import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface AddColumnDropdownProps {
  onAddColumn: (name: string, type: "TEXT" | "NUMBER") => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function AddColumnDropdown({
  onAddColumn,
  onClose,
  isLoading = false,
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
      className="absolute top-full right-0 z-50 w-100 rounded-md border border-gray-200 bg-white shadow-lg"
      onKeyDown={handleKeyDown}
    >
      <form onSubmit={handleSubmit} className="p-3 font-light">
        <div className="mb-3">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {columnType === "TEXT" ? (
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
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="1em"
                      height="1em"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path d="M216 152h-48v-48h48a8 8 0 0 0 0-16h-48V40a8 8 0 0 0-16 0v48h-48V40a8 8 0 0 0-16 0v48H40a8 8 0 0 0 0 16h48v48H40a8 8 0 0 0 0 16h48v48a8 8 0 0 0 16 0v-48h48v48a8 8 0 0 0 16 0v-48h48a8 8 0 0 0 0-16m-112 0v-48h48v48Z" />
                    </svg>
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="1em"
                      height="1em"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path d="M216 152h-48v-48h48a8 8 0 0 0 0-16h-48V40a8 8 0 0 0-16 0v48h-48V40a8 8 0 0 0-16 0v48H40a8 8 0 0 0 0 16h48v48H40a8 8 0 0 0 0 16h48v48a8 8 0 0 0 16 0v-48h48v48a8 8 0 0 0 16 0v-48h48a8 8 0 0 0 0-16m-112 0v-48h48v48Z" />
                    </svg>
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
            disabled={!columnName.trim() || isLoading}
            className="flex items-center space-x-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isLoading && (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            )}
            <span>{isLoading ? "Adding..." : "Add field"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
