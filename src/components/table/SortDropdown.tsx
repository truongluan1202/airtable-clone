import { useState, useEffect } from "react";
import Image from "next/image";
import type { SortConfig } from "~/types/table";

interface SortDropdownProps {
  columns: Array<{ id: string; name: string; type: string }>;
  sort: SortConfig[];
  onSortChange: (sort: SortConfig[]) => void;
  onClose: () => void;
}

interface SortRule {
  columnId: string;
  direction: "asc" | "desc";
}

export function SortDropdown({
  columns,
  sort,
  onSortChange,
  onClose,
}: SortDropdownProps) {
  const [sortRules, setSortRules] = useState<SortRule[]>(
    sort.length > 0 ? sort : [],
  );
  const [autoSort, setAutoSort] = useState(sort.length > 0);

  // Sync autoSort state with the actual sort state
  useEffect(() => {
    console.log("🔄 SortDropdown useEffect - sort changed:", {
      sortLength: sort.length,
      sort,
    });
    setAutoSort(sort.length > 0);
    // Only update sort rules if they're empty (initial load) or if sort is being applied from outside
    if (sort.length > 0) {
      setSortRules(sort);
    }
  }, [sort]);

  const handleAddSort = () => {
    // Find the first available column that's not already sorted
    const availableColumns = columns.filter(
      (col) => !sortRules.some((rule) => rule.columnId === col.id),
    );

    if (availableColumns.length > 0) {
      const newSortRules = [
        ...sortRules,
        {
          columnId: availableColumns[0]!.id,
          direction: "asc" as const,
        },
      ];
      setSortRules(newSortRules);

      // If auto sort is enabled, immediately apply the new rules
      if (autoSort) {
        console.log("✅ Auto sort enabled, applying new rules:", newSortRules);
        onSortChange(newSortRules);
      }
    }
  };

  const handleRemoveSort = (index: number) => {
    const newSortRules = sortRules.filter((_, i) => i !== index);
    setSortRules(newSortRules);

    // If auto sort is enabled, immediately apply the updated rules
    if (autoSort) {
      console.log(
        "✅ Auto sort enabled, applying updated rules after removal:",
        newSortRules,
      );
      onSortChange(newSortRules);
    }
  };

  const handleColumnChange = (index: number, columnId: string) => {
    const newSortRules = sortRules.map((rule, i) =>
      i === index ? { ...rule, columnId } : rule,
    );
    setSortRules(newSortRules);

    // If auto sort is enabled, immediately apply the updated rules
    if (autoSort) {
      console.log(
        "✅ Auto sort enabled, applying updated rules after column change:",
        newSortRules,
      );
      onSortChange(newSortRules);
    }
  };

  const handleDirectionChange = (index: number, direction: "asc" | "desc") => {
    const newSortRules = sortRules.map((rule, i) =>
      i === index ? { ...rule, direction } : rule,
    );
    setSortRules(newSortRules);

    // If auto sort is enabled, immediately apply the updated rules
    if (autoSort) {
      console.log(
        "✅ Auto sort enabled, applying updated rules after direction change:",
        newSortRules,
      );
      onSortChange(newSortRules);
    }
  };

  const handleApply = () => {
    console.log("🔄 Apply button clicked:", {
      autoSort,
      sortRulesLength: sortRules.length,
      sortRules,
    });

    if (sortRules.length > 0) {
      console.log("✅ Applying sort rules:", sortRules);
      onSortChange(sortRules);
    } else {
      console.log("❌ Clearing sort");
      onSortChange([]);
    }
    onClose();
  };

  const handleAutoSortToggle = () => {
    const newAutoSort = !autoSort;
    console.log("🔄 Auto sort toggle:", {
      current: autoSort,
      new: newAutoSort,
      sortRules: sortRules.length,
      currentSort: sort.length,
    });

    setAutoSort(newAutoSort);

    // If turning off auto sort, just stop applying sort (don't clear the rules)
    if (!newAutoSort) {
      console.log("❌ Disabling auto sort, returning to original order");
      onSortChange([]);
    } else if (sortRules.length > 0) {
      // If turning on auto sort and we have rules, apply them
      console.log("✅ Enabling auto sort, applying rules:", sortRules);
      onSortChange(sortRules);
    }
  };

  const getColumnType = (columnId: string) => {
    return columns.find((col) => col.id === columnId)?.type ?? "TEXT";
  };

  return (
    <div className="absolute top-full right-0 z-50 mt-2 w-110 rounded-md border border-gray-200 bg-white shadow-lg">
      <div className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
            <button className="rounded-full bg-gray-100 p-1">
              <Image
                src="/icons/info.svg"
                alt="Help"
                width={12}
                height={12}
                className="text-gray-400"
              />
            </button>
          </div>
        </div>

        {/* Sort Rules */}
        <div className="space-y-3">
          {sortRules.map((rule, index) => {
            const columnType = getColumnType(rule.columnId);
            const availableColumns = columns.filter(
              (col) =>
                !sortRules.some((r, i) => i !== index && r.columnId === col.id),
            );

            return (
              <div key={index} className="flex items-center space-x-2">
                {/* Column Dropdown */}
                <select
                  value={rule.columnId}
                  onChange={(e) => handleColumnChange(index, e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {availableColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </select>

                {/* Direction Dropdown */}
                <select
                  value={rule.direction}
                  onChange={(e) =>
                    handleDirectionChange(
                      index,
                      e.target.value as "asc" | "desc",
                    )
                  }
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="asc">
                    {columnType === "NUMBER" ? "Increasing" : "A → Z"}
                  </option>
                  <option value="desc">
                    {columnType === "NUMBER" ? "Decreasing" : "Z → A"}
                  </option>
                </select>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveSort(index)}
                  className="rounded-md px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                {/* Drag Handle */}
                <div className="cursor-move p-0 text-gray-400">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Another Sort Button */}
        {sortRules.length < columns.length && (
          <button
            onClick={handleAddSort}
            className="mt-3 flex w-full items-center space-x-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
          >
            <Image src="/icons/plus.svg" alt="Add" width={16} height={16} />
            <span>Add another sort</span>
          </button>
        )}

        {/* Auto Sort Toggle */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-700">
            Automatically sort records
          </span>
          <button
            onClick={handleAutoSortToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoSort ? "bg-green-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoSort ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
