import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const workspaceRouter = createTRPCRouter({
  // Get all workspaces for the current user - Optimized with raw SQL
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Use raw SQL for better performance with new indexes
    const workspaces = await ctx.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        description: string | null;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        baseCount: bigint;
        totalTables: bigint;
        totalRows: bigint;
        totalColumns: bigint;
      }>
    >`
      SELECT 
        w.id,
        w.name,
        w.description,
        w."userId",
        w."createdAt",
        w."updatedAt",
        COUNT(DISTINCT b.id) as "baseCount",
        COUNT(DISTINCT t.id) as "totalTables",
        COUNT(DISTINCT r.id) as "totalRows",
        COUNT(DISTINCT c.id) as "totalColumns"
      FROM "Workspace" w
      LEFT JOIN "Base" b ON w.id = b."workspaceId"
      LEFT JOIN "Table" t ON b.id = t."baseId"
      LEFT JOIN "Row" r ON t.id = r."tableId"
      LEFT JOIN "Column" c ON t.id = c."tableId"
      WHERE w."userId" = ${ctx.session.user.id}
      GROUP BY w.id, w.name, w.description, w."userId", w."createdAt", w."updatedAt"
      ORDER BY w."createdAt" DESC
    `;

    // Get bases separately for better performance (only if needed)
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
        _count: {
          select: {
            tables: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Get tables separately for better performance (only if needed)
    const tables = await ctx.prisma.table.findMany({
      where: {
        base: {
          userId: ctx.session.user.id,
        },
      },
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
    });

    // Group bases by workspaceId for efficient lookup
    const basesByWorkspaceId = bases.reduce(
      (acc: Record<string, typeof bases>, base: any) => {
        acc[base.workspaceId] ??= [];
        acc[base.workspaceId].push(base);
        return acc;
      },
      {} as Record<string, typeof bases>,
    );

    // Group tables by baseId for efficient lookup
    const tablesByBaseId = tables.reduce(
      (acc: Record<string, typeof tables>, table: any) => {
        acc[table.baseId] ??= [];
        acc[table.baseId].push(table);
        return acc;
      },
      {} as Record<string, typeof tables>,
    );

    // Combine workspaces with their bases and tables
    return workspaces.map((workspace: any) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      userId: workspace.userId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      bases: (basesByWorkspaceId[workspace.id] ?? []).map((base: any) => ({
        ...base,
        tables: tablesByBaseId[base.id] ?? [],
      })),
      _count: {
        bases: Number(workspace.baseCount),
      },
    }));
  }),

  // Get a single workspace by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          bases: {
            include: {
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
          },
        },
      });

      if (!workspace) {
        throw new Error("Workspace not found");
      }

      return workspace;
    }),

  // Create a new workspace
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workspace.create({
        data: {
          name: input.name,
          description: input.description,
          userId: ctx.session.user.id,
        },
      });
    }),

  // Update a workspace
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
      const workspace = await ctx.prisma.workspace.findFirst({
        where: {
          id,
          userId: ctx.session.user.id,
        },
      });

      if (!workspace) {
        throw new Error("Workspace not found");
      }

      return ctx.prisma.workspace.update({
        where: { id },
        data: updateData,
      });
    }),

  // Delete a workspace
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const workspace = await ctx.prisma.workspace.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });

      if (!workspace) {
        throw new Error("Workspace not found");
      }

      return ctx.prisma.workspace.delete({
        where: { id: input.id },
      });
    }),
});
