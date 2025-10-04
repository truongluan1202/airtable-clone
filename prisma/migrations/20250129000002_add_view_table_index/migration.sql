-- Add missing index for View table to optimize view operations
-- This will significantly improve performance for view creation, deletion, and listing

CREATE INDEX IF NOT EXISTS "View_tableId_idx" ON "View"("tableId");
