import { useState, useEffect, useRef } from "react";

type FilterValue =
  | "less_than"
  | "greater_than"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty";

interface Filter {
  id: string;
  value: FilterValue;
  columnId?: string;
  inputValue?: string;
}

type LogicOperator = "and" | "or";

interface Column {
  id: string;
  name: string;
  type: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFiltersChange: (filters: Filter[], logicOperator: LogicOperator) => void;
  initialFilters?: Filter[];
  initialLogicOperator?: LogicOperator;
  columns: Column[];
}

const getFilterOptionsForColumn = (
  columnType: string,
): { value: FilterValue; label: string }[] => {
  const baseOptions = [
    { value: "is_empty" as FilterValue, label: "Is empty" },
    { value: "is_not_empty" as FilterValue, label: "Is not empty" },
  ];

  if (columnType === "NUMBER") {
    return [
      ...baseOptions,
      { value: "equals" as FilterValue, label: "Equal to" },
      { value: "not_equals" as FilterValue, label: "Not equal to" },
      { value: "greater_than" as FilterValue, label: "Greater than" },
      { value: "less_than" as FilterValue, label: "Less than" },
    ];
  } else {
    // TEXT and other types
    return [
      ...baseOptions,
      { value: "equals" as FilterValue, label: "Equal to" },
      { value: "not_equals" as FilterValue, label: "Not equal to" },
      { value: "contains" as FilterValue, label: "Contains" },
      { value: "not_contains" as FilterValue, label: "Does not contain" },
    ];
  }
};

