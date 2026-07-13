import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { dailyApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import type { CustomerPayment, ExternalExpense, ProjectExpensePayment } from "@/lib/types";

export const Route = createFileRoute("/daily")({ component: DailyPage });

interface Entry {
  id: string;
  date: string;
  type: "دخل - قسط زبون" | "صرف - بند مشروع" | "صرف - مصروف خارجي";
  description: string;
  amount: number;
  direction: "in" | "out";
  payment_method: string;
  entered_by: string | null;
}

function DailyPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["daily-entries", date],
    queryFn: () => dailyApi.entries(date),
  });

  const entries = useMemo(() => {
    const out: Entry[] = [];
    (data?.customer_payments ?? []).forEach((p: CustomerPayment) => out.push({
      id: "cp-" + p.id, date: p.payment_date, type: "دخل - قسط زبون",
      description: `${p.customer?.name} ${p.project?.name ? `(${p.project.name})` : ""}`,
      amount: Number(p.amount), direction: "in", payment_method: p.payment_method, entered_by: p.entered_by ?? null,
    }));
    (data?.project_expense_payments ?? []).forEach((p: ProjectExpensePayment) => out.push({
      id: "pep-" + p.id, date: p.payment_date, type: "صرف - بند مشروع",
      description: `${p.expense?.category} • ${p.expense?.vendor_name ?? ""} (${p.expense?.project?.name ?? ""})`,
      amount: Number(p.amount), direction: "out", payment_method: p.payment_method, entered_by: p.entered_by ?? null,
    }));
    (data?.external_expenses ?? []).forEach((e: ExternalExpense) => out.push({
      id: "ex-" + e.id, date: e.expense_date, type: "صرف - مصروف خارجي",
      description: `${e.expense_type} ${e.beneficiary ? `→ ${e.beneficiary}` : ""}`,
      amount: Number(e.amount), direction: "out", payment_method: e.payment_method, entered_by: e.entered_by ?? null,
    }));
    return out;
  }, [data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter((e) => `${e.description} ${e.type}`.toLowerCase().includes(s));
  }, [entries, search]);

  const totalIn = filtered.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = filtered.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader title="المدخلات اليومية" subtitle="جميع الحركات المالية في يوم محدد"
        onExport={() => exportToExcel(filtered.map((e) => ({
          "التاريخ": formatDate(e.date), "النوع": e.type, "البيان": e.description,
          "وارد": e.direction === "in" ? e.amount : "", "صادر": e.direction === "out" ? e.amount : "",
          "طريقة الدفع": e.payment_method, "أدخلها": e.entered_by,
        })), `حركات_${date}`)} />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>بحث</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>إجمالي الوارد</Label><div className="h-9 flex items-center font-bold text-lg text-success">{formatMoney(totalIn)}</div></div>
          <div className="space-y-1.5"><Label>إجمالي الصادر</Label><div className="h-9 flex items-center font-bold text-lg text-destructive">{formatMoney(totalOut)}</div></div>
        </div>
        <div className="mt-3 p-3 rounded-md bg-primary/5 text-center">
          <span className="text-sm text-muted-foreground">صافي اليوم: </span>
          <span className="font-bold text-lg" style={{ color: totalIn - totalOut >= 0 ? "var(--success)" : "var(--destructive)" }}>
            {formatMoney(totalIn - totalOut)}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" dir="rtl">
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">لا يوجد حركات في هذا اليوم</p>
        )}
        {filtered.map((e) => {
          const isIn = e.direction === "in";
          return (
            <Card key={e.id} className="p-3 text-right relative overflow-hidden">
              <div className={`absolute top-0 right-0 left-0 h-1 ${isIn ? "bg-success" : "bg-destructive"}`} />
              <div className="flex items-start justify-between gap-2 mt-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{e.type}</p>
                  <h4 className="font-bold text-sm truncate">{e.description}</h4>
                </div>
                <span className={`font-bold tabular-nums text-sm shrink-0 ${isIn ? "text-success" : "text-destructive"}`}>
                  {isIn ? "+" : "−"} {formatMoney(e.amount)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-secondary">{e.payment_method}</span>
                <span className="text-muted-foreground">أدخلها: <span className="text-foreground font-medium">{e.entered_by ?? "—"}</span></span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
