import { EditableCell } from "./EditableCell";
import type { Row, Column, CellEditState } from "~/types/table";

interface TableRowProps {
  row: Row;
  rowIndex: number;
  columns: Column[];
  selectedCell: CellEditState | null;
  editingCell: CellEditState | null;
  columnVisibility: Record<string, boolean>;
  onCellSelect: (rowId: string, columnId: string) => void;
  onCellEdit: (rowId: string, columnId: string) => void;
  onCellSave: (rowId: string, columnId: string, value: string | number) => void;
  onCellCancel: () => void;
  onRowRightClick?: (event: React.MouseEvent, rowId: string) => void;
}

export function TableRow({
  row,
  rowIndex,
  columns,
  selectedCell,
  editingCell,
  columnVisibility,
  onCellSelect,
  onCellEdit,
  onCellSave,
  onCellCancel,
  onRowRightClick,
}: TableRowProps) {
  const getCell = (columnId: string) => {
    return row.cells.find((cell) => cell.columnId === columnId) ?? null;
  };

  const isCellSelected = (columnId: string) => {
    return (
      selectedCell?.rowId === row.id && selectedCell?.columnId === columnId
    );
  };

  const isCellEditing = (columnId: string) => {
    return editingCell?.rowId === row.id && editingCell?.columnId === columnId;
  };

  return (
    <div
      className="flex border-b border-gray-200 hover:bg-gray-50"
      onContextMenu={(e) => onRowRightClick?.(e, row.id)}
    >
      {/* Row number */}
      <div className="flex w-12 flex-shrink-0 items-center justify-center border-r border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500">{rowIndex + 1}</span>
      </div>

      {/* Data cells */}
      {columns.map((column) => {
        const isVisible = columnVisibility[column.id] !== false;
        if (!isVisible) return null;

        const cell = getCell(column.id);
        const isSelected = isCellSelected(column.id);
        const isEditing = isCellEditing(column.id);

        return (
          <div
            key={column.id}
            className="min-w-32 flex-1 border-r border-gray-200"
          >
            <EditableCell
              cell={cell}
              column={column}
              isEditing={isEditing}
              isSelected={isSelected}
              onStartEdit={() => onCellEdit(row.id, column.id)}
              onEndEdit={(value) => onCellSave(row.id, column.id, value)}
              onCancelEdit={onCellCancel}
              onSelect={() => onCellSelect(row.id, column.id)}
            />
          </div>
        );
      })}

      {/* Empty space for add column button */}
      <div className="w-32 flex-shrink-0"></div>
    </div>
  );
}
