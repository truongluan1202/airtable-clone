import { useCallback } from "react";
import { api } from "~/utils/api";
import type { Column } from "../types";

export function useDataGridMutations(tableId?: string) {
  const utils = api.useUtils();

  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: (data) => {
      console.log("✅ Cell updated successfully:", data);
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to update cell:", error);
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onSuccess: (data) => {
      console.log("✅ Column added successfully:", data);
      void utils.table.getById.invalidate();
      // For infinite query, we need to invalidate to refetch all pages with new column structure
      void utils.table.getByIdPaginated.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to add column:", error);
      // Show user-friendly error message
      const errorMessage = error.message || "Failed to add column";
      alert(`Error: ${errorMessage}`);
    },
  });

  const addRowMutation = api.table.addRow.useMutation({
    onSuccess: (data) => {
      console.log("✅ Row added successfully:", data);
      void utils.table.getById.invalidate();
      // For infinite query, we need to invalidate to refetch all pages
      void utils.table.getByIdPaginated.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to add row:", error);
    },
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onSuccess: (data) => {
      console.log("✅ Row deleted successfully:", data);
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to delete row:", error);
      console.error("❌ Error details:", error.message, error.data);
    },
    onMutate: (variables) => {
      console.log("🔥 Delete row mutation started with:", variables);
    },
  });

  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onSuccess: (data) => {
      console.log("✅ Column deleted successfully:", data);
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to delete column:", error);
    },
  });

  const handleAddColumn = useCallback(
    (name: string, type: "TEXT" | "NUMBER") => {
      if (!tableId) {
        console.error("Table ID is required to add a column");
        return;
      }
      addColumnMutation.mutate({
        tableId,
        name,
        type,
      });
    },
    [addColumnMutation, tableId],
  );

  const handleAddRow = useCallback(() => {
    if (!tableId) {
      console.error("Table ID is required to add a row");
      return;
    }
    addRowMutation.mutate({
      tableId,
    });
  }, [addRowMutation, tableId]);

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      console.log("🔥 Delete row called for:", rowId);
      deleteRowMutation.mutate({
        rowId,
      });
    },
    [deleteRowMutation],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      console.log("🔥 Delete column called for:", columnId);
      deleteColumnMutation.mutate({
        columnId,
      });
    },
    [deleteColumnMutation],
  );

  const handleCellUpdate = useCallback(
    (
      rowId: string,
      columnId: string,
      value: string,
      columns: Column[],
      setCellValues: React.Dispatch<
        React.SetStateAction<Record<string, string>>
      >,
    ) => {
      console.log("🔥 handleCellUpdate called with:", {
        rowId,
        columnId,
        value,
        valueType: typeof value,
        valueConstructor: value?.constructor?.name,
      });

      const cellKey = `${rowId}-${columnId}`;

      // Update local state optimistically
      setCellValues((prev) => ({
        ...prev,
        [cellKey]: value,
      }));

      // Find the column to determine its type
      const column = columns.find((col) => col.id === columnId);
      const columnType = column?.type;
      console.log("🔥 Found column:", { column, columnType });

      // Convert value based on column type
      let processedValue: string | number = String(value).trim();
      if (columnType === "NUMBER" && processedValue !== "") {
        const numValue = Number(processedValue);
        if (!isNaN(numValue)) {
          processedValue = numValue;
        }
      }

      console.log("🔥 Calling updateCellMutation with:", {
        rowId,
        columnId,
        value: processedValue,
      });

      // Update the database
      updateCellMutation.mutate({
        rowId,
        columnId,
        value: processedValue,
      });
    },
    [updateCellMutation],
  );

  return {
    handleAddColumn,
    handleAddRow,
    handleDeleteRow,
    handleDeleteColumn,
    handleCellUpdate,
    updateCellMutation,
    addColumnMutation,
    addRowMutation,
    deleteRowMutation,
    deleteColumnMutation,
  };
}
