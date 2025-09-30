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
  // Loading states
  isAddingColumn?: boolean;
  isDeletingColumn?: boolean;
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
  isAddingColumn = false,
  isDeletingColumn = false,
}: UseTableColumnsProps): ColumnDef<DataRow, any>[] {
  const columnHelper = createColumnHelper<DataRow>();

  console.log("🔥 useTableColumns loading states:", {
    isAddingColumn,
    isDeletingColumn,
  });

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
                    <svg
                      width="16"
                      height="16"
                      fill="currentColor"
                      shape-rendering="geometricprecision"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M8.442 3.266a.5.5 0 0 0-.884 0l-4.5 8.5a.5.5 0 1 0 .884.468L5.125 10h5.75l1.183 2.234a.5.5 0 1 0 .884-.468zM10.346 9 8 4.569 5.654 9z"
                      />
                    </svg>
                  )}
                  {column.type === "NUMBER" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="1em"
                      height="1em"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path d="M216 152h-48v-48h48a8 8 0 0 0 0-16h-48V40a8 8 0 0 0-16 0v48h-48V40a8 8 0 0 0-16 0v48H40a8 8 0 0 0 0 16h48v48H40a8 8 0 0 0 0 16h48v48a8 8 0 0 0 16 0v-48h48v48a8 8 0 0 0 16 0v-48h48a8 8 0 0 0 0-16m-112 0v-48h48v48Z" />
                    </svg>
                  )}

                  {/* Column name */}
                  <span
                    className={`text-xs font-normal text-gray-900 ${isSorted ? "font-semibold" : ""}`}
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
                    isDeletingColumn={isDeletingColumn}
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
              disabled={isAddingColumn}
              className="p-1 text-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAddingColumn ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              ) : (
                <Image
                  src="/icons/plus.svg"
                  alt="Add column"
                  width={16}
                  height={16}
                />
              )}
            </button>
            {showAddColumnDropdown && (
              <AddColumnDropdown
                onAddColumn={handleAddColumn}
                onClose={() => setShowAddColumnDropdown(false)}
                isLoading={isAddingColumn}
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
    isAddingColumn,
    isDeletingColumn,
  ]);

  return tableColumns;
}
