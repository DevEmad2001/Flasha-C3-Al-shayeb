import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, projectExpensesApi, projectExpensePaymentsApi, projectsApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Pencil, Settings2, FileDown } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { usePaymentMethods } from "@/hooks/useCatalog";
import { exportToExcel } from "@/lib/excel";
import { generateInvoice, shortId } from "@/lib/invoice";
import { ConfirmModal } from "@/components/ConfirmModal";

export const Route = createFileRoute("/payments")({ component: PaymentsPage });

const emptyExp = { category: "", vendor_name: "", total_amount: "", notes: "" };
const emptyPay = { amount: "", payment_method: "كاش", payment_date: new Date().toISOString().slice(0, 10), entered_by: "", notes: "" };

function PaymentsPage() {
  const qc = useQueryClient();
  const { names: paymentMethods } = usePaymentMethods();
  const [projectId, setProjectId] = useState<string>("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [openExpense, setOpenExpense] = useState(false);
  const [editExpId, setEditExpId] = useState<string | null>(null);
  const [openPay, setOpenPay] = useState<string | null>(null);
  const [editPay, setEditPay] = useState<any | null>(null);

  const [expForm, setExpForm] = useState(emptyExp);
  const [payForm, setPayForm] = useState(emptyPay);
  const [pendingDelete, setPendingDelete] = useState<{ type: "expense" | "payment" | "category"; id: string } | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => categoriesApi.listExpense(),
  });
  const categoryNames = categories.map((c) => c.name);

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    if (categoryNames.includes(name)) {
      setExpForm((f) => ({ ...f, category: name }));
      setNewCategory("");
      return;
    }
    try {
      await categoriesApi.create(name);
      toast.success("تمت إضافة النوع");
      await qc.invalidateQueries({ queryKey: ["expense-categories"] });
      setExpForm((f) => ({ ...f, category: name }));
      setNewCategory("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإضافة");
    }
  };

  const renameCategory = async (cat: { id: string; name: string }) => {
    const next = prompt("الاسم الجديد للنوع:", cat.name)?.trim();
    if (!next || next === cat.name) return;
    if (categoryNames.includes(next)) return toast.error("الاسم موجود مسبقاً");
    try {
      await categoriesApi.update(cat.id, next);
      toast.success("تم تعديل النوع");
      setExpForm((f) => (f.category === cat.name ? { ...f, category: next } : f));
      if (categoryFilter === cat.name) setCategoryFilter(next);
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التعديل");
    }
  };

  const [catToDelete, setCatToDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const cat = catToDelete!;
      const { count } = await categoriesApi.usageCount(cat.id, cat.name);
      if ((count ?? 0) > 0) {
        toast.error(`لا يمكن الحذف، النوع مستخدم في ${count} بند`);
        setCatToDelete(null);
        return;
      }
      await categoriesApi.remove(cat.id);
      toast.success("تم الحذف");
      if (expForm.category === cat.name) setExpForm((f) => ({ ...f, category: "" }));
      if (categoryFilter === cat.name) setCategoryFilter("all");
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      setCatToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
      setCatToDelete(null);
    }
  }, [catToDelete, expForm.category, categoryFilter, qc]);

  const confirmDeleteCategory = (cat: { id: string; name: string }) => setCatToDelete(cat);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: () => projectsApi.listMinimal(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["project-expenses", projectId],
    enabled: !!projectId,
    queryFn: () => projectExpensesApi.list(projectId),
  });

  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e: any) => { if (e.vendor_name) set.add(e.vendor_name); });
    return Array.from(set).sort();
  }, [expenses]);

  const grouped = useMemo(() => {
    const filtered = expenses.filter((e: any) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (vendorFilter !== "all" && e.vendor_name !== vendorFilter) return false;
      return true;
    });
    const map = new Map<string, any[]>();
    categoryNames.forEach((c: string) => map.set(c, []));
    filtered.forEach((e: any) => {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    });
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [expenses, vendorFilter, categoryFilter, categories]);

  const openNewExpense = () => { setEditExpId(null); setExpForm(emptyExp); setOpenExpense(true); };
  const openEditExpense = (e: any) => {
    setEditExpId(e.id);
    setExpForm({
      category: e.category, vendor_name: e.vendor_name ?? "",
      total_amount: String(e.total_amount ?? ""), notes: e.notes ?? "",
    });
    setOpenExpense(true);
  };

  const saveExpense = async () => {
    if (!projectId) return toast.error("اختر إسكان أولاً");
    if (!expForm.category) return toast.error("اختر نوع المصروف");
    const total = parseFloat(expForm.total_amount);
    if (!total || total <= 0) return toast.error("المبلغ الكلي مطلوب");
    const payload = {
      project_id: projectId, category: expForm.category,
      vendor_name: expForm.vendor_name || null, total_amount: total, notes: expForm.notes || null,
    };
    try {
      if (editExpId) await projectExpensesApi.update(editExpId, payload);
      else await projectExpensesApi.create(payload);
      toast.success(editExpId ? "تم التعديل" : "تم الإضافة");
      setExpForm(emptyExp); setEditExpId(null); setOpenExpense(false);
      qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const openNewPay = (expId: string) => { setEditPay(null); setPayForm(emptyPay); setOpenPay(expId); };
  const openEditPay = (p: any, expId: string) => {
    setEditPay(p);
    setPayForm({
      amount: String(p.amount), payment_method: p.payment_method, payment_date: p.payment_date,
      entered_by: p.entered_by ?? "", notes: p.notes ?? "",
    });
    setOpenPay(expId);
  };

  const savePayment = async (expenseId: string) => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return toast.error("المبلغ مطلوب");
    const payload = {
      expense_id: expenseId, amount: amt, payment_method: payForm.payment_method,
      payment_date: payForm.payment_date, entered_by: payForm.entered_by || null, notes: payForm.notes || null,
    };
    try {
      if (editPay) await projectExpensePaymentsApi.update(editPay.id, payload);
      else await projectExpensePaymentsApi.create(payload);
      toast.success(editPay ? "تم تعديل الدفعة" : "تم تسجيل الدفعة");
      setPayForm(emptyPay); setEditPay(null); setOpenPay(null);
      qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const removeExpense = useCallback(async (id: string) => {
    await projectExpensesApi.remove(id);
    qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    setPendingDelete(null);
  }, [qc, projectId]);

  const removePayment = useCallback(async (id: string) => {
    await projectExpensePaymentsApi.remove(id);
    qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    setPendingDelete(null);
  }, [qc, projectId]);

  const confirmRemoveExpense = (id: string) => setPendingDelete({ type: "expense", id });
  const confirmRemovePayment = (id: string) => setPendingDelete({ type: "payment", id });

  const downloadInvoice = (e: any, p: any) => {
    const paid = (e.payments ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
    const projectName = projects.find((pr: any) => pr.id === projectId)?.name;
    generateInvoice({
      type: "expense",
      number: shortId(p.id),
      date: p.payment_date,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      partyLabel: `الجهة / ${e.category}`,
      partyName: e.vendor_name || e.category,
      projectName,
      enteredBy: p.entered_by,
      notes: p.notes,
      totalAmount: Number(e.total_amount),
      paidToDate: paid,
      remaining: Number(e.total_amount) - paid,
    });
  };

  const handleExport = () => {
    const rows: any[] = [];
    expenses.forEach((e: any) => {
      const paid = (e.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      rows.push({
        "النوع": e.category, "الجهة": e.vendor_name, "المبلغ الكلي": Number(e.total_amount),
        "المدفوع": paid, "المتبقي": Number(e.total_amount) - paid, "ملاحظات": e.notes,
      });
    });
    exportToExcel(rows, "مدفوعات_المشروع");
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">

      <PageHeader title="المدفوعات" subtitle="إدارة بنود ودفعات كل إسكان" onExport={handleExport}>
        <Dialog open={openExpense} onOpenChange={(o) => { setOpenExpense(o); if (!o) { setEditExpId(null); setExpForm(emptyExp); } }}>
          <DialogTrigger asChild>
            <Button onClick={openNewExpense} disabled={!projectId} className="gap-2"><Plus className="w-4 h-4" />بند جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editExpId ? "تعديل بند" : "إضافة بند مصروف"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select value={expForm.category} onValueChange={(v) => setExpForm({ ...expForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                  <SelectContent>{categoryNames.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="إضافة نوع جديد (مثال: مقاول، بليط)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                  />
                  <Button type="button" variant="secondary" onClick={addCategory} className="gap-1 shrink-0">
                    <Plus className="w-4 h-4" />إضافة
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="gap-1 shrink-0" disabled={categories.length === 0}>
                        <Settings2 className="w-4 h-4" />إدارة
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="end">
                      <div className="text-xs text-muted-foreground mb-1 px-1">إدارة الأنواع</div>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {categories.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                            <span>{c.name}</span>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => renameCategory(c)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmDeleteCategory(c)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1.5"><Label>اسم الجهة / المقاول</Label><Input value={expForm.vendor_name} onChange={(e) => setExpForm({ ...expForm, vendor_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>المبلغ الكلي</Label><Input type="number" step="0.01" value={expForm.total_amount} onChange={(e) => setExpForm({ ...expForm, total_amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} /></div>
              <Button onClick={saveExpense} className="w-full">{editExpId ? "حفظ التعديلات" : "حفظ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>الإسكان / المشروع</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="اختر الإسكان" /></SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>فلترة حسب النوع</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {categoryNames.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>فلترة حسب المالك / الجهة</Label>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {vendorOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {!projectId && (
        <Card className="p-12 text-center text-muted-foreground">اختر إسكان لعرض البنود والمدفوعات.</Card>
      )}

      {projectId && grouped.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">لا توجد بنود. أضف أول بند للبدء.</Card>
      )}

      {projectId && grouped.length > 0 && (
        <Accordion type="multiple" className="space-y-2">
          {grouped.map(([cat, items]) => (
            <AccordionItem key={cat} value={cat} className="border rounded-lg bg-card px-3 sm:px-4">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">{cat}</span>
                <span className="ms-auto me-3 text-sm text-muted-foreground">{items.length} بند</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {items.map((e: any) => {
                    const paid = (e.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                    const remaining = Number(e.total_amount) - paid;
                    return (
                      <Card key={e.id} className="p-3 sm:p-4">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{e.vendor_name || "—"}</p>
                            {e.notes && <p className="text-xs text-muted-foreground truncate">{e.notes}</p>}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Dialog open={openPay === e.id} onOpenChange={(o) => { if (o) openNewPay(e.id); else { setOpenPay(null); setEditPay(null); setPayForm(emptyPay); } }}>
                              <DialogTrigger asChild><Button size="sm" className="h-8 px-2 text-xs">+ دفعة</Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>{editPay ? `تعديل دفعة ${e.vendor_name ?? ""}` : `إضافة دفعة لـ ${e.vendor_name ?? ""}`}</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                  <div className="space-y-1.5"><Label>المبلغ</Label><Input type="number" step="0.01" value={payForm.amount} onChange={(ev) => setPayForm({ ...payForm, amount: ev.target.value })} /></div>
                                  <div className="space-y-1.5">
                                    <Label>طريقة الدفع</Label>
                                    <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={payForm.payment_date} onChange={(ev) => setPayForm({ ...payForm, payment_date: ev.target.value })} /></div>
                                  <div className="space-y-1.5"><Label>أدخل بواسطة</Label><Input value={payForm.entered_by} onChange={(ev) => setPayForm({ ...payForm, entered_by: ev.target.value })} /></div>
                                  <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={payForm.notes} onChange={(ev) => setPayForm({ ...payForm, notes: ev.target.value })} /></div>
                                  <Button onClick={() => savePayment(e.id)} className="w-full">{editPay ? "حفظ التعديلات" : "حفظ الدفعة"}</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditExpense(e)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => confirmRemoveExpense(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <Stat label="الكلي" value={formatMoney(e.total_amount)} />
                          <Stat label="المدفوع" value={formatMoney(paid)} tone="success" />
                          <Stat label="المتبقي" value={formatMoney(remaining)} tone={remaining > 0 ? "warning" : "success"} />
                        </div>
                        {e.payments && e.payments.length > 0 && (
                          <>
                            {/* Mobile: stacked rows */}
                            <div className="md:hidden space-y-2 border-t pt-2">
                              {[...e.payments].sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date)).map((p: any) => (
                                <div key={p.id} className="rounded-lg bg-muted/30 p-2.5 text-xs">
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="font-bold text-success tabular-nums text-sm">{formatMoney(p.amount)}</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[10px]">{p.payment_method}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                                    <span className="truncate">{formatDate(p.payment_date)}{p.entered_by ? ` · ${p.entered_by}` : ""}</span>
                                    <div className="flex gap-0.5 shrink-0">
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadInvoice(e, p)} title="تنزيل سند صرف"><FileDown className="w-3.5 h-3.5 text-primary" /></Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditPay(p, e.id)}><Pencil className="w-3.5 h-3.5" /></Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmRemovePayment(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                                    </div>
                                  </div>
                                  {p.notes && <p className="mt-1 text-muted-foreground truncate">{p.notes}</p>}
                                </div>
                              ))}
                            </div>
                            {/* Desktop: table */}
                            <div className="hidden md:block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-right">التاريخ</TableHead>
                                    <TableHead className="text-right">المبلغ</TableHead>
                                    <TableHead className="text-right">طريقة الدفع</TableHead>
                                    <TableHead className="text-right">أدخلها</TableHead>
                                    <TableHead className="text-right">ملاحظات</TableHead>
                                    <TableHead className="text-center"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {[...e.payments].sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date)).map((p: any) => (
                                    <TableRow key={p.id}>
                                      <TableCell className="text-right">{formatDate(p.payment_date)}</TableCell>
                                      <TableCell className="text-right">{formatMoney(p.amount)}</TableCell>
                                      <TableCell className="text-right">{p.payment_method}</TableCell>
                                      <TableCell className="text-right">{p.entered_by ?? "—"}</TableCell>
                                      <TableCell className="text-xs text-right">{p.notes ?? "—"}</TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex gap-1 justify-center">
                                          <Button size="sm" variant="ghost" onClick={() => downloadInvoice(e, p)} title="تنزيل سند صرف"><FileDown className="w-4 h-4 text-primary" /></Button>
                                          <Button size="sm" variant="ghost" onClick={() => openEditPay(p, e.id)}><Pencil className="w-4 h-4" /></Button>
                                          <Button size="sm" variant="ghost" onClick={() => confirmRemovePayment(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete?.type === "expense" ? "حذف البند" : "حذف الدفعة"}
        message={pendingDelete?.type === "expense" ? "حذف البند وكل دفعاته؟" : "حذف الدفعة؟"}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.type === "expense") removeExpense(pendingDelete.id);
          else removePayment(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmModal
        open={!!catToDelete}
        title={`حذف النوع "${catToDelete?.name ?? ""}"`}
        message={`حذف النوع "${catToDelete?.name ?? ""}"؟`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => catToDelete && deleteCategory(catToDelete.id)}
        onCancel={() => setCatToDelete(null)}
      />
    </div>

  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-secondary";
  return (
    <div className={`p-2 rounded-md text-center ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}
