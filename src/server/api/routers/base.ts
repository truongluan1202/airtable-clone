import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
  // Get all bases for the current user
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.base.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      include: {
        workspace: true,
        tables: {
          include: {
            _count: {
              select: {
                rows: true,
                columns: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  // Get all bases for a specific workspace
  getByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.base.findMany({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        include: {
          workspace: true,
          tables: {
            include: {
              _count: {
                select: {
                  rows: true,
                  columns: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),

  // Get a single base by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.prisma.base.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          workspace: true,
          tables: {
            include: {
              columns: true,
              _count: {
                select: {
                  rows: true,
                },
              },
            },
          },
        },
      });

      if (!base) {
        throw new Error("Base not found");
      }

      return base;
    }),

  // Create a new base
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        workspaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workspace ownership
      const workspace = await ctx.prisma.workspace.findFirst({
        where: {
          id: input.workspaceId,
          userId: ctx.session.user.id,
        },
      });

      if (!workspace) {
        throw new Error("Workspace not found");
      }

      // Create the base
      const base = await ctx.prisma.base.create({
        data: {
          name: input.name,
          description: input.description,
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
      });

      // Create a default table with sample data
      const table = await ctx.prisma.table.create({
        data: {
          name: "Table 1",
          description: "Default table",
          baseId: base.id,
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

      // Add sample data
      const { faker } = await import("@faker-js/faker");
      const sampleRows = Array.from({ length: 5 }, () => ({
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
            const cellValue = cell.vText ?? cell.vNumber;

            cache[column.id] = cellValue ?? null;
            if (cellValue) {
              searchTexts.push(String(cellValue));
            }
          }
        }

        await ctx.prisma.row.update({
          where: { id: row.id },
          data: {
            cache: cache,
            search: searchTexts.join(" "),
          },
        });
      }

      return base;
    }),

  // Update a base
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
      const base = await ctx.prisma.base.findFirst({
        where: {
          id,
          userId: ctx.session.user.id,
        },
      });

      if (!base) {
        throw new Error("Base not found");
      }

      return ctx.prisma.base.update({
        where: { id },
        data: updateData,
      });
    }),

  // Delete a base
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const base = await ctx.prisma.base.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });

      if (!base) {
        throw new Error("Base not found");
      }

      return ctx.prisma.base.delete({
        where: { id: input.id },
      });
    }),
});
