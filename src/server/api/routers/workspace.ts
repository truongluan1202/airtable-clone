import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const workspaceRouter = createTRPCRouter({
  // Get all workspaces for the current user - Simplified for performance
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Simple workspace query without expensive aggregations
    const workspaces = await ctx.prisma.workspace.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bases: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return workspaces;
  }),

  // Get a single workspace by ID - Simplified for performance
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          bases: {
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
