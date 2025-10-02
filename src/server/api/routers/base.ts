import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createId } from "@paralleldrive/cuid2";

export const baseRouter = createTRPCRouter({
  // Get all bases for the current user - Optimized with raw SQL
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Use raw SQL for better performance with new indexes
    const bases = await ctx.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        description: string | null;
        workspaceId: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        workspaceName: string;
        workspaceDescription: string | null;
        tableCount: bigint;
        totalRows: bigint;
        totalColumns: bigint;
      }>
    >`
      SELECT 
        b.id,
        b.name,
        b.description,
        b."workspaceId",
        b."userId",
        b."createdAt",
        b."updatedAt",
        w.name as "workspaceName",
        w.description as "workspaceDescription",
        COUNT(DISTINCT t.id) as "tableCount",
        COUNT(DISTINCT r.id) as "totalRows",
        COUNT(DISTINCT c.id) as "totalColumns"
      FROM "Base" b
      JOIN "Workspace" w ON b."workspaceId" = w.id
      LEFT JOIN "Table" t ON b.id = t."baseId"
      LEFT JOIN "Row" r ON t.id = r."tableId"
      LEFT JOIN "Column" c ON t.id = c."tableId"
      WHERE b."userId" = ${ctx.session.user.id}
      GROUP BY b.id, b.name, b.description, b."workspaceId", b."userId", b."createdAt", b."updatedAt", w.name, w.description
      ORDER BY b."createdAt" DESC
    `;

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

    // Group tables by baseId for efficient lookup
    const tablesByBaseId = tables.reduce(
      (acc: Record<string, typeof tables>, table: any) => {
        acc[table.baseId] ??= [];
        acc[table.baseId].push(table);
        return acc;
      },
      {} as Record<string, typeof tables>,
    );

    // Combine bases with their tables and workspace info
    return bases.map((base: any) => ({
      id: base.id,
      name: base.name,
      description: base.description,
      workspaceId: base.workspaceId,
      userId: base.userId,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      workspace: {
        id: base.workspaceId,
        name: base.workspaceName,
        description: base.workspaceDescription,
        userId: base.userId,
        createdAt: base.createdAt, // Approximate
        updatedAt: base.updatedAt, // Approximate
      },
      tables: tablesByBaseId[base.id] ?? [],
      _count: {
        tables: Number(base.tableCount),
      },
    }));
  }),

  // Get all bases for a specific workspace - Optimized with raw SQL
  getByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use raw SQL for better performance with new indexes
      const bases = await ctx.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          workspaceId: string;
          userId: string;
          createdAt: Date;
          updatedAt: Date;
          workspaceName: string;
          workspaceDescription: string | null;
          tableCount: bigint;
          totalRows: bigint;
          totalColumns: bigint;
        }>
      >`
        SELECT 
          b.id,
          b.name,
          b.description,
          b."workspaceId",
          b."userId",
          b."createdAt",
          b."updatedAt",
          w.name as "workspaceName",
          w.description as "workspaceDescription",
          COUNT(DISTINCT t.id) as "tableCount",
          COUNT(DISTINCT r.id) as "totalRows",
          COUNT(DISTINCT c.id) as "totalColumns"
        FROM "Base" b
        JOIN "Workspace" w ON b."workspaceId" = w.id
        LEFT JOIN "Table" t ON b.id = t."baseId"
        LEFT JOIN "Row" r ON t.id = r."tableId"
        LEFT JOIN "Column" c ON t.id = c."tableId"
        WHERE b."workspaceId" = ${input.workspaceId}
          AND b."userId" = ${ctx.session.user.id}
        GROUP BY b.id, b.name, b.description, b."workspaceId", b."userId", b."createdAt", b."updatedAt", w.name, w.description
        ORDER BY b."createdAt" DESC
      `;

      // Get tables separately for better performance (only if needed)
      const tables = await ctx.prisma.table.findMany({
        where: {
          base: {
            workspaceId: input.workspaceId,
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

      // Group tables by baseId for efficient lookup
      const tablesByBaseId = tables.reduce(
        (acc: Record<string, typeof tables>, table: any) => {
          acc[table.baseId] ??= [];
          acc[table.baseId].push(table);
          return acc;
        },
        {} as Record<string, typeof tables>,
      );

      // Combine bases with their tables and workspace info
      return bases.map((base: any) => ({
        id: base.id,
        name: base.name,
        description: base.description,
        workspaceId: base.workspaceId,
        userId: base.userId,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
        workspace: {
          id: base.workspaceId,
          name: base.workspaceName,
          description: base.workspaceDescription,
          userId: base.userId,
          createdAt: base.createdAt, // Approximate
          updatedAt: base.updatedAt, // Approximate
        },
        tables: tablesByBaseId[base.id] ?? [],
        _count: {
          tables: Number(base.tableCount),
        },
      }));
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

      // Use transaction for atomic operations with direct bulk insert
      await ctx.prisma.$transaction(
        async (tx: any) => {
          // Enable faster commits for this transaction only
          await tx.$executeRaw`SET LOCAL synchronous_commit = off`;

          // Pre-generate row IDs and data
          const rowIds = Array.from({ length: 5 }, () => createId());
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
                  value = faker.person.firstName(); // Shorter than fullName
                } else if (column.name.toLowerCase().includes("email")) {
                  value = faker.internet.email();
                } else {
                  value = faker.lorem.word(); // Single word instead of multiple
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

            // Create row data
            sampleRows.push({
              id: rowId,
              tableId: table.id,
              cache: JSON.stringify(cache),
              search: searchTexts.join(" ").toLowerCase(),
            });
          }

          // Direct bulk insert for rows (faster than temp tables)
          if (sampleRows.length > 0) {
            const rowValues = sampleRows
              .map(
                (row) =>
                  `('${row.id}', '${row.tableId}', '${row.cache.replace(/'/g, "''")}', '${row.search.replace(/'/g, "''")}', NOW(), NOW())`,
              )
              .join(",");

            await tx.$executeRawUnsafe(`
              INSERT INTO "Row" (id, "tableId", cache, search, "createdAt", "updatedAt")
              VALUES ${rowValues}
              ON CONFLICT (id) DO NOTHING
            `);
          }

          // Direct bulk insert for cells (faster than temp tables)
          if (cells.length > 0) {
            const cellValues = cells
              .map(
                (cell) =>
                  `('${createId()}', '${cell.rowId}', '${cell.columnId}', ${cell.vText ? `'${cell.vText.toString().replace(/'/g, "''")}'` : "NULL"}, ${cell.vNumber ?? "NULL"}, NOW(), NOW())`,
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
          timeout: 10000, // 10 seconds timeout for small base creation
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
