import { useState } from "react";
import type { Column, SortConfig } from "~/types/table";

interface TableHeaderProps {
  columns: Column[];
  sort: SortConfig[];
  onSort: (sort: SortConfig[]) => void;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  columnVisibility: Record<string, boolean>;
  onAddColumn?: () => void;
  onDeleteColumn?: (columnId: string) => void;
}

export function TableHeader({
  columns,
  sort,
  onSort,
  onColumnVisibilityChange,
  columnVisibility,
  onAddColumn,
  onDeleteColumn,
}: TableHeaderProps) {
  const [showColumnMenu, setShowColumnMenu] = useState<string | null>(null);

  const handleSort = (columnId: string) => {
    const currentSort = sort.find((s) => s.columnId === columnId);
    let newSort: SortConfig[];

    if (!currentSort) {
      // Add new sort (ascending)
      newSort = [...sort, { columnId, direction: "asc" }];
    } else if (currentSort.direction === "asc") {
      // Change to descending
      newSort = sort.map((s) =>
        s.columnId === columnId ? { ...s, direction: "desc" as const } : s,
      );
    } else {
      // Remove sort
      newSort = sort.filter((s) => s.columnId !== columnId);
    }

    onSort(newSort);
  };

  const getSortIcon = (columnId: string) => {
    const currentSort = sort.find((s) => s.columnId === columnId);
    if (!currentSort) return "↕️";
    return currentSort.direction === "asc" ? "↑" : "↓";
  };

  const toggleColumnMenu = (columnId: string) => {
    setShowColumnMenu(showColumnMenu === columnId ? null : columnId);
  };

  return (
    <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-gray-50">
      {/* Row number column */}
      <div className="flex w-12 flex-shrink-0 items-center justify-center border-r border-gray-200 bg-gray-100">
        <span className="text-xs font-medium text-gray-500">#</span>
      </div>

      {/* Data columns */}
      {columns.map((column) => {
        const isVisible = columnVisibility[column.id] !== false;
        if (!isVisible) return null;

        return (
          <div
            key={column.id}
            className="group relative min-w-32 flex-1 border-r border-gray-200"
          >
            <div className="flex h-10 items-center justify-between p-2">
              <button
                onClick={() => handleSort(column.id)}
                className="flex flex-1 items-center space-x-1 text-left text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>{column.name}</span>
                <span className="text-xs">{getSortIcon(column.id)}</span>
              </button>

              <button
                onClick={() => toggleColumnMenu(column.id)}
                className="p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>

            {/* Column menu dropdown */}
            {showColumnMenu === column.id && (
              <div className="absolute top-full left-0 z-20 min-w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onColumnVisibilityChange(column.id, false);
                      setShowColumnMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Hide field
                  </button>
                  <div className="my-1 border-t border-gray-100"></div>
                  <button
                    onClick={() => {
                      onDeleteColumn?.(column.id);
                      setShowColumnMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete field
                  </button>
                  <div className="my-1 border-t border-gray-100"></div>
                  <div className="px-3 py-2 text-xs text-gray-500">
                    Type: {column.type}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add column button */}
      <div className="flex w-32 flex-shrink-0 items-center justify-center">
        <button
          onClick={onAddColumn}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
