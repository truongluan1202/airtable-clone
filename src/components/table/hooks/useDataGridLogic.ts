import { useMemo, useCallback } from "react";
import type { DataRow, Column } from "../types";
import type { SortConfig, FilterGroup } from "~/types/table";

// Performance optimization: Create Intl.Collator once and reuse
const COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function useDataGridLogic(
  data: DataRow[],
  columns: Column[],
  searchQuery: string,
  sort: SortConfig[],
  filters: FilterGroup[] = [],
) {
  // Performance optimization: O(1) column lookups using Map
  const columnMap = useMemo(() => {
    const map = new Map<string, Column>();
    columns.forEach((col) => map.set(col.id, col));
    return map;
  }, [columns]);

  // Performance optimization: O(1) column state lookups using Sets
  const sortedColumnIds = useMemo(
    () => new Set(sort.map((s) => s.columnId)),
    [sort],
  );
  const filteredColumnIds = useMemo(() => {
    const ids = new Set<string>();
    filters.forEach((group) => {
      group.conditions.forEach((condition) => ids.add(condition.columnId));
    });
    return ids;
  }, [filters]);

  // Performance optimization: O(1) sort direction lookups using Map
  const sortDirectionMap = useMemo(() => {
    const map = new Map<string, "asc" | "desc">();
    sort.forEach((s) => map.set(s.columnId, s.direction));
    return map;
  }, [sort]);
  // Performance optimization: Compile filters into functions once
  const compiledFilters = useMemo(() => {
    if (filters.length === 0) return null;

    // Early exit: filter out empty groups to avoid unnecessary processing
    const validGroups = filters.filter((group) => group.conditions.length > 0);
    if (validGroups.length === 0) return null;

    return validGroups.map((group) => {
      const compiledConditions = group.conditions.map((condition) => {
        const column = columnMap.get(condition.columnId);
        if (!column) return () => false;

        const { operator, value } = condition;
        const isNumber = column.type === "NUMBER";
        const lowerValue = isNumber ? null : String(value).toLowerCase();
        const numValue = isNumber ? Number(value) : null;

        return (row: DataRow) => {
          const cellValue = row[column.name];
          const isEmpty =
            cellValue === null || cellValue === undefined || cellValue === "";

          switch (operator) {
            case "is_empty":
              return isEmpty;
            case "is_not_empty":
              return !isEmpty;
            case "equals":
              if (isEmpty) return false;
              if (isNumber) return Number(cellValue) === numValue;
              return String(cellValue).toLowerCase() === lowerValue;
            case "not_equals":
              if (isEmpty) return true;
              if (isNumber) return Number(cellValue) !== numValue;
              return String(cellValue).toLowerCase() !== lowerValue;
            case "contains":
              if (isEmpty) return false;
              return String(cellValue).toLowerCase().includes(lowerValue!);
            case "not_contains":
              if (isEmpty) return true;
              return !String(cellValue).toLowerCase().includes(lowerValue!);
            case "greater_than":
              if (isEmpty) return false;
              return Number(cellValue) > numValue!;
            case "less_than":
              if (isEmpty) return false;
              return Number(cellValue) < numValue!;
            default:
              return true;
          }
        };
      });

      return (row: DataRow) => {
        if (group.logicOperator === "and") {
          for (const condition of compiledConditions) {
            if (!condition(row)) return false;
          }
          return true;
        } else {
          for (const condition of compiledConditions) {
            if (condition(row)) return true;
          }
          return false;
        }
      };
    });
  }, [filters, columnMap]);

  // Performance optimization: Compile search function once
  const compiledSearch = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase().trim();
    const searchableColumns = columns.filter((col) => col.type === "TEXT");

    return (row: DataRow) => {
      for (const column of searchableColumns) {
        const cellValue = row[column.name];
        if (
          cellValue !== null &&
          cellValue !== undefined &&
          String(cellValue).toLowerCase().includes(query)
        ) {
          return true;
        }
      }
      return false;
    };
  }, [searchQuery, columns]);

  // Performance optimization: Pre-compute search query for highlighting
  const searchQueryLower = useMemo(
    () => searchQuery.toLowerCase().trim(),
    [searchQuery],
  );

  // Performance optimization: Compile sort function once
  const compiledSort = useMemo(() => {
    if (sort.length === 0) return null;

    const sortConfigs = sort
      .map((sortConfig) => {
        const column = columnMap.get(sortConfig.columnId);
        if (!column) return null;
        return { column, direction: sortConfig.direction };
      })
      .filter(
        (config): config is { column: Column; direction: "asc" | "desc" } =>
          config !== null,
      );

    return (a: DataRow, b: DataRow) => {
      for (const { column, direction } of sortConfigs) {
        const aValue = a[column.name];
        const bValue = b[column.name];

        // Handle null/undefined values with early exit
        if (aValue === null || aValue === undefined) {
          if (bValue === null || bValue === undefined) continue;
          return direction === "asc" ? 1 : -1;
        }
        if (bValue === null || bValue === undefined) {
          return direction === "asc" ? -1 : 1;
        }

        let comparison = 0;

        // Sort based on column type using optimized collator
        if (column.type === "NUMBER") {
          const aNum = Number(aValue);
          const bNum = Number(bValue);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
          } else {
            comparison = COLLATOR.compare(String(aValue), String(bValue));
          }
        } else {
          comparison = COLLATOR.compare(String(aValue), String(bValue));
        }

        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }
      // Stable tie-breaker: use row ID for consistent ordering
      return a.id.localeCompare(b.id);
    };
  }, [sort, columnMap]);

  // Performance optimization: Main filtering logic with tight loops and early exits
  const filteredData = useMemo(() => {
    let result = data;

    // Apply search filter with early exit
    if (compiledSearch) {
      const filtered: DataRow[] = [];
      for (const row of result) {
        if (compiledSearch(row)) {
          filtered.push(row);
        }
      }
      result = filtered;
    }

    // Apply column filters with early exit
    if (compiledFilters) {
      const filtered: DataRow[] = [];
      for (const row of result) {
        let passesAllGroups = true;

        for (const filterGroup of compiledFilters) {
          if (!filterGroup(row)) {
            passesAllGroups = false;
            break; // Early exit on first failed group
          }
        }

        if (passesAllGroups) {
          filtered.push(row);
        }
      }
      result = filtered;
    }

    // Only copy when actually sorting (performance optimization)
    if (compiledSort) {
      result = [...result].sort(compiledSort);
    }

    return result;
  }, [data, compiledSearch, compiledFilters, compiledSort]);

  // Performance optimization: Optimized cell highlighting using pre-computed query
  const isCellHighlighted = useCallback(
    (rowId: string, columnId: string, cellValue: string) => {
      if (!searchQueryLower) {
        return false;
      }
      return String(cellValue).toLowerCase().includes(searchQueryLower);
    },
    [searchQueryLower],
  );

  // Performance optimization: O(1) column state checks using Sets
  const isColumnSorted = useCallback(
    (columnId: string) => {
      return sortedColumnIds.has(columnId);
    },
    [sortedColumnIds],
  );

  // Performance optimization: O(1) sort direction lookup using Map
  const getColumnSortDirection = useCallback(
    (columnId: string) => {
      return sortDirectionMap.get(columnId);
    },
    [sortDirectionMap],
  );

  // Performance optimization: O(1) filtered column check using Set
  const isColumnFiltered = useCallback(
    (columnId: string) => {
      return filteredColumnIds.has(columnId);
    },
    [filteredColumnIds],
  );

  return {
    filteredData,
    isCellHighlighted,
    isColumnSorted,
    getColumnSortDirection,
    isColumnFiltered,
  };
}
