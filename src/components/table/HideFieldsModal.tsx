import { useState, useRef, useEffect } from "react";

interface Column {
  id: string;
  name: string;
  type: string;
}

interface HideFieldsDropdownProps {
  columns: Column[];
  visibleColumns: Record<string, boolean>;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onBatchColumnVisibilityChange?: (updates: Record<string, boolean>) => void;
  onClose: () => void;
}

export function HideFieldsDropdown({
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  onBatchColumnVisibilityChange,
  onClose,
}: HideFieldsDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter columns based on search query
  const filteredColumns = columns.filter((column) =>
    column.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleHideAll = () => {
    // Batch all hide operations to avoid multiple rapid calls
    const updates = columns.reduce(
      (acc, column) => {
        acc[column.id] = false;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    // Use batch function if available, otherwise fall back to individual calls
    if (onBatchColumnVisibilityChange) {
      onBatchColumnVisibilityChange(updates);
    } else {
      Object.entries(updates).forEach(([columnId, visible]) => {
        onColumnVisibilityChange(columnId, visible);
      });
    }
  };

  const handleShowAll = () => {
    // Batch all show operations to avoid multiple rapid calls
    const updates = columns.reduce(
      (acc, column) => {
        acc[column.id] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    // Use batch function if available, otherwise fall back to individual calls
    if (onBatchColumnVisibilityChange) {
      onBatchColumnVisibilityChange(updates);
    } else {
      Object.entries(updates).forEach(([columnId, visible]) => {
        onColumnVisibilityChange(columnId, visible);
      });
    }
  };

  const getColumnIcon = (column: Column) => {
    if (column.type === "TEXT") {
      return (
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
      );
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        fill="currentColor"
        viewBox="0 0 256 256"
      >
        <path d="M216 152h-48v-48h48a8 8 0 0 0 0-16h-48V40a8 8 0 0 0-16 0v48h-48V40a8 8 0 0 0-16 0v48H40a8 8 0 0 0 0 16h48v48H40a8 8 0 0 0 0 16h48v48a8 8 0 0 0 16 0v-48h48v48a8 8 0 0 0 16 0v-48h48a8 8 0 0 0 0-16m-112 0v-48h48v48Z" />
      </svg>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      {/* Search bar */}
      <div className="mx-5 border-b border-gray-200 pt-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find a field"
            className="w-full pr-8 text-xs focus:outline-none"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <button className="text-gray-400 hover:text-gray-600">
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
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Column list */}
      <div className="mx-2 max-h-80 overflow-y-auto py-3">
        {filteredColumns.map((column) => {
          const isVisible = visibleColumns[column.id] !== false;

          return (
            <div
              key={column.id}
              className="flex max-h-7 items-center space-x-3 p-3 hover:bg-gray-50"
            >
              {/* Toggle switch */}
              <button
                onClick={() => onColumnVisibilityChange(column.id, !isVisible)}
                className={`relative inline-flex h-2 w-4 items-center rounded-full transition-colors ${
                  isVisible ? "bg-[#058a16]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-1 w-1 transform rounded-full bg-white transition-transform ${
                    isVisible ? "translate-x-2.5" : "translate-x-0.5"
                  }`}
                />
              </button>

              {/* Column icon */}
              <div className="flex-shrink-0">{getColumnIcon(column)}</div>

              {/* Column name */}
              <span className="flex-1 text-sm text-gray-900">
                {column.name}
              </span>

              {/* Drag handle */}
              <div className="flex-shrink-0 cursor-move">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  fill="currentColor"
                  className="cursor-grab not-hover:opacity-50"
                  viewBox="0 0 256 256"
                >
                  <path d="M104 60a12 12 0 1 1-12-12 12 12 0 0 1 12 12m60 12a12 12 0 1 0-12-12 12 12 0 0 0 12 12m-72 44a12 12 0 1 0 12 12 12 12 0 0 0-12-12m72 0a12 12 0 1 0 12 12 12 12 0 0 0-12-12m-72 68a12 12 0 1 0 12 12 12 12 0 0 0-12-12m72 0a12 12 0 1 0 12 12 12 12 0 0 0-12-12" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-2">
        <div className="flex space-x-3">
          <button
            onClick={handleHideAll}
            className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-700 hover:bg-gray-200"
          >
            Hide all
          </button>
          <button
            onClick={handleShowAll}
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            Show all
          </button>
        </div>
      </div>
    </div>
  );
}
