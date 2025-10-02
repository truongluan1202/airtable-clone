import { useCallback, useRef, useEffect, useReducer } from "react";
import { api } from "~/utils/api";
import type { Column } from "../types";

// Centralized pagination key to avoid cache misses
const PAGINATION_KEY = { limit: 500 };

// Configuration constants
const MUTATION_CONFIG = {
  debounceMs: 300,
  loadingTimeoutMs: 500,
  retryAttempts: 0,
  optimisticUpdates: true,
} as const;

interface MutationState {
  type:
    | "idle"
    | "adding-column"
    | "adding-row"
    | "deleting-row"
    | "deleting-column";
  progress: number;
}

// Optimistic update helpers
const createOptimisticUpdateHelpers = () => {
  const updateColumns = (pages: any[], columnUpdater: (cols: any[]) => any[]) =>
    pages.map((page) => ({
      ...page,
      table: { ...page.table, columns: columnUpdater(page.table.columns) },
    }));

  const updateRows = (pages: any[], rowUpdater: (rows: any[]) => any[]) =>
    pages.map((page) => ({ ...page, rows: rowUpdater(page.rows) }));

  return { updateColumns, updateRows };
};

// Loading state reducer
const mutationReducer = (
  state: MutationState,
  action: { type: string; progress?: number },
): MutationState => {
  switch (action.type) {
    case "START_ADDING_COLUMN":
      return { type: "adding-column", progress: 0 };
    case "START_ADDING_ROW":
      return { type: "adding-row", progress: 0 };
    case "START_DELETING_ROW":
      return { type: "deleting-row", progress: 0 };
    case "START_DELETING_COLUMN":
      return { type: "deleting-column", progress: 0 };
    case "COMPLETE":
      return { type: "idle", progress: 0 };
    case "UPDATE_PROGRESS":
      return { ...state, progress: action.progress ?? 0 };
    default:
      return state;
  }
};

