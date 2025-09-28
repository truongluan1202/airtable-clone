import { useMemo, useRef, useEffect } from "react";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { useDataGridState } from "./hooks/useDataGridState";
import { useDataGridMutations } from "./hooks/useDataGridMutations";
import { useDataGridLogic } from "./hooks/useDataGridLogic";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useStableRowOrder } from "./hooks/useStableRowOrder";
import * as TableColumns from "./useTableColumns";
import { TableHeader } from "./TableHeader";
import { TableBody } from "./TableBody";
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
}: DataGridProps & { filters?: FilterGroup[] }) {
  console.log("🔥 DataGrid rendered with tableId:", tableId);
  console.log("🔍 Search query in DataGrid:", searchQuery);

  const tableRef = useRef<HTMLTableElement>(null);

  // Maintain stable row order to prevent reordering on cell clicks
  const stableData = useStableRowOrder(data);

  // Custom hooks for state management
  const {
    selectedRows,
    selectedCell,
    editingCell,
    showAddColumnDropdown,
    openColumnDropdown,
    contextMenu,
    setCellValues,
    setShowAddColumnDropdown,
    setOpenColumnDropdown,
    setContextMenu,
    handleCellSelect,
    handleCellEdit,
    handleCellStopEdit,
    toggleRowSelection,
    handleContextMenu,
    getCellValue,
    isSelected,
    isEditing,
  } = useDataGridState();

  // Custom hooks for API mutations
  const {
    handleAddColumn,
    handleAddRow,
    handleDeleteRow,
    handleDeleteColumn,
    handleCellUpdate,
  } = useDataGridMutations(tableId);

  // Custom hook for search and sort logic
  const {
    filteredData,
    isCellHighlighted,
    isColumnSorted,
    getColumnSortDirection,
  } = useDataGridLogic(stableData, columns, searchQuery, sort, filters);

  // Handle click outside to close dropdowns and context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu) {
        // Check if the click is on the context menu itself
        const target = event.target as Element;
        if (!target.closest(".context-menu")) {
          setContextMenu(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu, setContextMenu]);

  // Get visible columns based on column visibility settings
  const visibleColumns = useMemo(() => {
    return columns.filter((column) => {
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
  }, [columns, columnVisibility]);

  // Create table columns using the custom hook
  const tableColumns = TableColumns.useTableColumns({
    visibleColumns,
    selectedRows,
    toggleRowSelection,
    getCellValue,
    handleCellUpdate: (rowId: string, columnId: string, value: string) =>
      handleCellUpdate(rowId, columnId, value, columns, setCellValues),
    isEditing,
    isSelected,
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

  return (
    <div className="h-full overflow-auto">
      <table
        ref={tableRef}
        className="w-full"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <TableHeader
          headerGroups={table.getHeaderGroups()}
          isColumnSorted={isColumnSorted}
        />
        <TableBody
          rows={table.getRowModel().rows}
          columns={columns}
          selectedCell={selectedCell}
          searchQuery={searchQuery}
          isColumnSorted={isColumnSorted}
          isCellHighlighted={isCellHighlighted}
          getCellValue={getCellValue}
          handleContextMenu={handleContextMenu}
          handleAddRow={() => handleAddRow()}
          visibleColumns={visibleColumns}
        />
      </table>

      {/* Context Menu */}
      {contextMenu && (
        <DataGridContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          rowId={contextMenu.rowId}
          onDeleteRow={handleDeleteRow}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
