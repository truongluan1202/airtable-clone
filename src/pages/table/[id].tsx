import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import { DataGrid } from "~/components/table/DataGrid";
import { TableNavigation } from "~/components/table/TableNavigation";
import { TableViewLayout } from "~/components/layout";
import type { SortConfig, FilterGroup } from "~/types/table";

export default function TableDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [showAddDataModal, setShowAddDataModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [sort, setSort] = useState<SortConfig[]>([]);
  const [filters, setFilters] = useState<FilterGroup[]>([]);

  // Use infinite query for paginated data
  const {
    data: infiniteData,
    isLoading: tableLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.table.getByIdPaginated.useInfiniteQuery(
    {
      id: id as string,
      limit: 50,
    },
    {
      enabled: !!id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  // Flatten all pages into a single array of rows
  const allRows = infiniteData?.pages.flatMap((page) => page.rows) ?? [];
  const table = infiniteData?.pages[0]?.table;

  // Debug logging
  console.log("📊 Infinite query state:", {
    pagesCount: infiniteData?.pages.length ?? 0,
    totalRows: allRows.length,
    hasNextPage,
    isFetchingNextPage,
    lastPageCursor:
      infiniteData?.pages[infiniteData.pages.length - 1]?.nextCursor,
    tableLoading,
  });

  // Initialize column visibility when table data loads
  useEffect(() => {
    if (table?.columns && Object.keys(columnVisibility).length === 0) {
      const initialVisibility: Record<string, boolean> = {};
      table.columns.forEach((column: { id: string }) => {
        initialVisibility[column.id] = true; // All columns visible by default
      });
      setColumnVisibility(initialVisibility);
    }
  }, [table?.columns, columnVisibility]);

  // Fetch all tables for the base
  const { data: baseTables, isLoading: tablesLoading } =
    api.table.getByBaseId.useQuery(
      { baseId: table?.baseId ?? "" },
      { enabled: !!table?.baseId && !!table },
    );

  const utils = api.useUtils();

  const addSampleData = api.table.addSampleData.useMutation({
    onSuccess: (data) => {
      console.log("✅ Sample data added successfully:", data);
      setShowAddDataModal(false);
      // Invalidate and refetch the infinite query
      void utils.table.getByIdPaginated.invalidate();
      // Also refetch the base tables query
      void utils.table.getByBaseId.invalidate();
    },
  });

  const addTestRows = api.table.addSampleData.useMutation({
    onSuccess: (data) => {
      console.log("✅ Test rows added successfully:", data);
      // Invalidate and refetch the infinite query
      void utils.table.getByIdPaginated.invalidate();
      // Also refetch the base tables query
      void utils.table.getByBaseId.invalidate();
    },
    onError: (error) => {
      console.error("Error adding rows:", error);
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  if (status === "loading" || tableLoading || tablesLoading) {
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

  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Table not found</h1>
          <p className="mt-2 text-gray-600">
            The table you&apos;re looking for doesn&apos;t exist.
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

  // Transform table data to match DataGrid format
  const gridData = allRows.map((row: any) => {
    // Create a dynamic object based on the actual table columns
    const rowData: any = { id: row.id };

    // Map each column to its value from the cache
    table?.columns?.forEach((column: any) => {
      const value = row.cache?.[column.id];
      // Only use cached values - don't generate fake data on refresh
      rowData[column.name] = value ?? "";
    });

    return rowData;
  });

  // Use actual tables from the database
  const tables =
    baseTables?.map((t: any) => ({
      id: t.id,
      name: t.name,
    })) ?? [];

  // Get current table name
  const getCurrentTableName = () => {
    return table?.name ?? "Untitled Table";
  };

  // Debug logging
  console.log("Table data:", table);
  console.log("Base tables:", baseTables);
  console.log("Grid data:", gridData);

  const handleTableSelect = (tableId: string) => {
    console.log("Table select clicked:", tableId, "current id:", id);
    if (tableId !== id) {
      void router.push(`/table/${tableId}`);
    }
  };

  const handleTableCreated = () => {
    // Refetch tables to update the list
    window.location.reload();
  };

  return (
    <>
      <Head>
        <title>{getCurrentTableName()} - Airtable Clone</title>
        <meta
          name="description"
          content={table.description ?? "Table in Airtable Clone"}
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <TableViewLayout
        baseName={table?.base?.name ?? "Untitled Base"}
        tableName={getCurrentTableName()}
        baseId={table?.baseId}
        tables={tables}
        onTableSelect={handleTableSelect}
        onTableCreated={handleTableCreated}
        onAddTestRows={(count) => {
          if (count >= 100000) {
            if (
              confirm(
                "This will add 100,000 rows to your table. This may take several minutes. Continue?",
              )
            ) {
              addTestRows.mutate({
                tableId: table.id,
                count,
              });
            }
          } else {
            addTestRows.mutate({
              tableId: table.id,
              count,
            });
          }
        }}
        isAddingRows={addTestRows.isPending}
      >
        <div className="flex h-full flex-col">
          <TableNavigation
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            columns={table?.columns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={(columnId, visible) => {
              setColumnVisibility((prev) => ({
                ...prev,
                [columnId]: visible,
              }));
            }}
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onFiltersChange={setFilters}
          >
            <DataGrid
              data={gridData}
              columns={table?.columns}
              tableId={table?.id}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={(columnId, visible) => {
                setColumnVisibility((prev) => ({
                  ...prev,
                  [columnId]: visible,
                }));
              }}
              sort={sort}
              filters={filters}
              enableVirtualization={true}
              // Infinite scroll props
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          </TableNavigation>
        </div>
      </TableViewLayout>

      {/* Add Sample Data Modal */}
      {showAddDataModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              Add Sample Data
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              How many sample rows would you like to add?
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Number of rows
                </label>
                <input
                  type="number"
                  defaultValue={100}
                  min={1}
                  max={1000}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddDataModal(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  addSampleData.mutate({
                    tableId: table.id,
                    count: 100,
                  });
                }}
                disabled={addSampleData.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {addSampleData.isPending ? "Adding..." : "Add Sample Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
