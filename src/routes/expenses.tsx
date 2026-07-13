import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { externalExpensesApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Receipt } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { usePaymentMethods } from "@/hooks/useCatalog";
import { exportToExcel } from "@/lib/excel";
import { useViewMode } from "@/hooks/useViewMode";
import { ConfirmModal } from "@/components/ConfirmModal";


export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

const empty = { expense_type: "", amount: "", payment_method: "كاش", expense_date: new Date().toISOString().slice(0, 10), entered_by: "", notes: "" };

function ExpensesPage() {
  const qc = useQueryClient();
  const { names: paymentMethods } = usePaymentMethods();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [enteredByFilter, setEnteredByFilter] = useState("all");
  const [enteredBySearch, setEnteredBySearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState(empty);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [view, setView] = useViewMode("expenses", "cards");


  const { data: rows = [] } = useQuery({
    queryKey: ["external-expenses"],
    queryFn: () => externalExpensesApi.list(),
  });

  const enteredByOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows as any[]) {
      const n = (r.entered_by ?? "").trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const enteredQ = enteredBySearch.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (s && !`${r.expense_type} ${r.notes ?? ""}`.toLowerCase().includes(s)) return false;
      if (enteredByFilter !== "all" && enteredByFilter !== "__text__" && (r.entered_by ?? "") !== enteredByFilter) return false;
      if (enteredQ && !(r.entered_by ?? "").toLowerCase().includes(enteredQ)) return false;
      if (from && r.expense_date < from) return false;
      if (to && r.expense_date > to) return false;
      return true;
    });
  }, [rows, search, from, to, enteredByFilter, enteredBySearch]);

  const total = filtered.reduce((s: number, r: any) => s + Number(r.amount), 0);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      expense_type: r.expense_type ?? "", amount: String(r.amount ?? ""),
      payment_method: r.payment_method ?? "كاش", expense_date: r.expense_date,
      entered_by: r.entered_by ?? "", notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.expense_type.trim()) return toast.error("نوع المصروف مطلوب");
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast.error("المبلغ مطلوب");
    const payload = {
      expense_type: form.expense_type, amount: amt, payment_method: form.payment_method,
      expense_date: form.expense_date, entered_by: form.entered_by || null, notes: form.notes || null,
    };
    try {
      if (editId) await externalExpensesApi.update(editId, payload);
      else await externalExpensesApi.create(payload);
      toast.success(editId ? "تم التعديل" : "تمت الإضافة");
      setForm(empty); setEditId(null); setOpen(false);
      qc.invalidateQueries({ queryKey: ["external-expenses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const remove = useCallback(async (id: string) => {
    await externalExpensesApi.remove(id);
    qc.invalidateQueries({ queryKey: ["external-expenses"] });
    setPendingDelete(null);
  }, [qc]);

  const confirmRemove = (id: string) => setPendingDelete(id);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">

      <PageHeader title="المصاريف الخارجية" subtitle="مصاريف غير مرتبطة بمشروع"
        onExport={() => exportToExcel(filtered.map((r: any) => ({
          "التاريخ": formatDate(r.expense_date), "النوع": r.expense_type, "المبلغ": Number(r.amount),
          "طريقة الدفع": r.payment_method, "أدخلها": r.entered_by, "ملاحظات": r.notes,
        })), "المصاريف_الخارجية")}>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />مصروف جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>نوع المصروف</Label><Input value={form.expense_type} onChange={(e) => setForm({ ...form, expense_type: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>المبلغ</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>أدخلها</Label><Input value={form.entered_by} onChange={(e) => setForm({ ...form, entered_by: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={save} className="w-full">{editId ? "حفظ التعديلات" : "حفظ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5"><Label>بحث</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نوع، ملاحظات..." /></div>
          <div className="space-y-1.5">
            <Label>أدخلها</Label>
            <Select value={enteredByFilter} onValueChange={setEnteredByFilter}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {enteredByOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                <SelectItem value="__text__">بحث بالاسم...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(enteredByFilter === "__text__" || enteredBySearch) && (
            <div className="space-y-1.5">
              <Label>بحث بالاسم</Label>
              <Input value={enteredBySearch} onChange={(e) => setEnteredBySearch(e.target.value)} placeholder="اسم الشخص..." />
            </div>
          )}
          <div className="space-y-1.5"><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>الإجمالي</Label><div className="h-9 flex items-center font-bold text-lg text-accent">{formatMoney(total)}</div></div>
        </div>
      </Card>

      <div className="flex justify-end mb-3">
        <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
          <button type="button" onClick={() => setView("cards")}
            className={`px-3 py-1 text-xs rounded transition-all ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>بطاقات</button>
          <button type="button" onClick={() => setView("table")}
            className={`px-3 py-1 text-xs rounded transition-all ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>جدول</button>
        </div>
      </div>

      {view === "cards" ? (
        filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">لا يوجد مصاريف</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r: any) => (
              <Card key={r.id} className="p-4 rounded-xl border border-border/70 shadow-sm text-right">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive shrink-0">
                      <Receipt className="w-3.5 h-3.5" />
                    </div>
                    <p className="font-bold text-sm truncate">{r.expense_type}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmRemove(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-destructive font-bold text-lg tabular-nums">{formatMoney(r.amount)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary">{r.payment_method}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="block text-[10px] text-muted-foreground">التاريخ</span>{formatDate(r.expense_date)}</div>
                  <div><span className="block text-[10px] text-muted-foreground">أدخلها</span>{r.entered_by ?? "—"}</div>
                </div>
                {r.notes && <p className="mt-2 pt-2 border-t text-xs text-muted-foreground truncate">{r.notes}</p>}
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">طريقة الدفع</TableHead>
                  <TableHead className="text-right">أدخلها</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد مصاريف</TableCell></TableRow>}
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-right">{formatDate(r.expense_date)}</TableCell>
                    <TableCell className="font-medium text-right">{r.expense_type}</TableCell>
                    <TableCell className="text-destructive font-semibold text-right">{formatMoney(r.amount)}</TableCell>
                    <TableCell className="text-right"><span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{r.payment_method}</span></TableCell>
                    <TableCell className="text-right">{r.entered_by ?? "—"}</TableCell>
                    <TableCell className="text-xs text-right">{r.notes ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => confirmRemove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ConfirmModal
        open={!!pendingDelete}
        title="حذف المصروف"
        message="حذف المصروف؟"
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
