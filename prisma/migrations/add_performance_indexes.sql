-- Critical indexes for 100k row performance
-- These indexes will significantly improve query performance for large tables

-- MUST-HAVE indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_row_table_created_id ON "Row" ("tableId", "createdAt", "id");
CREATE UNIQUE INDEX IF NOT EXISTS idx_cell_row_column_unique ON "Cell" ("rowId", "columnId");
CREATE INDEX IF NOT EXISTS idx_cell_row_id ON "Cell" ("rowId");
CREATE INDEX IF NOT EXISTS idx_column_table_name ON "Column" ("tableId", "name");

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_cell_column_id ON "Cell" ("columnId");
CREATE INDEX IF NOT EXISTS idx_row_table_id ON "Row" ("tableId");
CREATE INDEX IF NOT EXISTS idx_table_base_user ON "Table" ("baseId");
CREATE INDEX IF NOT EXISTS idx_base_user ON "Base" ("userId");

-- Optional search indexes (choose one based on your search needs)
-- Option 1: Full-text search with tsvector
CREATE INDEX IF NOT EXISTS idx_row_search_tsvector ON "Row" USING gin(to_tsvector('english', search));
-- Option 2: Trigram search (uncomment if you prefer trigram over tsvector)
-- CREATE INDEX IF NOT EXISTS idx_row_search_trgm ON "Row" USING gin(search gin_trgm_ops);
