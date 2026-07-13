import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/format";
import { toast } from "sonner";

export const PAYMENT_METHODS_QUERY_KEY = ["categories", "payment_method"] as const;
export const EXPENSE_CATEGORIES_QUERY_KEY = ["categories", "expense"] as const;
export const RECIPIENTS_QUERY_KEY = ["categories", "recipient"] as const;

export function usePaymentMethods() {
  const { data = [], ...rest } = useQuery({
    queryKey: PAYMENT_METHODS_QUERY_KEY,
    queryFn: () => categoriesApi.listPaymentMethods(),
  });
  const names = data.length > 0 ? data.map((c) => c.name) : [...DEFAULT_PAYMENT_METHODS];
  return { methods: data, names, defaultName: names[0] ?? "كاش", ...rest };
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: EXPENSE_CATEGORIES_QUERY_KEY,
    queryFn: () => categoriesApi.listExpense(),
  });
}

export function useRecipients() {
  const { data = [], ...rest } = useQuery({
    queryKey: RECIPIENTS_QUERY_KEY,
    queryFn: () => categoriesApi.listRecipients(),
  });
  return { recipients: data, names: data.map((c) => c.name), ...rest };
}

export function useCategoryManager(type: "expense" | "payment_method" | "recipient", queryKey: readonly string[]) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    if (type === "payment_method") qc.invalidateQueries();
  };

  const add = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    try {
      await categoriesApi.create(trimmed, type);
      toast.success("تمت الإضافة");
      invalidate();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإضافة");
      return false;
    }
  };

  const rename = async (cat: { id: string; name: string }) => {
    const next = prompt("الاسم الجديد:", cat.name)?.trim();
    if (!next || next === cat.name) return;
    try {
      await categoriesApi.update(cat.id, next, type);
      toast.success("تم التعديل");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التعديل");
    }
  };

  const remove = async (cat: { id: string; name: string }) => {
    try {
      const { count } = await categoriesApi.usageCount(cat.id, cat.name);
      if ((count ?? 0) > 0) {
        toast.error(`لا يمكن الحذف — مستخدم في ${count} سجل`);
        return;
      }
      if (!confirm(`حذف "${cat.name}"؟`)) return;
      await categoriesApi.remove(cat.id);
      toast.success("تم الحذف");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  };

  return { add, rename, remove, invalidate };
}
