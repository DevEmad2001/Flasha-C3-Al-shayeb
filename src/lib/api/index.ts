import { api, getToken, API_BASE, ApiError } from "./client";
import type {
  Category,
  Customer,
  CustomerPayment,
  DashboardStats,
  ExternalExpense,
  InventoryItem,
  InventoryMovement,
  Project,
  ProjectExpense,
  ProjectExpensePayment,
  ProjectStats,
} from "@/lib/types";

export { api, apiRequest, getToken, setToken, ApiError, API_BASE } from "./client";

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; username: string; display_name: string }>("/auth/login", { username, password }),
  me: () => api.get<{ username: string; display_name: string }>("/auth/me"),
  changePassword: (new_password: string) => api.put<void>("/auth/password", { new_password }),
  changeUsername: (new_username: string) => api.put<{ username: string }>("/auth/username", { new_username }),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/dashboard/stats"),
};

export const projectsApi = {
  list: () => api.get<Project[]>("/projects"),
  listMinimal: () => api.get<Pick<Project, "id" | "name">[]>("/projects", { fields: "minimal" }),
  listWithOwner: () => api.get<{ id: string; name: string; owner_name?: string | null }[]>("/projects", { fields: "list" }),
  stats: () => api.get<Record<string, ProjectStats>>("/projects/stats"),
  create: (data: Partial<Project>) => api.post<Project>("/projects", data),
  update: (id: string, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data),
  remove: (id: string) => api.delete(`/projects/${id}`),
};

export const customersApi = {
  listFull: () => api.get<Customer[]>("/customers", { full: true }),
  listStocktake: () => api.get<Customer[]>("/customers", { fields: "stocktake" }),
  create: (data: Partial<Customer>) => api.post<{ id: string }>("/customers", data),
  update: (id: string, data: Partial<Customer>) => api.put<Customer>(`/customers/${id}`, data),
  remove: (id: string) => api.delete(`/customers/${id}`),
};

export const customerPaymentsApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<CustomerPayment[]>("/customer-payments", params),
  create: (data: Partial<CustomerPayment>) => api.post<{ id: string }>("/customer-payments", data),
  update: (id: string, data: Partial<CustomerPayment>) => api.put<CustomerPayment>(`/customer-payments/${id}`, data),
  remove: (id: string) => api.delete(`/customer-payments/${id}`),
};

export const categoriesApi = {
  list: (type: string) => api.get<Category[]>("/categories", { type }),
  listExpense: () => api.get<Category[]>("/categories", { type: "expense" }),
  listPaymentMethods: () => api.get<Category[]>("/categories", { type: "payment_method" }),
  listRecipients: () => api.get<Category[]>("/categories", { type: "recipient" }),
  usageCount: (id: string, name: string) => api.get<{ count: number }>(`/categories/${id}/usage-count`, { name }),
  create: (name: string, type = "expense") => api.post<Category>("/categories", { name, type }),
  update: (id: string, name: string, type = "expense") => api.put<Category>(`/categories/${id}`, { name, type }),
  remove: (id: string) => api.delete(`/categories/${id}`),
};

export const projectExpensesApi = {
  list: (project_id: string) => api.get<ProjectExpense[]>("/project-expenses", { project_id }),
  create: (data: Partial<ProjectExpense>) => api.post<{ id: string }>("/project-expenses", data),
  update: (id: string, data: Partial<ProjectExpense>) => api.put<ProjectExpense>(`/project-expenses/${id}`, data),
  remove: (id: string) => api.delete(`/project-expenses/${id}`),
};

export const projectExpensePaymentsApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<ProjectExpensePayment[]>("/project-expense-payments", params),
  create: (data: Partial<ProjectExpensePayment>) => api.post<{ id: string }>("/project-expense-payments", data),
  update: (id: string, data: Partial<ProjectExpensePayment>) =>
    api.put<ProjectExpensePayment>(`/project-expense-payments/${id}`, data),
  remove: (id: string) => api.delete(`/project-expense-payments/${id}`),
};

export const inventoryApi = {
  items: () => api.get<InventoryItem[]>("/inventory-items"),
  createItem: (data: Partial<InventoryItem>) => api.post<InventoryItem>("/inventory-items", data),
  updateItem: (id: string, data: Partial<InventoryItem>) => api.put<InventoryItem>(`/inventory-items/${id}`, data),
  removeItem: (id: string) => api.delete(`/inventory-items/${id}`),
  movements: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<InventoryMovement[]>("/inventory-movements", params),
  createMovement: (data: Partial<InventoryMovement>) => api.post<{ id: string }>("/inventory-movements", data),
  updateMovement: (id: string, data: Partial<InventoryMovement>) =>
    api.put<InventoryMovement>(`/inventory-movements/${id}`, data),
  removeMovement: (id: string) => api.delete(`/inventory-movements/${id}`),
};

export const externalExpensesApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<ExternalExpense[]>("/external-expenses", params),
  create: (data: Partial<ExternalExpense>) => api.post<ExternalExpense>("/external-expenses", data),
  update: (id: string, data: Partial<ExternalExpense>) => api.put<ExternalExpense>(`/external-expenses/${id}`, data),
  remove: (id: string) => api.delete(`/external-expenses/${id}`),
};

export const scheduleApi = {
  data: () =>
    api.get<{
      customers: Customer[];
      payments: { customer_id: string; amount: number; payment_date: string }[];
      projects: { id: string; name: string }[];
    }>("/schedule"),
};

export const reportsApi = {
  summary: (start: string, end: string) => api.get("/reports/summary", { start, end }),
};

export const dailyApi = {
  entries: (date: string) => api.get("/daily", { date }),
};

export const backupApi = {
  download: async (): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/backup/download`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.message ?? `HTTP ${res.status}`, res.status);
    }
    return res.blob();
  },
};

export interface SeedStatus {
  config: {
    sample_data_enabled: boolean;
    only_if_empty: boolean;
    include_demo_users: boolean;
    allow_admin_reset: boolean;
    allow_admin_clear: boolean;
    admin_user: string;
  };
  counts: Record<string, number>;
  demo_users: { username: string; password: string; role: string }[];
  test_scenarios: string[];
}

export const adminApi = {
  seedStatus: () => api.get<SeedStatus>("/admin/seed/status"),
  runSeed: (force = false) =>
    api.post<{ message: string; counts: Record<string, number> }>(`/admin/seed/run?force=${force}`),
  resetSeed: () => api.post<{ message: string; counts: Record<string, number> }>("/admin/seed/reset"),
  clearData: () => api.post<{ message: string; counts: Record<string, number> }>("/admin/data/clear"),
};
