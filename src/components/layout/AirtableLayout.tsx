import { useState } from "react";
import Image from "next/image";
import { UserDropdown } from "~/components/ui";

interface AirtableLayoutProps {
  children: React.ReactNode;
}

export function AirtableLayout({ children }: AirtableLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-white">
      {/* Fixed Horizontal Header */}
      <div className="fixed top-0 right-0 left-0 z-50 border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Left side - Menu and Logo */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <Image
                src="/icons/menu.svg"
                alt="Menu"
                width={20}
                height={20}
                className="text-gray-600"
              />
            </button>
            <div className="flex items-center space-x-2">
              <Image
                src="/icons/airtable-logo.png"
                alt="Airtable"
                width={24}
                height={24}
              />
              <span className="text-xl font-semibold text-gray-900">
                Airtable
              </span>
            </div>
          </div>

          {/* Center - Search Bar */}
          <div className="mx-8 max-w-md flex-1">
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
                placeholder="Search..."
                className="block w-full rounded-md border border-gray-300 bg-white py-2 pr-12 pl-10 leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-gray-400">⌘K</span>
              </div>
            </div>
          </div>

          {/* Right side - Help, Notifications, User */}
          <div className="flex items-center space-x-4">
            <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              <Image src="/icons/help.svg" alt="Help" width={20} height={20} />
            </button>
            <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              <Image
                src="/icons/bell.svg"
                alt="Notifications"
                width={20}
                height={20}
              />
            </button>
            <UserDropdown />
          </div>
        </div>
      </div>

      {/* Vertical Sidebar */}
      <div
        className={`${sidebarCollapsed ? "w-16" : "w-75"} fixed top-16 left-0 z-40 border-r border-gray-200 bg-white transition-all duration-200`}
      >
        <div className="p-4">
          {/* Navigation Items */}
          <nav className="space-y-1">
            {/* Home */}
            <div className="flex items-center space-x-3 rounded-md bg-gray-100 p-2">
              <Image
                src="/icons/home.svg"
                alt="Home"
                width={20}
                height={20}
                className="text-gray-700"
              />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium text-gray-900">Home</span>
              )}
            </div>

            {/* Starred */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/star.svg"
                alt="Starred"
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">Starred</span>
                  <Image
                    src="/icons/chevron-down.svg"
                    alt="Dropdown"
                    width={12}
                    height={12}
                    className="text-gray-400"
                  />
                </div>
              )}
            </div>

            {/* Starred placeholder */}
            {!sidebarCollapsed && (
              <div className="font-small mb-2 ml-2 rounded-md bg-gray-50 p-3">
                <div className="flex items-center space-x-2">
                  <Image
                    src="/icons/star.svg"
                    alt="Star"
                    width={16}
                    height={16}
                    className="text-gray-400"
                  />
                  <span className="text-xs text-gray-500">
                    Your starred bases, interfaces, and workspaces will appear
                    here.
                  </span>
                </div>
              </div>
            )}

            {/* Shared */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/shared.svg"
                alt="Shared"
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">Shared</span>
              )}
            </div>

            {/* Workspaces */}
            <div className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-100">
              <div className="flex items-center space-x-3">
                <Image
                  src="/icons/workspace.svg"
                  alt="Workspaces"
                  width={20}
                  height={20}
                  className="text-gray-600"
                />
                {!sidebarCollapsed && (
                  <span className="text-sm text-gray-700">Workspaces</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-1">
                  <button className="rounded p-1 hover:bg-gray-200">
                    <Image
                      src="/icons/plus.svg"
                      alt="Add"
                      width={12}
                      height={12}
                      className="text-gray-500"
                    />
                  </button>
                  <button className="rounded p-1 hover:bg-gray-200">
                    <Image
                      src="/icons/chevron-right.svg"
                      alt="Expand"
                      width={12}
                      height={12}
                      className="text-gray-500"
                    />
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="relative mt-8 flex h-full flex-col justify-end space-y-1 border-t border-gray-200 bg-white pt-5">
            {/* Templates and apps */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/document.svg"
                alt="Templates"
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">
                  Templates and apps
                </span>
              )}
            </div>

            {/* Marketplace */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/checkbox.svg"
                alt="Marketplace"
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">Marketplace</span>
              )}
            </div>

            {/* Import */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/plus.svg"
                alt="Import"
                width={20}
                height={20}
                className="text-gray-600"
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">Import</span>
              )}
            </div>

            {/* Create Button */}
            <button className="mt-5 flex w-full items-center justify-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">+ Create</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 pt-16 ${sidebarCollapsed ? "ml-16" : "ml-75"} transition-all duration-200`}
      >
        <div className="h-full overflow-auto">{children}</div>
      </div>
    </div>
  );
}
