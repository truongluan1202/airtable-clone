import Image from "next/image";
import { flexRender } from "@tanstack/react-table";
import type { Row } from "@tanstack/react-table";
import type { DataRow, Column, CellSelection } from "./types";

interface TableBodyProps {
  rows: Row<DataRow>[];
  columns: Column[];
  selectedCell: CellSelection | null;
  searchQuery: string;
  isColumnSorted: (columnId: string) => boolean;
  isCellHighlighted: (
    rowId: string,
    columnId: string,
    cellValue: string,
  ) => boolean;
  getCellValue: (
    rowId: string,
    columnId: string,
    defaultValue?: string,
  ) => string;
  handleContextMenu: (e: React.MouseEvent, rowId: string) => void;
  handleAddRow: () => void;
  visibleColumns: Column[];
}

export function TableBody({
  rows,
  columns,
  selectedCell,
  searchQuery,
  isColumnSorted,
  isCellHighlighted,
  getCellValue,
  handleContextMenu,
  handleAddRow,
  visibleColumns,
}: TableBodyProps) {
  return (
    <tbody>
      {rows.map((row, _rowIndex) => (
        <tr
          key={row.id}
          className="border-b border-gray-200 hover:bg-gray-50"
          onContextMenu={(e) => handleContextMenu(e, row.original.id)}
        >
          {row.getVisibleCells().map((cell, _columnIndex) => {
            const isSelected =
              selectedCell?.rowId === row.original.id &&
              selectedCell?.columnId === cell.column.id;
            const columnIsSorted = isColumnSorted(cell.column.id);

            // Get the column name for data access (row data is keyed by column names, not IDs)
            const columnName = columns.find(
              (col) => col.id === cell.column.id,
            )?.name;
            const cellValue = getCellValue(
              row.original.id,
              cell.column.id,
              columnName ? (row.original[columnName] ?? "") : "",
            );

            // Debug: Check what's in the row data
            if (
              searchQuery.trim() &&
              cell.column.id !== "addColumn" &&
              cell.column.id !== "select"
            ) {
              console.log("🔍 Row data debug:", {
                rowId: row.original.id,
                columnId: cell.column.id,
                columnName,
                cellValue,
                rawRowData: row.original,
                directAccess: columnName
                  ? row.original[columnName]
                  : "no column name",
              });
            }

            // Skip search highlighting for non-data columns
            const isSearchHighlighted =
              cell.column.id !== "addColumn" &&
              cell.column.id !== "select" &&
              isCellHighlighted(row.original.id, cell.column.id, cellValue);

            // Debug logging
            if (searchQuery.trim()) {
              console.log("🔍 Highlight check:", {
                rowId: row.original.id,
                columnId: cell.column.id,
                cellValue,
                searchQuery,
                isSearchHighlighted,
                isDataColumn:
                  cell.column.id !== "addColumn" && cell.column.id !== "select",
              });
            }

            return (
              <td
                key={cell.id}
                className={`px-3 py-2 ${
                  isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
                } ${columnIsSorted ? "bg-[#fff2e9]" : ""} ${
                  isSearchHighlighted ? "!bg-[#f6c974]" : ""
                }`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            );
          })}
        </tr>
      ))}

      {/* Add row button */}
      <tr>
        <td colSpan={visibleColumns.length} className="px-3 py-2">
          <button
            onClick={handleAddRow}
            className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <Image src="/icons/plus.svg" alt="Add row" width={16} height={16} />
            <span>Add a record</span>
          </button>
        </td>
      </tr>
    </tbody>
  );
}
