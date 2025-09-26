import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";

export default function BaseDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [tableName, setTableName] = useState("");
  const [tableDescription, setTableDescription] = useState("");

  const { data: base, isLoading: baseLoading } = api.base.getById.useQuery(
    { id: id as string },
    { enabled: !!id },
  );

  const { data: tables, refetch: refetchTables } =
    api.table.getByBaseId.useQuery({ baseId: id as string }, { enabled: !!id });

  const createTable = api.table.create.useMutation({
    onSuccess: (newTable) => {
      void refetchTables();
      setShowCreateTable(false);
      setTableName("");
      setTableDescription("");
      // Redirect to the new table
      void router.push(`/table/${newTable.id}`);
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  // Auto-redirect to first table if tables exist, or show create table if none exist
  useEffect(() => {
    if (tables && tables.length > 0 && !showCreateTable) {
      void router.push(`/table/${tables[0]?.id}`);
    } else if (tables && tables.length === 0 && !showCreateTable) {
      // If no tables exist, show the create table modal
      setShowCreateTable(true);
    }
  }, [tables, router, showCreateTable]);

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

  if (status === "loading" || baseLoading) {
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
    return null;
  }

  if (!base) {
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

      {/* Show loading while redirecting */}
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading table...</p>
        </div>
      </div>

      {/* Create Table Modal - only show when no tables exist */}
      {showCreateTable && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              Create Your First Table
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Let&apos;s create your first table to get started with organizing
              your data.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
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
  );
}
