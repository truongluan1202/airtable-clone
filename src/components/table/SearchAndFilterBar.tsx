import { useState } from "react";
import type { Column, FilterConfig } from "~/types/table";

interface SearchAndFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: FilterConfig[];
  columns: Column[];
  onAddFilter: (filter: FilterConfig) => void;
  onRemoveFilter: (columnId: string) => void;
  onClearFilters: () => void;
}

export function SearchAndFilterBar({
  searchQuery,
  onSearchChange,
  filters,
  columns,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
}: SearchAndFilterBarProps) {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<FilterConfig>>({});

  const handleAddFilter = () => {
    if (
      newFilter.columnId &&
      newFilter.operator &&
      newFilter.value !== undefined
    ) {
      onAddFilter(newFilter as FilterConfig);
      setNewFilter({});
      setShowFilterMenu(false);
    }
  };

  const getFilterOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      equals: "is",
      not_equals: "is not",
      contains: "contains",
      not_contains: "doesn&apos;t contain",
      greater_than: "is greater than",
      less_than: "is less than",
      is_empty: "is empty",
      is_not_empty: "is not empty",
    };
    return labels[operator] ?? operator;
  };

  const getColumnName = (columnId: string) => {
    return columns.find((col) => col.id === columnId)?.name ?? columnId;
  };

  return (
    <div className="border-b border-gray-200 bg-white p-4">
      <div className="flex items-center space-x-4">
        {/* Search input */}
        <div className="max-w-md flex-1">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-5 w-5 text-gray-400"
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
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search all records..."
              className="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Filter button */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
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
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter
            {filters.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                {filters.length}
              </span>
            )}
          </button>

          {/* Filter dropdown */}
          {showFilterMenu && (
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="p-4">
                <h3 className="mb-3 text-sm text-gray-900">Add Filter</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-700">
                      Column
                    </label>
                    <select
                      value={newFilter.columnId ?? ""}
                      onChange={(e) =>
                        setNewFilter({ ...newFilter, columnId: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select column</option>
                      {columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700">
                      Condition
                    </label>
                    <select
                      value={newFilter.operator ?? ""}
                      onChange={(e) =>
                        setNewFilter({
                          ...newFilter,
                          operator: e.target.value as FilterConfig["operator"],
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select condition</option>
                      <option value="equals">is</option>
                      <option value="not_equals">is not</option>
                      <option value="contains">contains</option>
                      <option value="not_contains">doesn&apos;t contain</option>
                      <option value="greater_than">is greater than</option>
                      <option value="less_than">is less than</option>
                      <option value="is_empty">is empty</option>
                      <option value="is_not_empty">is not empty</option>
                    </select>
                  </div>

                  {newFilter.operator &&
                    !["is_empty", "is_not_empty"].includes(
                      newFilter.operator,
                    ) && (
                      <div>
                        <label className="block text-sm text-gray-700">
                          Value
                        </label>
                        <input
                          type={
                            columns.find((c) => c.id === newFilter.columnId)
                              ?.type === "NUMBER"
                              ? "number"
                              : "text"
                          }
                          value={newFilter.value ?? ""}
                          onChange={(e) =>
                            setNewFilter({
                              ...newFilter,
                              value: e.target.value,
                            })
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          placeholder="Enter value"
                        />
                      </div>
                    )}

                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowFilterMenu(false)}
                      className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddFilter}
                      disabled={!newFilter.columnId || !newFilter.operator}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add Filter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active filters */}
        {filters.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Filters:</span>
            {filters.map((filter, index) => (
              <div
                key={index}
                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
              >
                <span>
                  {getColumnName(filter.columnId)}{" "}
                  {getFilterOperatorLabel(filter.operator)} {filter.value}
                </span>
                <button
                  onClick={() => onRemoveFilter(filter.columnId)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={onClearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
