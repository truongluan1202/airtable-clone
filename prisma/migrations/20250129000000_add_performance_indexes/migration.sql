-- Add performance indexes for better query performance
-- These indexes will significantly improve loading times for workspace, base, and table operations

-- Base table indexes
CREATE INDEX IF NOT EXISTS "Base_userId_idx" ON "Base"("userId");
CREATE INDEX IF NOT EXISTS "Base_workspaceId_idx" ON "Base"("workspaceId");

-- Table table indexes  
CREATE INDEX IF NOT EXISTS "Table_baseId_idx" ON "Table"("baseId");

-- Row table indexes
CREATE INDEX IF NOT EXISTS "Row_tableId_idx" ON "Row"("tableId");
CREATE INDEX IF NOT EXISTS "Row_table_created_id_idx" ON "Row"("tableId", "createdAt", "id");

-- Cell table indexes
CREATE INDEX IF NOT EXISTS "Cell_rowId_idx" ON "Cell"("rowId");
CREATE INDEX IF NOT EXISTS "Cell_columnId_idx" ON "Cell"("columnId");
