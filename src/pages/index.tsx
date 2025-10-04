import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "~/utils/api";
import { AirtableLayout } from "~/components/layout";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const utils = api.useUtils();
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);

  const { data: workspaces, refetch: refetchWorkspaces } =
    api.workspace.getAll.useQuery();

  const createWorkspace = api.workspace.create.useMutation({
    onSuccess: (newWorkspace) => {
      void refetchWorkspaces();
      // Redirect to the newly created workspace
      void router.push(`/workspace/${newWorkspace.id}`);
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
        // No other workspaces, stay on home page (will show create workspace flow)
        void refetchWorkspaces();
      }
    },
  });

  useEffect(() => {
    if (status === "loading") return; // Still loading
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  // Redirect to first workspace if available
  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !router.query.workspace) {
      void router.push(`/workspace/${workspaces[0]?.id}`);
    }
  }, [workspaces, router]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showWorkspaceDropdown) {
        setShowWorkspaceDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showWorkspaceDropdown]);

  const handleCreateWorkspace = () => {
    createWorkspace.mutate({
      name: "My First Workspace",
    });
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to signin
  }

  return (
    <>
      <Head>
        <title>Airtable Clone</title>
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
            {/* Welcome Screen - Show when no workspaces exist */}
            {workspaces && workspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-50 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
                  <Image
                    src="/icons/workspace.svg"
                    alt="Workspace"
                    width={32}
                    height={32}
                    className="text-blue-600"
                  />
                </div>
                <h1 className="mb-4 text-xl font-bold text-gray-900">
                  Welcome to Airtable
                </h1>
                <p className="mb-8 max-w-md text-lg text-gray-600">
                  Create your first workspace to start organizing your data and
                  collaborating with your team.
                </p>
                <button
                  onClick={handleCreateWorkspace}
                  className="rounded-md bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
                >
                  Create your first workspace
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-50 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
                  <Image
                    src="/icons/workspace.svg"
                    alt="Workspace"
                    width={32}
                    height={32}
                    className="text-blue-600"
                  />
                </div>
                <h1 className="mb-4 text-xl font-bold text-gray-900">
                  Redirecting...
                </h1>
                <p className="mb-8 max-w-md text-lg text-gray-600">
                  Taking you to your workspace.
                </p>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Deletion Loading Overlay */}
        {deleteWorkspace.isPending && (
          <div className="bg-opacity-50 fixed inset-0 z-[100] flex items-center justify-center bg-black">
            <div className="rounded-lg bg-white p-8 shadow-xl">
              <div className="flex flex-col items-center space-y-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent"></div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Deleting Workspace
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Please wait while we delete &ldquo;{workspaces?.[0]?.name}
                    &rdquo; and all its contents...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AirtableLayout>
    </>
  );
}
