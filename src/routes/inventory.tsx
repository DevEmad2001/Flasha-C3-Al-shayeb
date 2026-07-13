import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, projectsApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Pencil, Info, Package } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { useViewMode } from "@/hooks/useViewMode";
import { exportToExcel } from "@/lib/excel";
import { ConfirmModal } from "@/components/ConfirmModal";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

const emptyItem = { name: "", unit: "", quantity: "0", notes: "" };
const emptyMove = { item_id: "", movement_type: "in" as "in" | "out", quantity: "", project_id: "", entered_by: "", movement_date: new Date().toISOString().slice(0, 10), notes: "" };

function InventoryPage() {
  const qc = useQueryClient();
  const [openItem, setOpenItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [openMove, setOpenMove] = useState(false);
  const [editMoveId, setEditMoveId] = useState<string | null>(null);
  const [iForm, setIForm] = useState(emptyItem);
  const [mForm, setMForm] = useState(emptyMove);
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("inventory-items", "cards");
  const [movItem, setMovItem] = useState<string>("all");
  const [movProject, setMovProject] = useState<string>("all");
  const [fromMonth, setFromMonth] = useState<string>("all");
  const [fromYear, setFromYear] = useState<string>("all");
  const [toMonth, setToMonth] = useState<string>("all");
  const [toYear, setToYear] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<{ type: "item" | "movement"; id: string } | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeProject, setCloseProject] = useState<string>("");
  const [closeMonth, setCloseMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [closeYear, setCloseYear] = useState<string>(String(new Date().getFullYear()));

  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => inventoryApi.items(),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: () => projectsApi.listMinimal(),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => inventoryApi.movements(),
  });

  const filteredItems = items.filter((i: any) => i.name.toLowerCase().includes(search.toLowerCase()));

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const m of movements as any[]) set.add(new Date(m.movement_date).getFullYear());
    const cur = new Date().getFullYear();
    set.add(cur); set.add(cur - 1);
    return Array.from(set).sort((a, b) => b - a);
  }, [movements]);

  const MONTHS = [
    "يناير","فبراير","مارس","أبريل","مايو","يونيو",
    "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
  ];

  const dateBounds = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    let from: string | null = null;
    let to: string | null = null;
    if (fromYear !== "all") {
      const m = fromMonth === "all" ? 1 : parseInt(fromMonth);
      from = `${fromYear}-${pad(m)}-01`;
    }
    if (toYear !== "all") {
      const m = toMonth === "all" ? 12 : parseInt(toMonth);
      const last = new Date(parseInt(toYear), m, 0).getDate();
      to = `${toYear}-${pad(m)}-${pad(last)}`;
    }
    return { from, to };
  }, [fromMonth, fromYear, toMonth, toYear]);

  const filteredMovements = useMemo(() => {
    return (movements as any[]).filter((m) => {
      if (movItem !== "all" && m.item_id !== movItem) return false;
      if (movProject !== "all" && m.project_id !== movProject) return false;
      if (dateBounds.from && m.movement_date < dateBounds.from) return false;
      if (dateBounds.to && m.movement_date > dateBounds.to) return false;
      return true;
    });
  }, [movements, movItem, movProject, dateBounds]);

  const exportMovements = (rows: any[], name: string) =>
    exportToExcel(rows.map((m: any) => ({
      "التاريخ": formatDate(m.movement_date), "المادة": m.item?.name, "النوع": m.movement_type === "in" ? "دخول" : "خروج",
      "الكمية": Number(m.quantity), "الوحدة": m.item?.unit ?? "", "المشروع": m.project?.name ?? "—",
      "أدخلها": m.entered_by ?? "", "ملاحظات": m.notes ?? "",
    })), name);

  const runClosure = () => {
    if (!closeProject) return toast.error("اختر الإسكان");
    const m = parseInt(closeMonth);
    const y = parseInt(closeYear);
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${y}-${pad(m)}-01`;
    const last = new Date(y, m, 0).getDate();
    const to = `${y}-${pad(m)}-${pad(last)}`;
    const rows = (movements as any[]).filter((mv) =>
      mv.project_id === closeProject && mv.movement_date >= from && mv.movement_date <= to,
    );
    if (rows.length === 0) return toast.error("لا توجد حركات لهذا الإسكان في الفترة");
    const projName = (projects as any[]).find((p: any) => p.id === closeProject)?.name ?? "مشروع";
    exportMovements(rows, `قفل_${projName}_${y}_${pad(m)}`);
    toast.success("تم تصدير ملف الإقفال");
    setCloseOpen(false);
  };

  const openNewItem = () => { setEditItemId(null); setIForm(emptyItem); setOpenItem(true); };
  const openEditItem = (i: any) => {
    setEditItemId(i.id);
    setIForm({ name: i.name, unit: i.unit ?? "", quantity: String(i.quantity), notes: i.notes ?? "" });
    setOpenItem(true);
  };

  const saveItem = async () => {
    if (!iForm.name.trim()) return toast.error("الاسم مطلوب");
    try {
      if (editItemId) {
        await inventoryApi.updateItem(editItemId, { name: iForm.name, unit: iForm.unit || null, notes: iForm.notes || null });
        toast.success("تم التعديل");
      } else {
        await inventoryApi.createItem({
          name: iForm.name, unit: iForm.unit || null, quantity: parseFloat(iForm.quantity) || 0, notes: iForm.notes || null,
        });
        toast.success("تمت الإضافة");
      }
      setIForm(emptyItem); setEditItemId(null); setOpenItem(false);
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const openNewMove = () => { setEditMoveId(null); setMForm(emptyMove); setOpenMove(true); };
  const openEditMove = (m: any) => {
    setEditMoveId(m.id);
    setMForm({
      item_id: m.item_id, movement_type: m.movement_type, quantity: String(m.quantity),
      project_id: m.project_id ?? "", entered_by: m.entered_by ?? "",
      movement_date: m.movement_date, notes: m.notes ?? "",
    });
    setOpenMove(true);
  };

  const saveMovement = async () => {
    if (!mForm.item_id) return toast.error("اختر المادة");
    const q = parseFloat(mForm.quantity);
    if (!q || q <= 0) return toast.error("الكمية مطلوبة");
    if (mForm.movement_type === "in") {
      const item = items.find((i: any) => i.id === mForm.item_id);
      if (item && Number(item.quantity) < q) {
        return toast.error(`الكمية في المستودع غير كافية. المتوفر: ${Number(item.quantity)}`);
      }
    }
    const payload = {
      item_id: mForm.item_id, movement_type: mForm.movement_type, quantity: q,
      project_id: mForm.project_id || null, movement_date: mForm.movement_date,
      entered_by: mForm.entered_by || null, notes: mForm.notes || null,
    };
    try {
      if (editMoveId) await inventoryApi.updateMovement(editMoveId, payload);
      else await inventoryApi.createMovement(payload);
      toast.success(editMoveId ? "تم تعديل الحركة" : "تمت الحركة");
      setMForm(emptyMove); setEditMoveId(null); setOpenMove(false);
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const removeItem = useCallback(async (id: string) => {
    await inventoryApi.removeItem(id);
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    setPendingDelete(null);
  }, [qc]);

  const removeMovement = useCallback(async (id: string) => {
    await inventoryApi.removeMovement(id);
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    setPendingDelete(null);
  }, [qc]);

  const confirmRemoveItem = (id: string) => setPendingDelete({ type: "item", id });
  const confirmRemoveMovement = (id: string) => setPendingDelete({ type: "movement", id });

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader title="مواد البناء" subtitle="إدارة المواد المتوفرة وحركات الدخول/الخروج"
        onExport={() => exportToExcel(items.map((i: any) => ({ "الاسم": i.name, "الوحدة": i.unit, "الكمية": Number(i.quantity) })), "مواد_البناء")}>
        <Dialog open={openItem} onOpenChange={(o) => { setOpenItem(o); if (!o) { setEditItemId(null); setIForm(emptyItem); } }}>
          <DialogTrigger asChild><Button onClick={openNewItem} variant="outline" className="gap-2"><Plus className="w-4 h-4" />مادة جديدة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItemId ? "تعديل مادة" : "إضافة مادة"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>الاسم</Label><Input value={iForm.name} onChange={(e) => setIForm({ ...iForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>الوحدة (مثل: كيس، م³)</Label><Input value={iForm.unit} onChange={(e) => setIForm({ ...iForm, unit: e.target.value })} /></div>
              {!editItemId && (
                <div className="space-y-1.5"><Label>الكمية المبدئية</Label><Input type="number" step="0.01" value={iForm.quantity} onChange={(e) => setIForm({ ...iForm, quantity: e.target.value })} /></div>
              )}
              <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={iForm.notes} onChange={(e) => setIForm({ ...iForm, notes: e.target.value })} /></div>
              {editItemId && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">الكمية تتعدل تلقائياً من خلال تبويب "الحركات" (دخول/خروج).</p>
              )}
              <Button onClick={saveItem} className="w-full">{editItemId ? "حفظ التعديلات" : "حفظ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={openMove} onOpenChange={(o) => { setOpenMove(o); if (!o) { setEditMoveId(null); setMForm(emptyMove); } }}>
          <DialogTrigger asChild><Button onClick={openNewMove} className="gap-2"><Plus className="w-4 h-4" />حركة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editMoveId ? "تعديل حركة" : "حركة جرد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>المادة</Label>
                <Select value={mForm.item_id} onValueChange={(v) => setMForm({ ...mForm, item_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{items.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>نوع الحركة</Label>
                <Select value={mForm.movement_type} onValueChange={(v: any) => setMForm({ ...mForm, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">دخول للسكن (صرف)</SelectItem>
                    <SelectItem value="out">رجيع من السكن</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>الكمية</Label><Input type="number" step="0.01" value={mForm.quantity} onChange={(e) => setMForm({ ...mForm, quantity: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={mForm.movement_date} onChange={(e) => setMForm({ ...mForm, movement_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>المشروع</Label>
                <Select value={mForm.project_id} onValueChange={(v) => setMForm({ ...mForm, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>أدخلها</Label><Input value={mForm.entered_by} onChange={(e) => setMForm({ ...mForm, entered_by: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={mForm.notes} onChange={(e) => setMForm({ ...mForm, notes: e.target.value })} /></div>
              <Button onClick={saveMovement} className="w-full">{editMoveId ? "حفظ التعديلات" : "حفظ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
        <div className="flex gap-3 items-start">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">كيف تعمل صفحة مواد البناء؟</p>
            <p className="text-muted-foreground">
              <b>المواد:</b> سجّل المواد اللي عندك بالمستودع (إسمنت، حديد، طوب...) مع الكمية الحالية.
              <br />
              <b>الحركات:</b>
              <br />
              <b>دخول للسكن (صرف):</b> تاخذ كمية من المستودع وتضيفها للسكن — بتنقص من المستودع.
              <br />
              <b>رجيع من السكن:</b> ترجع كمية فاضية من السكن للمستودع — بتزيد في المستودع.
              <br />
              يمكنك ربط الحركة بمشروع معين لمعرفة كم استهلك كل إسكان من كل مادة.
            </p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="moves">
        <TabsList>
          <TabsTrigger value="moves">الحركات</TabsTrigger>
          <TabsTrigger value="items">المواد</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <Input className="max-w-xs" placeholder="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
                <button type="button" onClick={() => setView("table")}
                  className={`px-3 py-1 text-xs rounded transition-all ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>جدول</button>
                <button type="button" onClick={() => setView("cards")}
                  className={`px-3 py-1 text-xs rounded transition-all ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>بطاقات</button>
              </div>
            </div>
            {view === "table" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الوحدة</TableHead>
                    <TableHead className="text-right">الكمية الحالية</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد مواد</TableCell></TableRow>}
                  {filteredItems.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium text-right">{i.name}</TableCell>
                      <TableCell className="text-right">{i.unit ?? "—"}</TableCell>
                      <TableCell className="font-bold text-right">{Number(i.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground/70 max-w-[160px] truncate">{i.notes ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="ghost" onClick={() => openEditItem(i)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => confirmRemoveItem(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredItems.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-8">لا يوجد مواد</p>
                )}
                {filteredItems.map((i: any, idx: number) => {
                  const qty = Number(i.quantity);
                  const low = qty <= 0;
                  return (
                    <Card key={i.id}
                      className="p-3 card-enter hover-lift group relative overflow-hidden text-right"
                      style={{ animationDelay: `${idx * 30}ms` }}>
                      <div className={`absolute top-0 left-0 right-0 h-1 ${low ? "bg-destructive" : "bg-gradient-primary"}`} />
                      <div className="flex items-start justify-between gap-2 mt-1">
                        <div className="p-1.5 rounded-lg bg-accent/10 text-accent shrink-0">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        {low && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">نفدت</span>}
                      </div>
                      <h4 className="font-bold text-sm mt-2 truncate text-right">{i.name}</h4>
                      <div className="mt-1.5 text-right">
                        <p className="text-xl font-bold tabular-nums leading-tight">{qty.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">{i.unit ?? "—"}</p>
                      </div>
                      {i.notes && <p className="text-[11px] text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">{i.notes}</p>}
                      <div className="mt-2 flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditItem(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmRemoveItem(i.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

            )}
          </Card>
        </TabsContent>
        <TabsContent value="moves">
          <Card className="p-4">
            <div className="space-y-2 mb-3">
              <div className="space-y-1">
                <Label className="text-xs">المادة</Label>
                <Select value={movItem} onValueChange={setMovItem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المواد</SelectItem>
                    {items.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الإسكان / المشروع</Label>
                <Select value={movProject} onValueChange={setMovProject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الإسكانات</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2 space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">من</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={fromMonth} onValueChange={setFromMonth}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="الشهر" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الشهور</SelectItem>
                        {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={fromYear} onValueChange={setFromYear}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="السنة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل السنوات</SelectItem>
                        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">إلى</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={toMonth} onValueChange={setToMonth}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="الشهر" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الشهور</SelectItem>
                        {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={toYear} onValueChange={setToYear}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="السنة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل السنوات</SelectItem>
                        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-3">
              <p className="text-xs text-muted-foreground shrink-0">{filteredMovements.length} حركة</p>
              <div className="flex gap-2 flex-1 justify-end">
                <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">إقفال مشروع</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>إقفال شهر لمشروع</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>الإسكان</Label>
                        <Select value={closeProject} onValueChange={setCloseProject}>
                          <SelectTrigger><SelectValue placeholder="اختر الإسكان" /></SelectTrigger>
                          <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>الشهر</Label>
                          <Select value={closeMonth} onValueChange={setCloseMonth}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>السنة</Label>
                          <Select value={closeYear} onValueChange={setCloseYear}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={runClosure} className="w-full">تصدير ملف الإقفال</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => exportMovements(filteredMovements, "حركات_مواد_البناء")}>تصدير Excel</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" dir="rtl">
              {filteredMovements.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">لا توجد حركات</p>
              )}
              {filteredMovements.map((m: any) => {
                const isIn = m.movement_type === "in";
                return (
                  <Card key={m.id} className="p-3 text-right relative overflow-hidden">
                    <div className={`absolute top-0 right-0 left-0 h-1 ${isIn ? "bg-success" : "bg-destructive"}`} />
                    <div className="flex items-start justify-between gap-2 mt-1">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate">{m.item?.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{formatDate(m.movement_date)}</p>
                      </div>
                      {isIn
                        ? <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full shrink-0"><ArrowDownCircle className="w-3.5 h-3.5" />دخول</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full shrink-0"><ArrowUpCircle className="w-3.5 h-3.5" />خروج</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground text-[10px]">الكمية</p>
                        <p className="font-bold tabular-nums">{Number(m.quantity)} {m.item?.unit ?? ""}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-[10px]">المشروع</p>
                        <p className="font-medium truncate">{m.project?.name ?? "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-[10px]">أدخلها</p>
                        <p className="font-medium truncate">{m.entered_by ?? "—"}</p>
                      </div>
                      {m.notes && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-[10px]">ملاحظات</p>
                          <p className="text-xs">{m.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-0.5 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditMove(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmRemoveMovement(m.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete?.type === "item" ? "حذف المادة" : "حذف الحركة"}
        message={pendingDelete?.type === "item" ? "حذف المادة وكل حركاتها؟" : "حذف الحركة؟ سيتم تعديل الكمية الحالية تلقائياً."}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.type === "item") removeItem(pendingDelete.id);
          else removeMovement(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
