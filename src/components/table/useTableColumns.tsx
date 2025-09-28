import React, { useMemo } from "react";
import Image from "next/image";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { EditableCell } from "./EditableCell";
import { AddColumnDropdown } from "./AddColumnDropdown";
import { ColumnDropdown } from "./ColumnDropdown";
import type { DataRow, Column } from "./types";

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
}: UseTableColumnsProps): ColumnDef<DataRow, any>[] {
  const columnHelper = createColumnHelper<DataRow>();

  const tableColumns = useMemo(() => {
    const cols: ColumnDef<DataRow, any>[] = [
      columnHelper.accessor("id", {
        id: "select",
        header: () => (
          <Image
            src="/icons/checkbox.svg"
            alt="Select all"
            width={16}
            height={16}
            className="text-gray-400"
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span className="mr-2 text-sm text-gray-500">{row.index + 1}</span>
            <button
              onClick={() => toggleRowSelection(row.original.id)}
              className="p-1"
            >
              <Image
                src="/icons/checkbox.svg"
                alt="Select row"
                width={16}
                height={16}
                className={`${
                  selectedRows.has(row.original.id)
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              />
            </button>
          </div>
        ),
        size: 48,
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
                <div className="flex items-center space-x-2">
                  <span className={isSorted ? "font-semibold" : ""}>
                    {column.name}
                  </span>
                  {column.type === "TEXT" && (
                    <Image
                      src="/icons/document.svg"
                      alt="Text"
                      width={12}
                      height={12}
                      className="text-gray-400"
                    />
                  )}
                  {column.type === "NUMBER" && (
                    <Image
                      src="/icons/checkbox.svg"
                      alt="Number"
                      width={12}
                      height={12}
                      className="text-gray-400"
                    />
                  )}
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
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100"
                >
                  <Image
                    src="/icons/chevron-down.svg"
                    alt="option dropdown"
                    width={12}
                    height={12}
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
          size: 150,
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
              className="p-1 text-gray-400 hover:text-gray-600"
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
        size: 48,
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
  ]);

  return tableColumns;
}
