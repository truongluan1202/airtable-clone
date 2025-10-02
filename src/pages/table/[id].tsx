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
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkLoadingMessage, setBulkLoadingMessage] =
    useState("Adding rows...");

  // Get total row count for complete table structure
  const { data: rowCountData } = api.table.getRowCount.useQuery(
    { id: id as string },
    {
      enabled: !!id,
      staleTime: 10 * 60 * 1000, // 10 minutes - row count rarely changes
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
      refetchOnWindowFocus: false,
    },
  );

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
      limit: 500, // First page: 500 rows for quick skeleton display
    },
    {
      enabled: !!id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on mount if data exists
    },
  );

  // Flatten all pages into a single array of rows
  const allRows = infiniteData?.pages.flatMap((page) => page.rows) ?? [];
  const table = infiniteData?.pages[0]?.table;

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
  const {
    data: baseTables,
    isLoading: tablesLoading,
    refetch: refetchTables,
  } = api.table.getByBaseId.useQuery(
    { baseId: table?.baseId ?? "" },
    { enabled: !!table?.baseId && !!table },
  );

  const addSampleData = api.table.addSampleData.useMutation({
    onMutate: async (variables) => {
      setIsBulkLoading(true);
      setBulkLoadingMessage(`Adding ${variables.count ?? 0} sample rows...`);
    },
    onSuccess: async (_data) => {
      setShowAddDataModal(false);
      setIsBulkLoading(false);

      // Simple page refresh - no need for complex cache management
      window.location.reload();
    },
    onError: (error) => {
      console.error("❌ Error adding sample data:", error);
      setIsBulkLoading(false);
    },
  });

  const addTestRows = api.table.addSampleData.useMutation({
    onMutate: async (variables) => {
      setIsBulkLoading(true);
      setBulkLoadingMessage(`Adding ${variables.count ?? 0} test rows...`);
    },
    onSuccess: async (_data) => {
      setIsBulkLoading(false);

      // Simple page refresh - no need for complex cache management
      window.location.reload();
    },
    onError: (error) => {
      console.error("❌ Error adding test rows:", error);
      setIsBulkLoading(false);
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

  // Transform table data to match DataGrid format using flatter structure
  const gridData = allRows.map((row: any) => {
    // Create a dynamic object based on the actual table columns
    const rowData: any = { id: row.id };

    // Use cache data directly - much more efficient than cell lookups
    table?.columns?.forEach((column: any) => {
      // Get value directly from cache
      const value = row.data?.[column.id];
      rowData[column.name] = value?.toString() ?? "";
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

  const handleTableSelect = (tableId: string) => {
    if (tableId !== id) {
      void router.push(`/table/${tableId}`);
    }
  };

  const handleTableCreated = () => {
    // Refetch tables to update the list
    void refetchTables();
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
              // Total rows for complete table structure
              totalRows={rowCountData?.totalRows}
              // Bulk loading props
              isBulkLoading={isBulkLoading}
              bulkLoadingMessage={bulkLoadingMessage}
              // Data loading state to disable operations
              isDataLoading={hasNextPage || isFetchingNextPage}
            />
          </TableNavigation>
        </div>
      </TableViewLayout>
    </>
  );
}
