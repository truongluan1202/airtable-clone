import type { SortConfig } from "~/types/table";

export interface DataRow {
  id: string;
  [key: string]: any; // Allow dynamic properties based on table columns
}

export interface Column {
  id: string;
  name: string;
  type: string;
}

export interface DataGridProps {
  data: DataRow[];
  columns?: Column[];
  tableId?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  sort?: SortConfig[];
  isBulkLoading?: boolean;
  bulkLoadingMessage?: string;
}

export interface EditableCellProps {
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

export interface CellSelection {
  rowId: string;
  columnId: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  rowId: string;
}
