import React, { useMemo } from "react";
import Image from "next/image";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { EditableCell } from "./EditableCell";
import { AddColumnDropdown } from "./AddColumnDropdown";
import { ColumnDropdown } from "./ColumnDropdown";
import type { DataRow, Column } from "./types";

// Component for the select cell with hover effect
function SelectCell({
  rowIndex,
  rowId,
  isSelected,
  onToggle,
  isRowHovered,
}: {
  rowIndex: number;
  rowId: string;
  isSelected: boolean;
  onToggle: (rowId: string) => void;
  isRowHovered: boolean;
}) {
  return (
    <div className="flex items-center justify-center">
      {isRowHovered ? (
        <button
          onClick={() => onToggle(rowId)}
          className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white shadow-sm hover:border-gray-400 hover:bg-gray-50"
        >
          {isSelected && <div className="h-2 w-2 rounded-sm bg-blue-600"></div>}
        </button>
      ) : (
        <span className="text-xs text-gray-500">{rowIndex + 1}</span>
      )}
    </div>
  );
}

interface UseTableColumnsProps {
  visibleColumns: Column[];
  selectedRows: Set<string>;
  toggleRowSelection: (rowId: string) => void;
  getCellValue: (
    rowId: string,
    columnId: string,
    defaultValue?: string,
  ) => string;
  handleCellUpdate: (rowId: string, columnId: string, value: string) => void;
  isEditing: (rowId: string, columnId: string) => boolean;
  isSelected: (rowId: string, columnId: string) => boolean;
  handleCellEdit: (rowId: string, columnId: string) => void;
  handleCellSelect: (rowId: string, columnId: string) => void;
  handleCellStopEdit: () => void;
  showAddColumnDropdown: boolean;
  setShowAddColumnDropdown: (show: boolean) => void;
  handleAddColumn: (name: string, type: "TEXT" | "NUMBER") => void;
  handleDeleteColumn: (columnId: string) => void;
  openColumnDropdown: string | null;
  setOpenColumnDropdown: (columnId: string | null) => void;
  isColumnSorted: (columnId: string) => boolean;
  getColumnSortDirection: (columnId: string) => "asc" | "desc" | undefined;
  isRowHovered?: (rowId: string) => boolean;
}

export function useTableColumns({
  visibleColumns,
  selectedRows,
  toggleRowSelection,
  getCellValue,
  handleCellUpdate,
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
  isRowHovered,
}: UseTableColumnsProps): ColumnDef<DataRow, any>[] {
  const columnHelper = createColumnHelper<DataRow>();

  const tableColumns = useMemo(() => {
    const cols: ColumnDef<DataRow, any>[] = [
      columnHelper.accessor("id", {
        id: "select",
        header: () => (
          <div className="flex items-center justify-center">
            <div className="h-4 w-4 rounded border border-gray-300 bg-white shadow-sm"></div>
          </div>
        ),
        cell: ({ row }) => (
          <SelectCell
            rowIndex={row.index}
            rowId={row.original.id}
            isSelected={selectedRows.has(row.original.id)}
            onToggle={toggleRowSelection}
            isRowHovered={isRowHovered?.(row.original.id) ?? false}
          />
        ),
        size: 60,
      }),
    ];

    // Add dynamic columns based on visible columns
    visibleColumns.forEach((column) => {
      cols.push(
        columnHelper.accessor(column.name, {
          id: column.id,
          header: () => {
            const isSorted = isColumnSorted(column.id);
            const sortDirection = getColumnSortDirection(column.id);

            return (
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  {/* Column type icon */}
                  {column.type === "TEXT" && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <span className="text-xs text-gray-600">A</span>
                    </div>
                  )}
                  {column.type === "NUMBER" && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <span className="text-xs text-gray-600">#</span>
                    </div>
                  )}

                  {/* Column name */}
                  <span
                    className={`text-xs font-medium text-gray-900 ${isSorted ? "font-semibold" : ""}`}
                  >
                    {column.name}
                  </span>

                  {/* Sort indicator */}
                  {isSorted && (
                    <span className="text-xs text-orange-600">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenColumnDropdown(
                      openColumnDropdown === column.id ? null : column.id,
                    );
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded hover:bg-gray-100"
                >
                  <Image
                    src="/icons/chevron-down.svg"
                    alt="option dropdown"
                    width={10}
                    height={10}
                    className="text-gray-400"
                  />
                </button>
                {openColumnDropdown === column.id && (
                  <ColumnDropdown
                    columnId={column.id}
                    columnName={column.name}
                    onDeleteColumn={handleDeleteColumn}
                    onClose={() => setOpenColumnDropdown(null)}
                  />
                )}
              </div>
            );
          },
          cell: ({ row }) => {
            const cellValue = getCellValue(
              row.original.id,
              column.id,
              row.original[column.name] ?? "",
            );
            return (
              <EditableCell
                value={cellValue}
                onUpdate={(value) =>
                  handleCellUpdate(row.original.id, column.id, value)
                }
                isEditing={isEditing(row.original.id, column.id)}
                isSelected={isSelected(row.original.id, column.id)}
                onStartEdit={() => handleCellEdit(row.original.id, column.id)}
                onStopEdit={handleCellStopEdit}
                onSelect={() => handleCellSelect(row.original.id, column.id)}
                placeholder={
                  column.type === "TEXT" ? "Enter text..." : "Enter number..."
                }
                hasDropdown={column.name.toLowerCase().includes("status")}
              />
            );
          },
          size: 200,
        }),
      );
    });

    // Add the "Add Column" button
    cols.push(
      columnHelper.display({
        id: "addColumn",
        header: () => (
          <div className="relative">
            <button
              onClick={() => setShowAddColumnDropdown(!showAddColumnDropdown)}
              className="p-1 text-gray-400 hover:text-gray-900"
            >
              <Image
                src="/icons/plus.svg"
                alt="Add column"
                width={16}
                height={16}
              />
            </button>
            {showAddColumnDropdown && (
              <AddColumnDropdown
                onAddColumn={handleAddColumn}
                onClose={() => setShowAddColumnDropdown(false)}
              />
            )}
          </div>
        ),
        cell: () => null,
        size: 60,
      }),
    );

    return cols;
  }, [
    columnHelper,
    visibleColumns,
    selectedRows,
    toggleRowSelection,
    getCellValue,
    handleCellUpdate,
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
    isRowHovered,
  ]);

  return tableColumns;
}
