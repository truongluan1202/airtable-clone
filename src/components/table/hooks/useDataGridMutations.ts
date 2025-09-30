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
    onMutate: async (variables) => {
      console.log("🔥 Setting add column loading to true");
      setIsAddingColumnLoading(true);

      // Cancel any outgoing refetches
      await utils.table.getByIdPaginated.cancel();

      // Snapshot previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();

      // Optimistically add the new column to the table structure
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          // Create optimistic column data
          const optimisticColumn = {
            id: `temp-col-${Date.now()}`,
            name: variables.name,
            type: variables.type,
            createdAt: new Date(),
          };

          const newPages = oldData.pages.map((page) => ({
            ...page,
            table: {
              ...page.table,
              columns: [...page.table.columns, optimisticColumn],
            },
            // Add empty cells for the new column to all existing rows
            rows: page.rows.map((row: any) => ({
              ...row,
              cells: [
                ...row.cells,
                {
                  id: `temp-cell-${Date.now()}-${row.id}`,
                  rowId: row.id,
                  columnId: optimisticColumn.id,
                  vText: null,
                  vNumber: null,
                },
              ],
            })),
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Return context for rollback
      return { previousData };
    },
    onSuccess: (data) => {
      console.log("✅ Column added successfully:", data);

      // Invalidate to ensure consistency and get real data
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the new column
      setTimeout(() => {
        setIsAddingColumnLoading(false);
      }, 500);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to add column:", error);
      setIsAddingColumnLoading(false);

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: variables.tableId, limit: 500 },
          context.previousData,
        );
      }

      // Show user-friendly error message
      const errorMessage = error.message || "Failed to add column";
      alert(`Error: ${errorMessage}`);
    },
  });

  const addRowMutation = api.table.addRow.useMutation({
    onMutate: async (variables) => {
      console.log("🔥 Setting add row loading to true");
      setIsAddingRowLoading(true);

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await utils.table.getByIdPaginated.cancel();
      await utils.table.getRowCount.cancel();

      // Snapshot the previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();
      const previousRowCount = utils.table.getRowCount.getData({
        id: variables.tableId,
      });

      // Optimistically update row count
      utils.table.getRowCount.setData({ id: variables.tableId }, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          totalRows: oldData.totalRows + 1,
        };
      });

      // For single row addition, we'll just update the row count optimistically
      // and let the natural data flow handle the row positioning when it refetches
      // This avoids complex pagination logic and ensures consistency with database ordering

      // Return context with the previous data for rollback
      return { previousData, previousRowCount };
    },
    onSuccess: (data) => {
      console.log("✅ Row added successfully:", data);

      // Invalidate to refetch the data with the new row in the correct position
      void utils.table.getByIdPaginated.invalidate();
      void utils.table.getRowCount.invalidate();

      // Keep loading state visible for a bit longer so user can see the new row
      setTimeout(() => {
        setIsAddingRowLoading(false);
      }, 500);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to add row:", error);
      setIsAddingRowLoading(false);

      // Rollback the optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: variables.tableId, limit: 500 },
          context.previousData,
        );
      }
      if (context?.previousRowCount) {
        utils.table.getRowCount.setData(
          { id: variables.tableId },
          context.previousRowCount,
        );
      }
    },
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onMutate: async (variables) => {
      console.log("🔥 Delete row mutation started with:", variables);
      setIsDeletingRowLoading(true);

      // Cancel any outgoing refetches
      await utils.table.getByIdPaginated.cancel();
      await utils.table.getRowCount.cancel();

      // Snapshot previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();
      const previousRowCount = utils.table.getRowCount.getData({
        id: tableId ?? "",
      });

      // Optimistically remove the row from the infinite query data
      utils.table.getByIdPaginated.setInfiniteData(
        { id: tableId ?? "", limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          const newPages = oldData.pages.map((page) => ({
            ...page,
            rows: page.rows.filter((row: any) => row.id !== variables.rowId),
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Optimistically update row count
      utils.table.getRowCount.setData({ id: tableId ?? "" }, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          totalRows: Math.max(0, oldData.totalRows - 1),
        };
      });

      // Return context for rollback
      return { previousData, previousRowCount };
    },
    onSuccess: (data) => {
      console.log("✅ Row deleted successfully:", data);

      // Invalidate to ensure consistency
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();
      void utils.table.getRowCount.invalidate();

      // Keep loading state visible for a bit longer so user can see the row was deleted
      setTimeout(() => {
        setIsDeletingRowLoading(false);
      }, 500);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to delete row:", error);
      console.error("❌ Error details:", error.message, error.data);
      setIsDeletingRowLoading(false);

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: tableId ?? "", limit: 500 },
          context.previousData,
        );
      }
      if (context?.previousRowCount) {
        utils.table.getRowCount.setData(
          { id: tableId ?? "" },
          context.previousRowCount,
        );
      }
    },
  });

  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onMutate: async (variables) => {
      console.log("🔥 Setting delete column loading to true");
      setIsDeletingColumnLoading(true);

      // Cancel any outgoing refetches
      await utils.table.getByIdPaginated.cancel();

      // Snapshot previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();

      // Optimistically remove the column from the table structure
      utils.table.getByIdPaginated.setInfiniteData(
        { id: tableId ?? "", limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          const newPages = oldData.pages.map((page) => ({
            ...page,
            table: {
              ...page.table,
              columns: page.table.columns.filter(
                (col: any) => col.id !== variables.columnId,
              ),
            },
            // Remove cells for the deleted column from all rows
            rows: page.rows.map((row: any) => ({
              ...row,
              cells: row.cells.filter(
                (cell: any) => cell.columnId !== variables.columnId,
              ),
            })),
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Return context for rollback
      return { previousData };
    },
    onSuccess: (data) => {
      console.log("✅ Column deleted successfully:", data);

      // Invalidate to ensure consistency
      void utils.table.getById.invalidate();
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the column was deleted
      setTimeout(() => {
        setIsDeletingColumnLoading(false);
      }, 500);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to delete column:", error);
      setIsDeletingColumnLoading(false);

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: tableId ?? "", limit: 500 },
          context.previousData,
        );
      }
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
