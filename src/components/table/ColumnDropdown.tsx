import { useRef, useEffect } from "react";
import Image from "next/image";

interface ColumnDropdownProps {
  columnId: string;
  columnName: string;
  onDeleteColumn: (columnId: string) => void;
  onClose: () => void;
  isDeletingColumn?: boolean;
}

export function ColumnDropdown({
  columnId,
  columnName: _columnName,
  onDeleteColumn,
  onClose,
  isDeletingColumn = false,
}: ColumnDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleDeleteColumn = () => {
    onDeleteColumn(columnId);
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white font-normal shadow-lg"
    >
      <div className="py-1">
        <button
          onClick={handleDeleteColumn}
          disabled={isDeletingColumn}
          className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeletingColumn ? (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-300 border-t-red-600"></div>
          ) : (
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
          <span>{isDeletingColumn ? "Deleting..." : "Delete field"}</span>
        </button>
      </div>
    </div>
  );
}
