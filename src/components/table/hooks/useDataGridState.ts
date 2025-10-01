import { useState, useCallback } from "react";
import type { CellSelection, ContextMenuState } from "../types";

export function useDataGridState() {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [editingCell, setEditingCell] = useState<CellSelection | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [showAddColumnDropdown, setShowAddColumnDropdown] = useState(false);
  const [openColumnDropdown, setOpenColumnDropdown] = useState<string | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        rowId,
      });
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

  return {
    // State
    selectedRows,
    selectedCell,
    editingCell,
    cellValues,
    showAddColumnDropdown,
    openColumnDropdown,
    contextMenu,

    // Setters
    setSelectedRows,
    setSelectedCell,
    setEditingCell,
    setCellValues,
    setShowAddColumnDropdown,
    setOpenColumnDropdown,
    setContextMenu,

    // Handlers
    handleCellSelect,
    handleCellEdit,
    handleCellStopEdit,
    toggleRowSelection,
    handleContextMenu,
    getCellValue,

    // Computed
    isSelected,
    isEditing,
  };
}
