import { faker } from "@faker-js/faker";
import { createId } from "@paralleldrive/cuid2";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";

export interface TableColumn {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER";
}

export interface SampleDataOptions {
  tableId: string;
  columns: TableColumn[];
  count?: number;
  useFaker?: boolean; // only for the tiny simple generator
}

export class SampleDataService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Tiny sample (5 rows) for table creation
   */
  async generateSimpleSampleData(options: SampleDataOptions): Promise<void> {
    const { tableId, columns = [], count = 5 } = options;

    const sampleRowIds = Array.from({ length: count }, () => createId());
    const sampleRows: Array<{
      id: string;
      tableId: string;
      cache: Record<string, string | number | null>;
      search: string;
    }> = [];
    const cells: Array<{
      id: string;
      rowId: string;
      columnId: string;
      vText: string | null;
      vNumber: number | null;
    }> = [];

    for (let i = 0; i < count; i++) {
      const rowId = sampleRowIds[i];
      const cache: Record<string, string | number | null> = {};
      const searchTexts: string[] = [];

      for (const column of columns) {
        let value: string | number | null = null;

        if (column.type === "TEXT") {
          if (column.name.toLowerCase().includes("name")) {
            value = faker.person.firstName();
          } else if (column.name.toLowerCase().includes("email")) {
            value = faker.internet.email();
          } else {
            value = faker.lorem.word();
          }
        } else if (column.type === "NUMBER") {
          value = faker.number.int({ min: 1, max: 100 });
        }

        cache[column.id] = value ?? null;
        if (value !== null && value !== undefined)
          searchTexts.push(String(value));

        cells.push({
          id: createId(),
          rowId: rowId!,
          columnId: column.id,
          vText: column.type === "TEXT" ? (value as string | null) : null,
          vNumber: column.type === "NUMBER" ? (value as number | null) : null,
        });
      }

      sampleRows.push({
        id: rowId!,
        tableId,
        cache,
        search: searchTexts.join(" ").toLowerCase(),
      });
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.row.createMany({
        data: sampleRows.map((row) => ({
          id: row.id,
          tableId: row.tableId,
          cache: row.cache,
          search: row.search,
        })),
      });

      // (For small seed only) also store cells
      await tx.cell.createMany({ data: cells });
    });
  }

  /**
   * TURBO BULK LOADER
   * - Writes ONLY into "Row" (cache jsonb). Zero writes to "Cell".
   * - Defers "search" computation to a single background UPDATE.
   * - Passes columns via UNNEST() to avoid scanning "Column" in every batch.
   * - Parallelizable with N writers; defaults tuned conservatively.
   */
  async generateBulkSampleDataTurbo(
    options: SampleDataOptions & {
      batchSize?: number;
      parallel?: number;
    },
  ): Promise<{
    success: boolean;
    rowsAdded: number;
    status?: string;
    message?: string;
  }> {
    const {
      tableId,
      columns,
      count = 100,
      batchSize = 50_000,
      parallel = 2,
    } = options;
    if (count <= 0) return { success: true, rowsAdded: 0 };

    const writerUrl = process.env.DIRECT_DATABASE_URL!;
    if (!writerUrl) throw new Error("DIRECT_DATABASE_URL is required");

    // Prepare column arrays once
    const colIds = columns.map((c) => c.id);
    const colNames = columns.map((c) => c.name);
    const colTypes = columns.map((c) => c.type);

    // Batch plan
    const totalBatches = Math.ceil(count / batchSize);
    const batches = Array.from({ length: totalBatches }, (_, i) => {
      const start = i * batchSize;
      return { start, count: Math.min(batchSize, count - start) };
    });

    // Worker that opens a single connection and processes many batches
    const worker = async (
      client: Client,
      b: { start: number; count: number },
    ) => {
      // One transaction per batch for back-pressure
      await client.query("BEGIN");
      try {
        // Cheap GUCs that are broadly allowed
        await client.query("SET LOCAL synchronous_commit = off");
        await client.query("SET LOCAL wal_compression = on");
        // (Optional) helps aggregation; may be ignored by some providers
        try {
          await client.query(`SET LOCAL work_mem = '64MB'`);
        } catch {}

        // NOTE: No "Cell" writes here. Everything goes to "Row". search=NULL (backfilled later)
        // Columns are passed by UNNEST to avoid touching "Column" table in SQL.
        await client.query(
          `
WITH cols AS (
  SELECT * FROM unnest($2::text[], $3::text[], $4::text[]) AS t(id, name, type)
), row_ids AS (
  -- Using UUIDs avoids any need to offset counts and guarantees uniqueness
  SELECT gen_random_uuid()::text AS id
  FROM generate_series($5::int, $5::int + $6::int - 1)
), vals AS (
  SELECT
    r.id AS row_id,
    c.id AS column_id,
    c.name,
    c.type,
    md5(r.id || ':' || c.id) AS hash_str
  FROM row_ids r
  CROSS JOIN cols c
), hashed AS (
  SELECT
    row_id, column_id, name, type,
    ('x' || substr(hash_str, 1, 8))::bit(32)::int AS h32
  FROM vals
), computed AS (
  SELECT
    row_id,
    column_id,
    CASE
      WHEN name = 'Name'
        THEN (ARRAY['Liam','Noah','Olivia','Emma','Ava','Mia','Amelia','Sophia','Isabella',
                    'James','Benjamin','Lucas','Henry','Alexander','Charlotte','Harper',
                    'Evelyn','Ella','Jack','Leo'])[1 + abs(h32) % 20]
      WHEN name = 'Email'
        THEN 'user' || (100000 + abs(h32) % 900000)::text || '@example.com'
      WHEN name = 'Age'
        THEN NULL
      WHEN type = 'TEXT'
        THEN (ARRAY['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel',
                    'india','juliet','kilo','lima','mike','november','oscar','papa',
                    'quebec','romeo','sierra','tango','uniform'])[1 + abs(h32) % 21]
      ELSE NULL
    END AS v_text,
    CASE
      WHEN name = 'Age'
        THEN 18 + abs(h32) % 63
      WHEN type = 'NUMBER'
        THEN 1 + abs(h32) % 100
      ELSE NULL
    END AS v_number
  FROM hashed
)
INSERT INTO "Row"(id, "tableId", cache, search, "createdAt", "updatedAt")
SELECT
  c.row_id,
  $1::text,
  jsonb_object_agg(c.column_id,
    COALESCE(to_jsonb(c.v_text), to_jsonb(c.v_number), 'null'::jsonb)
  ) AS cache,
  NULL,               -- defer search
  now(),
  now()
FROM computed c
GROUP BY c.row_id
ON CONFLICT (id) DO NOTHING
          `,
          [tableId, colIds, colNames, colTypes, b.start, b.count],
        );

        await client.query("COMMIT");
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw e;
      }
    };

    // Run with N writers; each writer reuses one connection
    const runWithConcurrency = async () => {
      const q = batches.slice();
      const n = Math.min(parallel, q.length || 1);

      await Promise.all(
        Array.from({ length: n }, async () => {
          const client = new Client({ connectionString: writerUrl });
          await client.connect();
          try {
            while (q.length) {
              const next = q.shift()!;
              await worker(client, next);
            }
          } finally {
            try {
              await client.end();
            } catch {}
          }
        }),
      );
    };

    await runWithConcurrency();

    // Backfill search in the background from cache (fast single UPDATE)
    backfillSearchFromCacheInBackground(tableId, writerUrl).catch((err) =>
      console.error("Background search backfill failed:", err),
    );

    // Optional (recommended) to make immediate reads snappy
    analyzeInBackground(writerUrl).catch((err) => {
      console.warn("Background analyze failed:", err);
    });

    return {
      success: true,
      rowsAdded: count,
      status: "completed",
      message:
        "Turbo mode: inserted rows with JSON cache only. Search is backfilling in background.",
    };
  }

  /**
   * Turbo++: fastest path
   * - No Cell writes
   * - No md5 hashing
   * - No cross join + jsonb_object_agg
   * - Per-row jsonb_build_object with light integer math
   */
  async generateBulkSampleDataTurboPlus(opts: {
    tableId: string;
    columns: TableColumn[];
    count?: number;
    batchSize?: number; // default 100k
    parallel?: number; // default 2 (try 3–4 if DB is beefy)
  }): Promise<{
    success: boolean;
    rowsAdded: number;
    status: string;
    message: string;
  }> {
    const {
      tableId,
      columns,
      count = 100,
      batchSize = 50_000,
      parallel = 2,
    } = opts;

    if (count <= 0 || columns.length === 0) {
      return {
        success: true,
        rowsAdded: 0,
        status: "completed",
        message: "No work",
      };
    }

    // Build a single jsonb_build_object(...) pair list once per batch:
    // key = $$<columnId>$$, value = to_jsonb(<fast expr depending on row number>)
    const names =
      "ARRAY['Liam','Noah','Olivia','Emma','Ava','Mia','Amelia','Sophia','Isabella','James','Benjamin','Lucas','Henry','Alexander','Charlotte','Harper','Evelyn','Ella','Jack','Leo']";
    const words =
      "ARRAY['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet','kilo','lima','mike','november','oscar','papa','quebec','romeo','sierra','tango','uniform']";

    const valueExprFor = (c: TableColumn, i: number) => {
      // Use only integer math on the row counter (s.n) to synthesize values quickly.
      // Different multipliers keep columns from repeating the same sequences.
      if (c.name === "Name") {
        return `(${names})[1 + (abs((s.n*17 + ${i}*31)) % 20)]`;
      }
      if (c.name === "Email") {
        return `('user' || (100000 + (abs((s.n*97 + ${i}*13)) % 900000))::text || '@example.com')`;
      }
      if (c.name === "Age") {
        return `(18 + (abs((s.n*53 + ${i}*7)) % 63))`;
      }
      if (c.type === "TEXT") {
        return `(${words})[1 + (abs((s.n*11 + ${i})) % 21)]`;
      }
      if (c.type === "NUMBER") {
        return `(1 + (abs((s.n*29 + ${i}*5)) % 100))`;
      }
      return "NULL";
    };

    const jsonPairs = columns
      .map((c, i) => `$$${c.id}$$, to_jsonb(${valueExprFor(c, i)})`)
      .join(",\n          ");

    const writerUrl = process.env.DIRECT_DATABASE_URL!;
    const totalBatches = Math.ceil(count / batchSize);
    const batches = Array.from({ length: totalBatches }, (_, idx) => {
      const start = idx * batchSize;
      return { start, count: Math.min(batchSize, count - start) };
    });

    console.log("Total batches:", totalBatches);
    console.log("Batches:", batches);
    console.log("Batch size:", batchSize);
    console.log("Parallel:", parallel);
    console.log("Count:", count);

    const insertOneBatch = async (
      client: Client,
      start: number,
      cnt: number,
    ) => {
      await client.query("BEGIN");
      try {
        // Per-transaction fast settings
        await client.query("SET LOCAL synchronous_commit = off");
        await client.query("SET LOCAL wal_compression = on");
        await client.query("SET LOCAL jit = off");
        // If allowed in your environment, this helps when FKs exist:
        try {
          await client.query("SET LOCAL session_replication_role = replica");
        } catch {}

        // Single INSERT .. SELECT for cnt rows
        const sql = `
          INSERT INTO "Row"(id, "tableId", cache, search, "createdAt", "updatedAt")
          SELECT
            gen_random_uuid()::text,
            $1::text,
            jsonb_build_object(
              ${jsonPairs}
            ) AS cache,
            NULL,
            now(),
            now()
          FROM generate_series($2::int, ($2 + $3 - 1)::int) AS s(n)
        `;
        await client.query(sql, [tableId, start + 1, cnt]);

        await client.query("COMMIT");
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw e;
      }
    };

    // True parallelism: each worker gets its own connection and processes batches
    const runWithConcurrency = async () => {
      const q = batches.slice();
      const n = Math.min(parallel, q.length);

      await Promise.all(
        Array.from({ length: n }, async () => {
          const client = new Client({ connectionString: writerUrl });
          await client.connect();
          try {
            while (q.length) {
              const batch = q.shift()!;
              await insertOneBatch(client, batch.start, batch.count);
            }
          } finally {
            try {
              await client.end();
            } catch {}
          }
        }),
      );
    };

    try {
      await runWithConcurrency();
    } finally {
      // No need to end client here since each worker manages its own
    }

    // Backfill search in the background from cache (fast single UPDATE)
    backfillSearchFromCacheInBackground(tableId, writerUrl).catch((err) =>
      console.error("Background search backfill failed:", err),
    );

    // Optional (recommended) to make immediate reads snappy
    analyzeInBackground(writerUrl).catch((err) => {
      console.warn("Background analyze failed:", err);
    });

    return {
      success: true,
      rowsAdded: count,
      status: "completed",
      message: `Inserted ${count} rows via Turbo++ (no md5, no cross-join, jsonb_build_object).`,
    };
  }
}

