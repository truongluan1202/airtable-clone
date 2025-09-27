import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import { api } from "~/utils/api";
import { AddColumnDropdown } from "./AddColumnDropdown";
import { ColumnDropdown } from "./ColumnDropdown";

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
  tableId?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
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
  isHighlighted?: boolean;
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
  isHighlighted = false,
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
      } ${isHighlighted ? "bg-yellow-200" : ""}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ userSelect: "none" }}
    >
      {value || "-"}
    </div>
  );
}

export function DataGrid({
  data,
  columns = [],
  tableId,
  searchQuery = "",
  onSearchChange: _onSearchChange,
  columnVisibility = {},
  onColumnVisibilityChange,
}: DataGridProps) {
  console.log("🔥 DataGrid rendered with tableId:", tableId);
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
  const [showAddColumnDropdown, setShowAddColumnDropdown] = useState(false);
  const [openColumnDropdown, setOpenColumnDropdown] = useState<string | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    rowId: string;
  } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // tRPC mutations
  const utils = api.useUtils();
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: (data) => {
      console.log("✅ Cell updated successfully:", data);
      // Invalidate the table query to refetch data
      void utils.table.getById.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to update cell:", error);
      // You could show a toast notification here
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onSuccess: (data) => {
      console.log("✅ Column added successfully:", data);
      // Invalidate the table query to refetch data
      void utils.table.getById.invalidate();
      setShowAddColumnDropdown(false);
    },
    onError: (error) => {
      console.error("❌ Failed to add column:", error);
      // You could show a toast notification here
    },
  });

  const addRowMutation = api.table.addRow.useMutation({
    onSuccess: (data) => {
      console.log("✅ Row added successfully:", data);
      // Invalidate the table query to refetch data
      void utils.table.getById.invalidate();
    },
    onError: (error) => {
      console.error("❌ Failed to add row:", error);
      // You could show a toast notification here
    },
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onSuccess: (data) => {
      console.log("✅ Row deleted successfully:", data);
      // Invalidate the table query to refetch data
      void utils.table.getById.invalidate();
      // Also try to refetch all table queries
      void utils.table.getById.refetch();
      setContextMenu(null);
    },
    onError: (error) => {
      console.error("❌ Failed to delete row:", error);
      console.error("❌ Error details:", error.message, error.data);
      // You could show a toast notification here
    },
    onMutate: (variables) => {
      console.log("🔥 Delete row mutation started with:", variables);
    },
  });

  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onSuccess: (data) => {
      console.log("✅ Column deleted successfully:", data);
      void utils.table.getById.invalidate();
      void utils.table.getById.refetch();
      setOpenColumnDropdown(null);
    },
    onError: (error) => {
      console.error("❌ Failed to delete column:", error);
    },
  });

  const columnHelper = createColumnHelper<DataRow>();

  // Handle clicks outside context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu) {
        // Check if the click is on the context menu itself
        const target = event.target as Element;
        if (!target.closest(".context-menu")) {
          console.log("🔥 Clicking outside context menu, closing it");
          setContextMenu(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu]);

  // Search and filter logic
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }

    const query = searchQuery.toLowerCase().trim();
    return data.filter((row) => {
      // Check if any cell in the row matches the search query
      return columns.some((column) => {
        const cellValue = row[column.name];
        if (cellValue === null || cellValue === undefined) {
          return false;
        }
        return String(cellValue).toLowerCase().includes(query);
      });
    });
  }, [data, columns, searchQuery]);

  // Check if a cell matches the search query
  const isCellHighlighted = useCallback(
    (rowId: string, columnId: string, cellValue: string) => {
      if (!searchQuery.trim()) {
        return false;
      }
      const query = searchQuery.toLowerCase().trim();
      return String(cellValue).toLowerCase().includes(query);
    },
    [searchQuery],
  );

  const handleAddColumn = useCallback(
    (name: string, type: "TEXT" | "NUMBER") => {
      if (!tableId) {
        console.error("Table ID is required to add a column");
        return;
      }
      addColumnMutation.mutate({
        tableId,
        name,
        type,
      });
    },
    [addColumnMutation, tableId],
  );

  const handleAddRow = useCallback(() => {
    if (!tableId) {
      console.error("Table ID is required to add a row");
      return;
    }
    addRowMutation.mutate({
      tableId,
    });
  }, [addRowMutation, tableId]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      console.log("🔥 Context menu triggered for row:", rowId);
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        rowId,
      });
    },
    [],
  );

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      console.log("🔥 Delete row called for:", rowId);
      deleteRowMutation.mutate({
        rowId,
      });
    },
    [deleteRowMutation],
  );

  const handleColumnVisibilityChange = useCallback(
    (columnId: string, visible: boolean) => {
      onColumnVisibilityChange?.(columnId, visible);
    },
    [onColumnVisibilityChange],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      console.log("🔥 Delete column called for:", columnId);
      deleteColumnMutation.mutate({
        columnId,
      });
    },
    [deleteColumnMutation],
  );

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    return columns.filter((column) => {
      // If columnVisibility is empty or column not in visibility state, show by default
      if (
        Object.keys(columnVisibility).length === 0 ||
        !(column.id in columnVisibility)
      ) {
        return true;
      }
      // Otherwise, use the visibility setting
      return columnVisibility[column.id] === true;
    });
  }, [columns, columnVisibility]);

  const handleCellUpdate = useCallback(
    (rowId: string, columnId: string, value: string) => {
      console.log("🔥 handleCellUpdate called with:", {
        rowId,
        columnId,
        value,
      });

      const cellKey = `${rowId}-${columnId}`;

      // Update local state optimistically
      setCellValues((prev) => ({
        ...prev,
        [cellKey]: value,
      }));

      // Find the column to determine its type
      const column = columns.find((col) => col.id === columnId);
      const columnType = column?.type;
      console.log("🔥 Found column:", { column, columnType });

      // Convert value based on column type
      let processedValue: string | number = value.trim();
      if (columnType === "NUMBER" && processedValue !== "") {
        const numValue = Number(processedValue);
        if (!isNaN(numValue)) {
          processedValue = numValue;
        }
      }

      console.log("🔥 Calling updateCellMutation with:", {
        rowId,
        columnId,
        value: processedValue,
      });

      // Update the database
      updateCellMutation.mutate({
        rowId,
        columnId,
        value: processedValue,
      });
    },
    [updateCellMutation, columns],
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

    // Add dynamic columns based on visible columns
    visibleColumns.forEach((column) => {
      cols.push(
        columnHelper.accessor(column.name, {
          id: column.id,
          header: () => (
            <div className="relative flex items-center justify-between">
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenColumnDropdown(
                    openColumnDropdown === column.id ? null : column.id,
                  );
                }}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100"
              >
                {/* <svg
                  className="h-4 w-4 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg> */}
                <Image
                  src="/icons/chevron-down.svg"
                  alt="otpion dropdown"
                  width={12}
                  height={12}
                  className="text-gray-400"
                />
              </button>
              {openColumnDropdown === column.id && (
                <ColumnDropdown
                  columnId={column.id}
                  columnName={column.name}
                  onDeleteColumn={handleDeleteColumn}
                  onClose={() => setOpenColumnDropdown(null)}
                />
              )}
            </div>
          ),
          cell: ({ row }) => {
            const cellValue = getCellValue(
              row.original.id,
              column.id,
              row.original[column.name] ?? "",
            );
            return (
              <EditableCell
                value={cellValue}
                onUpdate={(value) =>
                  handleCellUpdate(row.original.id, column.id, value)
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
                isHighlighted={isCellHighlighted(
                  row.original.id,
                  column.id,
                  cellValue,
                )}
              />
            );
          },
          size: 150,
        }),
      );
    });

    // Add the "Add Column" button
    cols.push(
      columnHelper.display({
        id: "addColumn",
        header: () => (
          <div className="relative">
            <button
              onClick={() => setShowAddColumnDropdown(!showAddColumnDropdown)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <Image
                src="/icons/plus.svg"
                alt="Add column"
                width={16}
                height={16}
              />
            </button>
            {showAddColumnDropdown && (
              <AddColumnDropdown
                onAddColumn={handleAddColumn}
                onClose={() => setShowAddColumnDropdown(false)}
              />
            )}
          </div>
        ),
        cell: () => null,
        size: 48,
      }),
    );

    return cols;
  }, [
    columnHelper,
    visibleColumns,
    selectedRows,
    toggleRowSelection,
    getCellValue,
    handleCellUpdate,
    isEditing,
    isSelected,
    handleCellEdit,
    handleCellSelect,
    handleCellStopEdit,
    showAddColumnDropdown,
    handleAddColumn,
    isCellHighlighted,
    handleDeleteColumn,
    openColumnDropdown,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell) return;

      // Find current cell position
      const currentRowIndex = filteredData.findIndex(
        (row) => row.id === selectedCell.rowId,
      );
      const currentColumnIndex = visibleColumns.findIndex(
        (col) => col.id === selectedCell.columnId,
      );

      if (currentRowIndex === -1 || currentColumnIndex === -1) return;

      const maxRows = filteredData.length;
      const maxColumns = visibleColumns.length;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (currentRowIndex > 0) {
            const prevRow = filteredData[currentRowIndex - 1];
            if (prevRow) {
              handleCellSelect(prevRow.id, selectedCell.columnId);
            }
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (currentRowIndex < maxRows - 1) {
            const nextRow = filteredData[currentRowIndex + 1];
            if (nextRow) {
              handleCellSelect(nextRow.id, selectedCell.columnId);
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentColumnIndex > 0) {
            const prevColumn = visibleColumns[currentColumnIndex - 1];
            if (prevColumn) {
              handleCellSelect(selectedCell.rowId, prevColumn.id);
            }
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentColumnIndex < maxColumns - 1) {
            const nextColumn = visibleColumns[currentColumnIndex + 1];
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
              const prevColumn = visibleColumns[currentColumnIndex - 1];
              if (prevColumn) {
                handleCellSelect(selectedCell.rowId, prevColumn.id);
              }
            } else if (currentRowIndex > 0) {
              // Move to last column of previous row
              const prevRow = filteredData[currentRowIndex - 1];
              const lastColumn = visibleColumns[maxColumns - 1];
              if (prevRow && lastColumn) {
                handleCellSelect(prevRow.id, lastColumn.id);
              }
            }
          } else {
            // Tab: move right
            if (currentColumnIndex < maxColumns - 1) {
              const nextColumn = visibleColumns[currentColumnIndex + 1];
              if (nextColumn) {
                handleCellSelect(selectedCell.rowId, nextColumn.id);
              }
            } else if (currentRowIndex < maxRows - 1) {
              // Move to first column of next row
              const nextRow = filteredData[currentRowIndex + 1];
              const firstColumn = visibleColumns[0];
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
      filteredData,
      visibleColumns,
      handleCellSelect,
      handleCellEdit,
      editingCell,
    ],
  );

  const table = useReactTable({
    data: filteredData,
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
              onContextMenu={(e) => handleContextMenu(e, row.original.id)}
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
            <td colSpan={visibleColumns.length} className="px-3 py-2">
              <button
                onClick={handleAddRow}
                className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700"
              >
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu fixed z-50 rounded-md border border-gray-200 bg-white shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="py-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(
                  "🔥 Delete button clicked for row:",
                  contextMenu.rowId,
                );
                handleDeleteRow(contextMenu.rowId);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Delete row
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
