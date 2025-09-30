import { useCallback, useState } from "react";
import { api } from "~/utils/api";
import type { Column } from "../types";

export function useDataGridMutations(tableId?: string) {
  const utils = api.useUtils();

  // Track loading states that persist until data is refetched
  const [isAddingColumnLoading, setIsAddingColumnLoading] = useState(false);
  const [isAddingRowLoading, setIsAddingRowLoading] = useState(false);
  const [isDeletingRowLoading, setIsDeletingRowLoading] = useState(false);
  const [isDeletingColumnLoading, setIsDeletingColumnLoading] = useState(false);

  // Note: Loading states are now cleared using timeouts in the mutation success handlers
  // This provides better UX by keeping loading visible until user can see the result

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
    onMutate: () => {
      console.log("🔥 Setting add column loading to true");
      setIsAddingColumnLoading(true);
    },
    onSuccess: (data) => {
      console.log("✅ Column added successfully:", data);
      void utils.table.getById.invalidate();
      // For infinite query, we need to invalidate to refetch all pages with new column structure
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the new column
      setTimeout(() => {
        setIsAddingColumnLoading(false);
      }, 1000);
    },
    onError: (error) => {
      console.error("❌ Failed to add column:", error);
      setIsAddingColumnLoading(false);
      // Show user-friendly error message
      const errorMessage = error.message || "Failed to add column";
      alert(`Error: ${errorMessage}`);
    },
  });

  const addRowMutation = api.table.addRow.useMutation({
    onMutate: () => {
      console.log("🔥 Setting add row loading to true");
      setIsAddingRowLoading(true);
    },
    onSuccess: (data) => {
      console.log("✅ Row added successfully:", data);
      void utils.table.getById.invalidate();
      // For infinite query, we need to invalidate to refetch all pages
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the new row, if the ui already updated set false immediately
      setTimeout(() => {
        if (data.id) {
          setIsAddingRowLoading(false);
        }
      }, 1000);
    },
    onError: (error) => {
      console.error("❌ Failed to add row:", error);
      setIsAddingRowLoading(false);
    },
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onMutate: (variables) => {
      console.log("🔥 Delete row mutation started with:", variables);
      setIsDeletingRowLoading(true);
    },
    onSuccess: (data) => {
      console.log("✅ Row deleted successfully:", data);
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the row was deleted
      setTimeout(() => {
        setIsDeletingRowLoading(false);
      }, 800);
    },
    onError: (error) => {
      console.error("❌ Failed to delete row:", error);
      console.error("❌ Error details:", error.message, error.data);
      setIsDeletingRowLoading(false);
    },
  });

  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onMutate: () => {
      console.log("🔥 Setting delete column loading to true");
      setIsDeletingColumnLoading(true);
    },
    onSuccess: (data) => {
      console.log("✅ Column deleted successfully:", data);
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the column was deleted
      setTimeout(() => {
        setIsDeletingColumnLoading(false);
      }, 800);
    },
    onError: (error) => {
      console.error("❌ Failed to delete column:", error);
      setIsDeletingColumnLoading(false);
    },
  });

  const handleAddColumn = useCallback(
    (name: string, type: "TEXT" | "NUMBER") => {
      if (!tableId) {
        console.error("Table ID is required to add a column");
        return;
      }
      console.log("🔥 handleAddColumn called with:", { name, type, tableId });
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
    console.log("🔥 handleAddRow called with tableId:", tableId);
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

  // Debug loading states
  console.log("🔥 useDataGridMutations loading states:", {
    isAddingColumnLoading,
    isAddingRowLoading,
    isDeletingRowLoading,
    isDeletingColumnLoading,
  });

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
    // Expose loading states (use persistent states that wait for data refetch)
    isAddingColumn: isAddingColumnLoading,
    isAddingRow: isAddingRowLoading,
    isDeletingRow: isDeletingRowLoading,
    isDeletingColumn: isDeletingColumnLoading,
    isUpdatingCell: false, // Remove cell update loading since we do optimistic updates
  };
}
