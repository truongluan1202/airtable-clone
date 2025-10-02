import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import { UserDropdown } from "~/components/ui";

interface AirtableLayoutProps {
  children: React.ReactNode;
}

export function AirtableLayout({ children }: AirtableLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const router = useRouter();

  const { data: workspaces, refetch: refetchWorkspaces } =
    api.workspace.getAll.useQuery();
  const createWorkspace = api.workspace.create.useMutation({
    onSuccess: () => {
      void refetchWorkspaces();
      setShowCreateWorkspace(false);
      setWorkspaceName("");
    },
  });

  const handleCreateWorkspace = () => {
    if (workspaceName.trim()) {
      createWorkspace.mutate({
        name: workspaceName.trim(),
      });
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Fixed Horizontal Header */}
      <div className="fixed top-0 right-0 left-0 z-50 border-b border-gray-200 bg-white">
        <div className="flex h-14 items-center justify-between px-4">
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
            <div className="flex items-center space-x-0">
              <Image
                src="/icons/airtable-logo.png"
                alt="Airtable"
                width={40}
                height={40}
              />
              <span className="text-xl font-semibold text-gray-900">
                Airtable
              </span>
            </div>
          </div>

          {/* Center - Search Bar */}
          <div className="mx-8 max-w-sm flex-1">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Image
                  src="/icons/search.svg"
                  alt="Search"
                  width={13}
                  height={13}
                  className="text-gray-400"
                />
              </div>
              <input
                type="text"
                placeholder="Search..."
                className="block w-full rounded-4xl border border-gray-300 bg-white py-1 pr-12 pl-10 leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
        className={`${
          sidebarCollapsed ? "w-16" : "w-72"
        } fixed top-16 bottom-0 left-0 z-40 flex flex-col border-r border-gray-200 bg-white transition-all duration-200`}
      >
        {/* Column layout that fills the available height */}
        <div className="flex h-full flex-col">
          {/* Scrollable NAV (fills remaining height) */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
            {/* Home */}
            <div className="flex items-center space-x-3 rounded-md bg-gray-100 p-2">
              <Image src="/icons/home.svg" alt="Home" width={20} height={20} />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-900">Home</span>
              )}
            </div>

            {/* Starred */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/star.svg"
                alt="Starred"
                width={20}
                height={20}
              />
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">Starred</span>
                </div>
              )}
            </div>

            {/* Shared */}
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/shared.svg"
                alt="Shared"
                width={20}
                height={20}
              />
              {!sidebarCollapsed && (
                <span className="text-sm text-gray-700">Shared</span>
              )}
            </div>

            {/* Workspaces header */}
            <div className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-100">
              <div className="flex items-center space-x-3">
                <Image
                  src="/icons/workspace.svg"
                  alt="Workspaces"
                  width={20}
                  height={20}
                />
                {!sidebarCollapsed && (
                  <span className="text-sm text-gray-700">Workspaces</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setShowCreateWorkspace(true)}
                    className="rounded p-1 hover:bg-gray-200"
                  >
                    <Image
                      src="/icons/plus.svg"
                      alt=""
                      width={12}
                      height={12}
                    />
                  </button>
                  <button
                    onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
                    className="rounded p-1 hover:bg-gray-200"
                  >
                    <Image
                      src={
                        workspacesExpanded
                          ? "/icons/chevron-down.svg"
                          : "/icons/chevron-right.svg"
                      }
                      alt=""
                      width={12}
                      height={12}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Workspace List */}
            {!sidebarCollapsed && workspacesExpanded && workspaces && (
              <div className="ml-6 space-y-1">
                {workspaces.map((ws: any) => {
                  // Check if this workspace is currently active
                  const isActive = router.asPath.startsWith(
                    `/workspace/${ws.id}`,
                  );

                  return (
                    <div
                      key={ws.id}
                      onClick={() => router.push(`/workspace/${ws.id}`)}
                      className={`flex cursor-pointer items-center space-x-3 rounded-md p-2 transition-all duration-200 ${
                        isActive
                          ? "border-l-2 border-gray-500 bg-gray-50 text-gray-700 shadow-sm"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <Image
                        src="/icons/workspace.svg"
                        alt=""
                        width={16}
                        height={16}
                        className={isActive ? "opacity-80" : ""}
                      />
                      <span
                        className={`text-sm ${isActive ? "font-medium" : "text-gray-700"}`}
                      >
                        {ws.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Bottom (fixed) */}
          <div className="mx-4 space-y-1 border-t border-gray-200 py-4 pt-4">
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/template.png"
                alt="Templates"
                width={16}
                height={16}
              />
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-700">
                  Templates and apps
                </span>
              )}
            </div>
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/marketplace.png"
                alt="Marketplace"
                width={16}
                height={16}
              />
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-700">Marketplace</span>
              )}
            </div>
            <div className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-gray-100">
              <Image
                src="/icons/import.png"
                alt="Import"
                width={16}
                height={16}
              />
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-700">Import</span>
              )}
            </div>

            <button
              className={`mt-2 w-full rounded-md ${sidebarCollapsed ? "border border-gray-300/90 p-0 text-xl font-thin" : "bg-[#166ee1] py-2 text-white hover:bg-blue-700"}`}
            >
              {sidebarCollapsed ? (
                <span>+</span>
              ) : (
                <span className="text-sm">+ Create</span>
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

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <div className="cell-modal-overlay bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg text-gray-900">Create New Workspace</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter workspace name"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateWorkspace(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!workspaceName.trim() || createWorkspace.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createWorkspace.isPending ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