export function FilterModal({
  isOpen,
  onClose,
  onFiltersChange,
  initialFilters = [],
  initialLogicOperator = "and",
  columns,
}: FilterModalProps) {
  const [filters, setFilters] = useState<Filter[]>(initialFilters);
  const [logicOperator, setLogicOperator] =
    useState<LogicOperator>(initialLogicOperator);
  const [openColumnDropdown, setOpenColumnDropdown] = useState<string | null>(
    null,
  );
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>("");
  const [openOperatorDropdown, setOpenOperatorDropdown] = useState<
    string | null
  >(null);
  const [operatorSearchQueries, setOperatorSearchQueries] = useState<
    Record<string, string>
  >({});
  const [isUpdating, setIsUpdating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Update local state when initialFilters prop changes (only when modal opens or when filters are empty)
  useEffect(() => {
    if (
      isOpen &&
      !isUpdating &&
      (filters.length === 0 || initialFilters.length === 0)
    ) {
      setFilters(initialFilters);
    }
  }, [initialFilters, isOpen, filters.length, isUpdating]);

  // Update logic operator when prop changes
  useEffect(() => {
    setLogicOperator(initialLogicOperator);
  }, [initialLogicOperator]);

  const handleFilterChange = (filterId: string, value: FilterValue) => {
    console.log("Changing filter value:", {
      filterId,
      value,
      currentFilters: filters,
    });
    setIsUpdating(true);
    const updatedFilters = filters.map((filter) =>
      filter.id === filterId ? { ...filter, value } : filter,
    );
    console.log("Updated filters:", updatedFilters);
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters, logicOperator);
    // Reset the updating flag after a short delay
    setTimeout(() => setIsUpdating(false), 100);
  };

  const addFilter = () => {
    const newFilter: Filter = {
      id: `filter-${Date.now()}`,
      value: "equals",
      columnId: columns[0]?.id ?? "",
      inputValue: "",
    };
    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters, logicOperator);
  };

  const handleColumnChange = (filterId: string, columnId: string) => {
    console.log("Changing column:", {
      filterId,
      columnId,
      currentFilters: filters,
    });
    setIsUpdating(true);
    const updatedFilters = filters.map((filter) =>
      filter.id === filterId
        ? {
            ...filter,
            columnId,
            value: "equals" as FilterValue,
            inputValue: "",
          }
        : filter,
    );
    console.log("Updated filters:", updatedFilters);
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters, logicOperator);
    // Reset the updating flag after a short delay
    setTimeout(() => setIsUpdating(false), 100);
  };

  const handleInputChange = (filterId: string, inputValue: string) => {
    const updatedFilters = filters.map((filter) =>
      filter.id === filterId ? { ...filter, inputValue } : filter,
    );
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters, logicOperator);
  };

  const removeFilter = (filterId: string) => {
    const updatedFilters = filters.filter((filter) => filter.id !== filterId);
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters, logicOperator);
  };

  const handleLogicOperatorChange = (newLogicOperator: LogicOperator) => {
    setLogicOperator(newLogicOperator);
    onFiltersChange(filters, newLogicOperator);
  };

  const handleColumnSelect = (filterId: string, columnId: string) => {
    console.log("Selecting column:", { filterId, columnId });
    handleColumnChange(filterId, columnId);
    setOpenColumnDropdown(null);
    setColumnSearchQuery("");
  };

  const toggleColumnDropdown = (filterId: string) => {
    if (openColumnDropdown === filterId) {
      setOpenColumnDropdown(null);
      setColumnSearchQuery("");
    } else {
      setOpenColumnDropdown(filterId);
      setColumnSearchQuery("");
    }
  };

  const handleOperatorSelect = (filterId: string, operator: FilterValue) => {
    console.log("Selecting operator:", {
      filterId,
      operator,
      currentFilters: filters,
    });
    handleFilterChange(filterId, operator);
    setOpenOperatorDropdown(null);
    setOperatorSearchQueries((prev) => ({ ...prev, [filterId]: "" }));
  };

  const toggleOperatorDropdown = (filterId: string) => {
    if (openOperatorDropdown === filterId) {
      setOpenOperatorDropdown(null);
      setOperatorSearchQueries((prev) => ({ ...prev, [filterId]: "" }));
    } else {
      setOpenOperatorDropdown(filterId);
      setOperatorSearchQueries((prev) => ({ ...prev, [filterId]: "" }));
    }
  };

  // Filter columns based on search query
  const filteredColumns = columns.filter((column) =>
    column.name.toLowerCase().includes(columnSearchQuery.toLowerCase()),
  );

  // Filter operators based on search query
  const getFilteredOperators = (filterId: string) => {
    const filter = filters.find((f) => f.id === filterId);
    const selectedColumn = columns.find((col) => col.id === filter?.columnId);
    const columnType = selectedColumn?.type ?? "TEXT";
    const allOptions = getFilterOptionsForColumn(columnType);
    const searchQuery = operatorSearchQueries[filterId] ?? "";

    return allOptions.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()),
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

  // Close dropdowns when clicking outside the modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setOpenColumnDropdown(null);
        setColumnSearchQuery("");
        setOpenOperatorDropdown(null);
        setOperatorSearchQueries({});
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="absolute right-0 z-20 mt-2 w-140 rounded-md border border-gray-200 bg-white shadow-lg"
    >
      <div className="p-4">
        <div className="space-y-3">
          {filters.length === 0 ? (
            <div className="">
              <div className="mb-4 text-xs text-gray-500">
                No filter conditions are applied
                <svg
                  className="ml-1 inline h-4 w-4 text-gray-400"
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
              </div>
              <div className="flex justify-between space-x-4">
                <div className="flex space-x-4">
                  <button
                    onClick={addFilter}
                    className="flex items-center space-x-1 text-xs font-medium text-blue-500 hover:text-gray-800"
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
                    <span>Add condition</span>
                  </button>
                  <button className="flex items-center space-x-1 text-xs font-medium text-gray-600 hover:text-gray-800">
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
                    <span>Add condition group</span>
                    <svg
                      className="h-4 w-4 text-gray-400"
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
                <div className="text-xs font-medium text-gray-600 hover:text-gray-800">
                  Copy from another view
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-col space-y-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-700">
                  In this view, show records
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
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
              <div className="space-y-3">
                {filters.map((filter, index) => {
                  const selectedColumn = columns.find(
                    (col) => col.id === filter.columnId,
                  );
                  const filterOptions = getFilterOptionsForColumn(
                    selectedColumn?.type ?? "TEXT",
                  );
                  const needsInput = ![
                    "none",
                    "is_empty",
                    "is_not_empty",
                  ].includes(filter.value);

                  return (
                    <div key={filter.id} className="flex items-center">
                      {/* Logic operator for subsequent conditions */}
                      {index > 0 && (
                        <div className="relative mr-2">
                          <select
                            value={logicOperator}
                            onChange={(e) =>
                              handleLogicOperatorChange(
                                e.target.value as "and" | "or",
                              )
                            }
                            className="appearance-none rounded border border-gray-300 bg-white py-2 pr-7 pl-2 text-xs text-gray-700 focus:outline-none"
                          >
                            <option value="and">and</option>
                            <option value="or">or</option>
                          </select>
                          <div className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                            <svg
                              className="h-4 w-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* First condition starts with "Where" */}
                      {index === 0 && (
                        <span className="mr-2 items-center pr-2 pl-4 text-xs text-black">
                          Where
                        </span>
                      )}

                      {/* Column selector - has space from label */}
                      <div className="relative">
                        <div
                          className="flex w-30 cursor-pointer items-center justify-between rounded-l border border-gray-300 bg-white py-2 pr-2 pl-3 text-xs text-gray-700 hover:bg-gray-50"
                          onClick={() => toggleColumnDropdown(filter.id)}
                        >
                          <span>
                            {columns.find((col) => col.id === filter.columnId)
                              ?.name ?? "Select column"}
                          </span>
                          <svg
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              openColumnDropdown === filter.id
                                ? "rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>

                        {openColumnDropdown === filter.id && (
                          <div className="absolute top-full left-0 z-10 mt-1 w-45 rounded-md border border-gray-300 bg-white p-2 shadow-lg">
                            {/* Search Field */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Find a field"
                                value={columnSearchQuery}
                                onChange={(e) =>
                                  setColumnSearchQuery(e.target.value)
                                }
                                className="w-full rounded-md bg-white py-2 pr-3 pl-3 text-sm placeholder-gray-400 focus:outline-none"
                                autoFocus
                              />
                            </div>

                            {/* Column List */}
                            <div className="max-h-40 overflow-y-auto">
                              {filteredColumns.length > 0 ? (
                                filteredColumns.map((column) => (
                                  <div
                                    key={column.id}
                                    className="flex cursor-pointer items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={() =>
                                      handleColumnSelect(filter.id, column.id)
                                    }
                                  >
                                    {/* Column icon */}
                                    <div className="flex-shrink-0 text-black">
                                      {getColumnIcon(column)}
                                    </div>

                                    {/* Column name */}
                                    <span className="flex-1 truncate text-sm text-gray-900">
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

                      {/* Operator selector - no space, connected to column */}
                      <div className="relative">
                        <div
                          className="flex w-30 cursor-pointer items-center justify-between rounded-none border border-l-0 border-gray-300 bg-white py-2 pr-2 pl-3 text-xs text-gray-700 hover:bg-gray-50"
                          onClick={() => toggleOperatorDropdown(filter.id)}
                        >
                          <span className="truncate">
                            {filterOptions.find(
                              (option) => option.value === filter.value,
                            )?.label ?? "Select operator"}
                          </span>
                          <svg
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              openOperatorDropdown === filter.id
                                ? "rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>

                        {openOperatorDropdown === filter.id && (
                          <div className="absolute top-full left-0 z-10 mt-1 w-45 rounded-md border border-gray-300 bg-white p-2 shadow-lg">
                            {/* Search Field */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Find an operator"
                                value={operatorSearchQueries[filter.id] ?? ""}
                                onChange={(e) =>
                                  setOperatorSearchQueries((prev) => ({
                                    ...prev,
                                    [filter.id]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-md bg-white py-2 pr-3 pl-3 text-sm placeholder-gray-400 focus:outline-none"
                                autoFocus
                              />
                            </div>

                            {/* Operator List */}
                            <div className="max-h-40 overflow-y-auto">
                              {getFilteredOperators(filter.id).length > 0 ? (
                                getFilteredOperators(filter.id).map(
                                  (option) => (
                                    <div
                                      key={option.value}
                                      className="flex cursor-pointer items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      onClick={() =>
                                        handleOperatorSelect(
                                          filter.id,
                                          option.value,
                                        )
                                      }
                                    >
                                      {/* Operator name */}
                                      <span className="flex-1 text-sm text-gray-900">
                                        {option.label}
                                      </span>
                                    </div>
                                  ),
                                )
                              ) : (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No operators found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input field for values - no space, connected to operator */}
                      {needsInput && (
                        <input
                          type="text"
                          value={filter.inputValue ?? ""}
                          onChange={(e) =>
                            handleInputChange(filter.id, e.target.value)
                          }
                          placeholder="Enter a value"
                          className="w-35 rounded-none border border-l-0 border-gray-300 bg-white px-2 py-2 pl-3 text-xs text-black placeholder-gray-600 focus:outline-none"
                        />
                      )}

                      {/* Action buttons - no space, connected to input */}
                      <div className="flex items-center">
                        <button
                          onClick={() => removeFilter(filter.id)}
                          className="rounded-none border border-l-0 border-gray-300 bg-white p-2 text-black hover:text-red-500"
                          title="Delete condition"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            fill="currentColor"
                            viewBox="0 0 256 256"
                          >
                            <path d="M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0" />
                          </svg>
                        </button>
                        <button
                          className="rounded-r border border-l-0 border-gray-300 bg-white p-2 text-black hover:text-gray-600"
                          title="More options"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            fill="currentColor"
                            className="cursor-grab not-hover:opacity-50"
                            viewBox="0 0 256 256"
                          >
                            <path d="M104 60a12 12 0 1 1-12-12 12 12 0 0 1 12 12m60 12a12 12 0 1 0-12-12 12 12 0 0 0 12 12m-72 44a12 12 0 1 0 12 12 12 12 0 0 0-12-12m72 0a12 12 0 1 0 12 12 12 12 0 0 0-12-12m-72 68a12 12 0 1 0 12 12 12 12 0 0 0-12-12m72 0a12 12 0 1 0 12 12 12 12 0 0 0-12-12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add condition buttons */}
                <div className="flex items-center justify-between space-x-4 pt-2">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={addFilter}
                      className="flex items-center space-x-1 text-xs text-blue-500 hover:text-gray-800"
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
                      <span>Add condition</span>
                    </button>
                    <button
                      onClick={addFilter}
                      className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800"
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
                      <span>Add condition group</span>
                      <svg
                        className="h-4 w-4 text-gray-400"
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
                  <div className="text-xs font-medium text-gray-500 hover:text-gray-800">
                    Copy from another view
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