/** Compute Row.search from Row.cache in one pass (background) */
async function backfillSearchFromCacheInBackground(
  tableId: string,
  writerUrl: string,
) {
  const client = new Client({ connectionString: writerUrl });
  await client.connect();
  try {
    await client.query(
      `
      UPDATE "Row" r
      SET search = sub.s,
          "updatedAt" = now()
      FROM (
        SELECT
          id,
          lower(
            string_agg(
              NULLIF(
                CASE
                  WHEN jsonb_typeof(value) = 'string' THEN value::text
                  WHEN jsonb_typeof(value) = 'number' THEN (value::numeric)::text
                  ELSE ''
                END, ''
              ), ' '
            )
          ) AS s
        FROM (
          SELECT id, key, r.cache->key AS value
          FROM "Row" r
          CROSS JOIN LATERAL jsonb_object_keys(r.cache) AS key
          WHERE r."tableId" = $1 AND (r.search IS NULL OR r.search = '')
        ) kv
        GROUP BY id
      ) sub
      WHERE r.id = sub.id
    `,
      [tableId],
    );
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

/** Analyze to improve immediate read performance */
async function analyzeInBackground(writerUrl: string) {
  const client = new Client({ connectionString: writerUrl });
  await client.connect();
  try {
    await client.query(`ANALYZE "Row";`);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

export function createSampleDataService(prisma: PrismaClient) {
  return new SampleDataService(prisma);
}
