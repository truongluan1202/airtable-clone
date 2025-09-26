import { useState, useEffect, useRef } from "react";
import type { Column, Cell } from "~/types/table";

interface EditableCellProps {
  cell: Cell | null;
  column: Column;
  isEditing: boolean;
  isSelected: boolean;
  onStartEdit: () => void;
  onEndEdit: (value: string | number) => void;
  onCancelEdit: () => void;
  onSelect: () => void;
}

export function EditableCell({
  cell,
  column,
  isEditing,
  isSelected,
  onStartEdit,
  onEndEdit,
  onCancelEdit,
  onSelect,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = cell?.vText ?? cell?.vNumber ?? "";
  const cellValue = isEditing ? editValue : displayValue;

  useEffect(() => {
    if (isEditing) {
      setEditValue(String(displayValue));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          handleSave();
          break;
        case "Escape":
          e.preventDefault();
          onCancelEdit();
          break;
        case "Tab":
          e.preventDefault();
          handleSave();
          // Tab navigation will be handled by parent
          break;
      }
    } else {
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          onStartEdit();
          break;
      }
    }
  };

  const handleSave = () => {
    if (column.type === "NUMBER") {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue)) {
        onEndEdit(numValue);
      } else {
        onCancelEdit();
      }
    } else {
      onEndEdit(editValue);
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      handleSave();
    }
  };

  const handleClick = () => {
    if (!isEditing) {
      onSelect();
    }
  };

  const handleDoubleClick = () => {
    if (!isEditing) {
      onStartEdit();
    }
  };

  const baseClasses = `
    w-full h-8 px-2 py-1 text-sm border-0 outline-none
    ${isSelected ? "bg-blue-50" : "bg-white"}
    ${isEditing ? "bg-white border border-blue-500" : "hover:bg-gray-50"}
    focus:outline-none focus:ring-0
  `;

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={column.type === "NUMBER" ? "number" : "text"}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={baseClasses}
        placeholder={`Enter ${column.name.toLowerCase()}`}
      />
    );
  }

  return (
    <div
      className={baseClasses}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="gridcell"
      aria-label={`${column.name}: ${cellValue}`}
    >
      <span className="block truncate">
        {cellValue ?? (
          <span className="text-gray-400 italic">
            {column.type === "NUMBER" ? "0" : "Click to add"}
          </span>
        )}
      </span>
    </div>
  );
}
