import { faker } from "@faker-js/faker";
import { createId } from "@paralleldrive/cuid2";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";

export interface TableColumn {
  id: string;
  name: string;
  type: string;
}

export interface SampleDataOptions {
  tableId: string;
  columns: TableColumn[];
  count?: number;
  useFaker?: boolean; // Use faker.js for simple cases, deterministic for bulk
}

export class SampleDataService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate simple sample data for table creation (5 rows using faker.js)
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
        let value;
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
        if (value) {
          searchTexts.push(String(value));
        }

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
        tableId: tableId,
        cache: cache,
        search: searchTexts.join(" ").toLowerCase(),
      });
    }

    // Bulk insert rows and cells in a single transaction
    await this.prisma.$transaction(async (tx: any) => {
      // Insert rows
      await tx.row.createMany({
        data: sampleRows.map((row) => ({
          id: row.id,
          tableId: row.tableId,
          cache: row.cache,
          search: row.search,
        })),
      });

      // Insert cells
      await tx.cell.createMany({
        data: cells,
      });
    });
  }
  /**
   * Stream only row IDs; compute values in PG using md5(rowId||columnId)
   *
   * PERFORMANCE NOTES:
   * - Indexes on "Cell" table are the #1 performance bottleneck
   * - This method temporarily drops Cell indexes during bulk insert
   * - 100k rows × 20 columns = 2M Cell inserts
   * - Realistic performance: 20-40s only if indexes are off and DB has enough I/O/CPU
   * - Parallel = 1 for safety; try 2 if your DB is beefy
   * - Uses session_replication_role = replica to bypass FK checks (if allowed)
   */
  async generateBulkSampleData(options: SampleDataOptions): Promise<{
    success: boolean;
    rowsAdded: number;
    status?: string;
    message?: string;
  }> {
    const { tableId, count = 100 } = options;
    if (count <= 0) return { success: true, rowsAdded: 0 };

    const writerUrl = process.env.DIRECT_DATABASE_URL!;
    const batchSize = 100_000;
    const totalBatches = Math.ceil(count / batchSize);
    const batches = Array.from({ length: totalBatches }, (_, i) => {
      const start = i * batchSize;
      return { start, count: Math.min(batchSize, count - start) };
    });
    const parallel = 1; // Start with 1 for safety; try 2 if DB is beefy

    // Get table columns for data generation and cell count calculation
    const table = await this.prisma.table.findFirst({
      where: { id: tableId },
      include: { columns: { orderBy: { createdAt: "asc" } } },
    });
    if (!table) throw new Error("Table not found");

    const columns = table.columns;
    if (columns.length === 0) return { success: true, rowsAdded: 0 };

    // Calculate total cell count (rows × columns) to determine if index dropping is needed
    const totalCells = count * columns.length;
    const shouldDropIndexes = totalCells >= 1_000_000; // Only drop indexes for 1M+ cells

    console.log(
      `Total cells to insert: ${totalCells.toLocaleString()} (${count} rows × ${columns.length} columns)`,
    );
    console.log(
      `Index dropping: ${shouldDropIndexes ? "ENABLED" : "SKIPPED"} (threshold: 1M cells)`,
    );

    // Handle index operations outside of transaction (CONCURRENTLY requires this)
    const droppedIndexes: string[] = [];

    if (shouldDropIndexes) {
      const indexClient = new Client({ connectionString: writerUrl });
      await indexClient.connect();

      try {
        // Drop Cell table indexes temporarily (major performance bottleneck)
        // Only for large datasets where the overhead is worth it
        const cellIndexes = await indexClient.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'Cell' AND schemaname = 'public'
        `);

        for (const idx of cellIndexes.rows) {
          if (
            idx.indexname !== "Cell_pkey" &&
            idx.indexname !== "Cell_rowId_columnId_key"
          ) {
            // Keep primary key and unique constraint
            try {
              await indexClient.query(
                `DROP INDEX CONCURRENTLY IF EXISTS "${idx.indexname}"`,
              );
              droppedIndexes.push(idx.indexname);
              console.log(`Dropped index: ${idx.indexname}`);
            } catch (e) {
              console.warn(`Could not drop index ${idx.indexname}:`, e);
            }
          } else {
            console.log(`Keeping constraint/index: ${idx.indexname}`);
          }
        }
      } finally {
        await indexClient.end();
      }
    } else {
      console.log(
        `Skipping index operations for ${totalCells.toLocaleString()} cells (below 1M threshold)`,
      );
    }

    const processBatch = async (b: { start: number; count: number }) => {
      const client = new Client({ connectionString: writerUrl });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL synchronous_commit = off");
        await client.query("SET LOCAL wal_compression = on");

        // CRITICAL: Disable FK checks for massive performance gain
        // This bypasses per-row FK validation
        try {
          await client.query("SET LOCAL session_replication_role = replica");
        } catch (e) {
          // Some providers forbid this; continue without it
          console.warn("Could not set session_replication_role = replica:", e);
        }

        // Pure single SQL: generate row IDs, data, cache, search, and insert everything
        await client.query(
          `
WITH 
  -- Generate row IDs using deterministic sequence (no COPY needed)
  row_ids AS (
    SELECT 
      md5('${tableId}' || ':' || generate_series($2::int, ($2 + $3 - 1)::int)) as id,
      generate_series($2::int, ($2 + $3 - 1)::int) as seq
  ),
  -- Get column definitions
  cols AS (
    SELECT c.id, c.name, c.type
    FROM "Column" c
    WHERE c."tableId" = $1
  ),
  -- Generate all row-column combinations with deterministic hashing
  vals AS (
    SELECT
      r.id AS row_id,
      c.id AS column_id,
      c.name,
      c.type,
      md5(r.id || ':' || c.id) AS hash_str
    FROM row_ids r
    CROSS JOIN cols c
  ),
-- Convert first 8 hex chars to 32-bit int
hashed AS (
  SELECT
    row_id,
    column_id,
    name,
    type,
    ('x' || substr(hash_str, 1, 8))::bit(32)::int AS h32
  FROM vals
),
computed AS (
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
),
ins_rows AS (
  INSERT INTO "Row"(id, "tableId", cache, search, "createdAt", "updatedAt")
  SELECT
    r.id,
    $1::text,
    jsonb_object_agg(c.column_id,
      COALESCE(to_jsonb(c.v_text), to_jsonb(c.v_number), 'null'::jsonb)
    ) AS cache,
    lower(string_agg(COALESCE(c.v_text, c.v_number::text, ''), ' ')) AS search,
    now(), now()
  FROM row_ids r
  JOIN computed c ON c.row_id = r.id
  GROUP BY r.id
  RETURNING 1
)
INSERT INTO "Cell"(id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
SELECT
  md5(clock_timestamp()::text || row_id || column_id), -- text id; use gen_random_uuid() if you prefer uuid
  row_id,
  column_id,
  v_text,
  v_number,
  now(),
  now()
FROM computed;
          `,
          [tableId, b.start, b.count],
        );

        await client.query("COMMIT");
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw err;
      } finally {
        try {
          await client.end();
        } catch {}
      }
    };

    // tiny runner
    const runWithConcurrency = async <T>(
      items: T[],
      concurrency: number,
      worker: (item: T) => Promise<void>,
    ) => {
      const q = items.slice();
      const n = Math.min(concurrency, q.length);
      await Promise.all(
        Array.from({ length: n }, async () => {
          while (q.length) await worker(q.shift()!);
        }),
      );
    };

    await runWithConcurrency(batches, parallel, processBatch);

    // Recreate dropped indexes for normal operation (outside transaction)
    // Start index recreation in background - don't wait for completion
    if (shouldDropIndexes && droppedIndexes.length > 0) {
      console.log(
        `Starting background recreation of ${droppedIndexes.length} indexes...`,
      );

      // Don't await this - let it run in background
      recreateIndexesInBackground(droppedIndexes, writerUrl).catch((error) => {
        console.error("Background index recreation failed:", error);
      });
    } else if (!shouldDropIndexes) {
      console.log("No index recreation needed (indexes were not dropped)");
    }

    // Ensure the unique constraint exists (critical for updateCell operations)
    const constraintClient = new Client({ connectionString: writerUrl });
    await constraintClient.connect();

    try {
      const constraintExists = await constraintClient.query(`
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Cell_rowId_columnId_key' AND contype = 'u'
      `);

      if (constraintExists.rows.length === 0) {
        console.log(
          "Creating missing unique constraint: Cell_rowId_columnId_key",
        );
        await constraintClient.query(`
          ALTER TABLE "Cell" ADD CONSTRAINT "Cell_rowId_columnId_key" 
          UNIQUE ("rowId", "columnId")
        `);
        console.log("Unique constraint created successfully");
      } else {
        console.log("Unique constraint Cell_rowId_columnId_key already exists");
      }
    } catch (e) {
      console.warn("Could not create unique constraint:", e);
    } finally {
      await constraintClient.end();
    }

    return {
      success: true,
      rowsAdded: count,
      status: "completed",
      message: shouldDropIndexes
        ? `Successfully added ${count} rows. Indexes are being rebuilt in the background for optimal performance.`
        : `Successfully added ${count} rows. No index optimization needed for this dataset size.`,
    };
  }
}

// Background index recreation function
async function recreateIndexesInBackground(
  droppedIndexes: string[],
  writerUrl: string,
) {
  const recreateClient = new Client({ connectionString: writerUrl });
  await recreateClient.connect();

  try {
    console.log(`Recreating ${droppedIndexes.length} indexes in background...`);

    // Recreate indexes in parallel for faster completion
    const recreatePromises = droppedIndexes.map(async (indexName) => {
      try {
        // Recreate common Cell indexes based on naming patterns
        if (indexName.includes("rowId") && indexName.includes("columnId")) {
          await recreateClient.query(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "Cell" ("rowId", "columnId")`,
          );
        } else if (indexName.includes("rowId")) {
          await recreateClient.query(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "Cell" ("rowId")`,
          );
        } else if (indexName.includes("columnId")) {
          await recreateClient.query(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "Cell" ("columnId")`,
          );
        } else {
          // For custom indexes, you may need to manually recreate them
          console.warn(
            `Could not automatically recreate index: ${indexName} - please recreate manually if needed`,
          );
        }
        console.log(`Recreated index: ${indexName}`);
      } catch (e) {
        console.warn(`Could not recreate index ${indexName}:`, e);
      }
    });

    await Promise.all(recreatePromises);
    console.log("Background index recreation completed");
  } finally {
    await recreateClient.end();
  }
}

export function createSampleDataService(prisma: PrismaClient) {
  return new SampleDataService(prisma);
}
