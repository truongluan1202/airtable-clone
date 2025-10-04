import React from "react";

interface TableSkeletonProps {
  baseName?: string;
  tableName?: string;
}

export function TableSkeleton({
  baseName = "Untitled Base",
  tableName = "Creating table...",
}: TableSkeletonProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header Skeleton */}
      <div className="flex max-h-11 items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center space-x-4">
          {/* Toggle button skeleton */}
          <div className="h-6 w-6 animate-pulse rounded bg-gray-200"></div>

          {/* View name skeleton */}
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200"></div>
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200"></div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Action buttons skeleton */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-16 animate-pulse rounded bg-gray-200"
            ></div>
          ))}
        </div>
      </div>

      {/* Content Area with Sidebar */}
      <div className="flex flex-1">
        {/* Vertical Sidebar Skeleton */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50">
          <div className="p-4">
            {/* Create new view skeleton */}
            <div className="mb-2 flex items-center space-x-3 rounded-md p-2">
              <div className="h-3 w-3 animate-pulse rounded bg-gray-200"></div>
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200"></div>
            </div>

            {/* Find a view skeleton */}
            <div className="mb-2 flex items-center space-x-3 rounded-md p-2">
              <div className="h-3 w-3 animate-pulse rounded bg-gray-200"></div>
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200"></div>
            </div>

            {/* Views list skeleton */}
            <div className="space-y-1">
              <div className="flex items-center space-x-3 rounded-md bg-gray-100 p-2">
                <div className="h-4 w-4 animate-pulse rounded bg-gray-200"></div>
                <div className="h-3 w-16 animate-pulse rounded bg-gray-200"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content Skeleton */}
        <div className="flex-1 overflow-hidden">
          {/* Table Header Skeleton */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {/* Selection column */}
            <div className="flex w-15 items-center justify-center border-r border-gray-200">
              <div className="h-4 w-4 animate-pulse rounded bg-gray-200"></div>
            </div>

            {/* Data columns skeleton */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex w-48 items-center border-r border-gray-200 px-3 py-2"
              >
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
              </div>
            ))}

            {/* Add column skeleton */}
            <div className="flex w-30 items-center justify-center">
              <div className="h-6 w-16 animate-pulse rounded bg-gray-200"></div>
            </div>
          </div>

          {/* Table Rows Skeleton */}
          <div className="bg-white">
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="flex border-b border-gray-200 hover:bg-gray-50"
                style={{ height: "40px" }}
              >
                {/* Selection column with row number */}
                <div className="flex w-15 items-center justify-center border-r border-gray-200">
                  <span className="text-xs text-gray-400">{rowIndex + 1}</span>
                </div>

                {/* Data columns skeleton */}
                {Array.from({ length: 3 }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="flex w-48 items-center border-r border-gray-200 px-3 py-2"
                  >
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                  </div>
                ))}

                {/* Add column skeleton */}
                <div className="flex w-30 items-center justify-center">
                  <div className="h-6 w-16 animate-pulse rounded bg-gray-200"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
