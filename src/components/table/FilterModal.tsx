import { useState, useRef, useEffect } from "react";
import type { Column } from "~/types/table";
import type {
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "~/types/table";

interface FilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  filters: FilterGroup[];
  onFiltersChange: (filters: FilterGroup[]) => void;
}

export function FilterDropdown({
  isOpen,
  onClose,
  columns,
  filters,
  onFiltersChange,
}: FilterDropdownProps) {
  const [localFilters, setLocalFilters] = useState<FilterGroup[]>(filters);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

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

  const getOperatorsForColumn = (columnType: string): FilterOperator[] => {
    if (columnType === "NUMBER") {
      return [
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "is_empty",
        "is_not_empty",
      ];
    } else {
      return [
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "is_empty",
        "is_not_empty",
      ];
    }
  };

  const getOperatorLabel = (operator: FilterOperator): string => {
    const labels: Record<FilterOperator, string> = {
      equals: "is",
      not_equals: "is not",
      contains: "contains",
      not_contains: "does not contain",
      greater_than: "is greater than",
      less_than: "is less than",
      is_empty: "is empty",
      is_not_empty: "is not empty",
    };
    return labels[operator];
  };

  const addCondition = (groupId: string) => {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
      columnId: columns[0]?.id ?? "",
      operator: "equals",
      value: "",
    };

    setLocalFilters((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, conditions: [...group.conditions, newCondition] }
          : group,
      ),
    );
  };

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>,
  ) => {
    setLocalFilters((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map((condition) =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition,
              ),
            }
          : group,
      ),
    );
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    setLocalFilters(
      (prev) =>
        prev
          .map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  conditions: group.conditions.filter(
                    (condition) => condition.id !== conditionId,
                  ),
                }
              : group,
          )
          .filter((group) => group.conditions.length > 0), // Remove empty groups
    );
  };

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      conditions: [
        {
          id: `condition-${Date.now()}`,
          columnId: columns[0]?.id ?? "",
          operator: "equals",
          value: "",
        },
      ],
      logicOperator: "and",
    };

    setLocalFilters((prev) => [...prev, newGroup]);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const clearFilters = () => {
    setLocalFilters([]);
    onFiltersChange([]);
    onClose();
  };

  const getActiveFilterCount = () => {
    return localFilters.reduce(
      (count, group) => count + group.conditions.length,
      0,
    );
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 z-20 mt-2 w-120 rounded-md border border-gray-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm text-gray-900">In this view, show records</h3>
        <div className="flex items-center space-x-2"></div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {localFilters.length === 0 ? (
          <div className="py-4 text-center">
            <p className="mb-3 text-sm text-gray-500">No filters applied</p>
            <button
              onClick={addFilterGroup}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Add condition
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {localFilters.map((group, _groupIndex) => (
              <div key={group.id} className="space-y-2">
                {group.conditions.map((condition, conditionIndex) => (
                  <div
                    key={condition.id}
                    className="flex items-center space-x-2"
                  >
                    {/* Logic operator */}
                    {conditionIndex === 0 ? (
                      <span className="w-13 text-xs text-gray-700">Where</span>
                    ) : (
                      <div className="w-13">
                        <select
                          value={group.logicOperator}
                          onChange={(e) =>
                            setLocalFilters((prev) =>
                              prev.map((g) =>
                                g.id === group.id
                                  ? {
                                      ...g,
                                      logicOperator: e.target.value as
                                        | "and"
                                        | "or",
                                    }
                                  : g,
                              ),
                            )
                          }
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                        >
                          <option value="and">and</option>
                          <option value="or">or</option>
                        </select>
                      </div>
                    )}

                    {/* Column selector */}
                    <div className="w-24">
                      <select
                        value={condition.columnId}
                        onChange={(e) =>
                          updateCondition(group.id, condition.id, {
                            columnId: e.target.value,
                            operator: "equals", // Reset operator when column changes
                          })
                        }
                        className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        {columns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operator selector */}
                    <div className="w-31">
                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(group.id, condition.id, {
                            operator: e.target.value as FilterOperator,
                          })
                        }
                        className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        {getOperatorsForColumn(
                          columns.find((c) => c.id === condition.columnId)
                            ?.type ?? "TEXT",
                        ).map((operator) => (
                          <option key={operator} value={operator}>
                            {getOperatorLabel(operator)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Value input */}
                    {!["is_empty", "is_not_empty"].includes(
                      condition.operator,
                    ) && (
                      <div className="flex-1">
                        <input
                          type={
                            columns.find((c) => c.id === condition.columnId)
                              ?.type === "NUMBER"
                              ? "number"
                              : "text"
                          }
                          value={condition.value}
                          onChange={(e) =>
                            updateCondition(group.id, condition.id, {
                              value: e.target.value,
                            })
                          }
                          placeholder="Enter a value"
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => removeCondition(group.id, condition.id)}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                      <button className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
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
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add condition button */}
                <div className="flex items-center space-x-2">
                  <div className="w-13"></div>
                  <button
                    onClick={() => addCondition(group.id)}
                    className="flex items-center space-x-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-700"
                  >
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
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <span>Add condition</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Add condition group button */}
            <div className="flex items-center space-x-2">
              <div className="w-13"></div>
              <button
                onClick={addFilterGroup}
                className="flex items-center space-x-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-700"
              >
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
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span>Add condition group</span>
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
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
        <button
          onClick={clearFilters}
          className="text-xs text-gray-600 hover:text-gray-800"
        >
          Clear all filters
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={applyFilters}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}
