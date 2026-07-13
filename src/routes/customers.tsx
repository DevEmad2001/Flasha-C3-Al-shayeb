import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi, customerPaymentsApi, projectsApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Phone, Building2, FileDown, UserX, Trash } from "lucide-react";
import { useState, useMemo, Fragment, useCallback } from "react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { usePaymentMethods, useRecipients } from "@/hooks/useCatalog";
import { RecipientField } from "@/components/RecipientField";
import { useOwners } from "@/hooks/useOwners";
import { OwnerFilter } from "@/components/OwnerFilter";
import { exportToExcel } from "@/lib/excel";
import { generateInvoice, shortId } from "@/lib/invoice";
import { useViewMode } from "@/hooks/useViewMode";
import { ConfirmModal } from "@/components/ConfirmModal";

export const Route = createFileRoute("/customers")({ component: CustomersPage });

const emptyCust = { name: "", phone: "", project_id: "", total_amount: "", down_payment: "", monthly_installment: "", start_date: new Date().toISOString().slice(0, 10), notes: "" };
const emptyPay = { amount: "", payment_method: "كاش", payment_date: new Date().toISOString().slice(0, 10), recipient: "", entered_by: "", notes: "" };

function CustomersPage() {
  const qc = useQueryClient();
  const { names: paymentMethods } = usePaymentMethods();
  const { names: recipientNames } = useRecipients();
  const [openCust, setOpenCust] = useState(false);
  const [editCustId, setEditCustId] = useState<string | null>(null);
  const [openPay, setOpenPay] = useState<string | null>(null); // for new payment, value = customer id
  const [editPay, setEditPay] = useState<any | null>(null); // payment row being edited
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ownerSearch, setOwnerSearch] = useState("all");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<{ type: "customer" | "payment"; id: string } | null>(null);
  const [view, setView] = useViewMode("customers", "cards");

  const [cForm, setCForm] = useState(emptyCust);
  const [pForm, setPForm] = useState(emptyPay);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: () => projectsApi.listWithOwner(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-full"],
    queryFn: () => customersApi.listFull(),
  });

  const inRange = (d?: string | null) => {
    if (!d) return !dateFrom && !dateTo;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const owners = useOwners(projects as any[]);

  const projectsForOwner = useMemo(() => {
    if (ownerSearch === "all") return projects as any[];
    return (projects as any[]).filter((p) => (p.owner_name ?? "").trim() === ownerSearch);
  }, [projects, ownerSearch]);

  const filtered = useMemo(() => {
    const hasDateFilter = !!(dateFrom || dateTo);
    const recipientQ = recipientSearch.trim().toLowerCase();
    return customers.filter((c: any) => {
      if (projectFilter !== "all" && c.project_id !== projectFilter) return false;
      if (ownerSearch !== "all" && ownerSearch && (c.project?.owner_name ?? "") !== ownerSearch) return false;
      if (recipientFilter !== "all" || recipientQ) {
        const payments = c.payments ?? [];
        const match = payments.some((p: any) => {
          const r = (p.recipient ?? "").trim();
          if (recipientFilter !== "all" && recipientFilter !== "__text__" && r !== recipientFilter) return false;
          if (recipientQ && !r.toLowerCase().includes(recipientQ)) return false;
          return true;
        });
        if (!match) return false;
      }
      if (hasDateFilter) {
        const anyMatch = (c.payments ?? []).some((p: any) => inRange(p.payment_date));
        if (!anyMatch) return false;
      }
      return true;
    });
  }, [customers, ownerSearch, projectFilter, dateFrom, dateTo, recipientFilter, recipientSearch]);

  const openNewCust = () => { setEditCustId(null); setCForm(emptyCust); setOpenCust(true); };
  const openEditCust = (c: any) => {
    setEditCustId(c.id);
    setCForm({
      name: c.name ?? "", phone: c.phone ?? "", project_id: c.project_id ?? "",
      total_amount: String(c.total_amount ?? ""), down_payment: String(c.down_payment ?? ""),
      monthly_installment: String(c.monthly_installment ?? ""),
      start_date: c.start_date ?? new Date().toISOString().slice(0, 10), notes: c.notes ?? "",
    });
    setOpenCust(true);
  };

  const saveCustomer = async () => {
    if (!cForm.name.trim()) return toast.error("اسم الزبون مطلوب");
    const down = parseFloat(cForm.down_payment) || 0;
    const payload = {
      name: cForm.name, phone: cForm.phone || null, project_id: cForm.project_id || null,
      total_amount: parseFloat(cForm.total_amount) || 0,
      down_payment: down,
      monthly_installment: parseFloat(cForm.monthly_installment) || 0,
      start_date: cForm.start_date, notes: cForm.notes || null,
    };
    try {
      let customerId = editCustId;
      if (editCustId) {
        await customersApi.update(editCustId, payload);
      } else {
        const inserted = await customersApi.create(payload);
        customerId = inserted.id;
        if (customerId && down > 0) {
          await customerPaymentsApi.create({
            customer_id: customerId,
            project_id: payload.project_id,
            amount: down,
            payment_date: payload.start_date,
            payment_method: "كاش",
            notes: "دفعة أولى",
          });
        }
      }
      toast.success(editCustId ? "تم التعديل" : "تمت الإضافة");
      setCForm(emptyCust); setEditCustId(null); setOpenCust(false);
      qc.invalidateQueries({ queryKey: ["customers-full"] });
      qc.invalidateQueries({ queryKey: ["home-stats"] });
      qc.invalidateQueries({ queryKey: ["home-payments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const openNewPay = (cid: string) => { setEditPay(null); setPForm(emptyPay); setOpenPay(cid); };
  const openEditPay = (p: any) => {
    setEditPay(p);
    setPForm({
      amount: String(p.amount), payment_method: p.payment_method, payment_date: p.payment_date,
      recipient: p.recipient ?? "", entered_by: p.entered_by ?? "", notes: p.notes ?? "",
    });
  };

  const savePayment = async (cust: any) => {
    const amt = parseFloat(pForm.amount);
    if (!amt || amt <= 0) return toast.error("المبلغ مطلوب");
    const payload = {
      customer_id: cust.id, project_id: cust.project_id, amount: amt,
      payment_date: pForm.payment_date, payment_method: pForm.payment_method,
      recipient: pForm.recipient || null, entered_by: pForm.entered_by || null, notes: pForm.notes || null,
    };
    try {
      if (editPay) await customerPaymentsApi.update(editPay.id, payload);
      else await customerPaymentsApi.create(payload);
      toast.success(editPay ? "تم تعديل الدفعة" : "تم تسجيل الدفعة");
      setPForm(emptyPay); setEditPay(null); setOpenPay(null);
      qc.invalidateQueries({ queryKey: ["customers-full"] });
      qc.invalidateQueries({ queryKey: ["home-stats"] });
      qc.invalidateQueries({ queryKey: ["home-payments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const removeCustomer = useCallback(async (id: string) => {
    await customersApi.remove(id);
    qc.invalidateQueries({ queryKey: ["customers-full"] });
    setPendingDelete(null);
  }, [qc]);

  const removePayment = useCallback(async (id: string) => {
    await customerPaymentsApi.remove(id);
    qc.invalidateQueries({ queryKey: ["customers-full"] });
    qc.invalidateQueries({ queryKey: ["home-stats"] });
    qc.invalidateQueries({ queryKey: ["home-payments"] });
    setPendingDelete(null);
  }, [qc]);

  const confirmRemoveCustomer = (id: string) => setPendingDelete({ type: "customer", id });
  const confirmRemovePayment = (id: string) => setPendingDelete({ type: "payment", id });

  const downloadInvoice = (c: any, p: any) => {
    const paid = (c.payments ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
    generateInvoice({
      type: "customer",
      number: shortId(p.id),
      date: p.payment_date,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      partyLabel: "الزبون",
      partyName: c.name,
      partyPhone: c.phone,
      projectName: c.project?.name,
      recipient: p.recipient,
      enteredBy: p.entered_by,
      notes: p.notes,
      totalAmount: Number(c.total_amount),
      paidToDate: paid,
      remaining: Number(c.total_amount) - paid,
    });
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleExport = () => {
    exportToExcel(
      filtered.map((c: any) => {
        const paid = (c.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        return {
          "الاسم": c.name, "الهاتف": c.phone, "الإسكان": c.project?.name,
          "التوتال": Number(c.total_amount), "القسط الشهري": Number(c.monthly_installment),
          "المدفوع": paid, "المتبقي": Number(c.total_amount) - paid,
        };
      }),
      "الزبائن_والأقساط",
    );
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader title="الزبائن والأقساط" subtitle="إدارة الزبائن، الذمم والأقساط الشهرية" onExport={handleExport} viewMode={view} onViewChange={setView}>
        <Dialog open={openCust} onOpenChange={(o) => { setOpenCust(o); if (!o) { setEditCustId(null); setCForm(emptyCust); } }}>
          <DialogTrigger asChild><Button onClick={openNewCust} className="gap-2"><Plus className="w-4 h-4" />زبون جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editCustId ? "تعديل زبون" : "إضافة زبون"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>الاسم</Label><Input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الهاتف</Label><Input value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>الإسكان</Label>
                <Select value={cForm.project_id} onValueChange={(v) => setCForm({ ...cForm, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>التوتال الكلي</Label><Input type="number" step="0.01" value={cForm.total_amount} onChange={(e) => setCForm({ ...cForm, total_amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الدفعة الأولى</Label><Input type="number" step="0.01" placeholder="0" value={cForm.down_payment} onChange={(e) => setCForm({ ...cForm, down_payment: e.target.value })} disabled={!!editCustId} /></div>
              </div>
              {editCustId && <p className="text-xs text-muted-foreground">الدفعة الأولى تُسجَّل تلقائياً عند إنشاء الزبون فقط. لتعديلها عدّل الدفعة من سجل الدفعات.</p>}
              <div className="space-y-1.5"><Label>القسط الشهري</Label><Input type="number" step="0.01" value={cForm.monthly_installment} onChange={(e) => setCForm({ ...cForm, monthly_installment: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>تاريخ بدء الأقساط</Label><Input type="date" value={cForm.start_date} onChange={(e) => setCForm({ ...cForm, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} /></div>
              <Button onClick={saveCustomer} className="w-full">{editCustId ? "حفظ التعديلات" : "حفظ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <OwnerFilter
            value={ownerSearch}
            onChange={(v) => { setOwnerSearch(v); setProjectFilter("all"); }}
            owners={owners}
          />
          <div className="space-y-1.5">
            <Label>الواصل</Label>
            <Select value={recipientFilter} onValueChange={setRecipientFilter}>
              <SelectTrigger><SelectValue placeholder="اختر الواصل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الواصلين</SelectItem>
                {recipientNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                <SelectItem value="__text__">بحث بالاسم...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(recipientFilter === "__text__" || recipientSearch) && (
            <div className="space-y-1.5">
              <Label>بحث بالاسم</Label>
              <Input value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} placeholder="اسم الواصل..." />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الإسكان</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإسكانات</SelectItem>
                {projectsForOwner.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {view === "table" && (
      <Card className="p-4">
        <div className="overflow-x-auto">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center"></TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الإسكان</TableHead>
                  <TableHead className="text-right">التوتال</TableHead>
                  <TableHead className="text-right">القسط الشهري</TableHead>
                  <TableHead className="text-right">المدفوع</TableHead>
                  <TableHead className="text-right">المتبقي</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا يوجد زبائن</TableCell></TableRow>
              )}
              {filtered.map((c: any) => {
                const paid = (c.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                const remaining = Number(c.total_amount) - paid;
                const isOpen = expanded.has(c.id);
                return (
                  <Fragment key={c.id}>
                    <TableRow>
                      <TableCell className="text-center"><Button size="sm" variant="ghost" onClick={() => toggle(c.id)}>{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</Button></TableCell>
                      <TableCell className="font-medium text-right">{c.name}<div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>{c.notes && <div className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{c.notes}</div>}</TableCell>
                      <TableCell className="text-right">{c.project?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.total_amount)}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.monthly_installment)}</TableCell>
                      <TableCell className="text-success font-semibold text-right">{formatMoney(paid)}</TableCell>
                      <TableCell className={`text-right ${remaining > 0 ? "text-accent font-semibold" : "text-muted-foreground"}`}>{formatMoney(remaining)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Dialog open={openPay === c.id} onOpenChange={(o) => { if (o) openNewPay(c.id); else { setOpenPay(null); setEditPay(null); setPForm(emptyPay); } }}>
                            <DialogTrigger asChild><Button size="sm">+ دفعة</Button></DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>{editPay ? `تعديل دفعة ${c.name}` : `دفعة من ${c.name}`}</DialogTitle></DialogHeader>
                              <div className="space-y-3">
                                <div className="space-y-1.5"><Label>المبلغ</Label><Input type="number" step="0.01" value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} /></div>
                                <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={pForm.payment_date} onChange={(e) => setPForm({ ...pForm, payment_date: e.target.value })} /></div>
                                <div className="space-y-1.5">
                                  <Label>طريقة الدفع</Label>
                                  <Select value={pForm.payment_method} onValueChange={(v) => setPForm({ ...pForm, payment_method: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <RecipientField value={pForm.recipient} onChange={(v) => setPForm({ ...pForm, recipient: v })} />
                                <div className="space-y-1.5"><Label>أدخلها</Label><Input value={pForm.entered_by} onChange={(e) => setPForm({ ...pForm, entered_by: e.target.value })} /></div>
                                <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} /></div>
                                <Button onClick={() => savePayment(c)} className="w-full">{editPay ? "حفظ التعديلات" : "حفظ"}</Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button size="sm" variant="ghost" onClick={() => openEditCust(c)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => confirmRemoveCustomer(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <div className="p-3">
                            <h4 className="font-semibold mb-2">سجل الدفعات السابقة</h4>
                            {(!c.payments || c.payments.length === 0) ? (
                              <p className="text-sm text-muted-foreground">لا يوجد دفعات بعد</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-right">التاريخ</TableHead>
                                    <TableHead className="text-right">المبلغ</TableHead>
                                    <TableHead className="text-right">طريقة الدفع</TableHead>
                                    <TableHead className="text-right">الواصل</TableHead>
                                    <TableHead className="text-right">أدخلها</TableHead>
                                    <TableHead className="text-right">ملاحظات</TableHead>
                                    <TableHead className="text-center"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {[...c.payments].sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date)).map((p: any) => (
                                    <TableRow key={p.id}>
                                      <TableCell className="text-right">{formatDate(p.payment_date)}</TableCell>
                                      <TableCell className="text-right">{formatMoney(p.amount)}</TableCell>
                                      <TableCell className="text-right">{p.payment_method}</TableCell>
                                      <TableCell className="text-right">{p.recipient ?? "—"}</TableCell>
                                      <TableCell className="text-right">{p.entered_by ?? "—"}</TableCell>
                                      <TableCell className="text-right text-xs">{p.notes ?? "—"}</TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex gap-1 justify-center">
                                          <Button size="sm" variant="ghost" onClick={() => downloadInvoice(c, p)} title="تنزيل سند قبض"><FileDown className="w-4 h-4 text-primary" /></Button>
                                          <Button size="sm" variant="ghost" onClick={() => { openEditPay(p); setOpenPay(c.id); }}><Pencil className="w-4 h-4" /></Button>
                                          <Button size="sm" variant="ghost" onClick={() => confirmRemovePayment(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      )}
      {view === "cards" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {filtered.length === 0 && (
            <Card className="p-8 col-span-full text-center text-muted-foreground">لا يوجد زبائن</Card>
          )}
          {filtered.map((c: any, idx: number) => {
            const paid = (c.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
            const remaining = Number(c.total_amount) - paid;
            const progress = Number(c.total_amount) > 0 ? Math.min(100, (paid / Number(c.total_amount)) * 100) : 0;
            return (
              <Card
                key={c.id}
                className="p-5 card-enter relative overflow-hidden group hover-lift transition-all duration-300"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">{c.name}</h3>
                    {c.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </p>
                    )}
                    {c.project?.name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {c.project.name}
                      </p>
                    )}
                    {c.notes && (
                      <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">{c.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={() => openEditCust(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => confirmRemoveCustomer(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <div className="text-[11px] text-muted-foreground">التوتال</div>
                    <div className="font-semibold tabular-nums">{formatMoney(c.total_amount)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <div className="text-[11px] text-muted-foreground">القسط الشهري</div>
                    <div className="font-semibold tabular-nums">{formatMoney(c.monthly_installment)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-success/10">
                    <div className="text-[11px] text-muted-foreground">المدفوع</div>
                    <div className="font-semibold tabular-nums text-success">{formatMoney(paid)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-accent/10">
                    <div className="text-[11px] text-muted-foreground">المتبقي</div>
                    <div className={`font-semibold tabular-nums ${remaining > 0 ? "text-accent" : "text-muted-foreground"}`}>{formatMoney(remaining)}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>نسبة السداد</span>
                    <span className="tabular-nums">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Dialog open={openPay === c.id} onOpenChange={(o) => { if (o) openNewPay(c.id); else { setOpenPay(null); setEditPay(null); setPForm(emptyPay); } }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="flex-1 gap-1"><Plus className="w-3.5 h-3.5" />دفعة</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editPay ? `تعديل دفعة ${c.name}` : `دفعة من ${c.name}`}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5"><Label>المبلغ</Label><Input type="number" step="0.01" value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={pForm.payment_date} onChange={(e) => setPForm({ ...pForm, payment_date: e.target.value })} /></div>
                        <div className="space-y-1.5">
                          <Label>طريقة الدفع</Label>
                          <Select value={pForm.payment_method} onValueChange={(v) => setPForm({ ...pForm, payment_method: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <RecipientField value={pForm.recipient} onChange={(v) => setPForm({ ...pForm, recipient: v })} />
                        <div className="space-y-1.5"><Label>أدخلها</Label><Input value={pForm.entered_by} onChange={(e) => setPForm({ ...pForm, entered_by: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} /></div>
                        <Button onClick={() => savePayment(c)} className="w-full">{editPay ? "حفظ التعديلات" : "حفظ"}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="outline" onClick={() => toggle(c.id)} className="gap-1">
                    {expanded.has(c.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    الدفعات ({c.payments?.length ?? 0})
                  </Button>
                </div>

                {expanded.has(c.id) && (
                  <div className="mt-3 pt-3 border-t space-y-2 max-h-60 overflow-y-auto">
                    {(!c.payments || c.payments.length === 0) ? (
                      <p className="text-xs text-muted-foreground text-center py-2">لا يوجد دفعات بعد</p>
                    ) : (
                      [...c.payments].sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date)).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-muted/30">
                          <div className="min-w-0">
                            <div className="font-semibold text-success tabular-nums">{formatMoney(p.amount)}</div>
                            <div className="text-muted-foreground truncate">{formatDate(p.payment_date)} · {p.payment_method}</div>
                            {p.notes && <div className="text-muted-foreground/70 mt-0.5 line-clamp-1">{p.notes}</div>}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadInvoice(c, p)} title="تنزيل سند قبض"><FileDown className="w-3.5 h-3.5 text-primary" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { openEditPay(p); setOpenPay(c.id); }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmRemovePayment(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete?.type === "customer" ? "حذف الزبون" : "حذف الدفعة"}
        message={pendingDelete?.type === "customer" ? "حذف الزبون وكل دفعاته؟" : "حذف الدفعة؟"}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.type === "customer") removeCustomer(pendingDelete.id);
          else removePayment(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
