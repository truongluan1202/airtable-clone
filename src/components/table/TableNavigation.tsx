import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { HideFieldsDropdown } from "./HideFieldsModal";

interface TableNavigationProps {
  children: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onHideFieldsClick?: () => void;
  columns?: Array<{ id: string; name: string; type: string }>;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
}

export function TableNavigation({
  children,
  searchQuery = "",
  onSearchChange,
  onHideFieldsClick: _onHideFieldsClick,
  columns = [],
  columnVisibility = {},
  onColumnVisibilityChange,
}: TableNavigationProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showHideFieldsDropdown, setShowHideFieldsDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);

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
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calculate hidden columns count
  const hiddenCount = columns.filter(
    (column) => !columnVisibility[column.id],
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Horizontal Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center space-x-4">
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <Image
              src="/icons/menu.svg"
              alt="Toggle sidebar"
              width={20}
              height={20}
            />
          </button>

          {/* Grid view with dropdown */}
          <div className="flex items-center space-x-2">
            <Image
              src="/icons/grid-view.svg"
              alt="Grid View"
              width={16}
              height={16}
              className="text-gray-600"
            />
            <span className="text-sm font-medium text-gray-900">Grid view</span>
            <Image
              src="/icons/chevron-down.svg"
              alt="Dropdown"
              width={16}
              height={16}
              className="text-gray-400"
            />
          </div>
        </div>
        <div className="flex items-center">
          {/* Action buttons */}
          <div className="relative" ref={hideFieldsRef}>
            <button
              onClick={() => setShowHideFieldsDropdown(!showHideFieldsDropdown)}
              className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                hiddenCount > 0
                  ? "bg-blue-400/60 text-white hover:border hover:border-blue-800"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Image
                src="/icons/eye.svg"
                alt="Hide fields"
                width={16}
                height={16}
                className={hiddenCount > 0 ? "invert" : ""}
              />
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
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Image
              src="/icons/filter.svg"
              alt="Filter"
              width={16}
              height={16}
            />
            <span>Filter</span>
          </button>
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Image src="/icons/group.svg" alt="Group" width={16} height={16} />
            <span>Group</span>
          </button>
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Image src="/icons/sort.svg" alt="Sort" width={16} height={16} />
            <span>Sort</span>
          </button>
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Image src="/icons/color.svg" alt="Color" width={16} height={16} />
            <span>Color</span>
          </button>
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Image
              src="/icons/shared.svg"
              alt="Share and sync"
              width={16}
              height={16}
            />
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
                      <Image
                        src="/icons/search.svg"
                        alt="Search"
                        width={16}
                        height={16}
                        className="text-gray-400"
                      />
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
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">Create new...</span>
              )}
            </div>

            {/* Find a view */}
            <div className="mb-2 flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/search.svg"
                alt="Search"
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">Find a view</span>
              )}
            </div>

            {/* Grid view (active) */}
            <div className="mb-2 flex items-center space-x-3 rounded-md bg-gray-100 p-2">
              <Image
                src="/icons/grid-view.svg"
                alt="Grid View"
                width={20}
                height={20}
                className="text-gray-700"
              />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium text-gray-900">
                  Grid view
                </span>
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
