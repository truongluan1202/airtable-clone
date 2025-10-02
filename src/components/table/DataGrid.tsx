import { useMemo, useRef, useEffect, useState } from "react";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { useDataGridState } from "./hooks/useDataGridState";
import { useDataGridMutations } from "./hooks/useDataGridMutations";
import { useDataGridLogic } from "./hooks/useDataGridLogic";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
// import { useStableRowOrder } from "./hooks/useStableRowOrder";
import * as TableColumns from "./useTableColumns";
import { TableHeader } from "./TableHeader";
// import { TableBody } from "./TableBody";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { DataGridContextMenu } from "./DataGridContextMenu";
import type { DataGridProps } from "./types";
import type { FilterGroup } from "~/types/table";

export function DataGrid({
  data,
  columns = [],
  tableId,
  searchQuery = "",
  onSearchChange: _onSearchChange,
  columnVisibility = {},
  onColumnVisibilityChange: _onColumnVisibilityChange,
  sort = [],
  filters = [],
  enableVirtualization = true,
  // Infinite scroll props
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  // Total rows for complete table structure
  totalRows,
  // Bulk loading props
  isBulkLoading = false,
  bulkLoadingMessage = "Adding rows...",
  // Data loading state to disable operations
  isDataLoading = false,
}: DataGridProps & {
  filters?: FilterGroup[];
  enableVirtualization?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  totalRows?: number;
  isDataLoading?: boolean;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Memoize data and columns to ensure stable references
  const stableData = useMemo(() => data, [data]);
  const stableColumns = useMemo(() => columns, [columns]);

  // Custom hooks for state management
  const {
    selectedRows,
    selectedCell,
    editingCell,
    showAddColumnDropdown,
    openColumnDropdown,
    contextMenu,
    setCellValues,
    setSelectedCell,
    setShowAddColumnDropdown,
    setOpenColumnDropdown,
    setContextMenu,
    handleCellSelect,
    handleCellEdit,
    handleCellStopEdit,
    toggleRowSelection,
    handleContextMenu,
    getCellValue,
    isEditing,
  } = useDataGridState();

  // Custom hooks for API mutations
  const {
    handleAddColumn,
    handleAddRow,
    handleDeleteRow,
    handleDeleteColumn,
    handleCellUpdate,
    isAddingColumn,
    isAddingRow,
    isDeletingRow,
    isDeletingColumn,
  } = useDataGridMutations(tableId, isDataLoading);

  // Custom hook for search and sort logic
  const {
    filteredData,
    isCellHighlighted,
    isColumnSorted,
    getColumnSortDirection,
    isColumnFiltered,
  } = useDataGridLogic(stableData, stableColumns, searchQuery, sort, filters);

  // Handle click outside to close dropdowns, context menu, and clear cell selection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Handle context menu
      if (contextMenu) {
        // Check if the click is on the context menu itself
        if (!target.closest(".context-menu")) {
          setContextMenu(null);
        }
      }

      // Handle cell selection - clear selected cell when clicking outside the table
      if (selectedCell && tableRef.current) {
        // Check if the click is inside the table
        if (!tableRef.current.contains(target)) {
          setSelectedCell(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu, setContextMenu, selectedCell, setSelectedCell]);

  // Get visible columns based on column visibility settings
  const visibleColumns = useMemo(() => {
    return stableColumns.filter((column) => {
      // If columnVisibility is empty or column not in visibility state, show by default
      if (
        Object.keys(columnVisibility).length === 0 ||
        !(column.id in columnVisibility)
      ) {
        return true;
      }
      // Otherwise, use the visibility setting
      return columnVisibility[column.id] === true;
    });
  }, [stableColumns, columnVisibility]);

  // Create table columns using the custom hook
  const tableColumns = TableColumns.useTableColumns({
    visibleColumns,
    selectedRows,
    toggleRowSelection,
    getCellValue,
    handleCellUpdate: (rowId: string, columnId: string, value: string) =>
      handleCellUpdate(rowId, columnId, value, stableColumns, setCellValues),
    isEditing,
    handleCellEdit,
    handleCellSelect,
    handleCellStopEdit,
    showAddColumnDropdown,
    setShowAddColumnDropdown,
    handleAddColumn,
    handleDeleteColumn,
    openColumnDropdown,
    setOpenColumnDropdown,
    isColumnSorted,
    getColumnSortDirection,
    isRowHovered: (rowId: string) => hoveredRowId === rowId,
    isAddingColumn,
    isDeletingColumn,
    isDataLoading,
  });

  // Keyboard navigation hook
  const { handleKeyDown } = useKeyboardNavigation({
    selectedCell,
    filteredData,
    visibleColumns,
    handleCellSelect,
    handleCellEdit,
    editingCell,
  });

  // Create the table instance
  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility,
    },
  });

  if (enableVirtualization) {
    return (
      <div ref={tableRef} className="relative flex h-full flex-col">
        {/* Header - always visible */}
        <div className="flex-shrink-0 border-b border-gray-200">
          <table style={{ tableLayout: "fixed", width: "auto" }}>
            <TableHeader
              headerGroups={table.getHeaderGroups()}
              isColumnSorted={isColumnSorted}
              isColumnFiltered={isColumnFiltered}
            />
          </table>
        </div>

        {/* Virtualized Body - takes remaining space */}
        <div
          className="relative flex-1 overflow-hidden focus:outline-none"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <VirtualizedTableBody
            rows={table.getRowModel().rows}
            columns={stableColumns}
            selectedCell={selectedCell}
            searchQuery={searchQuery}
            isColumnSorted={isColumnSorted}
            isColumnFiltered={isColumnFiltered}
            isCellHighlighted={isCellHighlighted}
            getCellValue={getCellValue}
            handleContextMenu={handleContextMenu}
            handleAddRow={() => handleAddRow()}
            visibleColumns={visibleColumns}
            // Infinite scroll props
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
            // Row hover state
            onRowHover={setHoveredRowId}
            // Loading states
            isAddingRow={isAddingRow}
            isDataLoading={isDataLoading}
            // Total rows for complete table structure
            totalRows={totalRows}
          />

          {/* Bulk Loading Overlay */}
          {isBulkLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {bulkLoadingMessage}
                    </p>
                    <p className="text-xs text-gray-500">
                      Please wait while we add the rows...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row Counter Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              {filteredData.length === data.length
                ? `${data.length} row${data.length !== 1 ? "s" : ""}`
                : `${filteredData.length} of ${data.length} row${data.length !== 1 ? "s" : ""} shown`}
              {hasNextPage && (
                <span className="text-gray-400"> (+ more available)</span>
              )}
            </span>
            {hasNextPage && (
              <span className="text-gray-500">
                {isFetchingNextPage ? "Loading more..." : "More data available"}
              </span>
            )}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <DataGridContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            rowId={contextMenu.rowId}
            onDeleteRow={handleDeleteRow}
            onClose={() => setContextMenu(null)}
            isDeletingRow={isDeletingRow}
            isDataLoading={isDataLoading}
          />
        )}
      </div>
    );
  }
}
