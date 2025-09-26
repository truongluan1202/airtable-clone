#!/usr/bin/env node

// Simple build test script
const { execSync } = require("child_process");

console.log("🔨 Testing build process...");

try {
  // Test TypeScript compilation
  console.log("📝 Checking TypeScript...");
  execSync("pnpm typecheck", { stdio: "inherit" });

  // Test linting
  console.log("🔍 Checking linting...");
  execSync("pnpm lint", { stdio: "inherit" });

  console.log("✅ All checks passed! Build should work.");
} catch (error) {
  console.error("❌ Build test failed:", error.message);
  process.exit(1);
}
