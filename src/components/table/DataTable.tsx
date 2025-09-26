import { useCallback, useState } from "react";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { SearchAndFilterBar } from "./SearchAndFilterBar";
import { ContextMenu } from "./ContextMenu";
import { useTableState } from "~/hooks/useTableState";
import type { Table, Row, Column, CellEditState } from "~/types/table";

interface DataTableProps {
  table: Table;
  onCellUpdate?: (
    rowId: string,
    columnId: string,
    value: string | number,
  ) => void;
  onAddRow?: () => void;
  onAddColumn?: () => void;
  onDeleteRow?: (rowId: string) => void;
  onDeleteColumn?: (columnId: string) => void;
}

export function DataTable({
  table,
  onCellUpdate,
  onAddRow,
  onAddColumn,
  onDeleteRow,
  onDeleteColumn,
}: DataTableProps) {
  const {
    state,
    setSelectedCell,
    setEditingCell,
    setSearchQuery,
    addFilter,
    removeFilter,
    setSort,
    toggleColumnVisibility,
    clearFilters,
  } = useTableState(table.columns);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    type: "row" | "column" | "cell";
    targetId: string;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    type: "cell",
    targetId: "",
  });

  const handleCellSelect = useCallback(
    (rowId: string, columnId: string) => {
      const cell = table.rows
        .find((row) => row.id === rowId)
        ?.cells.find((cell) => cell.columnId === columnId);

      const value = cell?.vText ?? cell?.vNumber ?? "";

      setSelectedCell({
        rowId,
        columnId,
        value,
        isEditing: false,
      });
    },
    [table.rows, setSelectedCell],
  );

  const handleCellEdit = useCallback(
    (rowId: string, columnId: string) => {
      const cell = table.rows
        .find((row) => row.id === rowId)
        ?.cells.find((cell) => cell.columnId === columnId);

      const value = cell?.vText ?? cell?.vNumber ?? "";

      setEditingCell({
        rowId,
        columnId,
        value,
        isEditing: true,
      });
    },
    [table.rows, setEditingCell],
  );

  const handleCellSave = useCallback(
    (rowId: string, columnId: string, value: string | number) => {
      setEditingCell(null);
      setSelectedCell(null);

      if (onCellUpdate) {
        onCellUpdate(rowId, columnId, value);
      }
    },
    [setEditingCell, setSelectedCell, onCellUpdate],
  );

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);

  const handleRowRightClick = useCallback(
    (event: React.MouseEvent, rowId: string) => {
      event.preventDefault();
      setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        type: "row",
        targetId: rowId,
      });
    },
    [],
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      onDeleteRow?.(rowId);
    },
    [onDeleteRow],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      onDeleteColumn?.(columnId);
    },
    [onDeleteColumn],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!state.selectedCell) return;

      const { rowId, columnId } = state.selectedCell;
      const currentRowIndex = table.rows.findIndex((row) => row.id === rowId);
      const currentColumnIndex = table.columns.findIndex(
        (col) => col.id === columnId,
      );

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (currentRowIndex > 0) {
            const prevRow = table.rows[currentRowIndex - 1];
            if (prevRow) {
              handleCellSelect(prevRow.id, columnId);
            }
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (currentRowIndex < table.rows.length - 1) {
            const nextRow = table.rows[currentRowIndex + 1];
            if (nextRow) {
              handleCellSelect(nextRow.id, columnId);
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentColumnIndex > 0) {
            const prevColumn = table.columns[currentColumnIndex - 1];
            if (prevColumn) {
              handleCellSelect(rowId, prevColumn.id);
            }
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentColumnIndex < table.columns.length - 1) {
            const nextColumn = table.columns[currentColumnIndex + 1];
            if (nextColumn) {
              handleCellSelect(rowId, nextColumn.id);
            }
          }
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Tab: move left
            if (currentColumnIndex > 0) {
              const prevColumn = table.columns[currentColumnIndex - 1];
              if (prevColumn) {
                handleCellSelect(rowId, prevColumn.id);
              }
            }
          } else {
            // Tab: move right
            if (currentColumnIndex < table.columns.length - 1) {
              const nextColumn = table.columns[currentColumnIndex + 1];
              if (nextColumn) {
                handleCellSelect(rowId, nextColumn.id);
              }
            }
          }
          break;
      }
    },
    [state.selectedCell, table.rows, table.columns, handleCellSelect],
  );

  // Filter and sort data
  const filteredAndSortedRows = useCallback(() => {
    let filtered = table.rows;

    // Apply search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (row) =>
          row.search?.toLowerCase().includes(query) ??
          Object.values(row.cache ?? {}).some((value) =>
            String(value).toLowerCase().includes(query),
          ),
      );
    }

    // Apply column filters
    state.filters.forEach((filter) => {
      filtered = filtered.filter((row) => {
        const value = row.cache?.[filter.columnId] as
          | string
          | number
          | undefined;

        switch (filter.operator) {
          case "equals":
            return String(value) === String(filter.value);
          case "not_equals":
            return String(value) !== String(filter.value);
          case "contains":
            return String(value)
              .toLowerCase()
              .includes(String(filter.value).toLowerCase());
          case "not_contains":
            return !String(value)
              .toLowerCase()
              .includes(String(filter.value).toLowerCase());
          case "greater_than":
            return Number(value) > Number(filter.value);
          case "less_than":
            return Number(value) < Number(filter.value);
          case "is_empty":
            return !value || String(value).trim() === "";
          case "is_not_empty":
            return value && String(value).trim() !== "";
          default:
            return true;
        }
      });
    });

    // Apply sorting
    if (state.sort.length > 0) {
      filtered.sort((a, b) => {
        for (const sortConfig of state.sort) {
          const aValue = a.cache?.[sortConfig.columnId] as
            | string
            | number
            | undefined;
          const bValue = b.cache?.[sortConfig.columnId] as
            | string
            | number
            | undefined;

          let comparison = 0;
          if ((aValue ?? "") < (bValue ?? "")) comparison = -1;
          if ((aValue ?? "") > (bValue ?? "")) comparison = 1;

          if (comparison !== 0) {
            return sortConfig.direction === "desc" ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    return filtered;
  }, [table.rows, state.searchQuery, state.filters, state.sort]);

  const visibleRows = filteredAndSortedRows();

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Search and Filter Bar */}
      <SearchAndFilterBar
        searchQuery={state.searchQuery}
        onSearchChange={setSearchQuery}
        filters={state.filters}
        columns={table.columns}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        onClearFilters={clearFilters}
      />

      {/* Table */}
      <div
        className="flex-1 overflow-auto"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Header */}
        <TableHeader
          columns={table.columns}
          sort={state.sort}
          onSort={setSort}
          onColumnVisibilityChange={toggleColumnVisibility}
          columnVisibility={state.columnVisibility}
          onAddColumn={onAddColumn}
          onDeleteColumn={handleDeleteColumn}
        />

        {/* Rows */}
        <div className="min-h-0">
          {visibleRows.length > 0 ? (
            visibleRows.map((row, index) => (
              <TableRow
                key={row.id}
                row={row}
                rowIndex={index}
                columns={table.columns}
                selectedCell={state.selectedCell}
                editingCell={state.editingCell}
                columnVisibility={state.columnVisibility}
                onCellSelect={handleCellSelect}
                onCellEdit={handleCellEdit}
                onCellSave={handleCellSave}
                onCellCancel={handleCellCancel}
                onRowRightClick={handleRowRightClick}
              />
            ))
          ) : (
            <div className="flex h-32 items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">No records found</p>
                <p className="text-sm">
                  {state.searchQuery || state.filters.length > 0
                    ? "Try adjusting your search or filters"
                    : "Add some data to get started"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Add Row Button */}
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={onAddRow}
            className="w-full rounded border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
          >
            + Add a record
          </button>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={handleContextMenuClose}
        onDeleteRow={() => handleDeleteRow(contextMenu.targetId)}
        onDeleteColumn={() => handleDeleteColumn(contextMenu.targetId)}
        onAddColumn={onAddColumn}
        type={contextMenu.type}
      />
    </div>
  );
}
