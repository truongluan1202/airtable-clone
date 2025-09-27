import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface ColumnDropdownProps {
  columnId: string;
  columnName: string;
  onDeleteColumn: (columnId: string) => void;
  onClose: () => void;
}

export function ColumnDropdown({
  columnId,
  columnName,
  onDeleteColumn,
  onClose,
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
      className="absolute top-full left-0 z-50 mt-1 w-48 w-full rounded-md border border-gray-200 bg-white shadow-lg"
    >
      <div className="py-1">
        <button
          onClick={handleDeleteColumn}
          className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        >
          <Image
            src="/icons/checkbox.svg"
            alt="Delete"
            width={14}
            height={14}
            className="text-red-600"
          />
          <span>Delete field</span>
        </button>
      </div>
    </div>
  );
}
