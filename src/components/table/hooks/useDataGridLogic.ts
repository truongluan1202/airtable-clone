import { useMemo, useCallback } from "react";
import type { DataRow, Column } from "../types";
import type { SortConfig, FilterGroup } from "~/types/table";

export function useDataGridLogic(
  data: DataRow[],
  columns: Column[],
  searchQuery: string,
  sort: SortConfig[],
  filters: FilterGroup[] = [],
) {
  // Helper function to evaluate a single filter condition
  const evaluateCondition = useCallback(
    (row: DataRow, condition: any, column: Column) => {
      const cellValue = row[column.name];
      const { operator, value } = condition;

      // Handle empty values
      const isEmpty =
        cellValue === null || cellValue === undefined || cellValue === "";

      switch (operator) {
        case "is_empty":
          return isEmpty;
        case "is_not_empty":
          return !isEmpty;
        case "equals":
          if (isEmpty) return false;
          if (column.type === "NUMBER") {
            return Number(cellValue) === Number(value);
          }
          return (
            String(cellValue).toLowerCase() === String(value).toLowerCase()
          );
        case "not_equals":
          if (isEmpty) return true;
          if (column.type === "NUMBER") {
            return Number(cellValue) !== Number(value);
          }
          return (
            String(cellValue).toLowerCase() !== String(value).toLowerCase()
          );
        case "contains":
          if (isEmpty) return false;
          return String(cellValue)
            .toLowerCase()
            .includes(String(value).toLowerCase());
        case "not_contains":
          if (isEmpty) return true;
          return !String(cellValue)
            .toLowerCase()
            .includes(String(value).toLowerCase());
        case "greater_than":
          if (isEmpty) return false;
          return Number(cellValue) > Number(value);
        case "less_than":
          if (isEmpty) return false;
          return Number(cellValue) < Number(value);
        default:
          return true;
      }
    },
    [],
  );

  // Helper function to evaluate a filter group
  const evaluateFilterGroup = useCallback(
    (row: DataRow, group: FilterGroup) => {
      if (group.conditions.length === 0) return true;

      const results = group.conditions.map((condition) => {
        const column = columns.find((col) => col.id === condition.columnId);
        if (!column) return false;
        return evaluateCondition(row, condition, column);
      });

      return group.logicOperator === "and"
        ? results.every((result) => result)
        : results.some((result) => result);
    },
    [columns, evaluateCondition],
  );

  // Search, filter, and sort logic
  const filteredData = useMemo(() => {
    // Create a stable copy of data to preserve original order
    let result = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((row) => {
        // Check if any cell in the row matches the search query
        return columns.some((column) => {
          const cellValue = row[column.name];
          if (cellValue === null || cellValue === undefined) {
            return false;
          }
          return String(cellValue).toLowerCase().includes(query);
        });
      });
    }

    // Apply column filters
    if (filters.length > 0) {
      result = result.filter((row) => {
        // All filter groups must pass (AND between groups)
        return filters.every((group) => evaluateFilterGroup(row, group));
      });
    }

    // Apply sorting
    if (sort.length > 0) {
      result = [...result].sort((a, b) => {
        for (const sortConfig of sort) {
          const column = columns.find((col) => col.id === sortConfig.columnId);
          if (!column) continue;

          const aValue = a[column.name];
          const bValue = b[column.name];

          // Handle null/undefined values
          if (aValue === null || aValue === undefined) {
            if (bValue === null || bValue === undefined) continue;
            return sortConfig.direction === "asc" ? 1 : -1;
          }
          if (bValue === null || bValue === undefined) {
            return sortConfig.direction === "asc" ? -1 : 1;
          }

          let comparison = 0;

          // Sort based on column type
          if (column.type === "NUMBER") {
            const aNum = Number(aValue);
            const bNum = Number(bValue);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              comparison = aNum - bNum;
            } else {
              // Fallback to string comparison for non-numeric values
              comparison = String(aValue).localeCompare(String(bValue));
            }
          } else {
            // Text sorting
            comparison = String(aValue).localeCompare(String(bValue));
          }

          if (comparison !== 0) {
            return sortConfig.direction === "asc" ? comparison : -comparison;
          }
        }
        // Stable tie-breaker: use row ID for consistent ordering
        return a.id.localeCompare(b.id);
      });
    }

    return result;
  }, [data, columns, searchQuery, sort, filters, evaluateFilterGroup]);

  // Check if a cell matches the search query
  const isCellHighlighted = useCallback(
    (rowId: string, columnId: string, cellValue: string) => {
      if (!searchQuery.trim()) {
        return false;
      }
      const query = searchQuery.toLowerCase().trim();
      const cellValueStr = String(cellValue).toLowerCase();
      const matches = cellValueStr.includes(query);

      // Removed excessive logging to improve performance during search

      return matches;
    },
    [searchQuery],
  );

  // Check if a column is sorted
  const isColumnSorted = useCallback(
    (columnId: string) => {
      return sort.some((s) => s.columnId === columnId);
    },
    [sort],
  );

  // Get sort direction for a column
  const getColumnSortDirection = useCallback(
    (columnId: string) => {
      const sortConfig = sort.find((s) => s.columnId === columnId);
      return sortConfig?.direction;
    },
    [sort],
  );

  // Check if a column is filtered
  const isColumnFiltered = useCallback(
    (columnId: string) => {
      return filters.some((group) =>
        group.conditions.some((condition) => condition.columnId === columnId),
      );
    },
    [filters],
  );

  return {
    filteredData,
    isCellHighlighted,
    isColumnSorted,
    getColumnSortDirection,
    isColumnFiltered,
  };
}
