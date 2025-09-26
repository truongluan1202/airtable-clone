import { useState } from "react";
import Image from "next/image";

interface TableNavigationProps {
  children: React.ReactNode;
}

export function TableNavigation({ children }: TableNavigationProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          <button className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Image
              src="/icons/eye.svg"
              alt="Hide fields"
              width={16}
              height={16}
            />
            <span>Hide fields</span>
          </button>
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
          <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            <Image
              src="/icons/search.svg"
              alt="Search"
              width={16}
              height={16}
            />
          </button>
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
