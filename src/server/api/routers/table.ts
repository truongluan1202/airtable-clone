import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createId } from "@paralleldrive/cuid2";
import { createSampleDataService } from "~/server/services/sampleDataService";

// Utility function for retrying operations with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  shouldRetry: (error: any) => boolean,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      const delay = Math.min(100 * Math.pow(2, attempt), 2000);
      // Retrying operation with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
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
        throw new Error("Table not found or access denied");
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
      // Verify base ownership
      const base = await ctx.prisma.base.findFirst({
        where: {
          id: input.baseId,
          userId: ctx.session.user.id,
        },
      });

      if (!base) {
        throw new Error("Base not found");
      }

      // Create table with default columns
      const table = await ctx.prisma.table.create({
        data: {
          name: input.name,
          description: input.description,
          baseId: input.baseId,
          columns: {
            create: [
              {
                name: "Name",
                type: "TEXT",
              },
              {
                name: "Email",
                type: "TEXT",
              },
              {
                name: "Age",
                type: "NUMBER",
              },
            ],
          },
        },
        include: {
          columns: true,
        },
      });

      // Create default "Grid view" for the new table
      await ctx.prisma.view.create({
        data: {
          name: "Grid view",
          tableId: table.id,
          filters: null,
          sort: null,
          columns: null,
          search: null,
        },
      });

      // Add sample data if requested using the dedicated service
      if (input.withSampleData) {
        const sampleDataService = createSampleDataService(ctx.prisma);
        await sampleDataService.generateSimpleSampleData({
          tableId: table.id,
          columns: table.columns.map((col: any) => ({
            id: col.id,
            name: col.name,
            type: col.type,
          })),
          count: 5,
          useFaker: true,
        });
      }

      return table;
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

  // Add sample data to existing table (Turbo mode + server-side bulk lock)
  addSampleData: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(100000).default(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership & load columns (via Prisma)
      const table = await ctx.prisma.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.session.user.id } },
        include: { columns: true },
      });
      if (!table) throw new Error("Table not found");
      if (input.count <= 0) return { success: true, rowsAdded: 0 };

      // ---- Server-side bulk lock (soft lock via DB row) ----
      const lockKey = `bulk_lock_${input.tableId}`;
      // Dynamic expiry: ~10 min per 100k rows, min 5 min
      const minutes = Math.max(5, Math.ceil(input.count / 100000) * 10);
      const lockExpiry = new Date(Date.now() + minutes * 60 * 1000);

      try {
        // Create or refresh the lock
        await ctx.prisma.$executeRaw`
      INSERT INTO "BulkLock" (id, "tableId", "expiresAt", "createdAt")
      VALUES (${lockKey}, ${input.tableId}, ${lockExpiry}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET "expiresAt" = EXCLUDED."expiresAt"
    `;

        // Bulk lock active

        // ---- TURBO++ bulk insert: fastest path with no md5, no cross-join ----
        const sampleDataService = createSampleDataService(ctx.prisma);
        const result = await sampleDataService.generateBulkSampleDataTurboPlus({
          tableId: table.id,
          columns: table.columns.map((col: any) => ({
            id: col.id,
            name: col.name,
            type: col.type as "TEXT" | "NUMBER",
          })),
          count: input.count,
          // Tune if DB is beefy:
          batchSize: 100_000, // try 150k–200k if memory is comfy
          parallel: 2, // try 3–4 on a beefy DB
        });

        return result;
      } finally {
        // Always release the lock
        await ctx.prisma.$executeRaw`
      DELETE FROM "BulkLock" WHERE id = ${lockKey}
    `;
        // Bulk lock released
      }
    }),

  // Check if view updates are disabled due to bulk operations
  checkBulkLock: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.prisma.$queryRaw<
        Array<{ id: string; expiresAt: Date }>
      >`
    SELECT id, "expiresAt"
    FROM "BulkLock"
    WHERE "tableId" = ${input.tableId}
      AND "expiresAt" > NOW()
    LIMIT 1
  `;

      if (row.length === 0) {
        return { isLocked: false, lockInfo: null };
      }

      const expiresAt = row[0].expiresAt;
      const expiresIn = Math.max(0, expiresAt.getTime() - Date.now());

      return {
        isLocked: true,
        lockInfo: {
          id: row[0].id,
          expiresAt,
          expiresIn,
        },
      };
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
            WHERE c.id = ${input.columnId}
              AND b."userId" = ${ctx.session.user.id}
            LIMIT 1
          `;

          if (authResult.length === 0) {
            throw new Error("Table not found or access denied");
          }

          const { columnType, tableId } = authResult[0];

          // Ensure the row exists - create it if it doesn't
          await tx.$executeRaw`
            INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
            VALUES (
              ${input.rowId},
              ${tableId},
              '{}'::jsonb,
              '',
              NOW(),
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              "updatedAt" = NOW()
          `;

          // Verify the row exists before proceeding with cell insert
          const rowExists = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Row" WHERE id = ${input.rowId}
          `;

          if (rowExists.length === 0) {
            throw new Error(
              `Row with id ${input.rowId} does not exist and could not be created`,
            );
          }

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
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string().optional(), // Allow client to provide row ID
      }),
    )
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

      // Use raw SQL for efficient row creation - ensure cache includes all current columns
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Lock the table to prevent concurrent column addition
          await tx.$executeRaw`SELECT * FROM "Table" WHERE id = ${input.tableId} FOR UPDATE`;

          // Use provided row ID or generate new one
          const rowId = input.rowId ?? createId();

          // Get all current columns to initialize cache properly
          const columns = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Column" WHERE "tableId" = ${input.tableId}
          `;

          // Create initial cache with all current columns set to null
          const initialCache = columns.reduce(
            (acc: Record<string, null>, col: { id: string }) => ({
              ...acc,
              [col.id]: null,
            }),
            {},
          );
          const cacheJson = JSON.stringify(initialCache);

          // Create row with properly initialized cache (idempotent)
          await tx.$executeRaw`
          INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
          VALUES (${rowId}, ${input.tableId}, ${cacheJson}::jsonb, '', NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            "updatedAt" = NOW()
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
        columnId: z.string().optional(), // Allow client to provide column ID
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership in single query
      const ownershipResult = await ctx.prisma.$queryRaw<
        Array<{
          tableExists: boolean;
          rowCount: bigint;
        }>
      >`
        SELECT 
          CASE WHEN t.id IS NOT NULL THEN true ELSE false END as "tableExists",
          COUNT(r.id) as "rowCount"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        LEFT JOIN "Row" r ON t.id = r."tableId"
        WHERE t.id = ${input.tableId} AND b."userId" = ${ctx.session.user.id}
        GROUP BY t.id
      `;

      if (ownershipResult.length === 0) {
        return {
          success: false,
          error: "TABLE_NOT_FOUND",
          message: "Table not found or access denied",
          shouldRefetch: true,
        };
      }

      const { tableExists } = ownershipResult[0];

      if (!tableExists) {
        return {
          success: false,
          error: "TABLE_NOT_FOUND",
          message: "Table not found or access denied",
          shouldRefetch: true,
        };
      }

      // Use raw SQL for efficient column creation with deadlock retry
      const result = await retryWithBackoff(
        async () => {
          return await ctx.prisma.$transaction(
            async (tx: any) => {
              // Use provided column ID or generate new one
              const columnId = input.columnId ?? createId();

              // Create column with raw SQL (idempotent)
              await tx.$executeRaw`
              INSERT INTO "Column" (id, name, type, "tableId", "createdAt", "updatedAt")
              VALUES (${columnId}, ${input.name}, ${input.type}::"ColumnType", ${input.tableId}, NOW(), NOW())
              ON CONFLICT (id) DO NOTHING
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
        },
        3, // max retries
        (error) => error.message.includes("deadlock detected"),
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
        return {
          success: false,
          error: "TABLE_NOT_FOUND",
          message: "Table not found or access denied",
          shouldRefetch: true,
        };
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
          await retryWithBackoff(
            async () => {
              return await ctx.prisma.$transaction(
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
            },
            3, // max retries
            (error) => error.message.includes("deadlock detected"),
          );

          // Small delay between batches to prevent lock contention
          if (processedRows < totalRows) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      } else {
        // For small tables, process all at once with deadlock retry
        await retryWithBackoff(
          async () => {
            return await ctx.prisma.$transaction(
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
          },
          3, // max retries
          (error) => error.message.includes("deadlock detected"),
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

  // View-related endpoints
  // Get all views for a table
  getViews: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify table ownership
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.tableId,
          base: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      const views = await ctx.prisma.view.findMany({
        where: {
          tableId: input.tableId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return views;
    }),

  // Create a new view - Optimized with combined ownership check
  createView: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(100),
        filters: z.any().optional(),
        sort: z.any().optional(),
        columns: z.any().optional(),
        search: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Use transaction to combine ownership check and view creation
      const result = await ctx.prisma.$transaction(async (tx: any) => {
        // Verify table ownership with raw SQL for better performance
        const tableResult = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT t.id
          FROM "Table" t
          JOIN "Base" b ON t."baseId" = b.id
          WHERE t.id = ${input.tableId}
            AND b."userId" = ${ctx.session.user.id}
          LIMIT 1
        `;

        if (tableResult.length === 0) {
          throw new Error("Table not found");
        }

        // Create the view
        const view = await tx.view.create({
          data: {
            name: input.name,
            tableId: input.tableId,
            filters: input.filters,
            sort: input.sort,
            columns: input.columns,
            search: input.search,
          },
        });

        return view;
      });

      return result;
    }),

  // Update a view with patch-based optimistic concurrency control
  updateView: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        version: z.number(),
        patches: z.array(
          z.object({
            op: z.enum(["set", "merge"]),
            path: z.string(), // e.g., "filters", "sort", "columns", "search"
            value: z.any(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, version, patches } = input;

      // Check for bulk lock - skip view updates during bulk operations
      const bulkLock = await ctx.prisma.$queryRaw<
        Array<{ id: string; expiresAt: Date }>
      >`
        SELECT id, "expiresAt" FROM "BulkLock" 
        WHERE "tableId" = (SELECT "tableId" FROM "View" WHERE id = ${id})
          AND "expiresAt" > NOW()
        LIMIT 1
      `;

      if (bulkLock.length > 0) {
        // View update skipped due to bulk operation in progress
        return {
          id,
          version,
          message: "View update skipped during bulk operation",
        };
      }

      // CAS+rebase loop - retry with exponential backoff
      const maxRetries = 3;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          // Use transaction to ensure atomic patch application
          const result = await ctx.prisma.$transaction(async (tx: any) => {
            // First, get the current view with version check
            const currentView = await tx.view.findFirst({
              where: {
                id,
                version, // Only proceed if version matches (optimistic concurrency)
                table: {
                  base: {
                    userId: ctx.session.user.id, // Verify ownership
                  },
                },
              },
            });

            if (!currentView) {
              return {
                success: false,
                error: "CONFLICT",
                message: "View was modified by another process or not found",
                shouldRetry: true,
                id,
                version: input.version,
              };
            }

            // Apply patches to the current config
            // eslint-disable-next-line prefer-const
            let updatedConfig = {
              filters: currentView.filters,
              sort: currentView.sort,
              columns: currentView.columns,
              search: currentView.search,
            };

            for (const patch of patches) {
              if (patch.op === "set") {
                // Direct assignment
                (updatedConfig as any)[patch.path] = patch.value;
              } else if (patch.op === "merge") {
                // Merge with existing value
                const currentValue = (updatedConfig as any)[patch.path];
                if (Array.isArray(currentValue) && Array.isArray(patch.value)) {
                  // For arrays, replace the entire array
                  (updatedConfig as any)[patch.path] = patch.value;
                } else if (
                  typeof currentValue === "object" &&
                  typeof patch.value === "object"
                ) {
                  // For objects, merge
                  (updatedConfig as any)[patch.path] = {
                    ...currentValue,
                    ...patch.value,
                  };
                } else {
                  // For primitives, replace
                  (updatedConfig as any)[patch.path] = patch.value;
                }
              }
            }

            // Update the view with merged config and increment version
            const updatedView = await tx.view.update({
              where: { id },
              data: {
                filters: updatedConfig.filters,
                sort: updatedConfig.sort,
                columns: updatedConfig.columns,
                search: updatedConfig.search,
                version: { increment: 1 },
              },
              include: {
                table: {
                  include: {
                    base: true,
                  },
                },
              },
            });

            return {
              success: true,
              id: updatedView.id,
              version: updatedView.version,
              config: {
                filters: updatedView.filters,
                sort: updatedView.sort,
                columns: updatedView.columns,
                search: updatedView.search,
              },
            };
          });

          return result;
        } catch (error) {
          if (error instanceof Error && error.message.includes("CONFLICT")) {
            retryCount++;

            if (retryCount < maxRetries) {
              // Exponential backoff: 50ms, 100ms, 200ms
              const backoffMs = 50 * Math.pow(2, retryCount - 1);
              // CAS retry with exponential backoff

              // Get the latest version for the next attempt
              const latestView = await ctx.prisma.view.findFirst({
                where: {
                  id,
                  table: {
                    base: {
                      userId: ctx.session.user.id,
                    },
                  },
                },
                select: { version: true },
              });

              if (latestView) {
                // Update the version for the next retry
                input.version = latestView.version;
              }

              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }
          }

          // Re-throw if not a conflict or max retries reached
          throw error;
        }
      }

      // This should never be reached, but just in case
      throw new Error("CAS retry limit exceeded");
    }),

  // Test endpoint to simulate concurrent updates (for debugging)
  testConcurrentUpdate: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        version: z.number(),
        delay: z.number().optional().default(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { viewId, version, delay } = input;

      // Simulate a delay to test concurrent updates
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Try to update the view
      await ctx.prisma.view.updateMany({
        where: {
          id: viewId,
          version,
          table: {
            base: {
              userId: ctx.session.user.id,
            },
          },
        },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      // This should never be reached, but just in case
      throw new Error("CONFLICT: View update failed after maximum retries");
    }),

  // Delete a view - Optimized with raw SQL and default view protection
  deleteView: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Use raw SQL for better performance with proper indexing
      const viewResult = await ctx.prisma.$queryRaw<
        Array<{ id: string; name: string }>
      >`
        SELECT v.id, v.name
        FROM "View" v
        JOIN "Table" t ON v."tableId" = t.id
        JOIN "Base" b ON t."baseId" = b.id
        WHERE v.id = ${input.id}
          AND b."userId" = ${ctx.session.user.id}
        LIMIT 1
      `;

      if (viewResult.length === 0) {
        throw new Error("View not found");
      }

      // Prevent deletion of default "Grid view"
      if (viewResult[0].name === "Grid view") {
        throw new Error("Cannot delete the default Grid view");
      }

      await ctx.prisma.view.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
