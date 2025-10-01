import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";
import { randomUUID } from "crypto";

export const tableRouter = createTRPCRouter({
  // Get all tables for a base
  getByBaseId: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use Prisma for better performance and maintainability
      return ctx.prisma.table.findMany({
        where: {
          baseId: input.baseId,
          base: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          _count: {
            select: {
              columns: true,
              rows: true,
            },
          },
          columns: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }),

  // Get a single table with data
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use Prisma for better performance and maintainability
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.id,
          base: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          base: true,
          columns: {
            orderBy: {
              createdAt: "asc",
            },
          },
          rows: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              cells: {
                orderBy: {
                  column: {
                    createdAt: "asc",
                  },
                },
              },
            },
          },
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      return table;
    }),

  // Get total row count for a table
  getRowCount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership and get row count in single query
      const result = await ctx.prisma.$queryRaw<
        Array<{ count: bigint; tableExists: boolean }>
      >`
        SELECT 
          COUNT(r.id) as count,
          CASE WHEN t.id IS NOT NULL THEN true ELSE false END as "tableExists"
        FROM "Row" r
        RIGHT JOIN "Table" t ON r."tableId" = t.id
        JOIN "Base" b ON t."baseId" = b.id
        WHERE t.id = ${input.id} AND b."userId" = ${ctx.session.user.id}
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

  // Get table data with cursor-based pagination for infinite scroll
  // getByIdPaginated: protectedProcedure
  //   .input(
  //     z.object({
  //       id: z.string(),
  //       limit: z.number().min(1).max(10000).default(10000), // Ultra-optimized for 100k rows
  //       cursor: z.string().nullish(),
  //     }),
  //   )
  //   .query(async ({ ctx, input }) => {
  //     const table = await ctx.prisma.table.findFirst({
  //       where: {
  //         id: input.id,
  //         base: {
  //           userId: ctx.session.user.id,
  //         },
  //       },
  //       include: {
  //         base: true,
  //         columns: {
  //           orderBy: {
  //             createdAt: "asc",
  //           },
  //         },
  //       },
  //     });

  //     if (!table) {
  //       throw new Error("Table not found");
  //     }

  //     // Get total count using raw SQL for better performance with large datasets
  //     const countResult = await ctx.prisma.$queryRaw<[{ count: bigint }]>`
  //       SELECT COUNT(*) as count FROM "Row" WHERE "tableId" = ${input.id}
  //     `;
  //     const totalCount = Number(countResult[0]?.count ?? 0);

  //     // Use raw SQL for all pagination - much more reliable for large datasets
  //     let rows: any[];

  //     if (input.cursor) {
  //       try {
  //         const [createdAt, id] = input.cursor.split(",");
  //         if (createdAt && id) {
  //           // Keyset pagination with raw SQL
  //           rows = await ctx.prisma.$queryRaw`
  //             SELECT id, "createdAt", cache
  //             FROM "Row"
  //             WHERE "tableId" = ${input.id}
  //               AND ("createdAt" > ${new Date(createdAt)} OR ("createdAt" = ${new Date(createdAt)} AND id > ${id}))
  //             ORDER BY "createdAt" ASC, id ASC
  //             LIMIT ${input.limit + 1}
  //           `;
  //         } else {
  //           // Invalid cursor, start from beginning
  //           console.warn(
  //             "Invalid cursor format, starting from beginning:",
  //             input.cursor,
  //           );
  //           rows = await ctx.prisma.$queryRaw`
  //             SELECT id, "createdAt", cache
  //             FROM "Row"
  //             WHERE "tableId" = ${input.id}
  //             ORDER BY "createdAt" ASC, id ASC
  //             LIMIT ${input.limit + 1}
  //           `;
  //         }
  //       } catch (error) {
  //         console.warn(
  //           "Cursor pagination failed, falling back to first page:",
  //           error,
  //         );
  //         // Fallback to first page
  //         rows = await ctx.prisma.$queryRaw`
  //           SELECT id, "createdAt", cache
  //           FROM "Row"
  //           WHERE "tableId" = ${input.id}
  //           ORDER BY "createdAt" ASC, id ASC
  //           LIMIT ${input.limit + 1}
  //         `;
  //       }
  //     } else {
  //       // First page - use raw SQL
  //       rows = await ctx.prisma.$queryRaw`
  //         SELECT id, "createdAt", cache
  //         FROM "Row"
  //         WHERE "tableId" = ${input.id}
  //         ORDER BY "createdAt" ASC, id ASC
  //         LIMIT ${input.limit + 1}
  //       `;
  //     }

  //     // Check if there are more rows
  //     const hasMore = rows.length > input.limit;
  //     let nextCursor: string | null = null;

  //     // Remove the extra row if it exists
  //     const actualRows = hasMore ? rows.slice(0, input.limit) : rows;

  //     // Create next cursor from the last row
  //     if (hasMore && actualRows.length > 0) {
  //       const lastRow = actualRows[actualRows.length - 1];
  //       nextCursor = `${lastRow.createdAt.toISOString()},${lastRow.id}`;
  //     }

  //     // Transform rows to flatter structure using cache
  //     const flattenedRows = actualRows.map((row: any) => ({
  //       id: row.id,
  //       createdAt: row.createdAt,
  //       // Use cache directly - much more efficient than cell lookups
  //       data: row.cache as Record<string, string | number | null>,
  //     }));

  //     return {
  //       table,
  //       rows: flattenedRows,
  //       nextCursor,
  //       hasMore,
  //       totalCount, // Include total count for progress tracking
  //     };
  //   }),
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
          const tableId = randomUUID();
          const nameColumnId = randomUUID();
          const emailColumnId = randomUUID();
          const ageColumnId = randomUUID();

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

          // Add sample data if requested
          if (input.withSampleData) {
            // Create 10 sample rows with raw SQL
            const sampleRowIds = Array.from({ length: 10 }, () => randomUUID());
            const rowValues = sampleRowIds
              .map(
                (rowId) => `('${rowId}', '${tableId}', '{}', '', NOW(), NOW())`,
              )
              .join(",");

            await tx.$executeRawUnsafe(`
            INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
            VALUES ${rowValues}
          `);

            // Create cells with sample data using raw SQL
            const cellValues = [];
            for (const rowId of sampleRowIds) {
              const name = faker.person.fullName();
              const email = faker.internet.email();
              const age = faker.number.int({ min: 1, max: 100 });

              cellValues.push(
                `('${randomUUID()}', '${rowId}', '${nameColumnId}', '${name.replace(/'/g, "''")}', NULL, NOW(), NOW())`,
                `('${randomUUID()}', '${rowId}', '${emailColumnId}', '${email.replace(/'/g, "''")}', NULL, NOW(), NOW())`,
                `('${randomUUID()}', '${rowId}', '${ageColumnId}', NULL, ${age}, NOW(), NOW())`,
              );
            }

            await tx.$executeRawUnsafe(`
            INSERT INTO "Cell" (id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
            VALUES ${cellValues.join(",")}
          `);

            // Update row cache and search with raw SQL
            for (const rowId of sampleRowIds) {
              const name = faker.person.fullName();
              const email = faker.internet.email();
              const age = faker.number.int({ min: 1, max: 100 });

              await tx.$executeRaw`
              UPDATE "Row" 
              SET 
                cache = jsonb_build_object(
                  ${nameColumnId}, ${name},
                  ${emailColumnId}, ${email},
                  ${ageColumnId}, ${age}
                ),
                search = ${`${name} ${email} ${age}`},
                "updatedAt" = NOW()
              WHERE id = ${rowId}
            `;
            }
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
      // Verify ownership and get table with columns
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.tableId,
          base: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          columns: true,
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      // Ultra-optimized bulk insertion for 20s 100k rows
      // Large batch size for maximum throughput
      // With ~200 bytes per row, 5000 rows ≈ 1MB, should complete in <30s
      const batchSize = 5000;
      const totalBatches = Math.ceil(input.count / batchSize);

      // High concurrency for maximum parallel processing
      const maxConcurrentBatches = 6;
      const batchPromises: Promise<void>[] = [];

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, input.count);
        const batchCount = batchEnd - batchStart;

        const batchPromise = ctx.prisma.$transaction(
          async (tx: any) => {
            // Pre-generate all row IDs to avoid extra queries
            const rowIds = Array.from({ length: batchCount }, () =>
              randomUUID(),
            );

            // Pre-generate all data in memory
            const sampleRows = [];
            const cells = [];

            for (let i = 0; i < batchCount; i++) {
              const rowId = rowIds[i];
              const cache: Record<string, string | number | null> = {};
              const searchTexts: string[] = [];

              for (const column of table.columns) {
                let value;
                if (column.name === "Name") {
                  value = faker.person.fullName();
                } else if (column.name === "Email") {
                  value = faker.internet.email();
                } else if (column.name === "Age") {
                  value = faker.number.int({ min: 18, max: 80 });
                } else {
                  // Generic data based on column type
                  if (column.type === "TEXT") {
                    value = faker.lorem.paragraphs(1, "\n");
                  } else if (column.type === "NUMBER") {
                    value = faker.number.int({ min: 1, max: 1000 });
                  }
                }

                // Add to cache and search
                cache[column.id] = value ?? null;
                if (value) {
                  searchTexts.push(String(value));
                }

                // Create cell data
                cells.push({
                  rowId,
                  columnId: column.id,
                  vText: column.type === "TEXT" ? value : null,
                  vNumber: column.type === "NUMBER" ? value : null,
                });
              }

              // Create row with cache and search data included
              sampleRows.push({
                id: rowId,
                tableId: table.id,
                cache,
                search: searchTexts.join(" "),
              });
            }

            // Ultra-fast raw SQL bulk insert for rows
            if (sampleRows.length > 0) {
              const rowValues = sampleRows
                .map(
                  (row) =>
                    `('${row.id}', '${row.tableId}', '${JSON.stringify(row.cache).replace(/'/g, "''")}', '${row.search.replace(/'/g, "''")}', NOW(), NOW())`,
                )
                .join(",");

              await tx.$executeRawUnsafe(`
                INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
                VALUES ${rowValues}
                ON CONFLICT (id) DO NOTHING
              `);
            }

            // Ultra-fast raw SQL bulk insert for cells
            if (cells.length > 0) {
              const cellValues = cells
                .map((cell) => {
                  const cellId = randomUUID();
                  return `('${cellId}', '${cell.rowId}', '${cell.columnId}', ${cell.vText ? `'${cell.vText.toString().replace(/'/g, "''")}'` : "NULL"}, ${cell.vNumber ?? "NULL"}, NOW(), NOW())`;
                })
                .join(",");

              await tx.$executeRawUnsafe(`
                INSERT INTO "Cell" (id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
                VALUES ${cellValues}
                ON CONFLICT ("rowId", "columnId") DO NOTHING
              `);
            }
          },
          {
            timeout: 30000, // 30 seconds timeout for ultra-large batches
          },
        );

        batchPromises.push(batchPromise);

        // Limit concurrency to avoid lock contention
        if (
          batchPromises.length >= maxConcurrentBatches ||
          batchIndex === totalBatches - 1
        ) {
          await Promise.all(batchPromises);
          batchPromises.length = 0; // Clear the array
        }
      }

      return { success: true, rowsAdded: input.count };
    }),

  // Update a cell value
  updateCell: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
        columnId: z.string(),
        value: z.union([z.string(), z.number()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership step by step for better debugging

      // 1. Check if column exists and get its type
      const columnResult = await ctx.prisma.$queryRaw<
        Array<{ columnType: string; tableId: string }>
      >`
        SELECT c.type as "columnType", c."tableId" as "tableId"
        FROM "Column" c
        WHERE c.id = ${input.columnId}
        LIMIT 1
      `;

      if (columnResult.length === 0) {
        throw new Error("Column not found");
      }

      const { columnType, tableId } = columnResult[0];

      // 2. Check if row exists and belongs to the same table
      const rowResult = await ctx.prisma.$queryRaw<
        Array<{ rowId: string; rowTableId: string }>
      >`
        SELECT r.id as "rowId", r."tableId" as "rowTableId"
        FROM "Row" r
        WHERE r.id = ${input.rowId}
        LIMIT 1
      `;

      if (rowResult.length === 0) {
        throw new Error("Row not found");
      }

      const { rowTableId } = rowResult[0];

      // 3. Verify table IDs match
      if (tableId !== rowTableId) {
        throw new Error("Row does not belong to the same table as column");
      }

      // 4. Check user ownership of the base
      const baseResult = await ctx.prisma.$queryRaw<
        Array<{ baseId: string; userId: string }>
      >`
        SELECT b.id as "baseId", b."userId" as "userId"
        FROM "Table" t
        JOIN "Base" b ON t."baseId" = b.id
        WHERE t.id = ${tableId}
        LIMIT 1
      `;

      if (baseResult.length === 0) {
        throw new Error("Base not found");
      }

      const { userId } = baseResult[0];

      if (userId !== ctx.session.user.id) {
        throw new Error("Table not found or access denied");
      }

      // Use raw SQL for efficient upsert and cache update
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Upsert cell with raw SQL
          await tx.$executeRaw`
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
        `;

          // Update row cache and search with raw SQL
          await tx.$executeRaw`
          UPDATE "Row" 
          SET 
            cache = cache || jsonb_build_object(${input.columnId}, ${input.value}),
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

          // Return the updated cell
          const cell = await tx.$queryRaw<
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
          SELECT id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt"
          FROM "Cell"
          WHERE "rowId" = ${input.rowId} AND "columnId" = ${input.columnId}
          LIMIT 1
        `;

          return cell[0];
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

      // Get columns separately
      const columnsResult = await ctx.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Column" WHERE "tableId" = ${input.tableId}
      `;

      // Use raw SQL for efficient row creation and cell insertion
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Generate new row ID
          const rowId = randomUUID();

          // Create row with raw SQL
          await tx.$executeRaw`
          INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
          VALUES (${rowId}, ${input.tableId}, '{}', '', NOW(), NOW())
        `;

          // Create empty cells for all columns with raw SQL
          if (columnsResult.length > 0) {
            const cellValues = columnsResult
              .map((col: any) => {
                const cellId = randomUUID();
                return `('${cellId}', '${rowId}', '${col.id}', NULL, NULL, NOW(), NOW())`;
              })
              .join(",");

            await tx.$executeRawUnsafe(`
            INSERT INTO "Cell" (id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
            VALUES ${cellValues}
            ON CONFLICT ("rowId", "columnId") DO NOTHING
          `);
          }

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
          timeout: 30000, // 30 seconds timeout for row creation with cells
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

      const { tableExists, duplicateColumn, rowCount } = ownershipResult[0];

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
          const columnId = randomUUID();

          // Create column with raw SQL
          await tx.$executeRaw`
          INSERT INTO "Column" (id, name, type, "tableId", "createdAt", "updatedAt")
          VALUES (${columnId}, ${input.name}, ${input.type}::"ColumnType", ${input.tableId}, NOW(), NOW())
        `;

          // Create empty cells for all existing rows with raw SQL
          if (Number(rowCount) > 0) {
            await tx.$executeRaw`
               INSERT INTO "Cell" (id, "rowId", "columnId", "vText", "vNumber", "createdAt", "updatedAt")
               SELECT gen_random_uuid(), id, ${columnId}, NULL, NULL, NOW(), NOW()
               FROM "Row"
               WHERE "tableId" = ${input.tableId}
               ON CONFLICT ("rowId", "columnId") DO NOTHING
             `;
          }

          // Update row cache with raw SQL - add null value for new column
          await tx.$executeRaw`
          UPDATE "Row" 
          SET 
            cache = cache || jsonb_build_object(${columnId}, null),
            "updatedAt" = NOW()
          WHERE "tableId" = ${input.tableId}
        `;

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
      // Use transaction for atomic column deletion and cache cleanup
      const result = await ctx.prisma.$transaction(
        async (tx: any) => {
          // Get table ID and verify ownership
          const tableResult = await tx.$queryRaw<Array<{ tableId: string }>>`
          SELECT t.id as "tableId"
          FROM "Table" t
          JOIN "Base" b ON t."baseId" = b.id
          JOIN "Column" c ON t.id = c."tableId"
          WHERE c.id = ${input.columnId} AND b."userId" = ${ctx.session.user.id}
          LIMIT 1
        `;

          if (tableResult.length === 0) {
            throw new Error("Table not found or access denied");
          }

          const { tableId } = tableResult[0];

          // Remove column from row cache with raw SQL
          await tx.$executeRaw`
          UPDATE "Row" 
          SET 
            cache = cache - ${input.columnId},
            "updatedAt" = NOW()
          WHERE "tableId" = ${tableId}
        `;

          // Delete the column (cascade will delete cells)
          const deleteResult = await tx.$executeRaw`
          DELETE FROM "Column" 
          WHERE id = ${input.columnId}
        `;

          return deleteResult;
        },
        {
          timeout: 30000, // 30 seconds timeout for column deletion with cache cleanup
        },
      );

      if (result === 0) {
        throw new Error("Column not found or access denied");
      }

      return { success: true };
    }),
});
