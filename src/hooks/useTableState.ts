import { useState, useCallback } from "react";
import type {
  TableState,
  CellEditState,
  FilterConfig,
  SortConfig,
} from "~/types/table";

export function useTableState(initialColumns?: Array<{ id: string }>) {
  const [state, setState] = useState<TableState>(() => {
    const initialVisibility: Record<string, boolean> = {};
    if (initialColumns) {
      initialColumns.forEach((column) => {
        initialVisibility[column.id] = true;
      });
    }

    return {
      selectedCell: null,
      editingCell: null,
      searchQuery: "",
      filters: [],
      sort: [],
      columnVisibility: initialVisibility,
    };
  });

  const setSelectedCell = useCallback((cell: CellEditState | null) => {
    setState((prev) => ({ ...prev, selectedCell: cell }));
  }, []);

  const setEditingCell = useCallback((cell: CellEditState | null) => {
    setState((prev) => ({ ...prev, editingCell: cell }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const addFilter = useCallback((filter: FilterConfig) => {
    setState((prev) => ({
      ...prev,
      filters: [
        ...prev.filters.filter((f) => f.columnId !== filter.columnId),
        filter,
      ],
    }));
  }, []);

  const removeFilter = useCallback((columnId: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.columnId !== columnId),
    }));
  }, []);

  const setSort = useCallback((sort: SortConfig[]) => {
    setState((prev) => ({ ...prev, sort }));
  }, []);

  const toggleColumnVisibility = useCallback((columnId: string) => {
    setState((prev) => ({
      ...prev,
      columnVisibility: {
        ...prev.columnVisibility,
        [columnId]: !prev.columnVisibility[columnId],
      },
    }));
  }, []);

  const setColumnVisibility = useCallback(
    (columnId: string, visible: boolean) => {
      setState((prev) => ({
        ...prev,
        columnVisibility: {
          ...prev.columnVisibility,
          [columnId]: visible,
        },
      }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setState((prev) => ({ ...prev, filters: [] }));
  }, []);

  const clearSort = useCallback(() => {
    setState((prev) => ({ ...prev, sort: [] }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      selectedCell: null,
      editingCell: null,
      searchQuery: "",
      filters: [],
      sort: [],
      columnVisibility: {},
    });
  }, []);

  return {
    state,
    setSelectedCell,
    setEditingCell,
    setSearchQuery,
    addFilter,
    removeFilter,
    setSort,
    toggleColumnVisibility,
    setColumnVisibility,
    clearFilters,
    clearSort,
    resetState,
  };
}
