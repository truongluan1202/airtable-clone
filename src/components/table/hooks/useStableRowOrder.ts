import { useMemo, useRef } from "react";
import type { DataRow } from "../types";

/**
 * Custom hook to maintain stable row ordering even when data is refetched
 * This prevents rows from changing order when cells are clicked and data is invalidated
 */
export function useStableRowOrder(data: DataRow[]) {
  const rowOrderRef = useRef<string[]>([]);
  const previousDataRef = useRef<DataRow[]>([]);

  const stableData = useMemo(() => {
    // If this is the first time or data hasn't changed, use the data as-is
    if (
      previousDataRef.current.length === 0 ||
      data === previousDataRef.current
    ) {
      previousDataRef.current = data;
      rowOrderRef.current = data.map((row) => row.id);
      console.log("🔄 Initial row order set:", rowOrderRef.current);
      return data;
    }

    // Check if we have new data (different length or different IDs)
    const currentIds = data.map((row) => row.id);
    const previousIds = previousDataRef.current.map((row) => row.id);

    const hasNewData =
      currentIds.length !== previousIds.length ||
      !currentIds.every((id) => previousIds.includes(id));

    if (hasNewData) {
      // New data detected, update our reference
      console.log("🔄 New data detected, updating row order:", currentIds);
      previousDataRef.current = data;
      rowOrderRef.current = currentIds;
      return data;
    }

    // Data is the same, but order might have changed
    // Preserve the previous order
    console.log(
      "🔄 Preserving row order. Previous:",
      rowOrderRef.current,
      "Current:",
      currentIds,
    );
    const orderedData: DataRow[] = [];
    const dataMap = new Map(data.map((row) => [row.id, row]));

    // First, add rows in the previous order
    for (const id of rowOrderRef.current) {
      const row = dataMap.get(id);
      if (row) {
        orderedData.push(row);
        dataMap.delete(id);
      }
    }

    // Then, add any new rows that weren't in the previous order
    for (const row of dataMap.values()) {
      orderedData.push(row);
      rowOrderRef.current.push(row.id);
    }

    return orderedData;
  }, [data]);

  return stableData;
}
