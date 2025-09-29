import { flexRender } from "@tanstack/react-table";
import type { HeaderGroup } from "@tanstack/react-table";
import type { DataRow } from "./types";

interface TableHeaderProps {
  headerGroups: HeaderGroup<DataRow>[];
  isColumnSorted: (columnId: string) => boolean;
  isColumnFiltered: (columnId: string) => boolean;
}

export function TableHeader({
  headerGroups,
  isColumnSorted,
  isColumnFiltered,
}: TableHeaderProps) {
  return (
    <thead className="border-b border-gray-200 bg-gray-50">
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header, index) => {
            const columnIsSorted = isColumnSorted(header.column.id);
            const columnIsFiltered = isColumnFiltered(header.column.id);
            const isFirstColumn = index === 0;

            return (
              <th
                key={header.id}
                className={`${!isFirstColumn ? "border-r" : ""} border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-900 ${
                  columnIsSorted ? "bg-[#fff2e9]" : ""
                } ${columnIsFiltered ? "!bg-[#ecfcec]" : ""} $`}
                style={{
                  width: header.getSize(),
                  minWidth: header.getSize(),
                  maxWidth: header.getSize(),
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
