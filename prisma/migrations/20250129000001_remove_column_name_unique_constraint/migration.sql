-- Remove unique constraint on (tableId, name) from Column table
-- This allows multiple columns with the same name within a table

ALTER TABLE "Column" DROP CONSTRAINT IF EXISTS "Column_tableId_name_key";