export function useDataGridMutations(tableId?: string, isDataLoading = false) {
  const utils = api.useUtils();

  // Debounce ref for cell updates
  const cellUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (cellUpdateTimeoutRef.current) {
        clearTimeout(cellUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Consolidated loading state management
  const [mutationState, dispatch] = useReducer(mutationReducer, {
    type: "idle",
    progress: 0,
  });

  // Get optimistic update helpers
  const { updateColumns, updateRows } = createOptimisticUpdateHelpers();

  const updateCellMutation = api.table.updateCell.useMutation({
    retry: MUTATION_CONFIG.retryAttempts, // Use config constant
    onSuccess: (_data) => {
      // Don't invalidate - keep optimistic local state
      // The optimistic update in handleCellUpdate is sufficient
    },
    onError: (error) => {
      console.error("❌ Failed to update cell:", error);
      // Could add rollback logic here if needed
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onMutate: async (variables) => {
      dispatch({ type: "START_ADDING_COLUMN" });

      // Cancel any outgoing refetches
      await utils.table.getByIdPaginated.cancel();

      // Snapshot previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();

      // Optimistically add the new column to the table structure
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, ...PAGINATION_KEY },
        (oldData) => {
          if (!oldData) return oldData;

          // Create optimistic column data
          const optimisticColumn = {
            id: `temp-col-${Date.now()}`,
            name: variables.name,
            type: variables.type,
          };

          // Use optimistic update helper - only update column list
          const newPages = updateColumns(oldData.pages, (columns) => [
            ...columns,
            optimisticColumn,
          ]);

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
      // Update the optimistic data with the real column ID
      utils.table.getByIdPaginated.setInfiniteData(
        { id: data.tableId, ...PAGINATION_KEY },
        (oldData) => {
          if (!oldData) return oldData;

          // Use optimistic update helper to replace temp column with real data
          const newPages = updateColumns(oldData.pages, (columns) =>
            columns.map((col) => (col.id.startsWith("temp-col-") ? data : col)),
          );

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Invalidate to ensure consistency and get real data
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the new column
      setTimeout(() => {
        dispatch({ type: "COMPLETE" });
      }, MUTATION_CONFIG.loadingTimeoutMs);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to add column:", error);
      dispatch({ type: "COMPLETE" });

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: variables.tableId, ...PAGINATION_KEY },
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
      dispatch({ type: "START_ADDING_ROW" });

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

      // Optimistically add the new row to the data
      const optimisticRowId = `temp-row-${Date.now()}`;
      const optimisticRow = {
        id: optimisticRowId,
        createdAt: new Date(),
        data: {} as Record<string, string | number | null>,
      };

      // Add the optimistic row to the last page of data using helper
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, ...PAGINATION_KEY },
        (oldData) => {
          if (!oldData) return oldData;

          // Use optimistic update helper to add row to last page
          const newPages = oldData.pages.map((page, index) => {
            if (index === oldData.pages.length - 1) {
              return { ...page, rows: [...page.rows, optimisticRow] };
            }
            return page;
          });

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Return context with the previous data for rollback
      return { previousData, previousRowCount };
    },
    onSuccess: (data, variables) => {
      // Replace the optimistic row with the real row data
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, ...PAGINATION_KEY },
        (oldData) => {
          if (!oldData) return oldData;

          // Use optimistic update helper to replace temp row with real data
          const newPages = updateRows(oldData.pages, (rows) =>
            rows.map((row) => {
              if (row.id.startsWith("temp-row-")) {
                return {
                  id: data.id,
                  createdAt: data.createdAt,
                  data: {} as Record<string, string | number | null>, // Empty data for new row
                };
              }
              return row;
            }),
          );

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Keep loading state visible for a bit longer so user can see the new row
      setTimeout(() => {
        dispatch({ type: "COMPLETE" });
      }, MUTATION_CONFIG.loadingTimeoutMs);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to add row:", error);
      dispatch({ type: "COMPLETE" });

      // Rollback the optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: variables.tableId, ...PAGINATION_KEY },
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
      dispatch({ type: "START_DELETING_ROW" });

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
        { id: tableId ?? "", ...PAGINATION_KEY },
        (oldData) => {
          if (!oldData) return oldData;

          // Use optimistic update helper to remove row
          const newPages = updateRows(oldData.pages, (rows) =>
            rows.filter((row) => row.id !== variables.rowId),
          );

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
    onSuccess: (_data) => {
      // Invalidate to ensure consistency
      void utils.table.getByIdPaginated.invalidate();
      void utils.table.getRowCount.invalidate();

      // Keep loading state visible for a bit longer so user can see the row was deleted
      setTimeout(() => {
        dispatch({ type: "COMPLETE" });
      }, MUTATION_CONFIG.loadingTimeoutMs);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to delete row:", error);
      console.error("❌ Error details:", error.message, error.data);
      dispatch({ type: "COMPLETE" });

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: tableId ?? "", ...PAGINATION_KEY },
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
      dispatch({ type: "START_DELETING_COLUMN" });

      // Cancel any outgoing refetches
      await utils.table.getByIdPaginated.cancel();

      // Snapshot previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();

      // Optimistically remove the column from the table structure
      utils.table.getByIdPaginated.setInfiniteData(
        { id: tableId ?? "", ...PAGINATION_KEY },
        (oldData) => {
          if (!oldData) return oldData;

          // Use optimistic update helper to remove column
          const newPages = updateColumns(oldData.pages, (columns) =>
            columns.filter((col) => col.id !== variables.columnId),
          );

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Return context for rollback
      return { previousData };
    },
    onSuccess: (_data) => {
      // Invalidate to ensure consistency
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the column was deleted
      setTimeout(() => {
        dispatch({ type: "COMPLETE" });
      }, MUTATION_CONFIG.loadingTimeoutMs);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to delete column:", error);
      dispatch({ type: "COMPLETE" });

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: tableId ?? "", ...PAGINATION_KEY },
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
      deleteRowMutation.mutate({
        rowId,
      });
    },
    [deleteRowMutation],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
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
      const cellKey = `${rowId}-${columnId}`;

      // Update local state optimistically
      setCellValues((prev) => ({
        ...prev,
        [cellKey]: value,
      }));

      // Clear existing timeout
      if (cellUpdateTimeoutRef.current) {
        clearTimeout(cellUpdateTimeoutRef.current);
      }

      // Debounce the mutation call
      cellUpdateTimeoutRef.current = setTimeout(() => {
        // Find the column to determine its type
        const column = columns.find((col) => col.id === columnId);
        const columnType = column?.type;

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
      }, MUTATION_CONFIG.debounceMs);
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
    // Expose loading states from consolidated state machine
    isAddingColumn: mutationState.type === "adding-column",
    isAddingRow: mutationState.type === "adding-row",
    isDeletingRow: mutationState.type === "deleting-row",
    isDeletingColumn: mutationState.type === "deleting-column",
    isUpdatingCell: false, // Remove cell update loading since we do optimistic updates
    // Data loading state to disable operations
    isDataLoading,
    // Expose mutation state for advanced usage
    mutationState,
  };
}
