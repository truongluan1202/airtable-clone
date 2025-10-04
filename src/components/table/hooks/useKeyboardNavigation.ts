import { useCallback } from "react";
import type { DataRow, Column, CellSelection } from "../types";

interface UseKeyboardNavigationProps {
  selectedCell: CellSelection | null;
  filteredData: DataRow[];
  visibleColumns: Column[];
  handleCellSelect: (rowId: string, columnId: string) => void;
  handleCellEdit: (rowId: string, columnId: string) => void;
  editingCell: CellSelection | null;
  onStopEdit?: () => void;
  onKeyboardFocus?: () => void;
}

export function useKeyboardNavigation({
  selectedCell,
  filteredData,
  visibleColumns,
  handleCellSelect,
  handleCellEdit,
  editingCell,
  onStopEdit,
  onKeyboardFocus,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If no cell is selected and a navigation key is pressed, mark as keyboard focus
      if (!selectedCell && !editingCell && onKeyboardFocus) {
        if (
          [
            "Tab",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Enter",
            " ",
          ].includes(e.key)
        ) {
          onKeyboardFocus();
        }
      }

      // If we're editing a cell, let the EditableCell handle most keys
      if (editingCell) {
        // Only handle Tab and Shift+Tab to exit edit mode and navigate
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();

          // Save the current edit and navigate
          if (onStopEdit) {
            onStopEdit();
          }

          // Navigate to next/previous cell after a brief delay to allow save
          setTimeout(() => {
            if (!selectedCell) return;

            const currentRowIndex = filteredData.findIndex(
              (row) => row.id === selectedCell.rowId,
            );
            const currentColumnIndex = visibleColumns.findIndex(
              (col) => col.id === selectedCell.columnId,
            );

            if (currentRowIndex === -1 || currentColumnIndex === -1) return;

            const maxRows = filteredData.length;
            const maxColumns = visibleColumns.length;

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
          }, 50); // Small delay to allow save to complete
        }
        return;
      }

      // If no cell is selected, don't handle navigation
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
          handleCellEdit(selectedCell.rowId, selectedCell.columnId);
          break;
        case "F2":
          // F2 is a common shortcut for editing cells
          e.preventDefault();
          handleCellEdit(selectedCell.rowId, selectedCell.columnId);
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
      onStopEdit,
      onKeyboardFocus,
    ],
  );

  return { handleKeyDown };
}
