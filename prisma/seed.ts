import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create a default user if none exists
  const existingUser = await prisma.user.findFirst();

  if (!existingUser) {
    console.log("👤 Creating default user...");
    const user = await prisma.user.create({
      data: {
        email: "demo@example.com",
        name: "Demo User",
        emailVerified: new Date(),
      },
    });

    // Create a default workspace
    console.log("🏢 Creating default workspace...");
    const workspace = await prisma.workspace.create({
      data: {
        name: "My Workspace",
        description: "Default workspace for getting started",
        userId: user.id,
      },
    });

    // Create a default base
    console.log("📁 Creating default base...");
    const base = await prisma.base.create({
      data: {
        name: "My Base",
        description: "Default base with sample data",
        workspaceId: workspace.id,
        userId: user.id,
      },
    });

    // Create a sample table
    console.log("📊 Creating sample table...");
    const table = await prisma.table.create({
      data: {
        name: "Sample Table",
        description: "A table with sample data to get you started",
        baseId: base.id,
      },
    });

    // Create columns
    console.log("📋 Creating columns...");
    const nameColumn = await prisma.column.create({
      data: {
        name: "Name",
        type: "TEXT",
        tableId: table.id,
      },
    });

    const emailColumn = await prisma.column.create({
      data: {
        name: "Email",
        type: "TEXT",
        tableId: table.id,
      },
    });

    const ageColumn = await prisma.column.create({
      data: {
        name: "Age",
        type: "NUMBER",
        tableId: table.id,
      },
    });

    // Create sample rows with data
    console.log("📝 Creating sample rows...");
    const sampleData = Array.from({ length: 10 }, () => ({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      age: faker.number.int({ min: 18, max: 80 }),
    }));

    for (const data of sampleData) {
      const row = await prisma.row.create({
        data: {
          tableId: table.id,
          cache: {
            [nameColumn.id]: data.name,
            [emailColumn.id]: data.email,
            [ageColumn.id]: data.age,
          },
          search: `${data.name} ${data.email} ${data.age}`.toLowerCase(),
        },
      });

      // Create cells for each column
      await prisma.cell.createMany({
        data: [
          {
            rowId: row.id,
            columnId: nameColumn.id,
            vText: data.name,
          },
          {
            rowId: row.id,
            columnId: emailColumn.id,
            vText: data.email,
          },
          {
            rowId: row.id,
            columnId: ageColumn.id,
            vNumber: data.age,
          },
        ],
      });
    }

    console.log("✅ Database seeded successfully!");
    console.log(`📧 Default user email: demo@example.com`);
    console.log(`🏢 Workspace: ${workspace.name}`);
    console.log(`📁 Base: ${base.name}`);
    console.log(
      `📊 Table: ${table.name} (with ${sampleData.length} sample rows)`,
    );
  } else {
    console.log("👤 User already exists, skipping seed...");
  }
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
