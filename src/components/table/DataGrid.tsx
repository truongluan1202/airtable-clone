import { useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";

interface DataRow {
  id: string;
  [key: string]: any; // Allow dynamic properties based on table columns
}

interface Column {
  id: string;
  name: string;
  type: string;
}

interface DataGridProps {
  data: DataRow[];
  columns?: Column[];
}

interface EditableCellProps {
  value: string;
  onUpdate: (value: string) => void;
  isEditing: boolean;
  isSelected: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onSelect: () => void;
  placeholder?: string;
  hasDropdown?: boolean;
}

function EditableCell({
  value,
  onUpdate,
  isEditing,
  isSelected,
  onStartEdit,
  onStopEdit,
  onSelect,
  placeholder,
  hasDropdown = false,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  const [isDoubleClick, setIsDoubleClick] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onUpdate(editValue);
        onStopEdit();
      } else if (e.key === "Escape") {
        setEditValue(value);
        onStopEdit();
      }
    },
    [editValue, onUpdate, onStopEdit, value],
  );

  const handleBlur = useCallback(() => {
    onUpdate(editValue);
    onStopEdit();
  }, [editValue, onUpdate, onStopEdit]);

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`w-full border border-blue-500 p-1 text-sm focus:outline-none ${
            hasDropdown ? "pr-6" : ""
          }`}
          placeholder={placeholder}
          autoFocus
        />
        {hasDropdown && (
          <Image
            src="/icons/chevron-down.svg"
            alt="Dropdown"
            width={12}
            height={12}
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-gray-400"
          />
        )}
      </div>
    );
  }

  const handleClick = (_e: React.MouseEvent) => {
    // Prevent single click if this is part of a double-click
    if (isDoubleClick) {
      setIsDoubleClick(false);
      return;
    }

    // Small delay to check if double-click follows
    setTimeout(() => {
      if (!isDoubleClick && !isEditing) {
        onSelect();
      }
    }, 100);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDoubleClick(true);
    if (!isEditing) {
      onStartEdit();
    }
  };

  return (
    <div
      className={`cursor-pointer rounded p-1 text-sm text-gray-900 hover:bg-gray-50 ${
        isSelected ? "bg-blue-50" : ""
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ userSelect: "none" }}
    >
      {value || "-"}
    </div>
  );
}

export function DataGrid({ data, columns = [] }: DataGridProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const columnHelper = createColumnHelper<DataRow>();

  const handleCellUpdate = useCallback(
    (rowId: string, columnId: string, value: string) => {
      const cellKey = `${rowId}-${columnId}`;
      setCellValues((prev) => ({
        ...prev,
        [cellKey]: value,
      }));
    },
    [],
  );

  const getCellValue = useCallback(
    (rowId: string, columnId: string, defaultValue = "") => {
      const cellKey = `${rowId}-${columnId}`;
      return cellValues[cellKey] ?? defaultValue;
    },
    [cellValues],
  );

  const handleCellSelect = useCallback((rowId: string, columnId: string) => {
    setSelectedCell({ rowId, columnId });
  }, []);

  const handleCellEdit = useCallback((rowId: string, columnId: string) => {
    setEditingCell({ rowId, columnId });
  }, []);

  const handleCellStopEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const isSelected = useCallback(
    (rowId: string, columnId: string) => {
      return (
        selectedCell?.rowId === rowId && selectedCell?.columnId === columnId
      );
    },
    [selectedCell],
  );

  const isEditing = useCallback(
    (rowId: string, columnId: string) => {
      return editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    },
    [editingCell],
  );

  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRows((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(rowId)) {
        newSelection.delete(rowId);
      } else {
        newSelection.add(rowId);
      }
      return newSelection;
    });
  }, []);

  const tableColumns = useMemo(() => {
    const cols: any[] = [
      columnHelper.accessor("id", {
        id: "select",
        header: () => (
          <Image
            src="/icons/checkbox.svg"
            alt="Select all"
            width={16}
            height={16}
            className="text-gray-400"
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span className="mr-2 text-sm text-gray-500">{row.index + 1}</span>
            <button
              onClick={() => toggleRowSelection(row.original.id)}
              className="p-1"
            >
              <Image
                src="/icons/checkbox.svg"
                alt="Select row"
                width={16}
                height={16}
                className={`${
                  selectedRows.has(row.original.id)
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              />
            </button>
          </div>
        ),
        size: 48,
      }),
    ];

    // Add dynamic columns based on table structure
    columns.forEach((column) => {
      cols.push(
        columnHelper.accessor(column.name, {
          id: column.id,
          header: () => (
            <div className="flex items-center space-x-2">
              <span>{column.name}</span>
              {column.type === "TEXT" && (
                <Image
                  src="/icons/document.svg"
                  alt="Text"
                  width={12}
                  height={12}
                  className="text-gray-400"
                />
              )}
              {column.type === "NUMBER" && (
                <Image
                  src="/icons/checkbox.svg"
                  alt="Number"
                  width={12}
                  height={12}
                  className="text-gray-400"
                />
              )}
            </div>
          ),
          cell: ({ row }) => (
            <EditableCell
              value={getCellValue(
                row.original.id,
                column.name,
                row.original[column.name] ?? "",
              )}
              onUpdate={(value) =>
                handleCellUpdate(row.original.id, column.name, value)
              }
              isEditing={isEditing(row.original.id, column.id)}
              isSelected={isSelected(row.original.id, column.id)}
              onStartEdit={() => handleCellEdit(row.original.id, column.id)}
              onStopEdit={handleCellStopEdit}
              onSelect={() => handleCellSelect(row.original.id, column.id)}
              placeholder={
                column.type === "TEXT" ? "Enter text..." : "Enter number..."
              }
              hasDropdown={column.name.toLowerCase().includes("status")}
            />
          ),
          size: 150,
        }),
      );
    });

    // Add the "Add Column" button
    cols.push(
      columnHelper.display({
        id: "addColumn",
        header: () => (
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <Image
              src="/icons/plus.svg"
              alt="Add column"
              width={16}
              height={16}
            />
          </button>
        ),
        cell: () => null,
        size: 48,
      }),
    );

    return cols;
  }, [
    columnHelper,
    columns,
    selectedRows,
    toggleRowSelection,
    getCellValue,
    handleCellUpdate,
    isEditing,
    isSelected,
    handleCellEdit,
    handleCellSelect,
    handleCellStopEdit,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell) return;

      // Find current cell position
      const currentRowIndex = data.findIndex(
        (row) => row.id === selectedCell.rowId,
      );
      const currentColumnIndex = columns.findIndex(
        (col) => col.id === selectedCell.columnId,
      );

      if (currentRowIndex === -1 || currentColumnIndex === -1) return;

      const maxRows = data.length;
      const maxColumns = columns.length;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (currentRowIndex > 0) {
            const prevRow = data[currentRowIndex - 1];
            if (prevRow) {
              handleCellSelect(prevRow.id, selectedCell.columnId);
            }
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (currentRowIndex < maxRows - 1) {
            const nextRow = data[currentRowIndex + 1];
            if (nextRow) {
              handleCellSelect(nextRow.id, selectedCell.columnId);
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentColumnIndex > 0) {
            const prevColumn = columns[currentColumnIndex - 1];
            if (prevColumn) {
              handleCellSelect(selectedCell.rowId, prevColumn.id);
            }
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentColumnIndex < maxColumns - 1) {
            const nextColumn = columns[currentColumnIndex + 1];
            if (nextColumn) {
              handleCellSelect(selectedCell.rowId, nextColumn.id);
            }
          }
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + Tab: move left
            if (currentColumnIndex > 0) {
              const prevColumn = columns[currentColumnIndex - 1];
              if (prevColumn) {
                handleCellSelect(selectedCell.rowId, prevColumn.id);
              }
            } else if (currentRowIndex > 0) {
              // Move to last column of previous row
              const prevRow = data[currentRowIndex - 1];
              const lastColumn = columns[maxColumns - 1];
              if (prevRow && lastColumn) {
                handleCellSelect(prevRow.id, lastColumn.id);
              }
            }
          } else {
            // Tab: move right
            if (currentColumnIndex < maxColumns - 1) {
              const nextColumn = columns[currentColumnIndex + 1];
              if (nextColumn) {
                handleCellSelect(selectedCell.rowId, nextColumn.id);
              }
            } else if (currentRowIndex < maxRows - 1) {
              // Move to first column of next row
              const nextRow = data[currentRowIndex + 1];
              const firstColumn = columns[0];
              if (nextRow && firstColumn) {
                handleCellSelect(nextRow.id, firstColumn.id);
              }
            }
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!editingCell) {
            handleCellEdit(selectedCell.rowId, selectedCell.columnId);
          }
          break;
      }
    },
    [
      selectedCell,
      data,
      columns,
      handleCellSelect,
      handleCellEdit,
      editingCell,
    ],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    state: {
      rowSelection: Object.fromEntries(
        Array.from(selectedRows).map((id) => [id, true]),
      ),
    },
  });

  return (
    <div className="h-full overflow-auto">
      <table
        ref={tableRef}
        className="w-full"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <thead className="border-b border-gray-200 bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-sm font-medium text-gray-900"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, _rowIndex) => (
            <tr
              key={row.id}
              className="border-b border-gray-200 hover:bg-gray-50"
            >
              {row.getVisibleCells().map((cell, _columnIndex) => {
                const isSelected =
                  selectedCell?.rowId === row.original.id &&
                  selectedCell?.columnId === cell.column.id;

                return (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 ${
                      isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Add row button */}
          <tr>
            <td colSpan={columns.length} className="px-3 py-2">
              <button className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700">
                <Image
                  src="/icons/plus.svg"
                  alt="Add row"
                  width={16}
                  height={16}
                />
                <span>Add a record</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
