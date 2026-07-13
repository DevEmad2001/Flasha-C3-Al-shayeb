import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customerPaymentsApi, dashboardApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";
import { usePaymentMethods } from "@/hooks/useCatalog";
import { exportToExcel } from "@/lib/excel";
import { useState, useMemo, useCallback } from "react";
import { Building2, Users, CreditCard, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { RecipientField } from "@/components/RecipientField";

import type { CustomerPayment } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const qc = useQueryClient();
  const { names: paymentMethods } = usePaymentMethods();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CustomerPayment | null>(null);
  const [form, setForm] = useState({ amount: "", payment_date: "", payment_method: "كاش", recipient: "", entered_by: "", notes: "" });

  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: () => dashboardApi.stats(),
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["home-payments"],
    queryFn: () => customerPaymentsApi.list({ limit: 200, include_relations: true }),
  });

  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    rows.forEach((r) => { if (r.customer?.name) names.add(r.customer.name); });
    return Array.from(names).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (selectedCustomer === "all") return rows;
    return rows.filter((r) => r.customer?.name === selectedCustomer);
  }, [rows, selectedCustomer]);

  const openEdit = (r: CustomerPayment) => {
    setEditRow(r);
    setForm({
      amount: String(r.amount), payment_date: r.payment_date,
      payment_method: r.payment_method ?? "كاش", recipient: r.recipient ?? "",
      entered_by: r.entered_by ?? "", notes: r.notes ?? "",
    });
  };

  const save = async () => {
    if (!editRow) return;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast.error("المبلغ مطلوب");
    try {
      await customerPaymentsApi.update(editRow.id, {
        amount: amt, payment_date: form.payment_date, payment_method: form.payment_method,
        recipient: form.recipient || null, entered_by: form.entered_by || null, notes: form.notes || null,
      });
      toast.success("تم التعديل");
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["home-payments"] });
      qc.invalidateQueries({ queryKey: ["home-stats"] });
      qc.invalidateQueries({ queryKey: ["customers-full"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التعديل");
    }
  };

  const confirmRemove = (id: string) => setPendingDelete(id);

  const remove = useCallback(async (id: string) => {
    await customerPaymentsApi.remove(id);
    qc.invalidateQueries({ queryKey: ["home-payments"] });
    qc.invalidateQueries({ queryKey: ["home-stats"] });
    qc.invalidateQueries({ queryKey: ["customers-full"] });
    setPendingDelete(null);
  }, [qc]);

  const handleExport = () => {
    exportToExcel(
      filtered.map((r) => ({
        "اسم الزبون": r.customer?.name, "قيمة القسط": r.amount,
        "الإسكان/المشروع": r.project?.name, "اسم المالك": r.project?.owner_name,
        "تاريخ الدفع": formatDate(r.payment_date), "الواصل": r.recipient,
        "أدخلها": r.entered_by, "طريقة الدفع": r.payment_method,
      })),
      "دفعات_الإسكان",
    );
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader title="الصفحة الرئيسية" subtitle="نظرة عامة ودفعات الإسكان" onExport={handleExport} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
        <StatCard icon={Users} label="عدد الزبائن" value={stats?.customers_count ?? 0} tone="teal" />
        <StatCard icon={Building2} label="عدد الإسكانات" value={stats?.projects_count ?? 0} tone="teal" />
        <StatCard icon={CreditCard} label="إجمالي المحصّل" value={formatMoney(stats?.total_paid)} tone="deep" />
        <StatCard icon={AlertCircle} label="المتبقي على الزبائن" value={formatMoney(stats?.remaining)} tone="warning" />
      </div>

      <Card className="p-0 overflow-hidden rounded-2xl border-border/70 shadow-card">
        <div className="flex items-center justify-between gap-3 flex-wrap p-4 sm:p-6 border-b border-border/70 bg-secondary/40">
          <h2 className="font-display text-lg font-bold">دفعات الإسكان</h2>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-full sm:max-w-xs rounded-xl bg-card">
              <SelectValue placeholder="اختر الزبون" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الزبائن</SelectItem>
              {customerOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:hidden p-3 space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا توجد دفعات</p>
          )}
          {filtered.map((r) => (
            <Card key={r.id} className="p-4 rounded-xl border-border/70 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-base truncate">{r.customer?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.project?.name ?? "—"}{r.project?.owner_name ? ` — ${r.project.owner_name}` : ""}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => confirmRemove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-primary font-bold text-lg">{formatMoney(r.amount)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{r.payment_method}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="block text-[10px] text-muted-foreground">تاريخ الدفع</span>{formatDate(r.payment_date)}</div>
                <div><span className="block text-[10px] text-muted-foreground">الواصل</span>{r.recipient ?? "—"}</div>
                <div className="col-span-2"><span className="block text-[10px] text-muted-foreground">أدخلها</span>{r.entered_by ?? "—"}</div>
                {r.notes && <div className="col-span-2"><span className="block text-[10px] text-muted-foreground">ملاحظات</span><span className="text-muted-foreground/70 line-clamp-2">{r.notes}</span></div>}
              </div>
            </Card>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">اسم الزبون</TableHead>
                <TableHead className="text-center">قيمة القسط</TableHead>
                <TableHead className="text-center">الإسكان</TableHead>
                <TableHead className="text-center">اسم المالك</TableHead>
                <TableHead className="text-center">تاريخ الدفع</TableHead>
                <TableHead className="text-center">الواصل</TableHead>
                <TableHead className="text-center">أدخلها</TableHead>
                <TableHead className="text-center">طريقة الدفع</TableHead>
                <TableHead className="text-center">ملاحظات</TableHead>
                <TableHead className="text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">لا توجد دفعات</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-center">{r.customer?.name}</TableCell>
                  <TableCell className="text-primary font-semibold text-center">{formatMoney(r.amount)}</TableCell>
                  <TableCell className="text-center">{r.project?.name ?? "—"}</TableCell>
                  <TableCell className="text-center">{r.project?.owner_name ?? "—"}</TableCell>
                  <TableCell className="text-center">{formatDate(r.payment_date)}</TableCell>
                  <TableCell className="text-center">{r.recipient ?? "—"}</TableCell>
                  <TableCell className="text-center">{r.entered_by ?? "—"}</TableCell>
                  <TableCell className="text-center"><span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">{r.payment_method}</span></TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground/70 max-w-[120px] truncate">{r.notes ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center items-center gap-x-3">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(r)}><Pencil className="w-4 h-4 text-slate-500 hover:text-blue-600 transition-colors" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => confirmRemove(r.id)}><Trash2 className="w-4 h-4 text-red-500 hover:text-red-700 transition-colors" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل دفعة {editRow?.customer?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>المبلغ</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <RecipientField value={form.recipient} onChange={(v) => setForm({ ...form, recipient: v })} label="الواصل" />
            <div className="space-y-1.5"><Label>أدخلها</Label><Input value={form.entered_by} onChange={(e) => setForm({ ...form, entered_by: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full">حفظ التعديلات</Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmModal
        open={!!pendingDelete}
        title="حذف الدفعة"
        message="حذف الدفعة؟"
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "teal" }: { icon: typeof Users; label: string; value: unknown; tone?: "teal" | "deep" | "warning" }) {
  const isDeep = tone === "deep";
  const isWarning = tone === "warning";
  const iconBox = isDeep
    ? "bg-white/15 text-white"
    : isWarning
    ? "bg-warning/15 text-warning-foreground"
    : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground";
  return (
    <Card
      className={`p-3 sm:p-5 card-enter rounded-2xl border shadow-card flex items-center gap-2.5 sm:gap-4 transition-all duration-300 group ${
        isDeep
          ? "bg-gradient-deep text-white border-transparent shadow-elegant"
          : isWarning
          ? "bg-card border-warning/30 hover:border-warning/60 hover-lift"
          : "bg-card border-border/70 hover:border-primary/40 hover-lift"
      }`}
    >
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-colors ${iconBox}`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center py-0.5">
        <p className={`text-[11px] sm:text-sm font-medium leading-tight mb-0.5 sm:mb-0.5 ${isDeep ? "text-white/70" : "text-muted-foreground"}`}>{label}</p>
        <p className={`font-display text-sm sm:text-2xl font-bold tabular-nums leading-none tracking-tight ${isDeep ? "text-white" : "text-foreground"}`}>{value as string}</p>
      </div>
    </Card>
  );
}
