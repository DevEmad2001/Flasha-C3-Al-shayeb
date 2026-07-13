import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { scheduleApi, projectsApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useMemo } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { AlertCircle, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { useOwners } from "@/hooks/useOwners";
import { OwnerFilter } from "@/components/OwnerFilter";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });

type Row = {
  customer_id: string;
  customer_name: string;
  project_name: string | null;
  project_id: string | null;
  installment_no: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining: number;
  status: "paid" | "partial" | "pending" | "late";
};

type CustomerGroup = {
  customer_id: string;
  customer_name: string;
  project_name: string | null;
  project_id: string | null;
  total_due: number;
  total_paid: number;
  total_remaining: number;
  late_count: number;
  paid_count: number;
  installments: Row[];
  status: "paid" | "partial" | "pending" | "late";
};

function addMonths(iso: string, n: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function SchedulePage() {
  const [projectF, setProjectF] = useState<string>("all");
  const [customerF, setCustomerF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [ownerF, setOwnerF] = useState<string>("all");
  const [nameSearch, setNameSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["schedule-data"],
    queryFn: () => scheduleApi.data(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: () => projectsApi.listWithOwner(),
  });

  const owners = useOwners(projects as any[]);

  const projectsForOwner = useMemo(() => {
    if (ownerF === "all") return (data?.projects ?? []) as any[];
    return (projects as any[]).filter((p) => (p.owner_name ?? "").trim() === ownerF);
  }, [ownerF, projects, data?.projects]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const today = new Date().toISOString().slice(0, 10);
    const paidByCustomer = new Map<string, number>();
    for (const p of data.payments as any[]) {
      paidByCustomer.set(p.customer_id, (paidByCustomer.get(p.customer_id) ?? 0) + Number(p.amount));
    }
    const out: Row[] = [];
    for (const c of data.customers as any[]) {
      const total = Number(c.total_amount);
      const down = Number(c.down_payment ?? 0);
      const inst = Number(c.monthly_installment);
      const base = Math.max(0, total - down);
      if (!inst || inst <= 0 || !c.start_date || base <= 0) continue;
      const count = Math.ceil(base / inst);
      let paidPool = Math.max(0, (paidByCustomer.get(c.id) ?? 0) - down);
      let allocated = 0;
      for (let i = 0; i < count; i++) {
        const due = i === count - 1 ? base - allocated : inst;
        const dueDate = addMonths(c.start_date, i);
        const paidForThis = Math.min(paidPool, due);
        paidPool -= paidForThis;
        allocated += due;
        const remaining = due - paidForThis;
        let status: Row["status"];
        if (remaining <= 0.001) status = "paid";
        else if (paidForThis > 0) status = "partial";
        else if (dueDate < today) status = "late";
        else status = "pending";
        out.push({
          customer_id: c.id,
          customer_name: c.name,
          project_name: c.project?.name ?? null,
          project_id: c.project_id ?? null,
          installment_no: i + 1,
          due_date: dueDate,
          amount_due: due,
          amount_paid: paidForThis,
          remaining,
          status,
        });
      }
    }
    return out;
  }, [data]);

  const groups = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();
    for (const r of rows) {
      let g = map.get(r.customer_id);
      if (!g) {
        g = {
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          project_name: r.project_name,
          project_id: r.project_id,
          total_due: 0, total_paid: 0, total_remaining: 0,
          late_count: 0, paid_count: 0,
          installments: [],
          status: "pending",
        };
        map.set(r.customer_id, g);
      }
      g.installments.push(r);
      g.total_due += r.amount_due;
      g.total_paid += r.amount_paid;
      g.total_remaining += r.remaining;
      if (r.status === "late") g.late_count++;
      if (r.status === "paid") g.paid_count++;
    }
    for (const g of map.values()) {
      g.installments.sort((a, b) => a.due_date.localeCompare(b.due_date));
      if (g.total_remaining <= 0.001) g.status = "paid";
      else if (g.late_count > 0) g.status = "late";
      else if (g.total_paid > 0) g.status = "partial";
      else g.status = "pending";
    }
    return Array.from(map.values()).sort((a, b) => a.customer_name.localeCompare(b.customer_name, "ar"));
  }, [rows]);

  const filteredGroups = useMemo(() => {
    const nameQ = nameSearch.trim().toLowerCase();
    return groups.filter((g) => {
      if (projectF !== "all" && g.project_id !== projectF) return false;
      if (customerF !== "all" && g.customer_id !== customerF) return false;
      if (statusF !== "all" && g.status !== statusF) return false;
      if (ownerF !== "all") {
        const owner = g.project_id
          ? (projects as any[]).find((p) => p.id === g.project_id)?.owner_name?.trim()
          : null;
        if (owner !== ownerF) return false;
      }
      if (nameQ && !g.customer_name.toLowerCase().includes(nameQ)) return false;
      return true;
    });
  }, [groups, projectF, customerF, statusF, ownerF, nameSearch, projects]);

  const customersForProject = useMemo(
    () => (projectF === "all" ? groups : groups.filter((g) => g.project_id === projectF)),
    [groups, projectF],
  );

  const stats = useMemo(() => {
    return filteredGroups.reduce(
      (a, g) => {
        a.due += g.total_due;
        a.paid += g.total_paid;
        a.remaining += g.total_remaining;
        a.lateCount += g.late_count;
        return a;
      },
      { due: 0, paid: 0, remaining: 0, lateCount: 0 },
    );
  }, [filteredGroups]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader title="جدول استحقاق الأقساط" subtitle="الأقساط الشهرية المستحقة على كل زبون"
        onExport={() => exportToExcel(filteredGroups.flatMap((g) => g.installments).map((r) => ({
          "الزبون": r.customer_name, "المشروع": r.project_name, "رقم القسط": r.installment_no,
          "تاريخ الاستحقاق": formatDate(r.due_date), "المستحق": Number(r.amount_due),
          "المدفوع": Number(r.amount_paid), "المتبقي": Number(r.remaining),
          "الحالة": { paid: "مدفوع", partial: "جزئي", late: "متأخر", pending: "قادم" }[r.status],
        })), "جدول_الأقساط")} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label="إجمالي المستحق" value={formatMoney(stats.due)} />
        <StatCard label="المدفوع" value={formatMoney(stats.paid)} tone="success" />
        <StatCard label="المتبقي" value={formatMoney(stats.remaining)} tone="warning" />
        <StatCard label="أقساط متأخرة" value={String(stats.lateCount)} tone="destructive" />
      </div>

      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          <OwnerFilter value={ownerF} onChange={(v) => { setOwnerF(v); setProjectF("all"); }} owners={owners} />
          <div className="space-y-1.5">
            <Label>بحث باسم الزبون</Label>
            <Input value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} placeholder="اسم الزبون..." />
          </div>
          <div className="space-y-1.5">
            <Label>الإسكان</Label>
            <Select value={projectF} onValueChange={(v) => { setProjectF(v); setCustomerF("all"); }}>
              <SelectTrigger><SelectValue placeholder="اختر الإسكان" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإسكانات</SelectItem>
                {projectsForOwner.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الزبون</Label>
            <Select value={customerF} onValueChange={setCustomerF}>
              <SelectTrigger><SelectValue placeholder="اختر الزبون" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الزبائن</SelectItem>
                {customersForProject.map((g) => (
                  <SelectItem key={g.customer_id} value={g.customer_id}>{g.customer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="late">متأخر</SelectItem>
                <SelectItem value="pending">قادم</SelectItem>
                <SelectItem value="partial">جزئي</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {filteredGroups.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا يوجد زبائن. تأكد من إدخال تاريخ البدء وقيمة القسط.</Card>
      ) : (
        <div className={openId ? "" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"} dir="rtl">
          {(openId ? filteredGroups.filter((g) => g.customer_id === openId) : filteredGroups).map((g) => (
            <CustomerCard
              key={g.customer_id}
              group={g}
              open={openId === g.customer_id}
              onToggle={(v) => setOpenId(v ? g.customer_id : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCard({ group: g, open, onToggle }: { group: CustomerGroup; open: boolean; onToggle: (v: boolean) => void }) {
  const borderTone =
    g.status === "late" ? "border-destructive/40" :
    g.status === "paid" ? "border-success/40" :
    g.status === "partial" ? "border-warning/40" : "border-border/70";
  const progress = g.total_due > 0 ? Math.min(100, (g.total_paid / g.total_due) * 100) : 0;
  return (
    <Card className={`p-4 rounded-2xl border ${borderTone} shadow-card transition-all text-right`}>
      <Collapsible open={open} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full text-right">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base truncate">{g.customer_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {g.project_name ?? "—"} · {g.paid_count}/{g.installments.length} قسط
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusBadge status={g.status} />
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 rounded-lg bg-muted/40 min-w-0">
              <div className="text-[9px] text-muted-foreground">المستحق (د.أ)</div>
              <div className="font-semibold text-[11px] tabular-nums leading-tight">{Number(g.total_due).toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-success/10 min-w-0">
              <div className="text-[9px] text-muted-foreground">المدفوع (د.أ)</div>
              <div className="font-semibold text-[11px] tabular-nums leading-tight text-success">{Number(g.total_paid).toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-accent/10 min-w-0">
              <div className="text-[9px] text-muted-foreground">المتبقي (د.أ)</div>
              <div className="font-semibold text-[11px] tabular-nums leading-tight text-accent">{Number(g.total_remaining).toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="hidden sm:grid grid-cols-[28px_1fr_1fr_1fr_auto] gap-2 px-2 pb-1.5 text-[10px] font-medium text-muted-foreground">
              <div className="text-center">#</div>
              <div className="text-right">الاستحقاق</div>
              <div className="text-right tabular-nums">المستحق</div>
              <div className="text-right tabular-nums">المدفوع</div>
              <div className="text-center">الحالة</div>
            </div>
            <div className="space-y-1.5">
              {g.installments.map((r) => (
                <div key={r.installment_no}>
                  <div className="hidden sm:grid grid-cols-[28px_1fr_1fr_1fr_auto] items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                    <div className="text-center font-bold text-muted-foreground">{r.installment_no}</div>
                    <div className="text-right text-muted-foreground truncate">{formatDate(r.due_date)}</div>
                    <div className="text-right tabular-nums truncate">{formatMoney(r.amount_due)}</div>
                    <div className="text-right tabular-nums truncate text-success">{formatMoney(r.amount_paid)}</div>
                    <div className="flex justify-center"><StatusBadge status={r.status} /></div>
                  </div>
                  <div className="sm:hidden p-3 rounded-lg bg-muted/30 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-muted-foreground">قسط #{r.installment_no}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground">الاستحقاق</div>
                        <div>{formatDate(r.due_date)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">المستحق</div>
                        <div className="tabular-nums">{formatMoney(r.amount_due)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-muted-foreground">المدفوع</div>
                        <div className="tabular-nums text-success">{formatMoney(r.amount_paid)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-accent" : tone === "destructive" ? "text-destructive" : "";
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${cls}`}>{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map = {
    paid: { label: "مدفوع", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
    partial: { label: "جزئي", cls: "bg-warning/20 text-warning-foreground", Icon: Clock },
    pending: { label: "قادم", cls: "bg-secondary text-secondary-foreground", Icon: Clock },
    late: { label: "متأخر", cls: "bg-destructive/15 text-destructive", Icon: AlertCircle },
  }[status];
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${map.cls}`}><map.Icon className="w-3 h-3" />{map.label}</span>;
}
