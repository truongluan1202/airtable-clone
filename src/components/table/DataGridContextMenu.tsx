import { useEffect, useRef } from "react";

interface DataGridContextMenuProps {
  x: number;
  y: number;
  rowId: string;
  onDeleteRow: (rowId: string) => void;
  onClose: () => void;
}

export function DataGridContextMenu({
  x,
  y,
  rowId,
  onDeleteRow,
  onClose,
}: DataGridContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu fixed z-50 min-w-48 rounded-md border border-gray-200 bg-white shadow-lg"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="py-1">
        <button
          onClick={() => {
            onDeleteRow(rowId);
            onClose();
          }}
          className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        >
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
          Delete record
        </button>
      </div>
    </div>
  );
}
