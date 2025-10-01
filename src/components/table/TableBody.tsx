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
  isColumnFiltered: (columnId: string) => boolean;
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
  // Row hover state
  onRowHover?: (rowId: string | null) => void;
  // Loading states
  isAddingRow?: boolean;
  isDataLoading?: boolean;
}

export function TableBody({
  rows,
  columns,
  selectedCell,
  searchQuery: _searchQuery,
  isColumnSorted,
  isColumnFiltered,
  isCellHighlighted,
  getCellValue,
  handleContextMenu,
  handleAddRow,
  visibleColumns,
  onRowHover,
  isAddingRow = false,
  isDataLoading = false,
}: TableBodyProps) {
  return (
    <tbody>
      {rows.map((row, _rowIndex) => (
        <tr
          key={row.id}
          className="border-b border-gray-200 hover:bg-gray-50"
          onContextMenu={(e) => handleContextMenu(e, row.original.id)}
          onMouseEnter={() => onRowHover?.(row.original.id)}
          onMouseLeave={() => onRowHover?.(null)}
        >
          {row.getVisibleCells().map((cell, columnIndex) => {
            // Skip rendering cells for the "addColumn" column
            if (cell.column.id === "addColumn") {
              return null;
            }

            const isSelected =
              selectedCell?.rowId === row.original.id &&
              selectedCell?.columnId === cell.column.id;
            const columnIsSorted = isColumnSorted(cell.column.id);
            const columnIsFiltered = isColumnFiltered(cell.column.id);
            const isFirstColumn = columnIndex === 0;

            // Get the column name for data access (row data is keyed by column names, not IDs)
            const columnName = columns.find(
              (col) => col.id === cell.column.id,
            )?.name;
            const cellValue = getCellValue(
              row.original.id,
              cell.column.id,
              columnName ? (row.original[columnName] ?? "") : "",
            );

            // Skip search highlighting for non-data columns
            const isSearchHighlighted =
              cell.column.id !== "addColumn" &&
              cell.column.id !== "select" &&
              isCellHighlighted(row.original.id, cell.column.id, cellValue);

            return (
              <td
                key={cell.id}
                className={`${!isFirstColumn ? "border-r" : ""} border-b border-gray-200 px-3 py-2 ${
                  isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
                } ${columnIsSorted ? "bg-[#fff2e9]" : ""} ${
                  columnIsFiltered ? "!bg-[#ecfcec]" : ""
                } ${isSearchHighlighted ? "!bg-[#fff3d3]" : ""}`}
                style={{
                  width: cell.column.getSize() || 200,
                  minWidth: cell.column.getSize() || 200,
                  maxWidth: cell.column.getSize() || 200,
                }}
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
            disabled={isAddingRow || isDataLoading}
            className="flex items-center space-x-2 text-xs text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              isDataLoading ? "Cannot add row while data is loading" : undefined
            }
          >
            {isAddingRow ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
            ) : (
              <Image
                src="/icons/plus.svg"
                alt="Add row"
                width={16}
                height={16}
              />
            )}
            <span>{isAddingRow ? "Adding..." : "Add a record"}</span>
          </button>
        </td>
      </tr>
    </tbody>
  );
}
