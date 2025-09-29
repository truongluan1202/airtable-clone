import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender } from "@tanstack/react-table";
import type { Row } from "@tanstack/react-table";
import type { DataRow, Column, CellSelection } from "./types";

interface VirtualizedTableBodyProps {
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
  // Infinite scroll props
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  // Row hover state
  onRowHover?: (rowId: string | null) => void;
}

export function VirtualizedTableBody({
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
  visibleColumns: _visibleColumns,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  onRowHover,
}: VirtualizedTableBodyProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length + 1 + (isFetchingNextPage ? 1 : 0), // +1 for "Add row" button, +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above and below the visible area
  });

  console.log("🎯 Virtualizer state:", {
    totalCount: rows.length + 1 + (isFetchingNextPage ? 1 : 0),
    rowsLength: rows.length,
    isFetchingNextPage,
    hasNextPage,
    virtualItems: virtualizer.getVirtualItems().length,
  });

  // Infinite scroll logic using scroll event
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

      if (isNearBottom && hasNextPage && !isFetchingNextPage && fetchNextPage) {
        console.log("🔄 Fetching next page (scroll trigger)...", {
          scrollTop,
          scrollHeight,
          clientHeight,
          hasNextPage,
          isFetchingNextPage,
        });
        fetchNextPage();
      }
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  // Also check on virtual items change - using a ref to avoid dependency issues
  const checkVirtualItems = useCallback(() => {
    const virtualItems = virtualizer.getVirtualItems();
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    // Check if we're near the end (within 10 items of the last item)
    if (
      lastItem.index >= rows.length - 10 &&
      hasNextPage &&
      !isFetchingNextPage &&
      fetchNextPage
    ) {
      console.log("🔄 Fetching next page (virtual items trigger)...", {
        lastItemIndex: lastItem.index,
        rowsLength: rows.length,
        hasNextPage,
        isFetchingNextPage,
      });
      fetchNextPage();
    }
  }, [
    virtualizer,
    rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    checkVirtualItems();
  }, [checkVirtualItems]);

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto" // Fixed height for virtualization
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "auto",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const isAddRowButton = virtualRow.index === rows.length;
          const isLoadingIndicator = virtualRow.index === rows.length + 1;

          if (isAddRowButton) {
            return (
              <div
                key="add-row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "auto",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex items-center border-b border-gray-200 px-3 py-2">
                  <button
                    onClick={handleAddRow}
                    className="flex items-center space-x-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Add a record</span>
                  </button>
                </div>
              </div>
            );
          }

          if (isLoadingIndicator) {
            return (
              <div
                key="loading"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "auto",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex items-center justify-center border-b border-gray-200 px-3 py-2">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    <span>Loading more rows...</span>
                  </div>
                </div>
              </div>
            );
          }

          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={row.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "auto",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="flex border-b border-gray-200 hover:bg-gray-50"
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
                    isCellHighlighted(
                      row.original.id,
                      cell.column.id,
                      cellValue,
                    );

                  return (
                    <div
                      key={cell.id}
                      className={`min-w-0 flex-1 ${!isFirstColumn ? "border-r" : ""} border-b border-gray-200 px-3 py-2 ${
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
