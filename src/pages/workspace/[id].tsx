import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "~/utils/api";
import { AirtableLayout } from "~/components/layout";
import { UserDropdown } from "~/components/ui";

export default function WorkspacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const utils = api.useUtils();
  const [showCreateBase, setShowCreateBase] = useState(false);
  const [baseName, setBaseName] = useState("");
  const [baseDescription, setBaseDescription] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    baseId: string;
    baseName: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    baseId: "",
    baseName: "",
  });

  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);

  const {
    data: workspace,
    isLoading: workspaceLoading,
    isError: workspaceError,
  } = api.workspace.getById.useQuery({ id: id as string }, { enabled: !!id });

  const {
    data: bases,
    refetch: refetchBases,
    isLoading: basesLoading,
  } = api.base.getByWorkspace.useQuery(
    { workspaceId: id as string },
    { enabled: !!id },
  );

  const createBase = api.base.create.useMutation({
    onSuccess: (newBase) => {
      void refetchBases();
      setShowCreateBase(false);
      setBaseName("");
      setBaseDescription("");
      // Redirect to the newly created base
      void router.push(`/base/${newBase.id}`);
    },
  });

  const deleteBase = api.base.delete.useMutation({
    onSuccess: () => {
      void refetchBases();
      setContextMenu({ visible: false, x: 0, y: 0, baseId: "", baseName: "" });
    },
  });

  const deleteWorkspace = api.workspace.delete.useMutation({
    onSuccess: async () => {
      setShowWorkspaceDropdown(false);

      // Get fresh workspace data to find another workspace to navigate to
      await utils.workspace.getAll.invalidate();
      const freshWorkspaces = await utils.workspace.getAll.fetch();

      // If there are other workspaces, navigate to the first one
      if (freshWorkspaces && freshWorkspaces.length > 0) {
        void router.push(`/workspace/${freshWorkspaces[0]?.id}`);
      } else {
        // No other workspaces, go to home
        void router.push("/");
      }
    },
  });

  useEffect(() => {
    if (status === "loading") return; // Still loading
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
      if (showWorkspaceDropdown) {
        setShowWorkspaceDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu.visible, showWorkspaceDropdown]);

  const handleCreateBase = () => {
    if (baseName.trim() && id) {
      createBase.mutate({
        name: baseName.trim(),
        description: baseDescription.trim() || undefined,
        workspaceId: id as string,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, base: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      baseId: base.id,
      baseName: base.name,
    });
  };

  const handleDeleteBase = () => {
    if (contextMenu.baseId) {
      deleteBase.mutate({ id: contextMenu.baseId });
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, baseId: "", baseName: "" });
  };

  const handleDeleteWorkspace = () => {
    if (id) {
      deleteWorkspace.mutate({ id: id as string });
    }
  };

  if (status === "loading") {
    return (
      <AirtableLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </AirtableLayout>
    );
  }

  if (!session) {
    return null; // Will redirect to signin
  }

  if (workspaceLoading) {
    return (
      <AirtableLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading workspace...</p>
          </div>
        </div>
      </AirtableLayout>
    );
  }

  if (workspaceError) {
    return (
      <AirtableLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Workspace not found
            </h1>
            <p className="mt-2 text-gray-600">
              The workspace you&apos;re looking for doesn&apos;t exist.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </AirtableLayout>
    );
  }

  return (
    <>
      <Head>
        <title>{workspace.name} - Airtable Clone</title>
        <meta
          name="description"
          content="A powerful database and collaboration tool"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <AirtableLayout>
        <div className="flex h-full">
          {/* Main Content Area */}
          <div className="flex-1 p-6">
            {/* Workspace Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {workspace.name}
                  </h1>
                  {workspace.description && (
                    <p className="mt-1 text-gray-600">
                      {workspace.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Recently Opened Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-semibold text-gray-900">Bases</h2>
                  <Image
                    src="/icons/chevron-down.svg"
                    alt="Dropdown"
                    width={16}
                    height={16}
                    className="text-gray-400"
                  />
                </div>
                <div className="flex items-center space-x-1 rounded border border-gray-300 bg-white">
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Image
                      src="/icons/list-view.svg"
                      alt="List View"
                      width={16}
                      height={16}
                    />
                  </button>
                  <button className="bg-gray-100 p-2 text-gray-600">
                    <Image
                      src="/icons/grid-view.svg"
                      alt="Grid View"
                      width={16}
                      height={16}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Base Cards Grid */}
            {basesLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading bases...</p>
              </div>
            ) : bases && bases.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
                {bases.map((base: any) => (
                  <div
                    key={base.id}
                    className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                    onClick={() => router.push(`/base/${base.id}`)}
                    onContextMenu={(e) => handleContextMenu(e, base)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-purple-600 text-white">
                        {base.name.charAt(0).toUpperCase()}
                        {base.name.charAt(1).toLowerCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {base.name}
                        </h3>
                        <p className="text-xs text-gray-500">Opened just now</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Image
                    src="/icons/stacked-boxes.svg"
                    alt="No bases"
                    width={32}
                    height={32}
                    className="text-gray-400"
                  />
                </div>
                <h3 className="mb-2 text-lg text-gray-900">No bases yet</h3>
                <p className="mb-6 text-sm text-gray-500">
                  Create your first base to get started with organizing your
                  data.
                </p>
                <button
                  onClick={() => setShowCreateBase(true)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Create your first base
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="flex w-80 flex-col p-10 pt-5 text-xs">
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex flex-row space-x-2 p-2 pl-0">
                <button
                  onClick={() => setShowCreateBase(true)}
                  className="rounded-md bg-[#166ee1] px-3 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Create
                </button>
                <button className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50">
                  Share
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowWorkspaceDropdown(!showWorkspaceDropdown);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2 py-2 text-gray-700 transition-colors hover:bg-gray-50"
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
                        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                      />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showWorkspaceDropdown && (
                    <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={handleDeleteWorkspace}
                        disabled={deleteWorkspace.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleteWorkspace.isPending
                          ? "Deleting..."
                          : "Delete Workspace"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Workspace Collaborators */}
              <div>
                <h3 className="mb-3 text-sm text-gray-900">
                  Workspace collaborators
                </h3>
                <div className="flex items-center space-x-3">
                  <UserDropdown />
                  <span className="text-sm text-gray-700">You (owner)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Base Modal */}
        {showCreateBase && (
          <div className="cell-modal-overlay bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h3 className="mb-4 text-lg text-gray-900">Create New Base</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700">
                    Base Name
                  </label>
                  <input
                    type="text"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter base name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">
                    Description (Optional)
                  </label>
                  <textarea
                    value={baseDescription}
                    onChange={(e) => setBaseDescription(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateBase(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBase}
                  disabled={!baseName.trim() || createBase.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createBase.isPending ? "Creating..." : "Create Base"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu.visible && (
          <div
            className="fixed z-50 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              onClick={handleDeleteBase}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              disabled={deleteBase.isPending}
            >
              {deleteBase.isPending ? "Deleting..." : "Delete Base"}
            </button>
          </div>
        )}
      </AirtableLayout>
    </>
  );
}
