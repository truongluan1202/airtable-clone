#!/usr/bin/env node

/**
 * Script to fix failed migrations in production database
 * Run this with your production DATABASE_URL
 *
 * Usage: DATABASE_URL="your_prod_url" node scripts/fix-migration.js
 */

const { execSync } = require("child_process");

const migrationName = "20250929023310_baseline";

console.log("🔧 Fixing failed migration in production database...");
console.log(`Migration: ${migrationName}`);

try {
  // Check migration status first
  console.log("📊 Checking migration status...");
  execSync(`npx prisma migrate status`, { stdio: "inherit" });

  // Try to resolve the failed migration as applied
  console.log("✅ Marking migration as applied...");
  execSync(`npx prisma migrate resolve --applied ${migrationName}`, {
    stdio: "inherit",
  });

  console.log("🎉 Migration fixed successfully!");
} catch (error) {
  console.error("❌ Error fixing migration:", error.message);

  // Alternative: try to rollback the failed migration
  console.log("🔄 Trying to rollback failed migration...");
  try {
    execSync(`npx prisma migrate resolve --rolled-back ${migrationName}`, {
      stdio: "inherit",
    });
    console.log("✅ Migration rolled back successfully!");
  } catch (rollbackError) {
    console.error("❌ Rollback also failed:", rollbackError.message);
    console.log("\n📋 Manual steps needed:");
    console.log("1. Connect to your production database");
    console.log("2. Check the _prisma_migrations table");
    console.log("3. Remove or update the failed migration record");
    console.log("4. Or recreate the database if possible");
  }
}
