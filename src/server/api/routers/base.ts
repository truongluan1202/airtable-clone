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

      // Use transaction for atomic operations with optimized bulk creation
      await ctx.prisma.$transaction(
        async (tx: any) => {
          // Pre-generate row IDs
          const rowIds = Array.from({ length: 5 }, () => randomUUID());

          // Pre-generate all data in memory
          const sampleRows = [];
          const cells = [];

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
              .map(
                (cell) =>
                  `('${randomUUID()}', '${cell.rowId}', '${cell.columnId}', ${cell.vText ? `'${cell.vText.toString().replace(/'/g, "''")}'` : "NULL"}, ${cell.vNumber ?? "NULL"}, NOW(), NOW())`,
              )
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
