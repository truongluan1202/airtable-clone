import { useRef, useEffect } from "react";
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
  // Loading states
  isAddingRow?: boolean;
  isDataLoading?: boolean;
  // Total rows for complete table structure
  totalRows?: number;
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
  isAddingRow = false,
  isDataLoading = false,
  totalRows = 0,
}: VirtualizedTableBodyProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Create a complete table structure with all rows (real + skeleton)
  const completeRowCount = Math.max(totalRows, rows.length) + 1; // +1 for "Add row" button

  const virtualizer = useVirtualizer({
    count: completeRowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41, // Estimated row height in pixels (40px + 1px border)
    overscan: 10, // Reduced overscan for better performance
    measureElement: undefined, // Disable dynamic measurement for better performance
    getItemKey: (index) => {
      // Stable keys to prevent row remounting as skeletons resolve
      if (index === completeRowCount - 1) return "add-row";
      if (index < rows.length) return rows[index]?.id ?? `real-${index}`;
      return `skeleton-${index}`;
    },
  });

  // console.log("🎯 Complete table structure:", { totalRows, loadedRows: rows.length, completeRowCount, virtualItems: virtualizer.getVirtualItems().length, hasNextPage, isFetchingNextPage });

  // Automatic background fetching - capped at ≤2 in flight
  useEffect(() => {
    // Always try to fetch more data if we have less than total rows
    if (
      totalRows > 0 &&
      rows.length < totalRows &&
      !isFetchingNextPage &&
      fetchNextPage
    ) {
      // console.log("🚀 Auto-fetching more data...", { hasNextPage, isFetchingNextPage, fetchNextPage: !!fetchNextPage, totalRows, loadedRows: rows.length, remainingRows: totalRows - rows.length });

      // Fetch immediately without delay
      fetchNextPage();
    }
  }, [totalRows, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Limited parallel look-ahead fetching (≤2 requests in parallel)
  useEffect(() => {
    if (
      totalRows > 0 &&
      rows.length < totalRows &&
      !isFetchingNextPage &&
      fetchNextPage &&
      hasNextPage
    ) {
      // Calculate how many more requests we can make in parallel
      const remainingRows = totalRows - rows.length;
      // Backend handles dynamic page sizing: first page = 500, subsequent = ALL remaining rows
      const pageSize = remainingRows; // Backend loads all remaining rows in one go
      const remainingPages = 1; // Only one more request needed
      const maxParallelRequests = 1; // Only one request for all remaining data

      // Since backend loads all remaining rows in one go, no additional parallel requests needed
      // The main auto-fetch effect above will handle the single request for all remaining data
    }
  }, [totalRows, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Also keep scroll-based loading as backup
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement || !hasNextPage || isFetchingNextPage || !fetchNextPage)
      return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

      // Fetch more data when user scrolls 70% through the table (backup trigger)
      if (scrollPercentage > 0.7) {
        // console.log("📊 Scroll-based loading triggered at", Math.round(scrollPercentage * 100) + "%");
        fetchNextPage();
      }
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto bg-[#f6f8fc] pb-50" // Full height for virtualization
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
          const isAddRowButton = virtualRow.index === completeRowCount - 1; // Last row is "Add row" button
          const isRealRow = virtualRow.index < rows.length;
          const isSkeletonRow =
            virtualRow.index >= rows.length && !isAddRowButton;

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
                  transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                  willChange: "transform",
                }}
              >
                <div className="flex w-full items-center border-r border-b border-gray-200 bg-white px-3 py-2">
                  <button
                    onClick={handleAddRow}
                    disabled={isAddingRow || isDataLoading}
                    className="flex items-center space-x-2 text-xs text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      isDataLoading
                        ? "Cannot add row while data is loading"
                        : undefined
                    }
                  >
                    {isAddingRow ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    ) : (
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
                    )}
                    <span>{isAddingRow ? "Adding..." : "Add a record"}</span>
                  </button>
                </div>
              </div>
            );
          }

          if (isSkeletonRow) {
            // Calculate the actual row number for this skeleton row
            const actualRowNumber = virtualRow.index + 1;

            return (
              <div
                key={`skeleton-${virtualRow.index}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "auto",
                  height: `${virtualRow.size}px`,
                  transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                  willChange: "transform",
                  backgroundColor: "#fafbfc", // Skeleton background
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div
                  className="flex hover:bg-gray-50"
                  style={{ height: "40px" }}
                >
                  {/* Render skeleton cells to match real row structure */}
                  {rows.length > 0 && rows[0]
                    ? // Use the first real row's cell structure as template
                      rows[0].getVisibleCells().map((cell, columnIndex) => {
                        // Skip rendering cells for the "addColumn" column (same as real rows)
                        if (cell.column.id === "addColumn") {
                          return null;
                        }

                        const isFirstColumn = columnIndex === 0;

                        return (
                          <div
                            key={`skeleton-${virtualRow.index}-${cell.column.id}`}
                            className={`min-w-0 flex-1 ${!isFirstColumn ? "border-r" : ""} flex items-center border-b border-gray-200 px-3 py-2`}
                            style={{
                              width: cell.column.getSize() || 200,
                              minWidth: cell.column.getSize() || 200,
                              maxWidth: cell.column.getSize() || 200,
                              height: "40px",
                            }}
                          >
                            {cell.column.id === "select" ? (
                              // Show row number for selection column
                              <div className="flex items-center justify-center">
                                <span className="text-xs text-gray-500">
                                  {actualRowNumber}
                                </span>
                              </div>
                            ) : (
                              // Show skeleton placeholder for data columns
                              <div className="h-4 w-24 animate-pulse rounded bg-gray-200 opacity-60"></div>
                            )}
                          </div>
                        );
                      })
                    : // Fallback if no real rows yet - create consistent structure with select + data columns + addColumn
                      [
                        // Select column
                        <div
                          key={`skeleton-${virtualRow.index}-select`}
                          className="flex min-w-0 flex-1 items-center border-b border-gray-200 px-3 py-2"
                          style={{
                            width: 85,
                            minWidth: 85,
                            maxWidth: 85,
                            height: "40px",
                          }}
                        >
                          <div className="flex items-center justify-center">
                            <span className="text-xs text-gray-500">
                              {actualRowNumber}
                            </span>
                          </div>
                        </div>,
                        // Data columns
                        ...columns.map((column, _columnIndex) => (
                          <div
                            key={`skeleton-${virtualRow.index}-${column.id}`}
                            className="flex min-w-0 flex-1 items-center border-r border-b border-gray-200 px-3 py-2"
                            style={{
                              width: 200,
                              minWidth: 200,
                              maxWidth: 200,
                              height: "40px",
                            }}
                          >
                            <div className="h-4 w-24 animate-pulse rounded bg-gray-200 opacity-60"></div>
                          </div>
                        )),
                      ]}
                </div>
              </div>
            );
          }

          // Render real row data
          if (isRealRow) {
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
                  transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                  willChange: "transform",
                  backgroundColor: "white",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div
                  className="flex hover:bg-gray-50"
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
          }

          // This should never happen, but return null as fallback
          return null;
        })}
      </div>
    </div>
  );
}
