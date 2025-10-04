import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import { TableSkeleton } from "~/components/table/TableSkeleton";
import { TableViewLayout } from "~/components/layout";

export default function BaseDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [tableName, setTableName] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [waitingForDefaultTable, setWaitingForDefaultTable] = useState(false);

  const {
    data: base,
    isLoading: baseLoading,
    isError: baseError,
  } = api.base.getById.useQuery({ id: id as string }, { enabled: !!id });

  const { data: tables, refetch: refetchTables } =
    api.table.getByBaseId.useQuery(
      { baseId: id as string },
      {
        enabled: !!id,
        // Poll every 500ms when waiting for default table creation (synchronous creation should be fast)
        refetchInterval: (data) => {
          // If no tables exist but base exists, poll for new tables
          if (base && (!data || (Array.isArray(data) && data.length === 0))) {
            console.log("🔄 Polling for tables...", {
              baseId: base.id,
              tablesCount: Array.isArray(data) ? data.length : 0,
            });
            return 500; // Poll every 500ms for very fast detection
          }
          console.log("✅ Tables found, stopping polling", {
            tablesCount: Array.isArray(data) ? data.length : 0,
          });
          return false; // Stop polling when tables exist
        },
        refetchIntervalInBackground: true,
      },
    );

  const createTable = api.table.create.useMutation({
    onMutate: () => {
      setIsCreatingTable(true);
    },
    onSuccess: (newTable) => {
      void refetchTables();
      setShowCreateTable(false);
      setTableName("");
      setTableDescription("");
      setIsCreatingTable(false);
      // Redirect to the new table
      void router.push(`/table/${newTable.id}`);
    },
    onError: () => {
      setIsCreatingTable(false);
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  // Auto-redirect to first table if tables exist, or show skeleton immediately
  useEffect(() => {
    if (tables && tables.length > 0 && !showCreateTable && !isCreatingTable) {
      // Reset waiting state when tables are found
      setWaitingForDefaultTable(false);
      console.log("✅ Table found, redirecting to table page:", tables[0]?.id);
      void router.push(`/table/${tables[0]?.id}`);
    } else if (
      tables &&
      tables.length === 0 &&
      !showCreateTable &&
      !isCreatingTable &&
      base
    ) {
      // If no tables exist but base exists, show skeleton immediately
      // Since base creation is now synchronous, table should be available
      console.log("🔄 Showing skeleton - table should be available soon...");
      setWaitingForDefaultTable(true);

      // Immediately refetch tables to catch the newly created table
      console.log("🔄 Immediately refetching tables...");
      void refetchTables();
    }
  }, [tables, router, showCreateTable, isCreatingTable, base, refetchTables]);

  // Timeout fallback: if waiting too long for default table, show create table modal
  useEffect(() => {
    if (waitingForDefaultTable) {
      const timeout = setTimeout(() => {
        console.log(
          "⏰ Timeout waiting for default table, showing create table modal",
        );
        setWaitingForDefaultTable(false);
        setShowCreateTable(true);
      }, 2000); // 2 second timeout (very fast with synchronous creation)

      return () => clearTimeout(timeout);
    }
  }, [waitingForDefaultTable]);

  // Show skeleton when creating table or when no tables exist
  const shouldShowSkeleton =
    base && (isCreatingTable || !tables || tables.length === 0);

  const handleCreateTable = () => {
    if (tableName.trim() && id) {
      createTable.mutate({
        baseId: id as string,
        name: tableName.trim(),
        description: tableDescription.trim() || undefined,
        withSampleData: true,
      });
    }
  };

  // Show base UI immediately even during loading
  if (status === "loading" || baseLoading) {
    return (
      <>
        <Head>
          <title>Loading base - Airtable Clone</title>
          <meta name="description" content="Loading your base..." />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <TableViewLayout
          baseName="Loading base..."
          tableName="Loading table..."
          baseId={id as string}
          tables={[]}
        >
          <TableSkeleton
            baseName="Loading base..."
            tableName="Loading table..."
          />
        </TableViewLayout>
      </>
    );
  }

  if (!session) {
    return null;
  }

  if (baseError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Base not found</h1>
          <p className="mt-2 text-gray-600">
            The base you&apos;re looking for doesn&apos;t exist.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  // Show loading while base data is being fetched
  if (!base) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading base...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{base.name} - Airtable Clone</title>
        <meta
          name="description"
          content={base.description ?? "Base in Airtable Clone"}
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Always show skeleton when accessing base page */}
      {shouldShowSkeleton ? (
        <TableViewLayout
          baseName={base.name}
          tableName={isCreatingTable ? "Creating table..." : "Loading table..."}
          baseId={base.id}
          tables={[]}
        >
          <div className="space-y-4">
            <TableSkeleton
              baseName={base.name}
              tableName={
                isCreatingTable ? "Creating table..." : "Loading table..."
              }
            />
            <div className="text-center">
              <p className="mb-3 text-sm text-gray-600">
                {isCreatingTable
                  ? "Creating your table..."
                  : "Setting up your table..."}
              </p>
              {!isCreatingTable && (
                <button
                  onClick={() => {
                    console.log("🔄 Manual refresh requested");
                    void refetchTables();
                  }}
                  className="text-sm text-blue-600 underline hover:text-blue-800"
                >
                  Check for table
                </button>
              )}
            </div>
          </div>
        </TableViewLayout>
      ) : (
        <>
          {/* Show loading while redirecting */}
          <div className="flex min-h-screen items-center justify-center bg-white">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading base...</p>
            </div>
          </div>

          {/* Create Table Modal - fallback if needed */}
          {showCreateTable && (
            <div className="cell-modal-overlay bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-lg text-gray-900">
                  Create Your First Table
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                  Let&apos;s create your first table to get started with
                  organizing your data.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700">
                      Table Name
                    </label>
                    <input
                      type="text"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      placeholder="Enter table name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">
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
                    disabled={!tableName.trim() || createTable.isPending}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createTable.isPending ? "Creating..." : "Create Table"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
