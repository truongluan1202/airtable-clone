import { useMemo } from "react";
import type { DataRow } from "../types";

/**
 * Custom hook to maintain stable row ordering even when data is refetched
 * This prevents rows from changing order when cells are clicked and data is invalidated
 *
 * For now, this is simplified to just return the data as-is to prevent infinite re-renders
 * TODO: Implement proper stable row ordering when the infinite render issue is resolved
 */
export function useStableRowOrder(data: DataRow[]) {
  // Simply return the data as-is for now to prevent infinite re-renders
  // This ensures the data reference is stable
  return useMemo(() => data, [data]);
}
