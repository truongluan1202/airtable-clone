import { useCallback, useState } from "react";
import { api } from "~/utils/api";
import { createId } from "@paralleldrive/cuid2";
import type { Column } from "../types";

export function useDataGridMutations(tableId?: string, isDataLoading = false) {
  const utils = api.useUtils();

  // Graceful error handling utility
  const handleErrorGracefully = async (error: any, operation: string) => {
    console.error(`❌ ${operation} failed:`, error);

    // Check if it's a structured error response
    let errorData;
    try {
      errorData = JSON.parse(error.message);
    } catch {
      errorData = { message: error.message };
    }

    // Error encountered, refreshing data

    // If the error indicates we should refetch, do so
    if (errorData.shouldRefetch !== false) {
      try {
        await Promise.all([
          utils.table.getByIdPaginated.invalidate({ id: tableId ?? "" }),
          utils.table.getViews.invalidate({ tableId: tableId ?? "" }),
          utils.table.getRowCount.invalidate({ id: tableId ?? "" }),
        ]);
        // Data refreshed successfully
      } catch (refetchError) {
        console.error(
          `❌ Failed to refresh data after ${operation} error:`,
          refetchError,
        );
        // Unable to refresh data, user should reload page
      }
    }
  };

  // Track loading states that persist until data is refetched
  const [isAddingColumnLoading, setIsAddingColumnLoading] = useState(false);
  const [isAddingRowLoading, setIsAddingRowLoading] = useState(false);
  const [isDeletingRowLoading, setIsDeletingRowLoading] = useState(false);
  const [isDeletingColumnLoading, setIsDeletingColumnLoading] = useState(false);

  // Track pending edits for optimistic data
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});

  // Track row statuses (creating, saving, etc.)
  const [rowStatuses, setRowStatuses] = useState<
    Record<string, "creating" | "saving" | "saved">
  >({});

  // Track cell edit statuses for per-cell spinners
  const [cellEditStatuses, setCellEditStatuses] = useState<
    Record<string, "saving" | "saved">
  >({});

  // Track column statuses (creating, synced)
  const [columnStatuses, setColumnStatuses] = useState<
    Record<string, "creating" | "synced">
  >({});

  // Note: Loading states are now cleared using timeouts in the mutation success handlers
  // This provides better UX by keeping loading visible until user can see the result

  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: (_data, variables) => {
      const cellKey = `${variables.rowId}-${variables.columnId}`;

      // Mark cell as saved
      setCellEditStatuses((prev) => ({
        ...prev,
        [cellKey]: "saved",
      }));

      void utils.table.getByIdPaginated.invalidate();
    },
    onError: async (error, variables) => {
      console.error("❌ Failed to update cell:", error);

      const cellKey = `${variables.rowId}-${variables.columnId}`;

      // Mark cell as saved (even on error, to stop spinner)
      setCellEditStatuses((prev) => ({
        ...prev,
        [cellKey]: "saved",
      }));

      // Use graceful error handling to refresh data
      await handleErrorGracefully(error, "Cell update");
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onMutate: async (variables) => {
      setIsAddingColumnLoading(true);

      // Cancel any outgoing refetches
      await utils.table.getByIdPaginated.cancel();

      // Snapshot previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();

      // Generate proper client-assigned column ID using cuid2
      const clientColumnId = variables.columnId ?? createId();

      // Mark column as creating
      setColumnStatuses((prev) => ({
        ...prev,
        [clientColumnId]: "creating",
      }));

      // Create optimistic column data with client-assigned ID
      const optimisticColumn = {
        id: clientColumnId,
        name: variables.name,
        type: variables.type,
        createdAt: new Date(),
      };

      // Optimistically add the new column to the table structure
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          const newPages = oldData.pages.map((page) => ({
            ...page,
            table: {
              ...page.table,
              columns: [...page.table.columns, optimisticColumn],
            },
            // Note: We don't add empty data for new column - using sparse cells approach
            // Missing cells will be treated as null in the UI
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Return context for rollback
      return { previousData, clientColumnId };
    },
    onSuccess: (data, variables, context) => {
      // Get the client column ID from context
      const clientColumnId = context?.clientColumnId;

      if (clientColumnId && data) {
        // Mark column as synced (no longer creating)
        setColumnStatuses((prev) => ({
          ...prev,
          [clientColumnId]: "synced",
        }));

        // Flush any buffered edits for this column
        const editsToApply: Array<{ rowId: string; value: string }> = [];
        Object.entries(pendingEdits).forEach(([cellKey, value]) => {
          const [rowId, columnId] = cellKey.split("-", 2);
          if (columnId === clientColumnId && rowId) {
            editsToApply.push({ rowId, value });
          }
        });

        // Apply buffered edits to the database using the client column ID
        editsToApply.forEach(({ rowId, value }) => {
          // Only apply if the row is not optimistic (temp-row-*)
          if (!rowId.startsWith("temp-row-")) {
            updateCellMutation.mutate({
              rowId,
              columnId: clientColumnId, // Use client column ID consistently
              value,
            });
          }
        });

        // Invalidate only the first page to pull canonical data
        void utils.table.getByIdPaginated.invalidate({
          id: variables.tableId,
          limit: 500,
        });
      }

      // Keep loading state visible for a bit longer so user can see the new column
      setTimeout(() => {
        setIsAddingColumnLoading(false);
      }, 500);
    },
    onError: async (error, variables, context) => {
      setIsAddingColumnLoading(false);

      // Remove the optimistic column
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: variables.tableId, limit: 500 },
          context.previousData,
        );
      }

      // Clear column status and pending edits
      if (context?.clientColumnId) {
        setColumnStatuses((prev) => {
          const newStatuses = { ...prev };
          delete newStatuses[context.clientColumnId];
          return newStatuses;
        });

        // Clear pending edits for this column
        setPendingEdits((prev) => {
          const newEdits = { ...prev };
          Object.keys(newEdits).forEach((cellKey) => {
            const [, columnId] = cellKey.split("-", 2);
            if (columnId === context.clientColumnId) {
              delete newEdits[cellKey];
            }
          });
          return newEdits;
        });
      }

      // Use graceful error handling
      await handleErrorGracefully(error, "Column addition");
    },
  });

  const addRowMutation = api.table.addRow.useMutation({
    onMutate: async (variables) => {
      setIsAddingRowLoading(true);

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await utils.table.getByIdPaginated.cancel();
      await utils.table.getRowCount.cancel();

      // Snapshot the previous values
      const previousData = utils.table.getByIdPaginated.getInfiniteData();
      const previousRowCount = utils.table.getRowCount.getData({
        id: variables.tableId,
      });

      // Generate proper client-assigned ID using cuid2
      const clientRowId = variables.rowId ?? createId();

      // Mark row as creating
      setRowStatuses((prev) => ({
        ...prev,
        [clientRowId]: "creating",
      }));

      // Optimistically update row count
      utils.table.getRowCount.setData({ id: variables.tableId }, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          totalRows: oldData.totalRows + 1,
        };
      });

      // Optimistically add the new row to the data with client-generated ID
      const optimisticRow = {
        id: clientRowId,
        createdAt: new Date(),
        data: {} as Record<string, string | number | null>,
      };

      // Add the optimistic row to the last page of data
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          const newPages = [...oldData.pages];
          if (newPages.length > 0) {
            const lastPage = newPages[newPages.length - 1];
            if (lastPage) {
              newPages[newPages.length - 1] = {
                ...lastPage,
                rows: [...lastPage.rows, optimisticRow],
              };
            }
          }

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

      // Return context with the previous data for rollback
      return { previousData, previousRowCount, clientRowId };
    },
    onSuccess: (data, variables, context) => {
      // Get the client row ID from context
      const clientRowId = context?.clientRowId;

      if (clientRowId && data) {
        // Mark row as synced (no longer creating)
        setRowStatuses((prev) => ({
          ...prev,
          [clientRowId]: "saved",
        }));

        // Flush any buffered edits for this row
        const editsToApply: Array<{ columnId: string; value: string }> = [];
        Object.entries(pendingEdits).forEach(([cellKey, value]) => {
          const [rowId, columnId] = cellKey.split("-", 2);
          if (rowId === clientRowId && columnId) {
            editsToApply.push({ columnId, value });
          }
        });

        // Apply buffered edits to the database using the client ID
        editsToApply.forEach(({ columnId, value }) => {
          // Only apply if the column is not optimistic (temp-col-*)
          if (!columnId.startsWith("temp-col-")) {
            updateCellMutation.mutate({
              rowId: clientRowId, // Use client ID, not server ID
              columnId,
              value,
            });
          }
        });

        // Invalidate only the first page to pull canonical data
        void utils.table.getByIdPaginated.invalidate({
          id: variables.tableId,
          limit: 500,
        });
      }

      // Keep loading state visible for a bit longer so user can see the new row
      setTimeout(() => {
        setIsAddingRowLoading(false);
      }, 500);
    },
    onError: (error, variables, context) => {
      console.error("❌ Failed to add row:", error);
      setIsAddingRowLoading(false);

      // Remove the optimistic row and show error
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

      // Clear row status and pending edits
      if (context?.clientRowId) {
        setRowStatuses((prev) => {
          const newStatuses = { ...prev };
          delete newStatuses[context.clientRowId];
          return newStatuses;
        });

        // Clear pending edits for this row
        setPendingEdits((prev) => {
          const newEdits = { ...prev };
          Object.keys(newEdits).forEach((cellKey) => {
            const [rowId] = cellKey.split("-", 2);
            if (rowId === context.clientRowId) {
              delete newEdits[cellKey];
            }
          });
          return newEdits;
        });
      }

      // TODO: Show toast notification for error
    },
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onMutate: async (variables) => {
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
    onSuccess: (_data) => {
      // Invalidate to ensure consistency
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
            // Remove data for the deleted column from all rows
            rows: page.rows.map((row: any) => {
              const newData = { ...row.data };
              delete newData[variables.columnId];
              return {
                ...row,
                data: newData,
              };
            }),
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
    onSuccess: (_data) => {
      // Invalidate to ensure consistency
      void utils.table.getByIdPaginated.invalidate();

      // Keep loading state visible for a bit longer so user can see the column was deleted
      setTimeout(() => {
        setIsDeletingColumnLoading(false);
      }, 500);
    },
    onError: async (error, variables, context) => {
      setIsDeletingColumnLoading(false);

      // Rollback optimistic updates
      if (context?.previousData) {
        utils.table.getByIdPaginated.setInfiniteData(
          { id: tableId ?? "", limit: 500 },
          context.previousData,
        );
      }

      // Use graceful error handling
      await handleErrorGracefully(error, "Column deletion");
    },
  });

  const handleAddColumn = useCallback(
    (name: string, type: "TEXT" | "NUMBER", columnId?: string) => {
      if (!tableId) {
        console.error("Table ID is required to add a column");
        return;
      }

      // Use provided columnId or generate a new one
      const clientColumnId = columnId ?? createId();

      addColumnMutation.mutate({
        tableId,
        name,
        type,
        columnId: clientColumnId, // Pass the client-generated column ID
      });
    },
    [addColumnMutation, tableId],
  );

  const handleAddRow = useCallback(() => {
    if (!tableId) {
      console.error("Table ID is required to add a row");
      return;
    }

    // Generate proper client-assigned ID using cuid2
    const clientRowId = createId();

    addRowMutation.mutate({
      tableId,
      rowId: clientRowId, // Pass the client-generated ID
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
      // Prevent updates when data is loading
      if (isDataLoading) {
        console.log("⏸️ Cell update skipped - data is loading");
        return;
      }

      const cellKey = `${rowId}-${columnId}`;

      // Update local state optimistically
      setCellValues((prev) => ({
        ...prev,
        [cellKey]: value,
      }));

      // Mark cell as saving
      setCellEditStatuses((prev) => ({
        ...prev,
        [cellKey]: "saving",
      }));

      // Check if this is optimistic data (temp-row-* or temp-col-*)
      const isOptimisticRow = rowId.startsWith("temp-row-");
      const isOptimisticColumn = columnId.startsWith("temp-col-");

      if (isOptimisticRow || isOptimisticColumn) {
        // Store the edit for later application when optimistic data becomes real
        setPendingEdits((prev) => ({
          ...prev,
          [cellKey]: value,
        }));

        // Mark cell as saved since it's just pending
        setCellEditStatuses((prev) => ({
          ...prev,
          [cellKey]: "saved",
        }));

        return; // Don't try to update the database yet
      }

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

      // Update the database
      updateCellMutation.mutate({
        rowId,
        columnId,
        value: processedValue,
      });
    },
    [updateCellMutation, isDataLoading],
  );

  // Combined cell value function that checks both cellValues and pendingEdits
  const getCellValue = useCallback(
    (
      rowId: string,
      columnId: string,
      defaultValue = "",
      cellValues: Record<string, string> = {},
    ) => {
      const cellKey = `${rowId}-${columnId}`;

      // First check pendingEdits (for optimistic data)
      if (pendingEdits[cellKey] !== undefined) {
        return pendingEdits[cellKey];
      }

      // Then check regular cellValues
      return cellValues[cellKey] ?? defaultValue;
    },
    [pendingEdits],
  );

  // Function to clear optimistic data (call on refresh or when syncing)
  const clearOptimisticData = useCallback(() => {
    setPendingEdits({});
    setRowStatuses({});
    setCellEditStatuses({});
    setColumnStatuses({});
  }, []);

  // Function to get row status
  const getRowStatus = useCallback(
    (rowId: string) => {
      return rowStatuses[rowId] ?? "saved";
    },
    [rowStatuses],
  );

  // Function to get cell edit status
  const getCellEditStatus = useCallback(
    (rowId: string, columnId: string) => {
      const cellKey = `${rowId}-${columnId}`;
      return cellEditStatuses[cellKey] ?? "saved";
    },
    [cellEditStatuses],
  );

  // Function to check if row is in creating state (for disabling destructive actions)
  const isRowCreating = useCallback(
    (rowId: string) => {
      return rowStatuses[rowId] === "creating";
    },
    [rowStatuses],
  );

  // Function to get column status
  const getColumnStatus = useCallback(
    (columnId: string) => {
      return columnStatuses[columnId] ?? "synced";
    },
    [columnStatuses],
  );

  // Function to check if column is in creating state (for disabling destructive actions)
  const isColumnCreating = useCallback(
    (columnId: string) => {
      return columnStatuses[columnId] === "creating";
    },
    [columnStatuses],
  );

  return {
    handleAddColumn,
    handleAddRow,
    handleDeleteRow,
    handleDeleteColumn,
    handleCellUpdate,
    getCellValue, // Expose the combined cell value function
    clearOptimisticData, // Expose function to clear optimistic data
    getRowStatus, // Expose function to get row status
    getCellEditStatus, // Expose function to get cell edit status
    isRowCreating, // Expose function to check if row is creating
    getColumnStatus, // Expose function to get column status
    isColumnCreating, // Expose function to check if column is creating
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
    // Data loading state to disable operations
    isDataLoading,
  };
}
