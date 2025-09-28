import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import { UserDropdown } from "~/components/ui";

interface TableViewLayoutProps {
  children: React.ReactNode;
  baseName?: string;
  tableName?: string;
  baseId?: string;
  tables?: Array<{ id: string; name: string }>;
  onTableSelect?: (tableId: string) => void;
  onTableCreated?: () => void;
}

export function TableViewLayout({
  children,
  baseName = "Untitled Base",
  tableName = "Table 1",
  baseId,
  tables = [],
  onTableSelect,
  onTableCreated,
}: TableViewLayoutProps) {
  const [activeTab, setActiveTab] = useState("Data");
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [tableNameInput, setTableNameInput] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const router = useRouter();

  const createTable = api.table.create.useMutation({
    onSuccess: (newTable) => {
      setShowCreateTable(false);
      setTableNameInput("");
      setTableDescription("");
      onTableCreated?.();
      // Redirect to the new table
      void router.push(`/table/${newTable.id}`);
    },
  });

  const handleCreateTable = () => {
    if (tableNameInput.trim() && baseId) {
      createTable.mutate({
        baseId,
        name: tableNameInput.trim(),
        description: tableDescription.trim() || undefined,
        withSampleData: true,
      });
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Page-level Thin Sidebar */}
      <div className="flex w-16 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-100">
        <div className="p-2">
          {/* Stacked boxes icon */}
          <button
            onClick={() => router.push("/")}
            className="mb-2 w-full rounded-md p-3 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          >
            <Image
              src="/icons/airtable-icon-black.png"
              alt="Home"
              width={40}
              height={40}
            />
          </button>
        </div>

        {/* Bottom Icons */}
        <div className="mt-auto space-y-2 p-2">
          {/* Help */}
          <button className="w-full rounded-md px-3 py-2 text-gray-600 hover:bg-gray-200 hover:text-gray-900">
            <Image src="/icons/help.svg" alt="Help" width={20} height={20} />
          </button>

          {/* Notifications */}
          <button className="w-full rounded-md px-3 py-2 text-gray-600 hover:bg-gray-200 hover:text-gray-900">
            <Image
              src="/icons/bell.svg"
              alt="Notifications"
              width={20}
              height={20}
            />
          </button>

          {/* User Avatar */}
          <div className="flex justify-center py-2">
            <UserDropdown position="bottom-left" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Base Header */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex h-16 items-center justify-between px-6">
            {/* Left side - Base name and dropdown */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-600">
                  <span className="text-sm font-medium text-white">
                    {baseName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-lg font-semibold text-gray-900">
                    {baseName}
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
            </div>

            {/* Center - Navigation tabs */}
            <div className="flex items-center space-x-8">
              <button
                onClick={() => setActiveTab("Data")}
                className={`border-b-2 pb-4 text-sm font-medium ${
                  activeTab === "Data"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Data
              </button>
              <button
                onClick={() => setActiveTab("Automations")}
                className={`border-b-2 pb-4 text-sm font-medium ${
                  activeTab === "Automations"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Automations
              </button>
              <button
                onClick={() => setActiveTab("Interfaces")}
                className={`border-b-2 pb-4 text-sm font-medium ${
                  activeTab === "Interfaces"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Interfaces
              </button>
              <button
                onClick={() => setActiveTab("Forms")}
                className={`border-b-2 pb-4 text-sm font-medium ${
                  activeTab === "Forms"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Forms
              </button>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center space-x-3">
              <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                <Image
                  src="/icons/refresh.svg"
                  alt="Refresh"
                  width={20}
                  height={20}
                />
              </button>
              <button className="flex items-center space-x-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Image
                  src="/icons/star-filled.svg"
                  alt="Star"
                  width={16}
                  height={16}
                />
                <span>Upgrade</span>
              </button>
              <button className="flex items-center space-x-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Image
                  src="/icons/launch.svg"
                  alt="Launch"
                  width={16}
                  height={16}
                />
                <span>Launch</span>
              </button>
              <button className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700">
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Table Navigation Bar */}
        <div className="relative z-10 bg-white">
          <div className="flex h-9 items-center justify-between bg-[#e3f9fd] px-6 pl-0">
            {/* Left side - Table tabs */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-0">
                {tables.map((table) => {
                  const active = table.name === tableName;
                  return (
                    <button
                      key={table.id}
                      onClick={() => onTableSelect?.(table.id)}
                      className={[
                        "relative inline-flex h-9.5 w-20 items-center rounded-t-md px-3 pt-1 text-sm font-medium transition-colors",
                        active
                          ? [
                              "border border-gray-300 bg-white p-0 text-gray-900",
                              "z-20 -mb-px border-b-transparent",
                              "after:absolute after:right-[-1px] after:left-[-1px] after:content-['']",
                              "after:bottom-[-1px] after:h-[8px] after:bg-white",
                              "after:border-r after:border-l after:border-gray-300",
                              "after:pointer-events-none",
                            ].join(" ")
                          : "border border-transparent text-gray-600 hover:bg-blue-100 hover:text-gray-800",
                      ].join(" ")}
                    >
                      {table.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center space-x-2">
                <Image
                  src="/icons/chevron-down.svg"
                  alt="More tables"
                  width={16}
                  height={16}
                  className="text-gray-400"
                />
                <button
                  onClick={() => setShowCreateTable(true)}
                  className="ml-2 rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-blue-100 hover:text-gray-900"
                >
                  + Add or import
                </button>
              </div>
            </div>

            {/* Right side - Tools */}
            <div className="flex items-center">
              <button className="rounded px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700">
                Tools
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="relative z-0 flex-1 overflow-hidden border-t border-gray-200 bg-white">
          {children}
        </div>
      </div>

      {/* Create Table Modal */}
      {showCreateTable && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              Create New Table
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Create a new table in your base.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Table Name
                </label>
                <input
                  type="text"
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter table name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description (Optional)
                </label>
                <textarea
                  value={tableDescription}
                  onChange={(e) => setTableDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter table description"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateTable(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTable}
                disabled={!tableNameInput.trim() || createTable.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createTable.isPending ? "Creating..." : "Create Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
