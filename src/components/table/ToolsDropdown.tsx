import { useRef, useEffect } from "react";

interface ToolsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTestRows: (count: number) => void;
  isAddingRows: boolean;
}

export function ToolsDropdown({
  isOpen,
  onClose,
  onAddTestRows,
  isAddingRows,
}: ToolsDropdownProps) {
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

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm text-gray-900">Tools</h3>
      </div>

      {/* Content */}
      <div className="py-2">
        {/* Test Data Section */}
        <div className="px-4 py-2">
          <h4 className="mb-2 text-xs tracking-wide text-gray-500 uppercase">
            Test Data
          </h4>
          <div className="space-y-1">
            <button
              onClick={() => {
                onAddTestRows(100);
                onClose();
              }}
              disabled={isAddingRows}
              className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>{isAddingRows ? "Adding..." : "Add 100 Test Rows"}</span>
            </button>

            <button
              onClick={() => {
                onAddTestRows(1000);
                onClose();
              }}
              disabled={isAddingRows}
              className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>{isAddingRows ? "Adding..." : "Add 1k Test Rows"}</span>
            </button>

            <button
              onClick={() => {
                onAddTestRows(10000);
                onClose();
              }}
              disabled={isAddingRows}
              className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span>{isAddingRows ? "Adding..." : "Add 10k Test Rows"}</span>
            </button>

            <button
              onClick={() => {
                onAddTestRows(100000);
                onClose();
              }}
              disabled={isAddingRows}
              className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="h-2 w-2 rounded-full bg-red-600"></div>
              <span>{isAddingRows ? "Adding..." : "Add 100k Test Rows"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
