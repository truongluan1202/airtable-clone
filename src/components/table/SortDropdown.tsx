import { useState, useEffect, useRef } from "react";
import type { SortConfig } from "~/types/table";

interface SortDropdownProps {
  columns: Array<{ id: string; name: string; type: string }>;
  sort: SortConfig[];
  onSortChange: (sort: SortConfig[]) => void;
  onClose: () => void;
}

interface SortRule {
  columnId: string;
  direction: "asc" | "desc";
}

export function SortDropdown({
  columns,
  sort,
  onSortChange,
  onClose: _onClose,
}: SortDropdownProps) {
  const [sortRules, setSortRules] = useState<SortRule[]>(
    sort.length > 0 ? sort : [],
  );
  const [autoSort, setAutoSort] = useState(sort.length > 0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddSortDropdown, setShowAddSortDropdown] = useState(false);
  const [addSortSearchQuery, setAddSortSearchQuery] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync autoSort state with the actual sort state
  useEffect(() => {
    setAutoSort(sort.length > 0);
    // Only update sort rules if they're empty (initial load) or if sort is being applied from outside
    if (sort.length > 0) {
      setSortRules(sort);
    }
  }, [sort]);

  const handleRemoveSort = (index: number) => {
    const newSortRules = sortRules.filter((_, i) => i !== index);
    setSortRules(newSortRules);

    // If auto sort is enabled, immediately apply the updated rules
    if (autoSort) {
      onSortChange(newSortRules);
    }
  };

  const handleColumnChange = (index: number, columnId: string) => {
    const newSortRules = sortRules.map((rule, i) =>
      i === index ? { ...rule, columnId } : rule,
    );
    setSortRules(newSortRules);

    // If auto sort is enabled, immediately apply the updated rules
    if (autoSort) {
      onSortChange(newSortRules);
    }
  };

  const handleDirectionChange = (index: number, direction: "asc" | "desc") => {
    const newSortRules = sortRules.map((rule, i) =>
      i === index ? { ...rule, direction } : rule,
    );
    setSortRules(newSortRules);

    // If auto sort is enabled, immediately apply the updated rules
    if (autoSort) {
      onSortChange(newSortRules);
    }
  };

  const handleAutoSortToggle = () => {
    const newAutoSort = !autoSort;

    setAutoSort(newAutoSort);

    // If turning off auto sort, just stop applying sort (don't clear the rules)
    if (!newAutoSort) {
      onSortChange([]);
    } else if (sortRules.length > 0) {
      // If turning on auto sort and we have rules, apply them
      onSortChange(sortRules);
    }
  };

  const getColumnType = (columnId: string) => {
    return columns.find((col) => col.id === columnId)?.type ?? "TEXT";
  };

  // Filter columns based on search term
  const filteredColumns = columns.filter((column) =>
    column.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filter columns for "Add another sort" dropdown (exclude already sorted columns)
  const getAvailableColumnsForAddSort = () => {
    const availableColumns = columns.filter(
      (col) => !sortRules.some((rule) => rule.columnId === col.id),
    );
    return availableColumns.filter((column) =>
      column.name.toLowerCase().includes(addSortSearchQuery.toLowerCase()),
    );
  };

  const getColumnIcon = (column: { type: string }) => {
    if (column.type === "TEXT") {
      return (
        <svg
          width="16"
          height="16"
          fill="currentColor"
          shapeRendering="geometricPrecision"
        >
          <path
            fillRule="evenodd"
            d="M8.442 3.266a.5.5 0 0 0-.884 0l-4.5 8.5a.5.5 0 1 0 .884.468L5.125 10h5.75l1.183 2.234a.5.5 0 1 0 .884-.468zM10.346 9 8 4.569 5.654 9z"
          />
        </svg>
      );
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        fill="currentColor"
        viewBox="0 0 256 256"
      >
        <path d="M216 152h-48v-48h48a8 8 0 0 0 0-16h-48V40a8 8 0 0 0-16 0v48h-48V40a8 8 0 0 0-16 0v48H40a8 8 0 0 0 0 16h48v48H40a8 8 0 0 0 0 16h48v48a8 8 0 0 0 16 0v-48h48v48a8 8 0 0 0 16 0v-48h48a8 8 0 0 0 0-16m-112 0v-48h48v48Z" />
      </svg>
    );
  };

  const handleColumnSelect = (columnId: string) => {
    const newSortRules = [
      ...sortRules,
      {
        columnId,
        direction: "asc" as const,
      },
    ];
    setSortRules(newSortRules);
    setAutoSort(true);
    setSearchTerm(""); // Clear search term when selecting a column
    onSortChange(newSortRules);
  };

  const handleAddSortColumnSelect = (columnId: string) => {
    const newSortRules = [
      ...sortRules,
      {
        columnId,
        direction: "asc" as const,
      },
    ];
    setSortRules(newSortRules);
    setAutoSort(true);
    setShowAddSortDropdown(false);
    setAddSortSearchQuery("");
    onSortChange(newSortRules);
  };

  const toggleAddSortDropdown = () => {
    if (showAddSortDropdown) {
      setShowAddSortDropdown(false);
      setAddSortSearchQuery("");
    } else {
      setShowAddSortDropdown(true);
      setAddSortSearchQuery("");
    }
  };

  // Close dropdown when clicking outside the modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setShowAddSortDropdown(false);
        setAddSortSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Show initial state (column list) when no sort rules exist
  if (sortRules.length === 0) {
    return (
      <div
        ref={modalRef}
        className="absolute top-full right-0 z-50 mt-2 w-82 rounded-lg border border-gray-200 bg-white shadow-xl"
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mx-5 border-b border-gray-200 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-500">Sort by</h3>
              <button className="rounded-full bg-white">
                <svg
                  className="h-3 w-3"
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
            <button className="text-xs text-gray-500 hover:text-gray-700">
              Copy from a view
            </button>
          </div>
        </div>

        {/* Search Field */}
        <div className="mx-5 pt-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center">
              <svg
                className="h-4 w-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Find a field"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="0 w-full rounded-md bg-white py-2 pr-3 pl-6 text-sm placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Column List */}
        <div className="mx-2 max-h-80 overflow-y-auto pb-4">
          {filteredColumns.map((column) => (
            <div
              key={column.id}
              className="flex max-h-7 cursor-pointer items-center space-x-3 p-3 hover:bg-gray-50"
              onClick={() => handleColumnSelect(column.id)}
            >
              {/* Column icon */}
              <div className="flex-shrink-0 text-black">
                {getColumnIcon(column)}
              </div>

              {/* Column name */}
              <span className="flex-1 text-sm text-gray-900">
                {column.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show sort rules state when sort rules exist
  return (
    <div
      ref={modalRef}
      className="absolute top-full right-0 z-50 mt-2 w-110 rounded-md border border-gray-200 bg-white shadow-lg"
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-500">Sort by</h3>
            <button className="rounded-full bg-white">
              <svg
                className="h-3 w-3"
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

        {/* Separator */}
        <div className="mb-4 border-t border-gray-200"></div>

        {/* Sort Rules */}
        <div className="space-y-3">
          {sortRules.map((rule, index) => {
            const columnType = getColumnType(rule.columnId);
            const availableColumns = columns.filter(
              (col) =>
                !sortRules.some((r, i) => i !== index && r.columnId === col.id),
            );

            return (
              <div key={index} className="flex items-center space-x-2">
                {/* Column Dropdown */}
                <select
                  value={rule.columnId}
                  onChange={(e) => handleColumnChange(index, e.target.value)}
                  className="pointer-events-auto flex-1 rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {availableColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </select>

                {/* Direction Dropdown */}
                <select
                  value={rule.direction}
                  onChange={(e) =>
                    handleDirectionChange(
                      index,
                      e.target.value as "asc" | "desc",
                    )
                  }
                  className="pointer-events-auto max-w-30 flex-1 rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="asc">
                    {columnType === "NUMBER" ? "Increasing" : "A → Z"}
                  </option>
                  <option value="desc">
                    {columnType === "NUMBER" ? "Decreasing" : "Z → A"}
                  </option>
                </select>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveSort(index)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Another Sort Dropdown */}
        {sortRules.length < columns.length && (
          <div className="relative mt-3">
            <button
              onClick={toggleAddSortDropdown}
              className="flex w-full items-center space-x-2 rounded-md text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
            >
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span>Add another sort</span>
            </button>

            {showAddSortDropdown && (
              <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-md border border-gray-300 bg-white p-2 shadow-lg">
                {/* Search Field */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Find a field"
                    value={addSortSearchQuery}
                    onChange={(e) => setAddSortSearchQuery(e.target.value)}
                    className="w-full rounded-md bg-white py-2 pr-3 pl-3 text-sm placeholder-gray-400 focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Column List */}
                <div className="max-h-40 overflow-y-auto">
                  {getAvailableColumnsForAddSort().length > 0 ? (
                    getAvailableColumnsForAddSort().map((column) => (
                      <div
                        key={column.id}
                        className="flex cursor-pointer items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => handleAddSortColumnSelect(column.id)}
                      >
                        {/* Column icon */}
                        <div className="flex-shrink-0 text-black">
                          {getColumnIcon(column)}
                        </div>

                        {/* Column name */}
                        <span className="flex-1 text-sm text-gray-900">
                          {column.name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No columns found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Auto Sort Toggle */}
      <div className="bg-[#f2f4f8] px-4 py-4">
        <div className="flex w-52 items-center justify-between">
          <button
            onClick={handleAutoSortToggle}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              autoSort ? "bg-[#058a16]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                autoSort ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">
            Automatically sort records
          </span>
        </div>
      </div>
    </div>
  );
}
