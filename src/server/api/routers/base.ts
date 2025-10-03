import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createId } from "@paralleldrive/cuid2";
import { faker } from "@faker-js/faker";

export const baseRouter = createTRPCRouter({
  // Get all bases for the current user - Simplified for performance
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const bases = await ctx.prisma.base.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        workspaceId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: {
            tables: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return bases;
  }),

  // Get all bases for a specific workspace - Simplified for performance
  getByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bases = await ctx.prisma.base.findMany({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          workspaceId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: {
              tables: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return bases;
    }),

  // Get a single base by ID - Simplified for performance
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.prisma.base.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          workspaceId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          tables: {
            select: {
              id: true,
              name: true,
              description: true,
              baseId: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  rows: true,
                  columns: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!base) {
        throw new Error("Base not found");
      }

      return base;
    }),

  // Create a new base with sample data
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        workspaceId: z.string(),
        withSampleData: z.boolean().default(true),
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

      // Create the base with default table
      const base = await ctx.prisma.base.create({
        data: {
          name: input.name,
          description: input.description,
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
          tables: {
            create: {
              name: "Table 1",
              description: "Default table",
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
          },
        },
        include: {
          tables: {
            include: {
              columns: true,
            },
          },
        },
      });

      // Add sample data if requested
      if (input.withSampleData && base.tables.length > 0) {
        const table = base.tables[0];

        // Create sample rows with optimized bulk insert
        const sampleRowIds = Array.from({ length: 5 }, () => createId());
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

        for (let i = 0; i < 5; i++) {
          const rowId = sampleRowIds[i];
          const cache: Record<string, string | number | null> = {};
          const searchTexts: string[] = [];

          for (const column of table.columns) {
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
              vNumber:
                column.type === "NUMBER" ? (value as number | null) : null,
            });
          }

          sampleRows.push({
            id: rowId!,
            tableId: table.id,
            cache: cache, // Keep as object, no JSON conversion
            search: searchTexts.join(" ").toLowerCase(),
          });
        }

        // Bulk insert rows and cells in a single transaction
        await ctx.prisma.$transaction(async (tx: any) => {
          // Insert rows
          await tx.row.createMany({
            data: sampleRows.map((row) => ({
              id: row.id,
              tableId: row.tableId,
              cache: row.cache, // Already an object, no parsing needed
              search: row.search,
            })),
          });

          // Insert cells
          await tx.cell.createMany({
            data: cells, // IDs already generated, no need to map
          });
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
