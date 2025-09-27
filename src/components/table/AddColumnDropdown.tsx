import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface AddColumnDropdownProps {
  onAddColumn: (name: string, type: "TEXT" | "NUMBER") => void;
  onClose: () => void;
}

export function AddColumnDropdown({
  onAddColumn,
  onClose,
}: AddColumnDropdownProps) {
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<"TEXT" | "NUMBER">("TEXT");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (columnName.trim()) {
      onAddColumn(columnName.trim(), columnType);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg"
      onKeyDown={handleKeyDown}
    >
      <form onSubmit={handleSubmit} className="p-3">
        <div className="mb-3">
          <label
            htmlFor="column-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Field name
          </label>
          <input
            ref={inputRef}
            id="column-name"
            type="text"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            placeholder="Enter field name..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="column-type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Field type
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {columnType === "TEXT" ? (
                    <Image
                      src="/icons/document.svg"
                      alt="Text"
                      width={16}
                      height={16}
                      className="text-gray-400"
                    />
                  ) : (
                    <Image
                      src="/icons/checkbox.svg"
                      alt="Number"
                      width={16}
                      height={16}
                      className="text-gray-400"
                    />
                  )}
                  <span>{columnType === "TEXT" ? "Text" : "Number"}</span>
                </div>
                <Image
                  src="/icons/chevron-down.svg"
                  alt="Dropdown"
                  width={12}
                  height={12}
                  className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isOpen && (
              <div className="absolute top-full right-0 left-0 z-10 mt-1 rounded-md border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setColumnType("TEXT");
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <div className="flex items-center space-x-2">
                    <Image
                      src="/icons/document.svg"
                      alt="Text"
                      width={16}
                      height={16}
                      className="text-gray-400"
                    />
                    <span>Text</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setColumnType("NUMBER");
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <div className="flex items-center space-x-2">
                    <Image
                      src="/icons/checkbox.svg"
                      alt="Number"
                      width={16}
                      height={16}
                      className="text-gray-400"
                    />
                    <span>Number</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!columnName.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
          >
            Add field
          </button>
        </div>
      </form>
    </div>
  );
}
