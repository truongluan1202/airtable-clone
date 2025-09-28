/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

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
        count: z.number().min(1).max(1000).default(100),
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

      // Create rows
      const sampleRows = Array.from({ length: input.count }, () => ({
        tableId: table.id,
        cache: {},
        search: "",
      }));

      await ctx.prisma.row.createMany({
        data: sampleRows,
      });

      // Get the created rows
      const createdRows = await ctx.prisma.row.findMany({
        where: { tableId: table.id },
        orderBy: { createdAt: "desc" },
        take: input.count,
      });

      // Create cells with sample data
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
              value = faker.lorem.words(2);
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
