import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";
import { createId } from "@paralleldrive/cuid2";
import { from as copyFrom } from "pg-copy-streams";
import { env } from "~/env.js";
// helpers
const NULL = "\\N";
const q = (s: string) => `"${s.replace(/"/g, '""')}"`; // CSV quote, double internal quotes
const csvText = (v: string | null | undefined) => (v == null ? NULL : q(v));
const csvNum = (v: number | null | undefined) => (v == null ? NULL : String(v));

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = items.slice();
  const n = Math.min(concurrency, queue.length);
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) {
        const it = queue.shift()!;
        await worker(it);
      }
    }),
  );
}

export const tableRouter = createTRPCRouter({
  // Get all tables for a base - Optimized with raw SQL
  getByBaseId: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use raw SQL for better performance with new indexes
      const tables = await ctx.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          baseId: string;
          createdAt: Date;
          updatedAt: Date;
          columnCount: bigint;
          rowCount: bigint;
        }>
      >`
        SELECT 
          t.id,
          t.name,
          t.description,
          t."baseId",
          t."createdAt",
          t."updatedAt",
          COUNT(DISTINCT c.id) as "columnCount",
          COUNT(DISTINCT r.id) as "rowCount"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        LEFT JOIN "Column" c ON t.id = c."tableId"
        LEFT JOIN "Row" r ON t.id = r."tableId"
        WHERE t."baseId" = ${input.baseId} 
          AND b."userId" = ${ctx.session.user.id}
        GROUP BY t.id, t.name, t.description, t."baseId", t."createdAt", t."updatedAt"
        ORDER BY t."createdAt" ASC
      `;

      // Get columns separately for better performance (only if needed)
      const columns = await ctx.prisma.column.findMany({
        where: {
          table: {
            baseId: input.baseId,
            base: {
              userId: ctx.session.user.id,
            },
          },
        },
        select: {
          id: true,
          name: true,
          type: true,
          tableId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Group columns by tableId for efficient lookup
      const columnsByTableId = columns.reduce(
        (acc: Record<string, typeof columns>, col: any) => {
          acc[col.tableId] ??= [];
          acc[col.tableId].push(col);
          return acc;
        },
        {} as Record<string, typeof columns>,
      );

      // Combine tables with their columns
      return tables.map((table: any) => ({
        ...table,
        columnCount: Number(table.columnCount),
        rowCount: Number(table.rowCount),
        columns: columnsByTableId[table.id] ?? [],
      }));
    }),

  // Get total row count for a table - Optimized with indexes
  getRowCount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use optimized query with new indexes for better performance
      const result = await ctx.prisma.$queryRaw<
        Array<{ count: bigint; tableExists: boolean }>
      >`
        SELECT 
          COUNT(r.id) as count,
          CASE WHEN t.id IS NOT NULL THEN true ELSE false END as "tableExists"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        LEFT JOIN "Row" r ON t.id = r."tableId"
        WHERE t.id = ${input.id} 
          AND b."userId" = ${ctx.session.user.id}
        GROUP BY t.id
      `;

      if (result.length === 0) {
        throw new Error("Table not found");
      }

      const totalRows = Number(result[0]?.count ?? 0);

      return {
        totalRows,
      };
    }),

  // Get cached row count for a table - Ultra-fast for frequently accessed counts
  getRowCountCached: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // First try to get cached count from Table table (if we add a cachedRowCount column)
      // For now, use the optimized getRowCount query
      const result = await ctx.prisma.$queryRaw<
        Array<{ count: bigint; tableExists: boolean }>
      >`
        SELECT 
          COUNT(r.id) as count,
          CASE WHEN t.id IS NOT NULL THEN true ELSE false END as "tableExists"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        LEFT JOIN "Row" r ON t.id = r."tableId"
        WHERE t.id = ${input.id} 
          AND b."userId" = ${ctx.session.user.id}
        GROUP BY t.id
      `;

      if (result.length === 0) {
        throw new Error("Table not found");
      }

      const totalRows = Number(result[0]?.count ?? 0);

      return {
        totalRows,
        cached: false, // Will be true when we implement actual caching
      };
    }),

  // Get table data with cursor-based pagination for infinite scroll
  getByIdPaginated: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        // First page: 500 rows, subsequent pages: larger batches
        limit: z.number().min(1).max(100000).default(500),
        // cursor stays a string "ISODate,id" to avoid API change
        cursor: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1) Fetch table meta (unchanged to keep return shape stable)
      const table = await ctx.prisma.table.findFirst({
        where: { id: input.id, base: { userId: ctx.session.user.id } },
        include: {
          base: true,
          columns: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!table) throw new Error("Table not found");

      // 2) Total count using raw SQL (no 5MB limit)
      const countResult = await ctx.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM "Row"
        WHERE "tableId" = ${input.id}
      `;
      const totalCount = Number(countResult[0]?.count ?? 0);

      // 3) Dynamic page size: first page = 500, subsequent pages = ALL remaining rows
      const isFirstPage = !input.cursor;
      const dynamicLimit = isFirstPage ? 500 : totalCount - 500;

      // 4) Parse cursor safely: expected format "2025-01-01T00:00:00.000Z,<rowId>"
      let cursorCreatedAt: Date | null = null;
      let cursorId: string | null = null;
      if (input.cursor) {
        const [createdAtStr, idStr] = input.cursor.split(",");
        const d = createdAtStr ? new Date(createdAtStr) : null;
        if (d && !Number.isNaN(d.getTime()) && idStr) {
          cursorCreatedAt = d;
          cursorId = idStr;
        } else {
          // invalid cursor -> treat as first page
          cursorCreatedAt = null;
          cursorId = null;
        }
      }

      // 5) Keyset (tuple) pagination query with dynamic limit
      // Recommend index (run once):
      // CREATE INDEX CONCURRENTLY IF NOT EXISTS row_table_created_id_idx
      //   ON "Row" ("tableId", "createdAt", "id");
      let rows: { id: string; createdAt: Date; cache: any }[];

      if (cursorCreatedAt && cursorId) {
        // Use a tuple comparison for cleaner plans: ("createdAt", id) > (cursorCreatedAt, cursorId)
        rows = await ctx.prisma.$queryRaw<
          { id: string; createdAt: Date; cache: any }[]
        >`
          SELECT id, "createdAt", cache
          FROM "Row"
          WHERE "tableId" = ${input.id}
            AND ("createdAt", id) > (${cursorCreatedAt}, ${cursorId})
          ORDER BY "createdAt" ASC, id ASC
          LIMIT ${dynamicLimit + 1}
        `;
      } else {
        // First page using raw SQL (no 5MB limit)
        rows = await ctx.prisma.$queryRaw<
          { id: string; createdAt: Date; cache: any }[]
        >`
          SELECT id, "createdAt", cache
          FROM "Row"
          WHERE "tableId" = ${input.id}
          ORDER BY "createdAt" ASC, id ASC
          LIMIT ${dynamicLimit + 1}
        `;
      }

      // 6) Paging bookkeeping
      const hasMore = rows.length > dynamicLimit;
      const pageRows = hasMore ? rows.slice(0, dynamicLimit) : rows;

      // 6) Next cursor
      let nextCursor: string | null = null;
      const last = pageRows.at(-1);
      if (hasMore && last) {
        const iso =
          last.createdAt instanceof Date
            ? last.createdAt.toISOString()
            : new Date(last.createdAt as unknown as string).toISOString();
        nextCursor = `${iso},${last.id}`;
      }

      // 7) Flatten using cache (kept the same shape)
      const flattenedRows = pageRows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        data: (r.cache ?? {}) as Record<string, string | number | null>,
      }));

      return {
        table, // kept for compatibility
        rows: flattenedRows,
        nextCursor, // string "ISODate,id" (same as input format)
        hasMore,
        totalCount, // kept for compatibility
      };
    }),

  // Create a new table with default columns and sample data
  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        withSampleData: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify base ownership with raw SQL
      const baseResult = await ctx.prisma.$queryRaw<[{ id: string }]>`
        SELECT id FROM "Base" 
        WHERE id = ${input.baseId} AND "userId" = ${ctx.session.user.id}
        LIMIT 1
      `;

      if (baseResult.length === 0) {
        throw new Error("Base not found");
      }

      // Use raw SQL for efficient table and column creation
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Generate IDs
          const tableId = createId();
          const nameColumnId = createId();
          const emailColumnId = createId();
          const ageColumnId = createId();

          // Create table with raw SQL
          await tx.$executeRaw`
          INSERT INTO "Table" (id, name, description, "baseId", "createdAt", "updatedAt")
          VALUES (${tableId}, ${input.name}, ${input.description ?? null}, ${input.baseId}, NOW(), NOW())
        `;

          // Create default columns with raw SQL
          await tx.$executeRaw`
          INSERT INTO "Column" (id, name, type, "tableId", "createdAt", "updatedAt")
          VALUES 
            (${nameColumnId}, 'Name', 'TEXT', ${tableId}, NOW(), NOW()),
            (${emailColumnId}, 'Email', 'TEXT', ${tableId}, NOW(), NOW()),
            (${ageColumnId}, 'Age', 'NUMBER', ${tableId}, NOW(), NOW())
        `;

          // Add sample data if requested - Optimized with bulk operations
          if (input.withSampleData) {
            // Create 10 sample rows with bulk insert
            const sampleRowIds = Array.from({ length: 10 }, () => createId());
            const rowValues = sampleRowIds
              .map(
                (rowId) => `('${rowId}', '${tableId}', '{}', '', NOW(), NOW())`,
              )
              .join(",");

            await tx.$executeRawUnsafe(`
            INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
            VALUES ${rowValues}
          `);

            // Generate sample data once and reuse for both cells and cache
            const sampleData = sampleRowIds.map((rowId) => {
              const name = faker.person.fullName();
              const email = faker.internet.email();
              const age = faker.number.int({ min: 1, max: 100 });
              return { rowId, name, email, age };
            });

            // Create cells with bulk insert
            const cellValues = sampleData.flatMap(
              ({ rowId, name, email, age }) => [
                `('${createId()}', '${rowId}', '${nameColumnId}', '${name.replace(/'/g, "''")}', NULL, NOW(), NOW())`,
                `('${createId()}', '${rowId}', '${emailColumnId}', '${email.replace(/'/g, "''")}', NULL, NOW(), NOW())`,
                `('${createId()}', '${rowId}', '${ageColumnId}', NULL, ${age}, NOW(), NOW())`,
              ],
            );

            await tx.$executeRawUnsafe(`
            INSERT INTO "Cell" (id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
            VALUES ${cellValues.join(",")}
          `);

            // Update row cache and search with bulk operations
            const cacheUpdates = sampleData
              .map(
                ({ rowId, name, email, age }) =>
                  `('${rowId}', '${tableId}', jsonb_build_object('${nameColumnId}', '${name.replace(/'/g, "''")}', '${emailColumnId}', '${email.replace(/'/g, "''")}', '${ageColumnId}', ${age}), '${`${name} ${email} ${age}`.replace(/'/g, "''")}', NOW(), NOW())`,
              )
              .join(",");

            await tx.$executeRawUnsafe(`
            UPDATE "Row" 
            SET 
              cache = updates.cache,
              search = updates.search,
              "updatedAt" = updates."updatedAt"
            FROM (VALUES ${cacheUpdates}) AS updates(id, "tableId", cache, search, "updatedAt")
            WHERE "Row".id = updates.id
          `);
          }

          // Return the created table with columns
          const table = await tx.$queryRaw<
            Array<{
              id: string;
              name: string;
              description: string | null;
              baseId: string;
              createdAt: Date;
              updatedAt: Date;
            }>
          >`
          SELECT id, name, description, "baseId", "createdAt", "updatedAt"
          FROM "Table"
          WHERE id = ${tableId}
          LIMIT 1
        `;

          const columns = await tx.$queryRaw<
            Array<{
              id: string;
              name: string;
              type: string;
              tableId: string;
              createdAt: Date;
              updatedAt: Date;
            }>
          >`
          SELECT id, name, type, "tableId", "createdAt", "updatedAt"
          FROM "Column"
          WHERE "tableId" = ${tableId}
          ORDER BY "createdAt" ASC
        `;

          return {
            ...table[0],
            columns,
          };
        },
        {
          timeout: 30000, // 30 seconds timeout for table creation with sample data
        },
      );

      return result;
    }),

  // Update a table
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Verify ownership
      const table = await ctx.prisma.table.findFirst({
        where: {
          id,
          base: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      return ctx.prisma.table.update({
        where: { id },
        data: updateData,
      });
    }),

  // Delete a table
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and get table with base info
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.id,
          base: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          base: true,
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      // Check if this is the only table in the base
      const tableCount = await ctx.prisma.table.count({
        where: {
          baseId: table.baseId,
        },
      });

      if (tableCount <= 1) {
        throw new Error(
          "Cannot delete the last table in a base. A base must have at least one table.",
        );
      }

      return ctx.prisma.table.delete({
        where: { id: input.id },
      });
    }),

  // Add sample data to existing table
  addSampleData: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(100000).default(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1) Verify ownership & columns (via Prisma)
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.tableId,
          base: { userId: ctx.session.user.id },
        },
        include: { columns: true },
      });
      if (!table) throw new Error("Table not found");
      if (input.count <= 0) return { success: true, rowsAdded: 0 };

      // 2) Direct (non-pooled) writer URL for COPY
      const writerUrl = env.DIRECT_DATABASE_URL;

      // 3) Batching, parallelism
      const batchSize = 35000; // tune 10k–25k based on DB
      const totalBatches = Math.ceil(input.count / batchSize);
      const batches = Array.from({ length: totalBatches }, (_, i) => {
        const start = i * batchSize;
        const count = Math.min(batchSize, input.count - start);
        return { start, count };
      });
      const parallel = Math.min(4, totalBatches); // 2 parallel batches

      // Per-batch worker: COPY rows then cells in a single txn
      const processBatch = async (b: { start: number; count: number }) => {
        const { Client } = await import("pg");
        const client = new Client({ connectionString: writerUrl });
        await client.connect();

        try {
          await client.query("BEGIN");
          await client.query("SET LOCAL synchronous_commit = off");
          // optional: await client.query("SET LOCAL statement_timeout = '30s'");

          const nowIso = new Date().toISOString();
          const hasColumns = table.columns.length > 0;

          // --- COPY into "Row" ---
          const copyRowsSQL = `
          COPY "Row"(id, "tableId", cache, search, "createdAt", "updatedAt")
          FROM STDIN WITH (FORMAT csv, NULL '${NULL}')
        `;
          const rowStream = client.query(copyFrom(copyRowsSQL));

          // We'll stage cell lines while streaming rows (memory OK for 10k * (cols))
          const cellLines: string[] = [];

          for (let i = 0; i < b.count; i++) {
            const rowId = createId();
            const cache: Record<string, string | number | null> = {};
            const searchParts: string[] = [];

            if (hasColumns) {
              for (const column of table.columns) {
                let value: string | number | null = null;

                // short values for speed/size
                if (column.name === "Name") {
                  value = faker.person.firstName();
                } else if (column.name === "Email") {
                  value = faker.internet.email();
                } else if (column.name === "Age") {
                  value = faker.number.int({ min: 18, max: 80 });
                } else if (column.type === "TEXT") {
                  value = faker.lorem.word();
                } else if (column.type === "NUMBER") {
                  value = faker.number.int({ min: 1, max: 100 });
                }

                cache[column.id] = value;
                if (value != null && value !== "")
                  searchParts.push(String(value));

                // Stage a "Cell" CSV line
                const cellId = createId();
                const vText =
                  column.type === "TEXT" ? (value as string | null) : null;
                const vNumber =
                  column.type === "NUMBER" ? (value as number | null) : null;

                cellLines.push(
                  [
                    csvText(cellId),
                    csvText(rowId),
                    csvText(column.id),
                    csvText(vText),
                    csvNum(vNumber),
                    csvText(nowIso),
                    csvText(nowIso),
                  ].join(",") + "\n",
                );
              }
            }

            const search = searchParts.join(" ").toLowerCase();
            const rowLine =
              [
                csvText(rowId),
                csvText(table.id),
                csvText(JSON.stringify(cache)), // json text; column is jsonb
                csvText(search),
                csvText(nowIso),
                csvText(nowIso),
              ].join(",") + "\n";

            if (!rowStream.write(rowLine)) {
              await new Promise((res) => rowStream.once("drain", res));
            }
          }

          rowStream.end();
          await new Promise<void>((resolve, reject) => {
            rowStream.on("finish", resolve);
            rowStream.on("error", reject);
          });

          // --- COPY into "Cell" ---
          if (hasColumns && cellLines.length) {
            const copyCellsSQL = `
            COPY "Cell"(id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
            FROM STDIN WITH (FORMAT csv, NULL '${NULL}')
          `;
            const cellStream = client.query(copyFrom(copyCellsSQL));

            for (const line of cellLines) {
              if (!cellStream.write(line)) {
                await new Promise((res) => cellStream.once("drain", res));
              }
            }

            cellStream.end();
            await new Promise<void>((resolve, reject) => {
              cellStream.on("finish", resolve);
              cellStream.on("error", reject);
            });
          }

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

      await runWithConcurrency(batches, parallel, processBatch);

      return { success: true, rowsAdded: input.count };
    }),

  // Update a cell value - Optimized with single transaction
  updateCell: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
        columnId: z.string(),
        value: z.union([z.string(), z.number()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Use transaction for atomic operations with optimized queries
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // First, verify ownership and get column type
          const authResult = await tx.$queryRaw<
            Array<{ columnType: string; tableId: string }>
          >`
            SELECT 
              c.type as "columnType",
              c."tableId" as "tableId"
            FROM "Column" c
            JOIN "Table" t ON c."tableId" = t.id
            JOIN "Base" b ON t."baseId" = b.id
            JOIN "Row" r ON r.id = ${input.rowId}
            WHERE c.id = ${input.columnId}
              AND b."userId" = ${ctx.session.user.id}
              AND r."tableId" = c."tableId"
            LIMIT 1
          `;

          if (authResult.length === 0) {
            throw new Error("Table not found or access denied");
          }

          const { columnType } = authResult[0];

          // Upsert cell with proper typing
          const cellResult = await tx.$queryRaw<
            Array<{
              id: string;
              rowId: string;
              columnId: string;
              vText: string | null;
              vNumber: number | null;
              createdAt: Date;
              updatedAt: Date;
            }>
          >`
            INSERT INTO "Cell" (id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
            VALUES (
              gen_random_uuid(),
              ${input.rowId},
              ${input.columnId},
              ${columnType === "TEXT" ? String(input.value) : null},
              ${columnType === "NUMBER" ? Number(input.value) : null},
              NOW(),
              NOW()
            )
            ON CONFLICT ("rowId", "columnId") 
            DO UPDATE SET 
              "vText" = ${columnType === "TEXT" ? String(input.value) : null},
              "vNumber" = ${columnType === "NUMBER" ? Number(input.value) : null},
              "updatedAt" = NOW()
            RETURNING id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt"
          `;

          // Update row cache with proper jsonb typing and recompute search
          if (columnType === "NUMBER") {
            await tx.$executeRaw`
              UPDATE "Row" 
              SET 
                cache = jsonb_set(
                  COALESCE(cache, '{}'::jsonb),
                  ARRAY[${input.columnId}],
                  to_jsonb(${Number(input.value)}::numeric)
                ),
                search = (
                  SELECT string_agg(
                    COALESCE(c."vText"::text, c."vNumber"::text), 
                    ' '
                  )
                  FROM "Cell" c 
                  WHERE c."rowId" = ${input.rowId}
                ),
                "updatedAt" = NOW()
              WHERE id = ${input.rowId}
            `;
          } else {
            await tx.$executeRaw`
              UPDATE "Row" 
              SET 
                cache = jsonb_set(
                  COALESCE(cache, '{}'::jsonb),
                  ARRAY[${input.columnId}],
                  to_jsonb(${String(input.value)}::text)
                ),
                search = (
                  SELECT string_agg(
                    COALESCE(c."vText"::text, c."vNumber"::text), 
                    ' '
                  )
                  FROM "Cell" c 
                  WHERE c."rowId" = ${input.rowId}
                ),
                "updatedAt" = NOW()
              WHERE id = ${input.rowId}
            `;
          }

          return cellResult[0];
        },
        {
          timeout: 30000, // 30 seconds timeout for cell update with cache refresh
        },
      );

      return result;
    }),

  // Add a new row
  addRow: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership first
      const ownershipResult = await ctx.prisma.$queryRaw<
        [{ tableExists: boolean }]
      >`
        SELECT CASE WHEN t.id IS NOT NULL THEN true ELSE false END as "tableExists"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        WHERE t.id = ${input.tableId} AND b."userId" = ${ctx.session.user.id}
        LIMIT 1
      `;

      if (ownershipResult.length === 0 || !ownershipResult[0].tableExists) {
        throw new Error("Table not found");
      }

      // Use raw SQL for efficient row creation - no pre-creation of empty cells
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Generate new row ID
          const rowId = createId();

          // Create row with empty cache - cells will be created lazily when first edited
          await tx.$executeRaw`
          INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
          VALUES (${rowId}, ${input.tableId}, '{}', '', NOW(), NOW())
        `;

          // Return the created row
          const row = await tx.$queryRaw<
            Array<{
              id: string;
              tableId: string;
              cache: any;
              search: string;
              createdAt: Date;
              updatedAt: Date;
            }>
          >`
          SELECT id, "tableId", cache, search, "createdAt", "updatedAt"
          FROM "Row"
          WHERE id = ${rowId}
          LIMIT 1
        `;

          return row[0];
        },
        {
          timeout: 10000, // Reduced timeout since we're not creating cells
        },
      );

      return result;
    }),

  // Add a new column
  addColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(100),
        type: z.enum(["TEXT", "NUMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and check for duplicate column name in single query
      const ownershipResult = await ctx.prisma.$queryRaw<
        Array<{
          tableExists: boolean;
          duplicateColumn: boolean;
          rowCount: bigint;
        }>
      >`
        SELECT 
          CASE WHEN t.id IS NOT NULL THEN true ELSE false END as "tableExists",
          CASE WHEN c.id IS NOT NULL THEN true ELSE false END as "duplicateColumn",
          COUNT(r.id) as "rowCount"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        LEFT JOIN "Column" c ON t.id = c."tableId" AND c.name = ${input.name}
        LEFT JOIN "Row" r ON t.id = r."tableId"
        WHERE t.id = ${input.tableId} AND b."userId" = ${ctx.session.user.id}
        GROUP BY t.id, c.id
      `;

      if (ownershipResult.length === 0) {
        throw new Error("Table not found");
      }

      const { tableExists, duplicateColumn } = ownershipResult[0];

      if (!tableExists) {
        throw new Error("Table not found");
      }

      if (duplicateColumn) {
        throw new Error(`Column "${input.name}" already exists in this table`);
      }

      // Use raw SQL for efficient column creation and cell insertion
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Generate new column ID
          const columnId = createId();

          // Create column with raw SQL
          await tx.$executeRaw`
          INSERT INTO "Column" (id, name, type, "tableId", "createdAt", "updatedAt")
          VALUES (${columnId}, ${input.name}, ${input.type}::"ColumnType", ${input.tableId}, NOW(), NOW())
        `;

          // Lazy cell creation: Don't create cells upfront for large tables
          // Cells will be created on-demand when first accessed/edited
          // This makes add column O(1) instead of O(n) for large tables

          // No cache update needed - missing keys are treated as null at read time
          // This is the fastest approach for large tables

          // Return the created column
          const column = await tx.$queryRaw<
            Array<{
              id: string;
              name: string;
              type: string;
              tableId: string;
              createdAt: Date;
              updatedAt: Date;
            }>
          >`
          SELECT id, name, type, "tableId", "createdAt", "updatedAt"
          FROM "Column"
          WHERE id = ${columnId}
          LIMIT 1
        `;

          return column[0];
        },
        {
          timeout: 30000, // 30 seconds timeout for bulk operations
        },
      );

      return result;
    }),

  // Delete a row
  deleteRow: protectedProcedure
    .input(z.object({ rowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and delete row in single query
      const deleteResult = await ctx.prisma.$executeRaw`
        DELETE FROM "Row" 
        WHERE id = ${input.rowId}
          AND "tableId" IN (
            SELECT t.id 
            FROM "Table" t
            JOIN "Base" b ON t."baseId" = b.id
            WHERE b."userId" = ${ctx.session.user.id}
          )
      `;

      if (deleteResult === 0) {
        throw new Error("Table not found or access denied");
      }

      return { success: true };
    }),

  // Delete a column
  deleteColumn: protectedProcedure
    .input(z.object({ columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First, get table ID and verify ownership
      const tableResult = await ctx.prisma.$queryRaw<
        Array<{ tableId: string; rowCount: bigint }>
      >`
        SELECT t.id as "tableId", COUNT(r.id) as "rowCount"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        JOIN "Column" c ON t.id = c."tableId"
        LEFT JOIN "Row" r ON t.id = r."tableId"
        WHERE c.id = ${input.columnId} AND b."userId" = ${ctx.session.user.id}
        GROUP BY t.id
        LIMIT 1
      `;

      if (tableResult.length === 0) {
        throw new Error("Table not found or access denied");
      }

      const { tableId, rowCount } = tableResult[0];

      // Use batch processing for large tables to prevent timeouts
      const batchSize = 10000; // Process 10k rows at a time
      const totalRows = Number(rowCount);

      if (totalRows > batchSize) {
        // For large tables, use keyset pagination instead of OFFSET
        let lastCreatedAt: Date | null = null;
        let lastId: string | null = null;
        let processedRows = 0;

        while (processedRows < totalRows) {
          await ctx.prisma.$transaction(
            async (tx: any) => {
              // Use keyset pagination for better performance on large datasets
              const batchResult = await tx.$queryRaw<
                Array<{ id: string; createdAt: Date }>
              >`
                SELECT id, "createdAt"
                FROM "Row" 
                WHERE "tableId" = ${tableId}
                  AND (
                    ${lastCreatedAt}::timestamp IS NULL 
                    OR "createdAt" > ${lastCreatedAt}::timestamp
                    OR ("createdAt" = ${lastCreatedAt}::timestamp AND id > ${lastId}::text)
                  )
                ORDER BY "createdAt", id
                LIMIT ${batchSize}
              `;

              if (batchResult.length === 0) {
                processedRows = totalRows; // Exit the while loop
                return;
              }

              // Update cache for this batch
              const batchIds = batchResult.map(
                (r: { id: string; createdAt: Date }) => r.id,
              );
              await tx.$executeRaw`
                UPDATE "Row" 
                SET 
                  cache = cache - ${input.columnId},
                  "updatedAt" = NOW()
                WHERE "tableId" = ${tableId}
                  AND id = ANY(${batchIds})
              `;

              // Update keyset for next iteration
              const lastRow = batchResult[batchResult.length - 1];
              lastCreatedAt = lastRow.createdAt;
              lastId = lastRow.id;
              processedRows += batchResult.length;
            },
            {
              timeout: 15000, // 15 seconds per batch
            },
          );

          // Small delay between batches to prevent lock contention
          if (processedRows < totalRows) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      } else {
        // For small tables, process all at once
        await ctx.prisma.$transaction(
          async (tx: any) => {
            // Remove column from row cache
            await tx.$executeRaw`
              UPDATE "Row" 
              SET 
                cache = cache - ${input.columnId},
                "updatedAt" = NOW()
              WHERE "tableId" = ${tableId}
            `;
          },
          {
            timeout: 15000,
          },
        );
      }

      // Finally, delete the column (cascade will delete cells)
      const deleteResult = await ctx.prisma.$executeRaw`
        DELETE FROM "Column" 
        WHERE id = ${input.columnId}
      `;

      if (deleteResult === 0) {
        throw new Error("Column not found or access denied");
      }

      return { success: true };
    }),
});
