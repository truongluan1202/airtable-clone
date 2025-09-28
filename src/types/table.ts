export type ColumnType = "TEXT" | "NUMBER";

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  tableId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cell {
  id: string;
  rowId: string;
  columnId: string;
  vText: string | null;
  vNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Row {
  id: string;
  tableId: string;
  cache: Record<string, any> | null;
  search: string | null;
  cells: Cell[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Table {
  id: string;
  name: string;
  description: string | null;
  baseId: string;
  columns: Column[];
  rows: Row[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Base {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  tables: Table[];
  createdAt: Date;
  updatedAt: Date;
}

// Table view types
export interface TableView {
  id: string;
  name: string;
  tableId: string;
  filters: FilterConfig[] | null;
  sort: SortConfig[] | null;
  columns: ColumnVisibilityConfig[] | null;
  search: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterConfig {
  columnId: string;
  operator: FilterOperator;
  value: string | number;
}

export interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

export interface ColumnVisibilityConfig {
  columnId: string;
  visible: boolean;
  order: number;
}

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export type FilterCondition = {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string | number;
};

export type FilterGroup = {
  id: string;
  conditions: FilterCondition[];
  logicOperator: "and" | "or";
};

// Cell editing types
export interface CellSelection {
  rowId: string;
  columnId: string;
}

export interface CellEditState {
  rowId: string;
  columnId: string;
  value: string | number;
  isEditing: boolean;
}

export interface TableState {
  selectedCell: CellEditState | null;
  editingCell: CellEditState | null;
  searchQuery: string;
  filters: FilterGroup[];
  sort: SortConfig[];
  columnVisibility: Record<string, boolean>;
}
