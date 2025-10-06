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

  // Graceful error handling utility
  const handleErrorGracefully = async (error: any, operation: string) => {
    console.error(`❌ ${operation} failed:`, error);

    // Check if it's a structured error response
    let errorData;
    try {
      errorData = JSON.parse(error.message);
    } catch {
      errorData = { message: error.message };
    }

    // Error handled gracefully, refreshing data

    // If the error indicates we should refetch, do so
    if (errorData.shouldRefetch !== false) {
      try {
        await Promise.all([
          utils.table.getByIdPaginated.invalidate({ id: id as string }),
          utils.table.getViews.invalidate({ tableId: id as string }),
          utils.table.getRowCount.invalidate({ id: id as string }),
          utils.table.getByBaseId.invalidate({ baseId: table?.baseId ?? "" }),
        ]);
        // Data refreshed successfully
      } catch (refetchError) {
        console.error(
          `❌ Failed to refresh data after ${operation} error:`,
          refetchError,
        );
        // If refetch fails, show a more serious error message
        // Unable to refresh data, user should reload page
      }
    }
  };
  // Per-view state management - each view maintains its own state
  const [viewStates, setViewStates] = useState<
    Record<
      string,
      {
        searchQuery: string;
        columnVisibility: Record<string, boolean>;
        sort: SortConfig[];
        filters: FilterGroup[];
        version: number; // Track version for optimistic concurrency
      }
    >
  >({});

  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkLoadingMessage, setBulkLoadingMessage] =
    useState("Adding rows...");
  const [isLoadingNewView, setIsLoadingNewView] = useState(false);
  const [isLoadingViewData, setIsLoadingViewData] = useState(false);
  const [suspendViewSync, setSuspendViewSync] = useState(false);
  // Buffered patches during view sync suspension
  const bufferedPatchesRef = useRef<
    Array<{
      op: "set" | "merge";
      path: string;
      value: any;
      timestamp: number;
    }>
  >([]);
  // View-related state
  const [currentView, setCurrentView] = useState<TableView | null>(null);

  // Get current view's state (with defaults)
  const getCurrentViewState = () => {
    if (!currentView)
      return {
        searchQuery: "",
        columnVisibility: {},
        sort: [],
        filters: [],
        version: 1,
      };

    return (
      viewStates[currentView.id] ?? {
        searchQuery: "",
        columnVisibility: {},
        sort: [],
        filters: [],
        version: currentView.version ?? 1,
      }
    );
  };

  const currentViewState = getCurrentViewState();
  const searchQuery = currentViewState.searchQuery;
  const columnVisibility = currentViewState.columnVisibility;
  const sort = currentViewState.sort;
  const filters = currentViewState.filters;

  // Optimized comparison functions to replace expensive JSON.stringify
  const areValuesEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => areValuesEqual(item, b[index]));
    }

    if (typeof a === "object") {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => areValuesEqual(a[key], b[key]));
    }

    return false;
  };

  const areFiltersEqual = (a: FilterGroup[], b: FilterGroup[]): boolean => {
    if (a === b) return true;
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;

    return a.every((filterA, index) => {
      const filterB = b[index];
      if (!filterB) return false;

      return (
        filterA.id === filterB.id &&
        filterA.logicOperator === filterB.logicOperator &&
        areValuesEqual(filterA.conditions, filterB.conditions)
      );
    });
  };

  const areColumnArraysEqual = (a: any[], b: any[]): boolean => {
    if (a === b) return true;
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;

    return a.every((itemA, index) => {
      const itemB = b[index];
      if (!itemB) return false;

      return (
        itemA.columnId === itemB.columnId &&
        itemA.visible === itemB.visible &&
        itemA.order === itemB.order
      );
    });
  };

  // Update current view's state with proper merging and patch generation - optimized for performance
  const updateCurrentViewState = (
    updates: Partial<{
      searchQuery: string;
      columnVisibility: Record<string, boolean>;
      sort: SortConfig[];
      filters: FilterGroup[];
    }>,
  ) => {
    if (!currentView) return;

    // Update the state using functional setter to ensure we get the latest state
    setViewStates((prev) => {
      const currentState = prev[currentView.id] ?? {
        searchQuery: "",
        columnVisibility: {},
        sort: [],
        filters: [],
        version: currentView.version ?? 1,
      };

      // Merge updates with current state, handling filters specially
      const newState = {
        ...currentState,
        ...updates,
      };

      // Special handling for filters - merge by ID to preserve existing conditions
      if (updates.filters !== undefined) {
        const currentFilters = currentState.filters || [];
        const newFilters = updates.filters;

        // If newFilters is an array, merge by ID (upsert)
        if (Array.isArray(newFilters)) {
          // If newFilters is empty, clear all filters
          if (newFilters.length === 0) {
            newState.filters = [];
          } else {
            // Otherwise, merge by ID (upsert)
            const mergedFilters = [...currentFilters];

            newFilters.forEach((newFilter) => {
              if (newFilter.id) {
                // Find existing filter by ID and replace it
                const existingIndex = mergedFilters.findIndex(
                  (f) => f.id === newFilter.id,
                );
                if (existingIndex >= 0) {
                  mergedFilters[existingIndex] = newFilter;
                } else {
                  // Add new filter if ID doesn't exist
                  mergedFilters.push(newFilter);
                }
              } else {
                // If no ID, treat as a new filter and add it
                mergedFilters.push(newFilter);
              }
            });

            newState.filters = mergedFilters;
          }
        }
      }

      // Generate patches for each changed field by diffing prevState → nextState - optimized
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          let hasChanged = false;

          if (key === "filters") {
            // For filters, compare the merged result using optimized comparison
            hasChanged = !areFiltersEqual(
              currentState.filters,
              newState.filters,
            );
            if (hasChanged) {
              addPatch("set", "filters", newState.filters);
            }
          } else if (key === "columnVisibility") {
            // Convert columnVisibility to columns array format - only when needed
            const columnsArray = Object.entries(value).map(
              ([columnId, visible], index) => ({
                columnId,
                visible,
                order: index,
              }),
            );
            // Optimized comparison for column visibility
            hasChanged = !areColumnArraysEqual(
              currentState[key as keyof typeof currentState] as any,
              columnsArray,
            );
            if (hasChanged) {
              addPatch("set", "columns", columnsArray);
            }
          } else {
            // Optimized comparison for sort and search
            hasChanged = !areValuesEqual(
              currentState[key as keyof typeof currentState],
              value,
            );
            if (hasChanged) {
              addPatch("set", key, value);
            }
          }
        }
      });

      return {
        ...prev,
        [currentView.id]: newState,
      };
    });
  };

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

  // Column visibility is now managed per-view, no need for global initialization

  // Per-view update queue system - each view has its own queue
  const viewQueuesRef = useRef<
    Map<
      string,
      {
        isProcessing: boolean;
        queuedPatches: Array<{
          op: "set" | "merge";
          path: string;
          value: any;
          timestamp: number;
        }>;
        currentVersion: number;
        inFlightPatches: Array<{
          op: "set" | "merge";
          path: string;
          value: any;
          timestamp: number;
        }> | null;
        debounceTimeout: NodeJS.Timeout | null;
        retryCount: number;
        lastRetryTime: number;
      }
    >
  >(new Map());

  // Get or create a queue for a specific view
  const getViewQueue = (viewId: string) => {
    if (!viewQueuesRef.current.has(viewId)) {
      viewQueuesRef.current.set(viewId, {
        isProcessing: false,
        queuedPatches: [],
        currentVersion: 1,
        inFlightPatches: null,
        debounceTimeout: null,
        retryCount: 0,
        lastRetryTime: 0,
      });
    }
    return viewQueuesRef.current.get(viewId)!;
  };

  // Clean up queue for a view (called when view is deleted)
  const cleanupViewQueue = (viewId: string) => {
    const queue = viewQueuesRef.current.get(viewId);
    if (queue?.debounceTimeout) {
      clearTimeout(queue.debounceTimeout);
    }
    viewQueuesRef.current.delete(viewId);
  };

  // Retry with exponential backoff
  const retryWithBackoff = async (
    viewId: string,
    retryFn: () => Promise<void>,
    maxRetries = 3,
  ) => {
    const queue = getViewQueue(viewId);
    const now = Date.now();

    // Reset retry count if enough time has passed (5 minutes)
    if (now - queue.lastRetryTime > 5 * 60 * 1000) {
      queue.retryCount = 0;
    }

    if (queue.retryCount >= maxRetries) {
      // Max retries reached, stopping queue processing
      queue.isProcessing = false;
      queue.inFlightPatches = null;
      return;
    }

    queue.retryCount++;
    queue.lastRetryTime = now;

    // Exponential backoff: 1s, 2s, 4s, 8s...
    const delay = Math.min(1000 * Math.pow(2, queue.retryCount - 1), 8000);

    // Retrying view update with exponential backoff

    setTimeout(() => {
      void (async () => {
        try {
          await retryFn();
          // Reset retry count on success
          queue.retryCount = 0;
        } catch (error) {
          console.error(`❌ Retry attempt ${queue.retryCount} failed:`, error);
          // Will be handled by the error handler
        }
      })();
    }, delay);
  };

  // Coalesce patches - last write per op:path wins
  const coalescePatches = (
    patches: Array<{
      op: "set" | "merge";
      path: string;
      value: any;
      timestamp: number;
    }>,
  ) => {
    const patchMap = new Map<
      string,
      { op: "set" | "merge"; path: string; value: any; timestamp: number }
    >();

    // Sort by timestamp to ensure last write wins
    const sortedPatches = [...patches].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    for (const patch of sortedPatches) {
      const key = `${patch.op}:${patch.path}`;
      patchMap.set(key, patch);
    }

    return Array.from(patchMap.values());
  };

  // Process the view update queue for a specific view
  const processViewUpdateQueue = async (viewId: string) => {
    // Return if view sync is suspended
    if (suspendViewSync) {
      // View sync suspended, skipping queue processing
      return;
    }

    const queue = getViewQueue(viewId);

    if (
      !currentView ||
      queue.isProcessing ||
      queue.queuedPatches.length === 0
    ) {
      return;
    }

    // Only process if this is still the current view
    if (currentView.id !== viewId) {
      // View switched, aborting queue processing for old view
      return;
    }

    // Mark as processing
    queue.isProcessing = true;

    // Get all queued patches and clear the queue
    const patches = [...queue.queuedPatches];
    queue.queuedPatches = [];

    // Coalesce patches (last write per op:path wins)
    const coalescedPatches = coalescePatches(patches);

    // Skip sending if no meaningful patches after coalescing
    if (coalescedPatches.length === 0) {
      // No meaningful patches after coalescing, skipping send
      queue.isProcessing = false;
      return;
    }

    // Store in-flight patches for retry on conflict
    queue.inFlightPatches = coalescedPatches;

    // Processing view update queue

    // Send the patches
    updateView
      .mutateAsync({
        id: viewId,
        version: queue.currentVersion,
        patches: coalescedPatches,
      })
      .catch((error) => {
        console.error("❌ Queue processing failed:", error);
        // Mark processing as complete
        queue.isProcessing = false;
        queue.inFlightPatches = null;
      });
  };

  // Update current view when filters, sort, or column visibility changes
  const updateView = api.table.updateView.useMutation({
    onSuccess: async (response, _variables) => {
      // Handle both old format (updatedView) and new format (response)
      const updatedView = response.success
        ? {
            id: response.id,
            version: response.version,
            config: response.config,
          }
        : response;

      // View updated successfully

      // Only update currentView if this is still the current view
      if (currentView?.id === updatedView.id) {
        // Update the current view with new version
        setCurrentView(updatedView);

        // Update view state with new version
        setViewStates((prev) => ({
          ...prev,
          [updatedView.id]: {
            ...prev[updatedView.id],
            version: updatedView.version,
          },
        }));
      }

      // Update the specific view's queue
      const queue = getViewQueue(updatedView.id);
      queue.currentVersion = updatedView.version;
      queue.inFlightPatches = null;
      queue.isProcessing = false;

      // Process next batch if there are queued patches for this view
      void processViewUpdateQueue(updatedView.id);

      // Don't refetch views - can reintroduce older version
    },
    onError: async (error, _variables) => {
      // View update failed

      // Handle structured error responses from server
      let errorData;
      try {
        errorData = JSON.parse(error.message);
      } catch {
        errorData = { message: error.message };
      }

      if (
        error.message.includes("CONFLICT") ||
        errorData.error === "CONFLICT"
      ) {
        // Conflict detected, refetching view and retrying same batch

        // Show user-friendly message - view was updated by another process, retrying automatically

        // Refetch the view to get the latest version
        const refetchResult = await refetchViews();
        const refetchedViews = refetchResult.data;

        // Find the updated view with new version
        const updatedView = refetchedViews?.find(
          (v: any) => v.id === _variables.id,
        );

        if (updatedView) {
          const queue = getViewQueue(_variables.id);

          if (queue.inFlightPatches) {
            // Retrying same batch with updated version

            // Only update currentView if this is still the current view
            if (currentView?.id === updatedView.id) {
              // Update the current view with the new version
              setCurrentView(updatedView);

              // Update the view state with the new version
              setViewStates((prev) => ({
                ...prev,
                [updatedView.id]: {
                  ...prev[updatedView.id],
                  version: updatedView.version,
                },
              }));
            }

            // Update the queue's current version
            queue.currentVersion = updatedView.version;

            // Retry with the same in-flight patches using exponential backoff
            await retryWithBackoff(_variables.id, async () => {
              await updateView.mutateAsync({
                id: updatedView.id,
                version: updatedView.version,
                patches: queue.inFlightPatches!,
              });
            });
          } else {
            console.error("❌ No in-flight patches found for retry");
            queue.isProcessing = false;
            void processViewUpdateQueue(_variables.id);
          }
        } else {
          console.error("❌ Could not find updated view after refetch");
          const queue = getViewQueue(_variables.id);
          queue.isProcessing = false;
          queue.inFlightPatches = null;
          void processViewUpdateQueue(_variables.id);
        }
      } else {
        console.error("❌ Non-conflict error:", error);

        // Failed to update view

        const queue = getViewQueue(_variables.id);
        queue.isProcessing = false;
        queue.inFlightPatches = null;
        void processViewUpdateQueue(_variables.id);
      }
    },
  });

  // Use refs to track the latest state values to avoid race conditions
  const latestStateRef = useRef({
    filters,
    sort,
    columnVisibility,
    searchQuery,
  });

  // Update ref whenever state changes
  useEffect(() => {
    latestStateRef.current = {
      filters,
      sort,
      columnVisibility,
      searchQuery,
    };
  }, [filters, sort, columnVisibility, searchQuery]);

  const lastUpdateTimeRef = useRef<number>(0);

  // Patch batching system
  const pendingPatchesRef = useRef<
    Array<{
      op: "set" | "merge";
      path: string;
      value: any;
      timestamp: number;
    }>
  >([]);

  // Function to add patches to the batch
  const addPatch = (op: "set" | "merge", path: string, value: any) => {
    const now = Date.now();

    // If view sync is suspended, buffer patches instead of adding to pending
    if (suspendViewSync) {
      // Reduced logging for better performance
      if (process.env.NODE_ENV === "development") {
        console.log("⏸️ View sync suspended, buffering patch:", { op, path });
      }

      // Remove any existing buffered patches for the same path (latest wins)
      bufferedPatchesRef.current = bufferedPatchesRef.current.filter(
        (patch) => patch.path !== path,
      );

      // Add to buffered patches
      bufferedPatchesRef.current.push({
        op,
        path,
        value,
        timestamp: now,
      });

      return;
    }

    // Remove any existing patches for the same path (latest wins)
    pendingPatchesRef.current = pendingPatchesRef.current.filter(
      (patch) => patch.path !== path,
    );

    // Add the new patch
    pendingPatchesRef.current.push({
      op,
      path,
      value,
      timestamp: now,
    });

    // Reduced logging for better performance - only log in development
    if (process.env.NODE_ENV === "development") {
      console.log("📝 Added patch to batch:", {
        op,
        path,
        totalPatches: pendingPatchesRef.current.length,
      });
    }

    // Trigger the debounced save
    triggerDebouncedSave();
  };

  // Function to trigger the debounced save
  const triggerDebouncedSave = () => {
    // Short-circuit if view sync is suspended
    if (suspendViewSync) {
      // View sync suspended, skipping debounced save
      return;
    }

    if (currentView && table?.id && !currentView.id.startsWith("temp-")) {
      const queue = getViewQueue(currentView.id);

      // Clear any existing timeout for this view
      if (queue.debounceTimeout) {
        clearTimeout(queue.debounceTimeout);
      }

      // Scheduling patch-based view update

      queue.debounceTimeout = setTimeout(() => {
        // Re-check conditions inside timeout in case view changed
        if (!currentView || !table?.id || currentView.id.startsWith("temp-")) {
          // View conditions changed during debounce, skipping update
          return;
        }

        const patches = [...pendingPatchesRef.current];
        pendingPatchesRef.current = []; // Clear the batch

        if (patches.length === 0) {
          // No patches to apply, skipping update
          return;
        }

        const now = Date.now();

        // Adding patches to queue

        // Add patches to this view's queue
        queue.queuedPatches.push(...patches);

        // Queue status updated

        // Process the queue if not already processing
        if (!queue.isProcessing) {
          void processViewUpdateQueue(currentView.id);
        }

        // Update the last update time
        lastUpdateTimeRef.current = now;

        // Clear the timeout ref
        queue.debounceTimeout = null;
      }, 400); // 400ms debounce to reduce churn for fast typers
    }
  };

  // Patches are now generated at the moment of state change in updateCurrentViewState
  // No need for a separate effect to detect changes

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
      // Views loaded, auto-selecting default view

      const defaultView =
        views.find((v: any) => v.name === "Grid view") ?? views[0];
      // Auto-selecting default view
      setCurrentView(defaultView);
    }
  }, [views, currentView]);

  // Initialize queue version from server view when view is selected/loaded
  useEffect(() => {
    if (currentView?.version) {
      const queue = getViewQueue(currentView.id);

      // Initializing queue version from server view

      // Initialize queue version from server view
      queue.currentVersion = currentView.version;
    }
  }, [currentView?.id, currentView?.version]);

  // Sync view states with server versions when views are updated
  useEffect(() => {
    if (views && currentView) {
      const serverView = views.find((v: any) => v.id === currentView.id);
      if (serverView && serverView.version !== currentView.version) {
        // Syncing view version from server

        // Update currentView with the server version
        setCurrentView(serverView);

        // Update viewStates with the server version
        setViewStates((prev) => ({
          ...prev,
          [currentView.id]: {
            ...prev[currentView.id],
            searchQuery: prev[currentView.id]?.searchQuery ?? "",
            columnVisibility: prev[currentView.id]?.columnVisibility ?? {},
            sort: prev[currentView.id]?.sort ?? [],
            filters: prev[currentView.id]?.filters ?? [],
            version: serverView.version,
          },
        }));

        // Update the queue's current version
        const queue = getViewQueue(currentView.id);
        queue.currentVersion = serverView.version;

        // Clear any pending patches since we're syncing with server
        pendingPatchesRef.current = [];
        // Cleared pending patches due to version sync
      }
    }
  }, [views, currentView]);

  // Reset current view when table changes
  useEffect(() => {
    setCurrentView(null);
    // Clean up all view queues when table changes
    viewQueuesRef.current.clear();
  }, [id]);

  // Handle view sync resumption and flush buffered patches
  useEffect(() => {
    if (!suspendViewSync && bufferedPatchesRef.current.length > 0) {
      // Resuming view sync, flushing buffered patches

      // Get fresh view version from server
      void refetchViews().then((result) => {
        if (result.data && currentView) {
          const serverView = result.data.find(
            (v: any) => v.id === currentView.id,
          );
          if (serverView) {
            // Update current view with fresh version
            setCurrentView(serverView);

            // Coalesce buffered patches (last-write-wins per path)
            const coalescedPatches = coalescePatches(
              bufferedPatchesRef.current,
            );

            if (coalescedPatches.length > 0) {
              // Flushing coalesced patches after resume

              // Send coalesced patches with fresh version
              updateView.mutate({
                id: currentView.id,
                version: serverView.version,
                patches: coalescedPatches,
              });
            }

            // Clear buffered patches
            bufferedPatchesRef.current = [];
          }
        }
      });
    }
  }, [suspendViewSync, currentView, refetchViews, updateView]);

  const addTestRows = api.table.addSampleData.useMutation({
    onMutate: async (variables) => {
      setIsBulkLoading(true);
      setSuspendViewSync(true); // Suspend view sync during bulk operation
      setBulkLoadingMessage(`Adding ${variables.count ?? 0} test rows...`);
    },
    onSuccess: async (data) => {
      setIsBulkLoading(false);
      setBulkLoadingMessage("Data added! Refreshing...");

      // Optimized: Invalidate only rows/rowCount, NOT views (prevents flicker and accidental re-enable)
      await Promise.all([
        utils.table.getByIdPaginated.invalidate({ id: id as string }),
        utils.table.getRowCount.invalidate({ id: id as string }),
        // Don't invalidate getViews during bulk - it can cause flicker and re-enable writes
      ]);

      // Show success message with progressive loading feedback
      setBulkLoadingMessage(`✅ Added ${data.rowsAdded} rows! Loading data...`);

      // Simulate progressive loading feedback
      setTimeout(() => {
        setBulkLoadingMessage("⚡ Optimizing performance...");
      }, 1000);

      setTimeout(() => {
        setBulkLoadingMessage("🎉 Ready! Data is now fully optimized.");
        // Resume view sync after bulk operation completes
        setSuspendViewSync(false);
      }, 3000);

      setTimeout(() => {
        setBulkLoadingMessage("");
      }, 5000);
    },
    onError: async (error) => {
      setIsBulkLoading(false);
      setBulkLoadingMessage("❌ Failed to add test rows");

      // Resume view sync on error to prevent blocking future updates
      setSuspendViewSync(false);

      // Use graceful error handling
      await handleErrorGracefully(error, "Bulk data insertion");

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
        version: 1, // Default version for optimistic view
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Optimistically update the views list
      const previousViews = utils.table.getViews.getData({
        tableId: id as string,
      });
      // Optimistic create - previous views
      utils.table.getViews.setData({ tableId: id as string }, (old: any) => [
        ...(old ?? []),
        optimisticView,
      ]);

      // Immediately select the new view
      setCurrentView(optimisticView);

      // Force a small delay to ensure the UI updates
      // Optimistic create - view added to list

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
    onError: async (error, variables, context) => {
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

      // Use graceful error handling instead of alert
      await handleErrorGracefully(error, "View creation");
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
      // Optimistic delete - previous views
      utils.table.getViews.setData({ tableId: id as string }, (old: any) => {
        const filtered =
          old?.filter((view: any) => view.id !== variables.id) ?? [];
        // After filter - remaining views
        return filtered;
      });

      // If we're deleting the current view, switch to Grid view
      if (currentView?.id === variables.id) {
        const gridView = previousViews?.find(
          (v: any) => v.name === "Grid view",
        );
        setCurrentView(gridView ?? null);
      }

      // Clean up the queue for the deleted view
      cleanupViewQueue(variables.id);

      // Force a small delay to ensure the UI updates
      // Optimistic delete - view removed from list

      return { previousViews, deletedView: viewToDelete };
    },
    onSuccess: async () => {
      // Refetch to ensure consistency
      await refetchViews();
    },
    onError: async (error, variables, context) => {
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

      // Use graceful error handling instead of alerts
      if (error.message.includes("Cannot delete the default Grid view")) {
        // Cannot delete the default Grid view - required for table functionality
      } else {
        await handleErrorGracefully(error, "View deletion");
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
            {`${isCreating ? "Creating base" : (table?.name ?? "Loading table")} - Airtable Clone`}
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

    // Initialize view state if it doesn't exist
    if (!viewStates[view.id]) {
      const initialState = {
        searchQuery: "",
        columnVisibility: {} as Record<string, boolean>,
        sort: [] as SortConfig[],
        filters: [] as FilterGroup[],
        version: view.version ?? 1,
      };

      // Initializing view state

      if (view.name === "Grid view") {
        // Default settings for Grid view
        // Initializing Grid view with default settings
        // Set all columns to visible for Grid view
        columns.forEach((column: any) => {
          initialState.columnVisibility[column.id] = true;
        });
      } else {
        // Apply saved view settings
        // Initializing custom view with saved settings
        if (view.filters) {
          initialState.filters = view.filters as unknown as FilterGroup[];
        }
        if (view.sort) {
          initialState.sort = view.sort as unknown as SortConfig[];
        }
        if (view.columns) {
          (view.columns as unknown as any[]).forEach((col: any) => {
            initialState.columnVisibility[col.columnId] = col.visible;
          });
        }
        if (view.search) {
          initialState.searchQuery = view.search;
        }
      }

      // Set the initial state for this view
      setViewStates((prev) => ({
        ...prev,
        [view.id]: initialState,
      }));
    } else {
      // Switching to existing view with preserved state
    }
  };

  const handleCreateView = (name: string) => {
    if (name.trim() && table?.id) {
      // Creating view
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
      // Deleting view
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
            onSearchChange={(query) =>
              updateCurrentViewState({ searchQuery: query })
            }
            columns={columns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={(columnId, visible) => {
              updateCurrentViewState({
                columnVisibility: {
                  ...columnVisibility,
                  [columnId]: visible,
                },
              });
            }}
            onBatchColumnVisibilityChange={(updates) => {
              updateCurrentViewState({
                columnVisibility: {
                  ...columnVisibility,
                  ...updates,
                },
              });
            }}
            sort={sort}
            onSortChange={(newSort) =>
              updateCurrentViewState({ sort: newSort })
            }
            filters={filters}
            onFiltersChange={(newFilters) =>
              updateCurrentViewState({ filters: newFilters })
            }
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
              onSearchChange={(query) =>
                updateCurrentViewState({ searchQuery: query })
              }
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={(columnId, visible) => {
                updateCurrentViewState({
                  columnVisibility: {
                    ...columnVisibility,
                    [columnId]: visible,
                  },
                });
              }}
              onBatchColumnVisibilityChange={(
                updates: Record<string, boolean>,
              ) => {
                updateCurrentViewState({
                  columnVisibility: {
                    ...columnVisibility,
                    ...updates,
                  },
                });
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
