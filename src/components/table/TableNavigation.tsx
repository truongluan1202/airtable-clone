import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { HideFieldsDropdown } from "./HideFieldsModal";
import { SortDropdown } from "./SortDropdown";
import { FilterModal } from "./FilterModal";
import { CreateViewModal } from "./CreateViewModal";
import type {
  SortConfig,
  FilterGroup,
  Column,
  TableView,
  FilterCondition,
} from "~/types/table";

interface TableNavigationProps {
  children: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onHideFieldsClick?: () => void;
  columns?: Column[];
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  onBatchColumnVisibilityChange?: (updates: Record<string, boolean>) => void;
  sort?: SortConfig[];
  onSortChange?: (sort: SortConfig[]) => void;
  filters?: FilterGroup[];
  onFiltersChange?: (filters: FilterGroup[]) => void;
  // View-related props
  views?: TableView[];
  currentView?: TableView | null;
  onViewSelect?: (view: TableView) => void;
  onCreateView?: (name: string) => void;
  onDeleteView?: (viewId: string) => void;
  tableId?: string;
  // Loading states
  isCreatingView?: boolean;
  isDeletingView?: boolean;
}

export function TableNavigation({
  children,
  searchQuery = "",
  onSearchChange,
  onHideFieldsClick: _onHideFieldsClick,
  columns = [],
  columnVisibility = {},
  onColumnVisibilityChange,
  onBatchColumnVisibilityChange,
  sort = [],
  onSortChange,
  filters: _filters = [],
  onFiltersChange: _onFiltersChange,
  // View-related props
  views = [],
  currentView = null,
  onViewSelect,
  onCreateView,
  onDeleteView,
  tableId: _tableId,
  // Loading states
  isCreatingView = false,
  isDeletingView = false,
}: TableNavigationProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showHideFieldsDropdown, setShowHideFieldsDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  // Initialize filters from parent state
  const [filters, setFilters] = useState<
    Array<{
      id: string;
      value:
        | "less_than"
        | "greater_than"
        | "equals"
        | "not_equals"
        | "contains"
        | "not_contains"
        | "is_empty"
        | "is_not_empty";
      columnId?: string;
      inputValue?: string;
    }>
  >([]);
  const [logicOperator, setLogicOperator] = useState<"and" | "or">("and");
  const [showCreateViewModal, setShowCreateViewModal] = useState(false);

  // Initialize filters from parent state when it changes - optimized for performance
  useEffect(() => {
    // Skip expensive operations if view creation modal is open
    if (showCreateViewModal) {
      return;
    }

    if (_filters && _filters.length > 0) {
      // Convert FilterGroup back to internal filter format
      const firstGroup = _filters[0];
      if (firstGroup?.conditions && firstGroup.conditions.length > 0) {
        const convertedFilters = firstGroup.conditions.map((condition) => ({
          id:
            condition.id ||
            `filter-${condition.columnId}-${condition.operator}`,
          value: condition.operator as any,
          columnId: condition.columnId,
          inputValue: condition.value?.toString() ?? "",
        }));

        // Only update if the converted filters are actually different (optimized comparison)
        const filtersChanged =
          convertedFilters.length !== filters.length ||
          convertedFilters.some((newFilter, index) => {
            const oldFilter = filters[index];
            return (
              !oldFilter ||
              newFilter.id !== oldFilter.id ||
              newFilter.value !== oldFilter.value ||
              newFilter.columnId !== oldFilter.columnId ||
              newFilter.inputValue !== oldFilter.inputValue
            );
          });

        if (filtersChanged) {
          setFilters(convertedFilters);
          setLogicOperator(firstGroup.logicOperator ?? "and");
        }
      } else {
        // No conditions in the group, but don't clear existing filters if modal is open
        if (!showFilterDropdown && filters.length > 0) {
          setFilters([]);
          setLogicOperator("and");
        }
      }
    } else {
      // Clear filters if parent has no filters, but only if modal is not open
      if (!showFilterDropdown && filters.length > 0) {
        setFilters([]);
        setLogicOperator("and");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_filters, showFilterDropdown, showCreateViewModal]); // Added showCreateViewModal to dependencies
  const searchRef = useRef<HTMLDivElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSearchInput(false);
      }
      if (
        hideFieldsRef.current &&
        !hideFieldsRef.current.contains(event.target as Node)
      ) {
        setShowHideFieldsDropdown(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setShowFilterDropdown(false);
      }
    };

    // Fallback for very old browsers without PointerEvent
    const handleMouseDown = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSearchInput(false);
      }
      if (
        hideFieldsRef.current &&
        !hideFieldsRef.current.contains(event.target as Node)
      ) {
        setShowHideFieldsDropdown(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setShowFilterDropdown(false);
      }
    };

    const supportsPointer = "PointerEvent" in window;
    if (supportsPointer) {
      document.addEventListener("pointerdown", handlePointerDown);
    } else {
      document.addEventListener("mousedown", handleMouseDown);
    }

    return () => {
      if (supportsPointer) {
        document.removeEventListener("pointerdown", handlePointerDown);
      } else {
        document.removeEventListener("mousedown", handleMouseDown);
      }
    };
  }, []);

  // Calculate hidden columns count
  const hiddenCount = columns.filter(
    (column) => columnVisibility[column.id] === false,
  ).length;

  // Helper function to get column name by ID
  const getColumnName = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId);
    return column?.name ?? "Unknown Column";
  };

  // Get active filters (filters with valid column and value)
  const activeFilters = filters.filter(
    (filter) =>
      filter.columnId &&
      filter.value &&
      (filter.value === "is_empty" ||
        filter.value === "is_not_empty" ||
        (filter.inputValue && filter.inputValue.trim() !== "")),
  );

  // Convert our new filter format to the expected FilterGroup format
  const convertToFilterGroups = (
    newFilters: typeof filters,
    logicOp: "and" | "or",
  ): FilterGroup[] => {
    if (newFilters.length === 0) return [];

    // Convert each filter to a FilterCondition
    const conditions: FilterCondition[] = newFilters
      .filter((filter) => {
        // Skip filters with no value or no column
        if (!filter.value || !filter.columnId) return false;

        // Don't filter out filters with empty input values - they represent valid conditions
        // that just haven't been filled in yet. The DataGrid can handle empty values.
        return true;
      })
      .map((filter) => ({
        id: filter.id,
        columnId: filter.columnId!,
        operator: filter.value as any, // Our values match the FilterOperator type
        value: filter.inputValue ?? "",
      }));

    if (conditions.length === 0) return [];

    // Create a single FilterGroup with all conditions using the selected logic operator
    return [
      {
        id: "filter-group-1",
        conditions,
        logicOperator: logicOp,
      },
    ];
  };

  // Handle filter changes from FilterModal
  const handleFiltersChange = (
    newFilters: typeof filters,
    newLogicOperator: "and" | "or",
  ) => {
    // Filter change in TableNavigation

    setFilters(newFilters);
    setLogicOperator(newLogicOperator);

    // Convert to FilterGroup format and call parent callback
    const filterGroups = convertToFilterGroups(newFilters, newLogicOperator);
    // Converted filter groups
    _onFiltersChange?.(filterGroups);
  };

  // Convert filters for the DataGrid
  const filterGroups = convertToFilterGroups(filters, logicOperator);

  return (
    <div className="flex h-full flex-col">
      {/* Horizontal Toolbar */}
      <div className="flex max-h-11 items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center space-x-4">
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <Image
              src="/icons/menu.svg"
              alt="Toggle sidebar"
              width={16}
              height={16}
            />
          </button>

          {/* Current view with dropdown */}
          <div className="flex items-center space-x-2">
            <svg
              width="16"
              height="16"
              fill="#166ee1"
              shape-rendering="geometricprecision"
            >
              <path
                fill-rule="evenodd"
                d="M2.5 2A1.5 1.5 0 0 0 1 3.5v9A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13.5 2zM2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V5H2zM8.5 6H14v3H8.5zm-1 3V6H2v3zM2 10v2.5a.5.5 0 0 0 .5.5h5v-3zm6.5 0H14v2.5a.5.5 0 0 1-.5.5h-5z"
              />
            </svg>
            <span className="text-sm text-gray-900">
              {currentView?.name ?? "Grid view"}
            </span>
            <Image
              src="/icons/chevron-down.svg"
              alt="Dropdown"
              width={16}
              height={16}
              className="text-gray-400"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Action buttons */}
          <div className="relative" ref={hideFieldsRef}>
            <button
              onClick={() => setShowHideFieldsDropdown(!showHideFieldsDropdown)}
              className={`flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm ${
                hiddenCount > 0
                  ? "bg-[#c4edfd] text-gray-700 hover:bg-blue-200"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path d="M53.92 34.62a8 8 0 1 0-11.84 10.76l19.24 21.17C25 88.84 9.38 123.2 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208a127.1 127.1 0 0 0 52.07-10.83l22 24.21a8 8 0 1 0 11.84-10.76Zm47.33 75.84 41.67 45.85a32 32 0 0 1-41.67-45.85M128 192c-30.78 0-57.67-11.19-79.93-33.25A133.2 133.2 0 0 1 25 128c4.69-8.79 19.66-33.39 47.35-49.38l18 19.75a48 48 0 0 0 63.66 70l14.73 16.2A112 112 0 0 1 128 192m6-95.43a8 8 0 0 1 3-15.72 48.16 48.16 0 0 1 38.77 42.64 8 8 0 0 1-7.22 8.71 6 6 0 0 1-.75 0 8 8 0 0 1-8-7.26A32.09 32.09 0 0 0 134 96.57m113.28 34.69c-.42.94-10.55 23.37-33.36 43.8a8 8 0 1 1-10.67-11.92 132.8 132.8 0 0 0 27.8-35.14 133.2 133.2 0 0 0-23.12-30.77C185.67 75.19 158.78 64 128 64a118.4 118.4 0 0 0-19.36 1.57A8 8 0 1 1 106 49.79 134 134 0 0 1 128 48c34.88 0 66.57 13.26 91.66 38.35 18.83 18.83 27.3 37.62 27.65 38.41a8 8 0 0 1 0 6.5Z" />
              </svg>
              <span>
                {hiddenCount > 0 ? `${hiddenCount} hidden` : "Hide fields"}
              </span>
            </button>

            {showHideFieldsDropdown && (
              <HideFieldsDropdown
                columns={columns}
                visibleColumns={columnVisibility}
                onColumnVisibilityChange={
                  onColumnVisibilityChange ?? (() => undefined)
                }
                onBatchColumnVisibilityChange={
                  onBatchColumnVisibilityChange ?? (() => undefined)
                }
                onClose={() => setShowHideFieldsDropdown(false)}
              />
            )}
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm ${
                activeFilters.length > 0
                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path d="M200 136a8 8 0 0 1-8 8H64a8 8 0 0 1 0-16h128a8 8 0 0 1 8 8m32-56H24a8 8 0 0 0 0 16h208a8 8 0 0 0 0-16m-80 96h-48a8 8 0 0 0 0 16h48a8 8 0 0 0 0-16" />
              </svg>
              <span>
                {activeFilters.length === 0
                  ? "Filter"
                  : activeFilters.length === 1
                    ? `Filter by ${getColumnName(activeFilters[0]!.columnId!)}`
                    : `Filter by ${activeFilters.length} columns`}
              </span>
            </button>

            {showFilterDropdown && (
              <FilterModal
                isOpen={showFilterDropdown}
                onClose={() => setShowFilterDropdown(false)}
                onFiltersChange={handleFiltersChange}
                initialFilters={filters}
                initialLogicOperator={logicOperator}
                columns={columns}
              />
            )}
          </div>
          <button className="flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
            <svg
              width="16"
              height="16"
              fill="currentColor"
              shape-rendering="geometricprecision"
            >
              <path d="M6 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m1 0a.5.5 0 0 1 .5-.5H11a.5.5 0 0 1 0 1H7.5a.5.5 0 0 1-.5-.5M7.5 9a.5.5 0 0 0 0 1H11a.5.5 0 0 0 0-1zM6 9.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m-3.455-7c-.488 0-1.045.346-1.045.955v9.09c0 .61.557.955 1.045.955h10.91c.488 0 1.045-.346 1.045-.954V3.455c0-.61-.557-.955-1.046-.955zM2.5 12.493V3.507a.1.1 0 0 1 .045-.007h10.91q.029 0 .045.007v8.986a.1.1 0 0 1-.046.007H2.545a.1.1 0 0 1-.045-.007" />
            </svg>
            <span>Group</span>
          </button>
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className={`flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm ${
                sort.length > 0
                  ? "bg-orange-100 hover:bg-orange-200"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path d="M117.66 170.34a8 8 0 0 1 0 11.32l-32 32a8 8 0 0 1-11.32 0l-32-32a8 8 0 0 1 11.32-11.32L72 188.69V48a8 8 0 0 1 16 0v140.69l18.34-18.35a8 8 0 0 1 11.32 0m96-96-32-32a8 8 0 0 0-11.32 0l-32 32a8 8 0 0 0 11.32 11.32L168 67.31V208a8 8 0 0 0 16 0V67.31l18.34 18.35a8 8 0 0 0 11.32-11.32" />
              </svg>
              <span>
                {sort.length > 0
                  ? `Sorted by ${sort.length} field${sort.length > 1 ? "s" : ""}`
                  : "Sort"}
              </span>
            </button>

            {showSortDropdown && (
              <SortDropdown
                columns={columns}
                sort={sort}
                onSortChange={onSortChange ?? (() => undefined)}
                onClose={() => setShowSortDropdown(false)}
              />
            )}
          </div>
          <button className="flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M234.53 139.07a8 8 0 0 0 3.13-13.24L122.17 10.34a8 8 0 0 0-11.31 0L70.25 51l-24.6-24.66a8 8 0 0 0-11.31 11.32l24.6 24.6L15 106.17a24 24 0 0 0 0 33.94L99.89 225a24 24 0 0 0 33.94 0l78.49-78.49Zm-32.19-5.24-79.83 79.83a8 8 0 0 1-11.31 0L26.34 128.8a8 8 0 0 1 0-11.31l43.91-43.92 29.12 29.12a28 28 0 1 0 11.31-11.32L81.57 62.26l35-34.95L217.19 128l-11.72 3.9a8.1 8.1 0 0 0-3.13 1.93m-86.83-26.31a13.26 13.26 0 1 1-.05.06s.05-.05.05-.06m123.15 56a8 8 0 0 0-13.32 0C223.57 166.23 208 190.09 208 208a24 24 0 0 0 48 0c0-17.91-15.57-41.77-17.34-44.44ZM232 216a8 8 0 0 1-8-8c0-6.8 4-16.32 8-24.08 4 7.76 8 17.34 8 24.08a8 8 0 0 1-8 8" />
            </svg>
            <span>Color</span>
          </button>
          <svg
            width="16"
            height="16"
            fill="currentColor"
            shape-rendering="geometricprecision"
          >
            <path d="m13.146 2.646-1 1a.5.5 0 0 0 .708.708L13 4.207v7.586l-.146-.147a.5.5 0 0 0-.708.708l1 1a.5.5 0 0 0 .708 0l1-1a.5.5 0 0 0-.708-.708l-.146.147V4.207l.146.147a.5.5 0 0 0 .708-.708l-1-1a.5.5 0 0 0-.708 0M1.5 3a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1zM1 9.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1h-8a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1z" />
          </svg>
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M224 104a8 8 0 0 1-16 0V59.32l-66.33 66.34a8 8 0 0 1-11.32-11.32L196.68 48H152a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-40 24a8 8 0 0 0-8 8v72H48V80h72a8 8 0 0 0 0-16H48a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-72a8 8 0 0 0-8-8" />
            </svg>
            <span>Share and sync</span>
          </button>
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 ${
                showSearchInput || searchQuery ? "bg-blue-50 text-blue-600" : ""
              }`}
            >
              <Image
                src="/icons/search.svg"
                alt="Search"
                width={16}
                height={16}
              />
            </button>

            {showSearchInput && (
              <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-3">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        fill="currentColor"
                        className="absolute ml-2"
                        viewBox="0 0 256 256"
                      >
                        <path d="m229.66 218.34-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32M40 112a72 72 0 1 1 72 72 72.08 72.08 0 0 1-72-72" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      placeholder="Search all records..."
                      className="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 text-sm leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  {searchQuery && (
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Searching in all fields</span>
                      <button
                        onClick={() => {
                          onSearchChange?.("");
                          setShowSearchInput(false);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area with Sidebar */}
      <div className="flex flex-1">
        {/* Vertical Sidebar for Views */}
        <div
          className={`${sidebarCollapsed ? "w-0" : "w-64"} flex-shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-200`}
        >
          <div className="p-4">
            {/* Create new view */}
            <div
              className={`mb-2 flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100 ${
                isCreatingView ? "cursor-not-allowed opacity-50" : ""
              }`}
              onClick={() => !isCreatingView && setShowCreateViewModal(true)}
            >
              {isCreatingView ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              ) : (
                <Image
                  src="/icons/plus.svg"
                  alt="Create"
                  width={12}
                  height={12}
                  className="text-gray-600"
                />
              )}
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-700">
                  {isCreatingView ? "Creating view..." : "Create new view"}
                </span>
              )}
            </div>

            {/* Find a view */}
            <div className="mb-2 flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/search.svg"
                alt="Search"
                width={12}
                height={12}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-700">Find a view</span>
              )}
            </div>

            {/* Views list */}
            <div className="space-y-1">
              {views.map((view) => (
                <div
                  key={view.id}
                  className={`group flex items-center justify-between space-x-3 rounded-md p-2 ${
                    currentView?.id === view.id
                      ? "bg-gray-100"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div
                    className="flex flex-1 cursor-pointer items-center space-x-3"
                    onClick={() => onViewSelect?.(view)}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="#166ee1"
                      shape-rendering="geometricprecision"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M2.5 2A1.5 1.5 0 0 0 1 3.5v9A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13.5 2zM2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V5H2zM8.5 6H14v3H8.5zm-1 3V6H2v3zM2 10v2.5a.5.5 0 0 0 .5.5h5v-3zm6.5 0H14v2.5a.5.5 0 0 1-.5.5h-5z"
                      />
                    </svg>
                    {!sidebarCollapsed && (
                      <span className="text-xs text-gray-900">{view.name}</span>
                    )}
                  </div>
                  {!sidebarCollapsed &&
                    onDeleteView &&
                    view.name !== "Grid view" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        disabled={isDeletingView}
                        className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          isDeletingView ? "Deleting view..." : "Delete view"
                        }
                      >
                        {isDeletingView ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                        ) : (
                          <svg
                            width="12"
                            height="12"
                            fill="currentColor"
                            viewBox="0 0 256 256"
                          >
                            <path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128L50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z" />
                          </svg>
                        )}
                      </button>
                    )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="relative flex-1 overflow-hidden">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              // Clone the child and pass our converted filters
              return React.cloneElement(child, {
                filters: filterGroups,
              } as any);
            }
            return child;
          })}

          {/* View Operation Loading Overlay */}
          {(isCreatingView || isDeletingView) && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {isCreatingView ? "Creating view..." : "Deleting view..."}
                    </p>
                    <p className="text-xs text-gray-500">
                      Please wait while we process your request
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create View Modal - Optimized for performance */}
      {showCreateViewModal && (
        <CreateViewModal
          onCreateView={(name) => {
            if (onCreateView) {
              onCreateView(name);
            }
            setShowCreateViewModal(false);
          }}
          onClose={() => {
            setShowCreateViewModal(false);
          }}
          isLoading={isCreatingView}
        />
      )}
    </div>
  );
}
