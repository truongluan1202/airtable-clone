import { useCallback } from "react";
import type { DataRow, Column, CellSelection } from "../types";

interface UseKeyboardNavigationProps {
  selectedCell: CellSelection | null;
  filteredData: DataRow[];
  visibleColumns: Column[];
  handleCellSelect: (rowId: string, columnId: string) => void;
  handleCellEdit: (rowId: string, columnId: string) => void;
  editingCell: CellSelection | null;
}

export function useKeyboardNavigation({
  selectedCell,
  filteredData,
  visibleColumns,
  handleCellSelect,
  handleCellEdit,
  editingCell,
}: UseKeyboardNavigationProps) {
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

  return { handleKeyDown };
}
