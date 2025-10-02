import { useState, useEffect, useRef } from "react";

interface TableContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  onDelete: () => void;
  tableName: string;
  isDeleteDisabled?: boolean;
  isDeleting?: boolean;
}

export function TableContextMenu({
  isOpen,
  onClose,
  position,
  onDelete,
  tableName,
  isDeleteDisabled = false,
  isDeleting = false,
}: TableContextMenuProps) {
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

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        onClick={() => {
          if (!isDeleteDisabled && !isDeleting) {
            onDelete();
            onClose();
          }
        }}
        disabled={isDeleteDisabled || isDeleting}
        className={`flex w-full items-center px-3 py-2 text-left text-sm ${
          isDeleteDisabled || isDeleting
            ? "cursor-not-allowed text-gray-400"
            : "text-red-600 hover:bg-red-50"
        }`}
        title={
          isDeleteDisabled
            ? "Cannot delete the last table in a base"
            : isDeleting
              ? "Deleting..."
              : `Delete "${tableName}"`
        }
      >
        {isDeleting ? (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"></div>
        ) : (
          <svg
            className={`mr-2 h-4 w-4 ${
              isDeleteDisabled ? "text-gray-400" : "text-red-600"
            }`}
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
        {isDeleteDisabled
          ? "Delete (disabled)"
          : isDeleting
            ? "Deleting..."
            : `Delete "${tableName}"`}
      </button>
    </div>
  );
}
