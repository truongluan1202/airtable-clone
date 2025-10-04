import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useRef } from "react";
import { api } from "~/utils/api";
import { DataGrid } from "~/components/table/DataGrid";
import { TableNavigation } from "~/components/table/TableNavigation";
import { TableViewLayout } from "~/components/layout";
import type { SortConfig, FilterGroup, TableView } from "~/types/table";

export default function TableDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [searchQuery, setSearchQuery] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [sort, setSort] = useState<SortConfig[]>([]);
  const [filters, setFilters] = useState<FilterGroup[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkLoadingMessage, setBulkLoadingMessage] =
    useState("Adding rows...");
  // View-related state
  const [currentView, setCurrentView] = useState<TableView | null>(null);

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

  // Use refs to track previous values and prevent unnecessary re-renders
  const prevAllRowsRef = useRef<any[]>([]);
  const prevColumnsRef = useRef<any[]>([]);

  // Flatten all pages into a single array of rows - stable reference
  const allRows = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const newRows = infiniteData.pages.flatMap((page) => page.rows);

    // Only update if the data actually changed
    if (
      newRows.length !== prevAllRowsRef.current.length ||
      newRows.some((row, index) => row.id !== prevAllRowsRef.current[index]?.id)
    ) {
      prevAllRowsRef.current = newRows;
    }

    return prevAllRowsRef.current;
  }, [infiniteData?.pages]);

  const table = infiniteData?.pages[0]?.table;

  // Memoize columns to prevent infinite re-renders - stable reference
  const columns = useMemo(() => {
    if (!table?.columns) return [];

    // Only update if the columns actually changed
    if (
      table.columns.length !== prevColumnsRef.current.length ||
      table.columns.some(
        (col: any, index: number) =>
          col.id !== prevColumnsRef.current[index]?.id,
      )
    ) {
      prevColumnsRef.current = table.columns;
    }

    return prevColumnsRef.current;
  }, [table?.columns]);

  // Transform table data to match DataGrid format using flatter structure - memoized to prevent infinite re-renders
  const gridData = useMemo(() => {
    return allRows.map((row: any) => {
      // Create a dynamic object based on the actual table columns
      const rowData: any = { id: row.id };

      // Use cache data directly - much more efficient than cell lookups
      columns.forEach((column: any) => {
        // Get value directly from cache
        const value = row.data?.[column.id];
        rowData[column.name] = value?.toString() ?? "";
      });

      return rowData;
    });
  }, [allRows, columns]);

  // Initialize column visibility when table data loads
  useEffect(() => {
    if (columns.length > 0 && Object.keys(columnVisibility).length === 0) {
      const initialVisibility: Record<string, boolean> = {};
      columns.forEach((column: { id: string }) => {
        initialVisibility[column.id] = true; // All columns visible by default
      });
      setColumnVisibility(initialVisibility);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]); // Removed columnVisibility from dependencies to prevent infinite loop

  // Update current view when filters, sort, or column visibility changes
  const updateView = api.table.updateView.useMutation({
    onSuccess: async () => {
      await refetchViews();
    },
    onError: (error) => {
      console.error("❌ Error updating view:", error);
    },
  });

  useEffect(() => {
    if (currentView && table?.id) {
      // Debounce the update to avoid too many API calls
      const timeoutId = setTimeout(() => {
        updateView.mutate({
          id: currentView.id,
          filters,
          sort,
          columns: Object.entries(columnVisibility).map(
            ([columnId, visible], index) => ({
              columnId,
              visible,
              order: index,
            }),
          ),
          search: searchQuery,
        });
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [
    filters,
    sort,
    columnVisibility,
    searchQuery,
    currentView,
    table?.id,
    updateView,
  ]);

  // Fetch all tables for the base
  const {
    data: baseTables,
    isLoading: tablesLoading,
    refetch: refetchTables,
  } = api.table.getByBaseId.useQuery(
    { baseId: table?.baseId ?? "" },
    { enabled: !!table?.baseId && !!table },
  );

  // Fetch views for the current table
  const {
    data: views,
    isLoading: viewsLoading,
    refetch: refetchViews,
  } = api.table.getViews.useQuery({ tableId: id as string }, { enabled: !!id });

  // Auto-select the first view (default "Grid view") when views are loaded
  useEffect(() => {
    if (views && views.length > 0 && !currentView) {
      setCurrentView(views[0]);
    }
  }, [views, currentView]);

  // Reset current view when table changes
  useEffect(() => {
    setCurrentView(null);
  }, [id]);

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

  // View mutations
  const createView = api.table.createView.useMutation({
    onSuccess: async () => {
      await refetchViews();
    },
    onError: (error) => {
      console.error("❌ Error creating view:", error);
    },
  });

  const deleteView = api.table.deleteView.useMutation({
    onSuccess: async () => {
      await refetchViews();
      // If we deleted the current view, clear it
      if (currentView) {
        setCurrentView(null);
      }
    },
    onError: (error) => {
      console.error("❌ Error deleting view:", error);
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  if (status === "loading" || tableLoading || tablesLoading || viewsLoading) {
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

  const handleTableCreated = async () => {
    // Refetch tables to update the list
    await refetchTables();
  };

  // View management functions
  const handleViewSelect = (view: TableView) => {
    setCurrentView(view);
    // Apply view settings to current state
    if (view.filters) {
      setFilters(view.filters as unknown as FilterGroup[]);
    }
    if (view.sort) {
      setSort(view.sort as unknown as SortConfig[]);
    }
    if (view.columns) {
      const visibility: Record<string, boolean> = {};
      (view.columns as unknown as any[]).forEach((col: any) => {
        visibility[col.columnId] = col.visible;
      });
      setColumnVisibility(visibility);
    }
    if (view.search) {
      setSearchQuery(view.search);
    }
  };

  const handleCreateView = (name: string) => {
    if (name.trim() && table?.id) {
      createView.mutate({
        tableId: table.id,
        name: name.trim(),
        filters,
        sort,
        columns: Object.entries(columnVisibility).map(
          ([columnId, visible], index) => ({
            columnId,
            visible,
            order: index,
          }),
        ),
        search: searchQuery,
      });
    }
  };

  const handleDeleteView = (viewId: string) => {
    if (confirm("Are you sure you want to delete this view?")) {
      deleteView.mutate({ id: viewId });
    }
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
            columns={columns}
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
            views={views ?? []}
            currentView={currentView}
            onViewSelect={handleViewSelect}
            onCreateView={handleCreateView}
            onDeleteView={handleDeleteView}
            tableId={table?.id}
          >
            <DataGrid
              data={gridData}
              columns={columns}
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
              // Data loading state to disable operations - only true when actually fetching
              isDataLoading={isFetchingNextPage}
            />
          </TableNavigation>
        </div>
      </TableViewLayout>
    </>
  );
}
