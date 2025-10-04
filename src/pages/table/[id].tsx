import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useRef } from "react";
import { api } from "~/utils/api";
import { DataGrid } from "~/components/table/DataGrid";
import { TableNavigation } from "~/components/table/TableNavigation";
import { TableSkeleton } from "~/components/table/TableSkeleton";
import { TableViewLayout } from "~/components/layout";
import type { SortConfig, FilterGroup, TableView } from "~/types/table";

export default function TableDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const utils = api.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [sort, setSort] = useState<SortConfig[]>([]);
  const [filters, setFilters] = useState<FilterGroup[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkLoadingMessage, setBulkLoadingMessage] =
    useState("Adding rows...");
  const [isLoadingNewView, setIsLoadingNewView] = useState(false);
  const [isLoadingViewData, setIsLoadingViewData] = useState(false);
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

  // Check if this is a temporary table ID (from optimistic redirect)
  const isTemporaryTable = id?.toString().startsWith("temp-");

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
      enabled: !!id && !isTemporaryTable, // Don't fetch for temporary IDs
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on mount if data exists
      retry: (failureCount, error) => {
        // Retry up to 3 times for network errors, but not for auth errors
        if (failureCount < 3 && error.message.includes("network")) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
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
    if (
      currentView &&
      table?.id &&
      !currentView.id.startsWith("temp-") &&
      currentView.name !== "Grid view"
    ) {
      // Debounce the update to avoid too many API calls
      // Don't update optimistic views (temp-* IDs) or the default Grid view
      console.log("🔄 Updating view:", currentView.name, "with new settings");
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
    } else if (currentView?.name === "Grid view") {
      console.log(
        "🛡️ Grid view protected from updates - keeping default settings",
      );
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
    onSuccess: async (data) => {
      setIsBulkLoading(false);
      setBulkLoadingMessage("Data added! Refreshing...");

      // Optimized: Invalidate and refetch data instead of full page reload
      // This allows progressive loading while indexes are being rebuilt
      await Promise.all([
        utils.table.getByIdPaginated.invalidate({ id: id as string }),
        utils.table.getRowCount.invalidate({ id: id as string }),
        utils.table.getViews.invalidate({ tableId: id as string }),
      ]);

      // Show success message with progressive loading feedback
      setBulkLoadingMessage(`✅ Added ${data.rowsAdded} rows! Loading data...`);

      // Simulate progressive loading feedback
      setTimeout(() => {
        setBulkLoadingMessage("⚡ Optimizing performance...");
      }, 1000);

      setTimeout(() => {
        setBulkLoadingMessage("🎉 Ready! Data is now fully optimized.");
      }, 3000);

      setTimeout(() => {
        setBulkLoadingMessage("");
      }, 5000);
    },
    onError: (error) => {
      console.error("❌ Error adding test rows:", error);
      setIsBulkLoading(false);
      setBulkLoadingMessage("❌ Failed to add test rows");
      setTimeout(() => {
        setBulkLoadingMessage("");
      }, 3000);
    },
  });

  // View mutations with optimistic updates
  const createView = api.table.createView.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await utils.table.getViews.cancel();

      // Create optimistic view
      const optimisticView: TableView = {
        id: `temp-${Date.now()}`, // Temporary ID
        name: variables.name,
        tableId: variables.tableId,
        filters: variables.filters,
        sort: variables.sort,
        columns: variables.columns,
        search: variables.search ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Optimistically update the views list
      const previousViews = utils.table.getViews.getData({
        tableId: id as string,
      });
      console.log(
        "📝 Optimistic create - previous views:",
        previousViews?.length,
      );
      utils.table.getViews.setData({ tableId: id as string }, (old: any) => [
        ...(old ?? []),
        optimisticView,
      ]);

      // Immediately select the new view
      setCurrentView(optimisticView);

      // Force a small delay to ensure the UI updates
      setTimeout(() => {
        console.log("📝 Optimistic create - view added to list");
      }, 10);

      return { previousViews };
    },
    onSuccess: async (newView) => {
      // Set loading state for the new view
      setIsLoadingNewView(true);
      setIsLoadingViewData(true);

      // Refetch to get the real view with proper ID
      await refetchViews();
      // Select the real view (this will replace the optimistic view)
      setCurrentView(newView);

      // Clear loading states after a very brief moment for visual feedback
      setTimeout(() => {
        setIsLoadingNewView(false);
        setIsLoadingViewData(false);
      }, 150); // Very short delay just for visual feedback
    },
    onError: (error, variables, context) => {
      console.error("❌ Error creating view:", error);
      // Reset loading states
      setIsLoadingNewView(false);
      setIsLoadingViewData(false);
      // Rollback optimistic update
      if (context?.previousViews) {
        utils.table.getViews.setData(
          { tableId: id as string },
          context.previousViews,
        );
      }
      // Clear current view if it was the optimistic one
      if (currentView?.id.startsWith("temp-")) {
        setCurrentView(null);
      }
      // Show user-friendly error message
      alert("Failed to create view. Please try again.");
    },
  });

  const deleteView = api.table.deleteView.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await utils.table.getViews.cancel();

      // Get the view being deleted
      const viewToDelete = views?.find((v: any) => v.id === variables.id);

      // Optimistically remove the view from the list
      const previousViews = utils.table.getViews.getData({
        tableId: id as string,
      });
      console.log(
        "🗑️ Optimistic delete - previous views:",
        previousViews?.length,
        "deleting:",
        variables.id,
      );
      utils.table.getViews.setData({ tableId: id as string }, (old: any) => {
        const filtered =
          old?.filter((view: any) => view.id !== variables.id) ?? [];
        console.log("🗑️ After filter - remaining views:", filtered.length);
        return filtered;
      });

      // If we're deleting the current view, switch to Grid view
      if (currentView?.id === variables.id) {
        const gridView = previousViews?.find(
          (v: any) => v.name === "Grid view",
        );
        setCurrentView(gridView ?? null);
      }

      // Force a small delay to ensure the UI updates
      setTimeout(() => {
        console.log("🗑️ Optimistic delete - view removed from list");
      }, 10);

      return { previousViews, deletedView: viewToDelete };
    },
    onSuccess: async () => {
      // Refetch to ensure consistency
      await refetchViews();
    },
    onError: (error, variables, context) => {
      console.error("❌ Error deleting view:", error);

      // Rollback optimistic update
      if (context?.previousViews) {
        utils.table.getViews.setData(
          { tableId: id as string },
          context.previousViews,
        );
      }

      // Restore the deleted view if it was the current one
      if (context?.deletedView && currentView?.id === variables.id) {
        setCurrentView(context.deletedView);
      }

      // Show user-friendly error message for default view protection
      if (error.message.includes("Cannot delete the default Grid view")) {
        alert(
          "Cannot delete the default Grid view. This view is required for the table to function properly.",
        );
      } else {
        alert("Failed to delete view. Please try again.");
      }
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      void router.push("/auth/signin");
    }
  }, [session, status, router]);

  // Show base UI immediately for all table access (temporary or existing)
  if (
    isTemporaryTable ||
    status === "loading" ||
    tableLoading ||
    tablesLoading ||
    viewsLoading
  ) {
    const isCreating = isTemporaryTable;
    const baseName = isCreating
      ? "Creating base..."
      : (table?.base?.name ?? "Loading...");
    const tableName = isCreating
      ? "Creating table..."
      : (table?.name ?? "Loading...");
    const baseId = isCreating ? "" : (table?.base?.id ?? "");
    const tableId = isCreating ? "" : (table?.id ?? "");

    return (
      <>
        <Head>
          <title>
            {isCreating ? "Creating base" : (table?.name ?? "Loading table")} -
            Airtable Clone
          </title>
          <meta
            name="description"
            content={
              isCreating ? "Creating your new base..." : "Loading your table..."
            }
          />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <TableViewLayout
          baseName={baseName}
          tableName={tableName}
          baseId={baseId}
          tables={[]}
        >
          <TableNavigation
            views={views ?? []}
            currentView={currentView}
            onViewSelect={() => undefined}
            onCreateView={() => undefined}
            onDeleteView={() => undefined}
            tableId={tableId}
            isCreatingView={false}
            isDeletingView={false}
          >
            <TableSkeleton baseName={baseName} tableName={tableName} />
          </TableNavigation>
        </TableViewLayout>
      </>
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
    // Show brief loading state when switching views (except for optimistic views)
    if (!view.id.startsWith("temp-")) {
      setIsLoadingViewData(true);

      // Clear loading state after a very brief moment for visual feedback
      setTimeout(() => {
        setIsLoadingViewData(false);
      }, 100); // Very short delay just for visual feedback
    }

    setCurrentView(view);

    // Apply view settings to current state
    if (view.name === "Grid view") {
      // Reset to default settings for Grid view
      console.log("🔄 Switching to Grid view - resetting to default settings");
      setFilters([]);
      setSort([]);
      setSearchQuery("");
      // Set all columns to visible for Grid view
      const defaultVisibility: Record<string, boolean> = {};
      columns.forEach((column: any) => {
        defaultVisibility[column.id] = true;
      });
      setColumnVisibility(defaultVisibility);
    } else {
      // Apply custom view settings
      if (view.filters) {
        setFilters(view.filters as unknown as FilterGroup[]);
      } else {
        setFilters([]);
      }
      if (view.sort) {
        setSort(view.sort as unknown as SortConfig[]);
      } else {
        setSort([]);
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
      } else {
        setSearchQuery("");
      }
    }
  };

  const handleCreateView = (name: string) => {
    if (name.trim() && table?.id) {
      console.log("➕ Creating view:", name.trim());
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
    // Find the view to check if it's the default Grid view
    const viewToDelete = views?.find((v: any) => v.id === viewId);

    if (viewToDelete?.name === "Grid view") {
      alert(
        "Cannot delete the default Grid view. This view is required for the table to function properly.",
      );
      return;
    }

    if (confirm("Are you sure you want to delete this view?")) {
      console.log("🗑️ Deleting view:", viewId, viewToDelete);
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
            isCreatingView={createView.isPending}
            isDeletingView={deleteView.isPending}
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
              isBulkLoading={
                isBulkLoading || isLoadingNewView || isLoadingViewData
              }
              bulkLoadingMessage={
                isLoadingNewView
                  ? "Loading new view..."
                  : isLoadingViewData
                    ? "Loading view data..."
                    : bulkLoadingMessage
              }
              // Data loading state to disable operations - only true when actually fetching
              isDataLoading={
                isFetchingNextPage || isLoadingNewView || isLoadingViewData
              }
            />
          </TableNavigation>
        </div>
      </TableViewLayout>
    </>
  );
}
