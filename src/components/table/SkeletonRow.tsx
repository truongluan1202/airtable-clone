import React from "react";

interface SkeletonRowProps {
  columns: Array<{ id: string; name: string; type: string }>;
  isFirstColumn?: boolean;
  rowNumber?: number;
}

export function SkeletonRow({
  columns,
  isFirstColumn = false,
  rowNumber = 0,
}: SkeletonRowProps) {
  return (
    <div
      className="flex hover:bg-gray-50"
      style={{
        height: "40px",
        backgroundColor: "#fafbfc", // Slightly different background to indicate skeleton
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {/* Selection column with actual row number */}
      <div
        className={`flex items-center justify-center ${
          !isFirstColumn ? "border-r" : ""
        } border-gray-200`}
        style={{ width: "60px", minWidth: "60px", maxWidth: "60px" }}
      >
        <span className="text-xs text-gray-500">{rowNumber}</span>
      </div>

      {/* Data columns skeleton */}
      {columns.map((column, index) => (
        <div
          key={column.id}
          className={`flex items-center px-3 py-2 ${
            index !== columns.length - 1 ? "border-r" : ""
          } border-gray-200`}
          style={{ width: "200px", minWidth: "200px", maxWidth: "200px" }}
        >
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 opacity-60"></div>
        </div>
      ))}

      {/* Add column skeleton */}
      <div
        className="flex items-center justify-center border-gray-200"
        style={{ width: "120px", minWidth: "120px", maxWidth: "120px" }}
      >
        <div className="h-6 w-16 animate-pulse rounded bg-gray-200 opacity-60"></div>
      </div>
    </div>
  );
}
