import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { HideFieldsDropdown } from "./HideFieldsModal";
import { SortDropdown } from "./SortDropdown";
import { FilterDropdown } from "./FilterModal";
import type { SortConfig, FilterGroup, Column } from "~/types/table";

interface TableNavigationProps {
  children: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onHideFieldsClick?: () => void;
  columns?: Column[];
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  sort?: SortConfig[];
  onSortChange?: (sort: SortConfig[]) => void;
  filters?: FilterGroup[];
  onFiltersChange?: (filters: FilterGroup[]) => void;
}

export function TableNavigation({
  children,
  searchQuery = "",
  onSearchChange,
  onHideFieldsClick: _onHideFieldsClick,
  columns = [],
  columnVisibility = {},
  onColumnVisibilityChange,
  sort = [],
  onSortChange,
  filters = [],
  onFiltersChange,
}: TableNavigationProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showHideFieldsDropdown, setShowHideFieldsDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calculate hidden columns count
  const hiddenCount = columns.filter(
    (column) => columnVisibility[column.id] === false,
  ).length;

  // Calculate active filter count
  const activeFilterCount = filters.reduce(
    (count, group) => count + group.conditions.length,
    0,
  );

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

          {/* Grid view with dropdown */}
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
            <span className="text-sm text-gray-900">Grid view</span>
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
                onClose={() => setShowHideFieldsDropdown(false)}
              />
            )}
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center space-x-2 rounded-md px-2 py-1.5 text-sm ${
                activeFilterCount > 0
                  ? "bg-green-100 hover:bg-green-200"
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
                {activeFilterCount > 0
                  ? `Filtered by ${activeFilterCount}`
                  : "Filter"}
              </span>
            </button>

            {showFilterDropdown && (
              <FilterDropdown
                isOpen={showFilterDropdown}
                onClose={() => setShowFilterDropdown(false)}
                columns={columns}
                filters={filters}
                onFiltersChange={onFiltersChange ?? (() => undefined)}
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
            {/* Create new */}
            <div className="mb-2 flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/plus.svg"
                alt="Create"
                width={12}
                height={12}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-700">Create new...</span>
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

            {/* Grid view (active) */}
            <div className="mb-2 flex items-center space-x-3 rounded-md bg-gray-100 p-2">
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
                <span className="text-xs text-gray-900">Grid view</span>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
