import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface Column {
  id: string;
  name: string;
  type: string;
}

interface HideFieldsDropdownProps {
  columns: Column[];
  visibleColumns: Record<string, boolean>;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onClose: () => void;
}

export function HideFieldsDropdown({
  columns,
  visibleColumns,
  onColumnVisibilityChange,
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
    columns.forEach((column) => {
      onColumnVisibilityChange(column.id, false);
    });
  };

  const handleShowAll = () => {
    columns.forEach((column) => {
      onColumnVisibilityChange(column.id, true);
    });
  };

  const getColumnIcon = (column: Column) => {
    if (column.type === "TEXT") {
      if (column.name.toLowerCase().includes("name")) {
        return "/icons/user.svg";
      } else if (column.name.toLowerCase().includes("email")) {
        return "/icons/document.svg";
      } else {
        return "/icons/document.svg";
      }
    } else if (column.type === "NUMBER") {
      return "/icons/checkbox.svg";
    }
    return "/icons/document.svg";
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      {/* Search bar */}
      <div className="border-b border-gray-200 p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find a field"
            className="w-full rounded-md border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
      <div className="max-h-80 overflow-y-auto">
        {filteredColumns.map((column) => {
          const isVisible = visibleColumns[column.id] !== false;

          return (
            <div
              key={column.id}
              className="flex items-center space-x-3 border-b border-gray-100 p-3 hover:bg-gray-50"
            >
              {/* Toggle switch */}
              <button
                onClick={() => onColumnVisibilityChange(column.id, !isVisible)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isVisible ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    isVisible ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>

              {/* Column icon */}
              <div className="flex-shrink-0">
                <Image
                  src={getColumnIcon(column)}
                  alt={column.name}
                  width={16}
                  height={16}
                  className="text-gray-600"
                />
              </div>

              {/* Column name */}
              <span className="flex-1 text-sm text-gray-900">
                {column.name}
              </span>

              {/* Drag handle */}
              <div className="flex-shrink-0 cursor-move">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-3">
          <button
            onClick={handleHideAll}
            className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Hide all
          </button>
          <button
            onClick={handleShowAll}
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Show all
          </button>
        </div>
      </div>
    </div>
  );
}
