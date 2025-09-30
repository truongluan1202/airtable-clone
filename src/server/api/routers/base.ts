import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { randomUUID } from "crypto";

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

      // Use transaction for atomic operations
      await ctx.prisma.$transaction(async (tx: any) => {
        // Pre-generate row IDs
        const rowIds = Array.from({ length: 5 }, () => randomUUID());

        // Create rows with pre-generated IDs
        const sampleRows = rowIds.map((id) => ({
          id,
          tableId: table.id,
          cache: {},
          search: "",
        }));

        await tx.row.createMany({
          data: sampleRows,
        });

        // Pre-generate all cell data and cache
        const cells = [];
        const rowUpdates = [];

        for (let i = 0; i < 5; i++) {
          const rowId = rowIds[i];
          const cache: Record<string, string | number | null> = {};
          const searchTexts: string[] = [];

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

          // Prepare row update data
          rowUpdates.push({
            id: rowId,
            cache,
            search: searchTexts.join(" "),
          });
        }

        // Bulk create cells
        await tx.cell.createMany({
          data: cells,
          skipDuplicates: true,
        });

        // Bulk update rows with cache and search data
        await Promise.all(
          rowUpdates.map((update) =>
            tx.row.update({
              where: { id: update.id },
              data: {
                cache: update.cache,
                search: update.search,
              },
            }),
          ),
        );
      });

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
