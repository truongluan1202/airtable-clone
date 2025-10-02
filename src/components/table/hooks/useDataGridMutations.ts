import { useCallback, useState } from "react";
import { api } from "~/utils/api";
import type { Column } from "../types";

export function useDataGridMutations(tableId?: string, isDataLoading = false) {
  const utils = api.useUtils();

  // Track loading states that persist until data is refetched
  const [isAddingColumnLoading, setIsAddingColumnLoading] = useState(false);
  const [isAddingRowLoading, setIsAddingRowLoading] = useState(false);
  const [isDeletingRowLoading, setIsDeletingRowLoading] = useState(false);
  const [isDeletingColumnLoading, setIsDeletingColumnLoading] = useState(false);

  // Note: Loading states are now cleared using timeouts in the mutation success handlers
  // This provides better UX by keeping loading visible until user can see the result

  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: (_data) => {
      void utils.table.getByIdPaginated.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to update cell:", error);
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onMutate: async (variables) => {
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
            // Add empty data for the new column to all existing rows
            rows: page.rows.map((row: any) => ({
              ...row,
              data: {
                ...row.data,
                [optimisticColumn.id]: null, // Add empty value for new column
              },
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
      // Update the optimistic data with the real column ID
      utils.table.getByIdPaginated.setInfiniteData(
        { id: data.tableId, limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          const newPages = oldData.pages.map((page) => ({
            ...page,
            table: {
              ...page.table,
              columns: page.table.columns.map((col: any) =>
                col.id.startsWith("temp-col-") ? data : col,
              ),
            },
            // Update row data to use real column ID
            rows: page.rows.map((row: any) => {
              const newData = { ...row.data };
              // Remove temp column data and add real column data
              Object.keys(newData).forEach((key) => {
                if (key.startsWith("temp-col-")) {
                  delete newData[key];
                }
              });
              newData[data.id] = null;

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

      // Invalidate to ensure consistency and get real data
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

      // Optimistically add the new row to the data
      const optimisticRowId = `temp-row-${Date.now()}`;
      const optimisticRow = {
        id: optimisticRowId,
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
      return { previousData, previousRowCount };
    },
    onSuccess: (data, variables) => {
      // Replace the optimistic row with the real row data
      utils.table.getByIdPaginated.setInfiniteData(
        { id: variables.tableId, limit: 500 },
        (oldData) => {
          if (!oldData) return oldData;

          const newPages = oldData.pages.map((page) => ({
            ...page,
            rows: page.rows.map((row: any) => {
              // Replace optimistic row with real data
              if (row.id.startsWith("temp-row-")) {
                return {
                  id: data.id,
                  createdAt: data.createdAt,
                  data: {} as Record<string, string | number | null>, // Empty data for new row
                };
              }
              return row;
            }),
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        },
      );

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
