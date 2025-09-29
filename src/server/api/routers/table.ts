import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from "@faker-js/faker";

export const tableRouter = createTRPCRouter({
  // Get all tables for a base
  getByBaseId: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
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

      return ctx.prisma.table.findMany({
        where: {
          baseId: input.baseId,
        },
        include: {
          columns: {
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              rows: true,
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
            include: {
              cells: true,
            },
            orderBy: [
              {
                createdAt: "asc",
              },
              {
                id: "asc",
              },
            ],
          },
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      return table;
    }),

  // Get table data with cursor-based pagination for infinite scroll
  getByIdPaginated: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
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
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      // Get paginated rows
      const rows = await ctx.prisma.row.findMany({
        where: {
          tableId: input.id,
        },
        include: {
          cells: true,
        },
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        take: input.limit + 1, // Take one extra to check if there are more
        ...(input.cursor && {
          cursor: {
            id: input.cursor,
          },
          skip: 1, // Skip the cursor itself
        }),
      });

      // Check if there are more rows
      const hasMore = rows.length > input.limit;
      const nextCursor = hasMore ? rows[input.limit]?.id : null; // Use the extra row as next cursor

      // Remove the extra row if it exists
      const actualRows = hasMore ? rows.slice(0, input.limit) : rows;

      console.log("🔍 Pagination debug:", {
        inputLimit: input.limit,
        rowsReturned: rows.length,
        hasMore,
        nextCursor,
        actualRowsCount: actualRows.length,
        cursor: input.cursor,
      });

      return {
        table,
        rows: actualRows,
        nextCursor,
        hasMore,
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

      // Add sample data if requested
      if (input.withSampleData) {
        const sampleRows = Array.from({ length: 10 }, () => ({
          tableId: table.id,
          cache: {},
          search: "",
        }));

        await ctx.prisma.row.createMany({
          data: sampleRows,
        });

        // Get the created rows to add cells
        const createdRows = await ctx.prisma.row.findMany({
          where: { tableId: table.id },
        });

        // Create cells with sample data
        const cells = [];
        for (const row of createdRows) {
          for (const column of table.columns) {
            let value;
            if (column.type === "TEXT") {
              if (column.name.toLowerCase().includes("name")) {
                value = faker.person.fullName();
              } else if (column.name.toLowerCase().includes("email")) {
                value = faker.internet.email();
              } else {
                value = faker.lorem.words(2);
              }
            } else if (column.type === "NUMBER") {
              value = faker.number.int({ min: 1, max: 100 });
            }

            cells.push({
              rowId: row.id,
              columnId: column.id,
              vText: column.type === "TEXT" ? value : null,
              vNumber: column.type === "NUMBER" ? value : null,
            });
          }
        }

        await ctx.prisma.cell.createMany({
          data: cells,
        });

        // Update row cache and search
        for (const row of createdRows) {
          const rowCells = cells.filter((cell) => cell.rowId === row.id);
          const cache: Record<string, string | number | null> = {};
          const searchTexts: string[] = [];

          for (const cell of rowCells) {
            const column = table.columns.find(
              (col: { id: string }) => col.id === cell.columnId,
            );
            if (column) {
              const value = cell.vText ?? cell.vNumber;
              cache[column.id] = value ?? null;
              if (value) {
                searchTexts.push(String(value));
              }
            }
          }

          await ctx.prisma.row.update({
            where: { id: row.id },
            data: {
              cache,
              search: searchTexts.join(" "),
            },
          });
        }
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
      // Verify ownership
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.id,
          base: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!table) {
        throw new Error("Table not found");
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

      // For large datasets, use batch processing
      const batchSize = 1000;
      const totalBatches = Math.ceil(input.count / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, input.count);
        const batchCount = batchEnd - batchStart;

        // Create rows for this batch
        const sampleRows = Array.from({ length: batchCount }, () => ({
          tableId: table.id,
          cache: {},
          search: "",
        }));

        await ctx.prisma.row.createMany({
          data: sampleRows,
        });

        // Get the created rows for this batch
        const createdRows = await ctx.prisma.row.findMany({
          where: { tableId: table.id },
          orderBy: { createdAt: "desc" },
          take: batchCount,
        });

        // Create cells with sample data for this batch
        const cells = [];
        for (const row of createdRows) {
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
                // Create longer text content for testing truncation
                value = faker.lorem.paragraphs(1, "\n");
              } else if (column.type === "NUMBER") {
                value = faker.number.int({ min: 1, max: 1000 });
              }
            }

            cells.push({
              rowId: row.id,
              columnId: column.id,
              vText: column.type === "TEXT" ? value : null,
              vNumber: column.type === "NUMBER" ? value : null,
            });
          }
        }

        await ctx.prisma.cell.createMany({
          data: cells,
        });

        // Update row cache and search for this batch
        const rowUpdates = [];
        for (const row of createdRows) {
          const rowCells = cells.filter((cell) => cell.rowId === row.id);
          const cache: Record<string, string | number | null> = {};
          const searchTexts: string[] = [];

          for (const cell of rowCells) {
            const column = table.columns.find(
              (col: { id: string }) => col.id === cell.columnId,
            );
            if (column) {
              const value = cell.vText ?? cell.vNumber;
              cache[column.id] = value ?? null;
              if (value) {
                searchTexts.push(String(value));
              }
            }
          }

          rowUpdates.push({
            where: { id: row.id },
            data: {
              cache,
              search: searchTexts.join(" "),
            },
          });
        }

        // Batch update rows
        await Promise.all(
          rowUpdates.map((update) => ctx.prisma.row.update(update)),
        );
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
      // Verify ownership through table
      const table = await ctx.prisma.table.findFirst({
        where: {
          rows: {
            some: {
              id: input.rowId,
            },
          },
          base: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          columns: true,
        },
      });

      if (!table) {
        throw new Error("Table not found or access denied");
      }

      const column = table.columns.find(
        (col: { id: string }) => col.id === input.columnId,
      );
      if (!column) {
        throw new Error("Column not found");
      }

      // Update or create the cell
      const cell = await ctx.prisma.cell.upsert({
        where: {
          rowId_columnId: {
            rowId: input.rowId,
            columnId: input.columnId,
          },
        },
        update: {
          vText: column.type === "TEXT" ? String(input.value) : null,
          vNumber: column.type === "NUMBER" ? Number(input.value) : null,
        },
        create: {
          rowId: input.rowId,
          columnId: input.columnId,
          vText: column.type === "TEXT" ? String(input.value) : null,
          vNumber: column.type === "NUMBER" ? Number(input.value) : null,
        },
      });

      // Update the row cache and search
      const row = await ctx.prisma.row.findUnique({
        where: { id: input.rowId },
        include: { cells: true },
      });

      if (row) {
        const cache: Record<string, string | number | null> = {
          ...((row.cache as Record<string, string | number | null>) ?? {}),
        };
        const searchTexts: string[] = [];

        // Update cache for this column
        cache[input.columnId] = input.value;

        // Rebuild search text from all cells
        for (const cell of row.cells) {
          const cellValue = cell.vText ?? cell.vNumber;
          if (cellValue) {
            searchTexts.push(String(cellValue));
          }
        }

        await ctx.prisma.row.update({
          where: { id: input.rowId },
          data: {
            cache,
            search: searchTexts.join(" "),
          },
        });
      }

      return cell;
    }),

  // Add a new row
  addRow: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
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

      // Create the row
      const row = await ctx.prisma.row.create({
        data: {
          tableId: input.tableId,
          cache: {},
          search: "",
        },
      });

      // Create empty cells for all columns
      const cells = table.columns.map((column: { id: string }) => ({
        rowId: row.id,
        columnId: column.id,
        vText: null,
        vNumber: null,
      }));

      await ctx.prisma.cell.createMany({
        data: cells,
      });

      return row;
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
      // Verify ownership
      const table = await ctx.prisma.table.findFirst({
        where: {
          id: input.tableId,
          base: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          rows: true,
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      // Check if column name already exists
      const existingColumn = await ctx.prisma.column.findFirst({
        where: {
          tableId: input.tableId,
          name: input.name,
        },
      });

      if (existingColumn) {
        throw new Error(`Column "${input.name}" already exists in this table`);
      }

      // Create the column
      const column = await ctx.prisma.column.create({
        data: {
          name: input.name,
          type: input.type,
          tableId: input.tableId,
        },
      });

      // Create cells with sample data for all existing rows
      const cells = [];
      for (const row of table.rows) {
        let value;
        if (column.type === "TEXT") {
          if (column.name.toLowerCase().includes("name")) {
            value = faker.person.fullName();
          } else if (column.name.toLowerCase().includes("email")) {
            value = faker.internet.email();
          } else {
            value = faker.lorem.words(2);
          }
        } else if (column.type === "NUMBER") {
          value = faker.number.int({ min: 1, max: 100 });
        }

        cells.push({
          rowId: row.id,
          columnId: column.id,
          vText: column.type === "TEXT" ? value : null,
          vNumber: column.type === "NUMBER" ? value : null,
        });
      }

      await ctx.prisma.cell.createMany({
        data: cells,
      });

      // Update row cache to include the new column with generated data
      for (const row of table.rows) {
        const existingCache =
          (row.cache as Record<string, string | number | null>) ?? {};

        // Find the cell value for this row and column
        const cell = cells.find((c) => c.rowId === row.id);
        const cellValue = cell?.vText ?? cell?.vNumber ?? null;

        const updatedCache = {
          ...existingCache,
          [column.id]: cellValue,
        };

        // Update search text as well
        const existingSearch = row.search ?? "";
        const newSearchText = cellValue ? String(cellValue) : "";
        const updatedSearch = existingSearch
          ? `${existingSearch} ${newSearchText}`
          : newSearchText;

        await ctx.prisma.row.update({
          where: { id: row.id },
          data: {
            cache: updatedCache,
            search: updatedSearch.trim(),
          },
        });
      }

      return column;
    }),

  // Delete a row
  deleteRow: protectedProcedure
    .input(z.object({ rowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through table
      const table = await ctx.prisma.table.findFirst({
        where: {
          rows: {
            some: {
              id: input.rowId,
            },
          },
          base: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!table) {
        throw new Error("Table not found or access denied");
      }

      // Delete the row (cascade will delete cells)
      await ctx.prisma.row.delete({
        where: { id: input.rowId },
      });

      return { success: true };
    }),

  // Delete a column
  deleteColumn: protectedProcedure
    .input(z.object({ columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through table
      const table = await ctx.prisma.table.findFirst({
        where: {
          columns: {
            some: {
              id: input.columnId,
            },
          },
          base: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!table) {
        throw new Error("Table not found or access denied");
      }

      // Delete the column (cascade will delete cells)
      await ctx.prisma.column.delete({
        where: { id: input.columnId },
      });

      return { success: true };
    }),
});
