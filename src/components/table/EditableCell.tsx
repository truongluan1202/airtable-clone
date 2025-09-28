import { useState, useCallback } from "react";
import Image from "next/image";
import type { EditableCellProps } from "./types";

export function EditableCell({
  value,
  onUpdate,
  isEditing,
  isSelected,
  onStartEdit,
  onStopEdit,
  onSelect,
  placeholder,
  hasDropdown = false,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  const [isDoubleClick, setIsDoubleClick] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onUpdate(editValue);
        onStopEdit();
      } else if (e.key === "Escape") {
        setEditValue(value);
        onStopEdit();
      }
    },
    [editValue, onUpdate, onStopEdit, value],
  );

  const handleBlur = useCallback(() => {
    onUpdate(editValue);
    onStopEdit();
  }, [editValue, onUpdate, onStopEdit]);

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`w-full border border-blue-500 p-1 text-sm focus:outline-none ${
            hasDropdown ? "pr-6" : ""
          }`}
          placeholder={placeholder}
          autoFocus
        />
        {hasDropdown && (
          <Image
            src="/icons/chevron-down.svg"
            alt="Dropdown"
            width={12}
            height={12}
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-gray-400"
          />
        )}
      </div>
    );
  }

  const handleClick = (_e: React.MouseEvent) => {
    // Prevent single click if this is part of a double-click
    if (isDoubleClick) {
      setIsDoubleClick(false);
      return;
    }

    // Small delay to check if double-click follows
    setTimeout(() => {
      if (!isDoubleClick && !isEditing) {
        onSelect();
      }
    }, 100);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDoubleClick(true);
    if (!isEditing) {
      onStartEdit();
    }
  };

  return (
    <div
      className={`cursor-pointer rounded p-1 text-sm text-gray-900 hover:bg-gray-50 ${
        isSelected ? "bg-blue-50" : ""
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ userSelect: "none" }}
    >
      {value || "-"}
    </div>
  );
}
