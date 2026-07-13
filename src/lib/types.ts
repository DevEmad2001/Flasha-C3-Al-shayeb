export interface Project {
  id: string;
  name: string;
  location?: string | null;
  owner_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  project_id?: string | null;
  total_amount: number;
  down_payment: number;
  monthly_installment: number;
  start_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  project?: { name: string; owner_name?: string | null } | null;
  payments?: CustomerPayment[];
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  project_id?: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  recipient?: string | null;
  entered_by?: string | null;
  notes?: string | null;
  created_at?: string;
  customer?: { name: string; total_amount?: number } | null;
  project?: { name: string; owner_name?: string | null } | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface ProjectExpense {
  id: string;
  project_id: string;
  category: string;
  vendor_name?: string | null;
  total_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  payments?: ProjectExpensePayment[];
}

export interface ProjectExpensePayment {
  id: string;
  expense_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  entered_by?: string | null;
  notes?: string | null;
  expense?: {
    category: string;
    vendor_name?: string | null;
    project_id?: string;
    project?: { id: string; name: string } | null;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  unit?: string | null;
  category?: string | null;
  quantity: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  movement_type: "in" | "out";
  quantity: number;
  project_id?: string | null;
  movement_date: string;
  entered_by?: string | null;
  notes?: string | null;
  item?: { id: string; name: string; unit?: string | null; category?: string | null };
  project?: { id: string; name: string } | null;
}

export interface ExternalExpense {
  id: string;
  expense_type: string;
  amount: number;
  payment_method: string;
  beneficiary?: string | null;
  expense_date: string;
  entered_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface DashboardStats {
  projects_count: number;
  customers_count: number;
  total_due: number;
  total_paid: number;
  remaining: number;
  total_expenses: number;
}

export interface ProjectStats {
  customers: number;
  due: number;
  paid: number;
}
