import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Building2, MapPin, User, Calendar, Users, CreditCard, StickyNote } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excel";
import { formatDate, formatMoney } from "@/lib/format";
import { useViewMode } from "@/hooks/useViewMode";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useOwners } from "@/hooks/useOwners";
import { OwnerFilter } from "@/components/OwnerFilter";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

const empty = { name: "", location: "", owner_name: "", notes: "" };

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [view, setView] = useViewMode("projects", "cards");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [ownerSearch, setOwnerSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
  });

  const { data: statsMap = {} } = useQuery({
    queryKey: ["projects-stats"],
    queryFn: () => projectsApi.stats(),
  });

  const owners = useOwners(rows as any[]);

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (ownerSearch && (r.owner_name ?? "").trim() !== ownerSearch) return false;
      if (dateFrom && r.created_at && r.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.created_at && r.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [rows, ownerSearch, dateFrom, dateTo]);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({ name: r.name ?? "", location: r.location ?? "", owner_name: r.owner_name ?? "", notes: r.notes ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("اسم الإسكان مطلوب");
    const payload = { name: form.name, location: form.location || null, owner_name: form.owner_name || null, notes: form.notes || null };
    try {
      if (editId) await projectsApi.update(editId, payload);
      else await projectsApi.create(payload);
      toast.success(editId ? "تم التعديل" : "تم الإضافة");
      setForm(empty); setEditId(null); setOpen(false);
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const remove = useCallback(async (id: string) => {
    try {
      await projectsApi.remove(id);
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setPendingDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
      setPendingDelete(null);
    }
  }, [qc]);

  const confirmRemove = (id: string) => setPendingDelete(id);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader
        title="الإسكانات / المشاريع"
        subtitle="إدارة جميع الإسكانات والمشاريع"
        viewMode={view}
        onViewChange={setView}
        onExport={() =>
          exportToExcel(
            filtered.map((r: any) => ({
              "الاسم": r.name, "الموقع": r.location, "المالك": r.owner_name, "ملاحظات": r.notes,
              "تاريخ الإضافة": formatDate(r.created_at),
            })),
            "الإسكانات",
          )
        }
      >
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />إضافة إسكان</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "تعديل إسكان" : "إضافة إسكان جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="اسم الإسكان"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="الموقع"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <Field label="اسم المالك"><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></Field>
              <Field label="ملاحظات"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Button onClick={save} className="w-full">{editId ? "حفظ التعديلات" : "حفظ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <OwnerFilter
            value={ownerSearch || "all"}
            onChange={(v) => setOwnerSearch(v === "all" ? "" : v)}
            owners={owners}
          />
          <div className="space-y-1.5">
            <Label>من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {view === "table" ? (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الموقع</TableHead>
                  <TableHead className="text-right">المالك</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد إسكانات مطابقة.</TableCell></TableRow>
                )}
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-right">{r.name}</TableCell>
                    <TableCell className="text-right">{r.location ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.owner_name ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatDate(r.created_at)}</TableCell>
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
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {filtered.length === 0 && (
            <Card className="p-8 col-span-full text-center text-muted-foreground">لا توجد إسكانات مطابقة.</Card>
          )}
          {filtered.map((r: any, idx: number) => (
            <Card
              key={r.id}
              onClick={() => setExpandedId(r.id)}
              className="p-5 card-enter relative overflow-hidden group cursor-pointer hover-lift transition-all duration-300"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">{r.name}</h3>
                    {r.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {r.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); confirmRemove(r.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  <span className="text-foreground">{r.owner_name ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(r.created_at)}</span>
                </div>
                {r.notes && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/50 mt-2">
                    <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{r.notes}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!expandedId} onOpenChange={(o) => !o && setExpandedId(null)}>
        <DialogContent className="max-w-2xl">
          {(() => {
            const r = rows.find((x: any) => x.id === expandedId);
            if (!r) return null;
            const s = (statsMap as any)[r.id] ?? { customers: 0, due: 0, paid: 0 };
            const remaining = s.due - s.paid;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{r.name}</div>
                      {r.location && (
                        <div className="text-xs font-normal text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {r.location}
                        </div>
                      )}
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span className="text-foreground">{r.owner_name ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat icon={Users} label="عدد الزبائن" value={String(s.customers)} />
                    <Stat icon={CreditCard} label="إجمالي العقود" value={formatMoney(s.due)} />
                    <Stat icon={CreditCard} label="المحصّل" value={formatMoney(s.paid)} tone="success" />
                    <Stat icon={CreditCard} label="المتبقي" value={formatMoney(remaining)} tone="accent" />
                  </div>
                  {r.notes && (
                    <div className="flex gap-2 text-sm p-3 rounded-lg bg-muted/50">
                      <StickyNote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-foreground whitespace-pre-wrap">{r.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => { openEdit(r); setExpandedId(null); }}>
                      <Pencil className="w-4 h-4" /> تعديل
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive" onClick={() => { confirmRemove(r.id); setExpandedId(null); }}>
                      <Trash2 className="w-4 h-4" /> حذف
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!pendingDelete}
        title="حذف الإسكان"
        message="حذف الإسكان؟ سيتم حذف كل البيانات المرتبطة."
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" | "accent" }) {
  const color = tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border/50 animate-fade-in">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
