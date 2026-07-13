import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  customerPaymentsApi,
  customersApi,
  externalExpensesApi,
  inventoryApi,
  projectExpensePaymentsApi,
  projectsApi,
} from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import * as XLSX from "xlsx";
import {
  Users,
  Package,
  Receipt,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOwners } from "@/hooks/useOwners";
import { OwnerFilter } from "@/components/OwnerFilter";

const ALL = "__all__";

export const Route = createFileRoute("/stocktake")({ component: StocktakePage });

function StocktakePage() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const [start, setStart] = useState(firstOfMonth);
  const [end, setEnd] = useState(today);
  const [ownerFilter, setOwnerFilter] = useState<string>(ALL);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [customerId, setCustomerId] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [itemId, setItemId] = useState<string>(ALL);

  // ---------- reference data ----------
  const { data: projects = [] } = useQuery({
    queryKey: ["st-projects"],
    queryFn: () => projectsApi.listWithOwner(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["st-customers"],
    queryFn: () => customersApi.listStocktake(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["st-items"],
    queryFn: () => inventoryApi.items(),
  });

  const owners = useOwners(projects as any[]);

  const projectsForOwner = useMemo(() => {
    if (ownerFilter === ALL) return projects;
    return projects.filter((p: any) => (p.owner_name ?? "").trim() === ownerFilter);
  }, [projects, ownerFilter]);

  const ownerProjectIds = useMemo(
    () => new Set(projectsForOwner.map((p: any) => p.id)),
    [projectsForOwner],
  );

  const matchesOwner = (pid: string | null | undefined) =>
    ownerFilter === ALL || (pid != null && ownerProjectIds.has(pid));

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i: any) => i.category && s.add(i.category));
    return Array.from(s).sort();
  }, [items]);

  // Filter customer dropdown by project
  const customersForProject = useMemo(() => {
    let list = customers;
    if (ownerFilter !== ALL) list = list.filter((c: any) => ownerProjectIds.has(c.project_id));
    if (projectId !== ALL) list = list.filter((c: any) => c.project_id === projectId);
    return list;
  }, [customers, projectId, ownerFilter, ownerProjectIds]);

  // ---------- queries ----------
  const { data: payments = [] } = useQuery({
    queryKey: ["st-payments", start, end, projectId, customerId],
    queryFn: async () => {
      const data = await customerPaymentsApi.list({
        start,
        end,
        include_relations: true,
        ...(projectId !== ALL ? { project_id: projectId } : {}),
        ...(customerId !== ALL ? { customer_id: customerId } : {}),
      });
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["st-movements", start, end, projectId, category, itemId],
    queryFn: async () => {
      let rows = await inventoryApi.movements({
        start,
        end,
        ...(projectId !== ALL ? { project_id: projectId } : {}),
        ...(itemId !== ALL ? { item_id: itemId } : {}),
      });
      if (category !== ALL) rows = rows.filter((r) => r.item?.category === category);
      return rows;
    },
  });

  const { data: projExpenses = [] } = useQuery({
    queryKey: ["st-proj-expenses", start, end, projectId, category],
    queryFn: async () => {
      let rows = await projectExpensePaymentsApi.list({
        start,
        end,
        ...(projectId !== ALL ? { project_id: projectId } : {}),
        ...(category !== ALL ? { category } : {}),
      });
      return rows;
    },
  });

  const { data: extExpenses = [] } = useQuery({
    queryKey: ["st-ext-expenses", start, end, projectId],
    queryFn: async () => {
      if (projectId !== ALL) return [];
      return externalExpensesApi.list({ start, end });
    },
  });

  // ---------- aggregates ----------
  const filteredPayments = useMemo(
    () => payments.filter((p: any) => matchesOwner(p.project?.id)),
    [payments, ownerFilter, ownerProjectIds],
  );
  const filteredProjExpenses = useMemo(
    () => projExpenses.filter((e: any) => matchesOwner(e.expense?.project?.id)),
    [projExpenses, ownerFilter, ownerProjectIds],
  );
  const filteredMovements = useMemo(
    () => movements.filter((m: any) => matchesOwner(m.project?.id)),
    [movements, ownerFilter, ownerProjectIds],
  );

  const totalIn = filteredPayments.reduce((s, p: any) => s + Number(p.amount), 0);
  const totalProjOut = filteredProjExpenses.reduce((s, p: any) => s + Number(p.amount), 0);
  const totalExtOut = extExpenses.reduce((s, p: any) => s + Number(p.amount), 0);
  const totalOut = totalProjOut + totalExtOut;
  const net = totalIn - totalOut;

  const totalInQty = filteredMovements
    .filter((m: any) => m.movement_type === "in")
    .reduce((s: number, m: any) => s + Number(m.quantity), 0);
  const totalOutQty = filteredMovements
    .filter((m: any) => m.movement_type === "out")
    .reduce((s: number, m: any) => s + Number(m.quantity), 0);

  // Per-item summary (filtered list)
  const itemSummary = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; inQty: number; outQty: number; stock: number }>();
    items.forEach((i: any) => {
      if (category !== ALL && i.category !== category) return;
      if (itemId !== ALL && i.id !== itemId) return;
      map.set(i.id, { name: i.name, unit: i.unit ?? "", inQty: 0, outQty: 0, stock: Number(i.quantity) });
    });
    filteredMovements.forEach((m: any) => {
      const row = map.get(m.item?.id);
      if (!row) return;
      if (m.movement_type === "in") row.inQty += Number(m.quantity);
      else row.outQty += Number(m.quantity);
    });
    return Array.from(map.values()).sort((a, b) => b.inQty + b.outQty - (a.inQty + a.outQty));
  }, [items, filteredMovements, category, itemId]);

  // Per-customer summary
  const customerSummary = useMemo(() => {
    const list =
      customerId !== ALL
        ? customers.filter((c: any) => c.id === customerId)
        : projectId !== ALL
        ? customers.filter((c: any) => c.project_id === projectId)
        : ownerFilter !== ALL
        ? customers.filter((c: any) => ownerProjectIds.has(c.project_id))
        : customers;
    return list
      .map((c: any) => {
        const paidInPeriod = filteredPayments
          .filter((p: any) => p.customer?.id === c.id)
          .reduce((s: number, p: any) => s + Number(p.amount), 0);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone ?? "—",
          total: Number(c.total_amount),
          down: Number(c.down_payment),
          installment: Number(c.monthly_installment),
          paidInPeriod,
        };
      })
      .sort((a, b) => b.paidInPeriod - a.paidInPeriod);
  }, [customers, customerId, projectId, ownerFilter, ownerProjectIds, filteredPayments]);

  // ---------- export (multi-sheet) ----------
  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    const addSheet = (name: string, rows: Record<string, unknown>[]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "لا يوجد": "—" }]);
      ws["!views"] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    addSheet("ملخص", [
      { "البند": "من تاريخ", "القيمة": start },
      { "البند": "إلى تاريخ", "القيمة": end },
      { "البند": "إجمالي الوارد (دفعات)", "القيمة": totalIn },
      { "البند": "إجمالي مصاريف الإسكانات", "القيمة": totalProjOut },
      { "البند": "إجمالي المصاريف الخارجية", "القيمة": totalExtOut },
      { "البند": "الصافي", "القيمة": net },
      { "البند": "إجمالي وارد مخزون", "القيمة": totalInQty },
      { "البند": "إجمالي صرف مخزون", "القيمة": totalOutQty },
    ]);

    addSheet(
      "الزبائن",
      customerSummary.map((c) => ({
        "الزبون": c.name,
        "الهاتف": c.phone,
        "الإجمالي": c.total,
        "الدفعة الأولى": c.down,
        "القسط الشهري": c.installment,
        "مدفوع خلال الفترة": c.paidInPeriod,
      })),
    );

    addSheet(
      "الدفعات",
      payments.map((p: any) => ({
        "التاريخ": formatDate(p.payment_date),
        "الزبون": p.customer?.name ?? "—",
        "الإسكان": p.project?.name ?? "—",
        "المالك": p.project?.owner_name ?? "—",
        "المبلغ": Number(p.amount),
        "طريقة الدفع": p.payment_method ?? "—",
        "الواصل": p.recipient ?? "—",
        "أدخلها": p.entered_by ?? "—",
        "ملاحظات": p.notes ?? "",
      })),
    );

    addSheet(
      "ملخص المخزون",
      itemSummary.map((i) => ({
        "الصنف": i.name,
        "الوحدة": i.unit,
        "وارد بالفترة": i.inQty,
        "مصروف بالفترة": i.outQty,
        "صافي الفترة": i.inQty - i.outQty,
        "الرصيد الحالي": i.stock,
      })),
    );

    addSheet(
      "حركات المخزون",
      movements.map((m: any) => ({
        "التاريخ": formatDate(m.movement_date),
        "الصنف": m.item?.name ?? "—",
        "الوحدة": m.item?.unit ?? "—",
        "الصنف الفئوي": m.item?.category ?? "—",
        "النوع": m.movement_type === "in" ? "وارد" : "مصروف",
        "الكمية": Number(m.quantity),
        "الإسكان": m.project?.name ?? "—",
        "أدخلها": m.entered_by ?? "—",
        "ملاحظات": m.notes ?? "",
      })),
    );

    addSheet(
      "مصاريف الإسكانات",
      projExpenses.map((e: any) => ({
        "التاريخ": formatDate(e.payment_date),
        "البند": e.expense?.category ?? "—",
        "المورد": e.expense?.vendor_name ?? "—",
        "الإسكان": e.expense?.project?.name ?? "—",
        "المبلغ": Number(e.amount),
        "طريقة الدفع": e.payment_method ?? "—",
        "أدخلها": e.entered_by ?? "—",
        "ملاحظات": e.notes ?? "",
      })),
    );

    addSheet(
      "مصاريف خارجية",
      extExpenses.map((e: any) => ({
        "التاريخ": formatDate(e.expense_date),
        "البند": e.expense_type ?? "—",
        "المستفيد": e.beneficiary ?? "—",
        "المبلغ": Number(e.amount),
        "طريقة الدفع": e.payment_method ?? "—",
        "أدخلها": e.entered_by ?? "—",
        "ملاحظات": e.notes ?? "",
      })),
    );

    const tag =
      projectId !== ALL
        ? `إسكان_${projects.find((p: any) => p.id === projectId)?.name ?? ""}`
        : customerId !== ALL
        ? `زبون_${customers.find((c: any) => c.id === customerId)?.name ?? ""}`
        : "الكل";

    XLSX.writeFile(wb, `جرد_شامل_${tag}_${start}_${end}.xlsx`);
  };

  // suppress unused warning for exportToExcel (kept available for future)
  void exportToExcel;

  const resetFilters = () => {
    setProjectId(ALL);
    setCustomerId(ALL);
    setCategory(ALL);
    setItemId(ALL);
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader
        title="الجرد الشامل"
        subtitle="جرد مالي ومخزني حسب الإسكان أو الزبون أو الصنف خلال فترة محددة"
        onExport={handleExport}
      />

      {/* Filters */}
      <Card className="p-4 mb-4 shadow-card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1.5" />
          </div>
          <OwnerFilter
            className="text-xs"
            value={ownerFilter}
            onChange={(v) => {
              setOwnerFilter(v);
              setProjectId(ALL);
              setCustomerId(ALL);
            }}
            owners={owners}
            allValue={ALL}
          />
          <div>
            <Label className="text-xs">الإسكان</Label>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setCustomerId(ALL);
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>كل الإسكانات</SelectItem>
                {projectsForOwner.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">الزبون</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>كل الزبائن</SelectItem>
                {customersForProject.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">صنف المواد</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>كل الأصناف</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">مادة محددة</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>كل المواد</SelectItem>
                {items
                  .filter((i: any) => category === ALL || i.category === category)
                  .map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            مسح الفلاتر
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI icon={TrendingUp} label="الوارد (دفعات)" value={formatMoney(totalIn)} tone="success" />
        <KPI icon={TrendingDown} label="إجمالي المصاريف" value={formatMoney(totalOut)} tone="destructive" />
        <KPI
          icon={Wallet}
          label="الصافي"
          value={formatMoney(net)}
          tone={net >= 0 ? "success" : "destructive"}
        />
        <KPI
          icon={Package}
          label="وارد/صرف مخزون"
          value={`${totalInQty} / ${totalOutQty}`}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl mb-4 gap-1 h-auto p-1">
          <TabsTrigger value="customers" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <Users className="w-4 h-4" /> الزبائن
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <Package className="w-4 h-4" /> المخزون
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <Receipt className="w-4 h-4" /> المصاريف
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <ArrowDownCircle className="w-4 h-4" /> الحركات
          </TabsTrigger>
        </TabsList>

        {/* Customers */}
        <TabsContent value="customers" className="space-y-4">
          <h3 className="font-semibold">ملخص الزبائن ({customerSummary.length})</h3>
          {customerSummary.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">لا يوجد</Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customerSummary.map((c) => (
              <Card key={c.id} className="p-4 space-y-2 hover-lift">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{c.name}</p>
                  <span className="text-xs text-muted-foreground">{c.phone}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="block text-[10px] text-muted-foreground">الإجمالي</span><span className="tabular-nums">{formatMoney(c.total)}</span></div>
                  <div><span className="block text-[10px] text-muted-foreground">القسط</span><span className="tabular-nums">{formatMoney(c.installment)}</span></div>
                  <div><span className="block text-[10px] text-muted-foreground">الدفعة الأولى</span><span className="tabular-nums">{formatMoney(c.down)}</span></div>
                  <div><span className="block text-[10px] text-muted-foreground">مدفوع بالفترة</span><span className="tabular-nums font-semibold text-success">{formatMoney(c.paidInPeriod)}</span></div>
                </div>
              </Card>
            ))}
          </div>

          <h3 className="font-semibold pt-2">دفعات الفترة ({filteredPayments.length})</h3>
          {filteredPayments.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">لا يوجد</Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPayments.map((p: any) => (
              <Card key={p.id} className="p-4 space-y-2 hover-lift">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{p.customer?.name ?? "—"}</p>
                  <span className="text-success font-bold tabular-nums">{formatMoney(p.amount)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{p.project?.name ?? "—"}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="block text-[10px] text-muted-foreground">التاريخ</span>{formatDate(p.payment_date)}</div>
                  <div><span className="block text-[10px] text-muted-foreground">الطريقة</span>{p.payment_method ?? "—"}</div>
                  <div className="col-span-2"><span className="block text-[10px] text-muted-foreground">الواصل</span>{p.recipient ?? "—"}</div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Inventory summary */}
        <TabsContent value="inventory" className="space-y-3">
          <h3 className="font-semibold">ملخص المواد ({itemSummary.length})</h3>
          {itemSummary.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">لا يوجد</Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemSummary.map((i) => (
              <Card key={i.name} className="p-4 space-y-2 hover-lift">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{i.name}</p>
                  <Badge variant="secondary" className="tabular-nums">{i.stock} {i.unit}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="block text-[10px] text-muted-foreground">وارد</span><span className="tabular-nums text-success">{i.inQty}</span></div>
                  <div><span className="block text-[10px] text-muted-foreground">مصروف</span><span className="tabular-nums text-destructive">{i.outQty}</span></div>
                  <div><span className="block text-[10px] text-muted-foreground">صافي</span><span className="tabular-nums font-semibold">{i.inQty - i.outQty}</span></div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          <h3 className="font-semibold">مصاريف الإسكانات ({filteredProjExpenses.length})</h3>
          {filteredProjExpenses.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">لا يوجد</Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProjExpenses.map((e: any) => (
              <Card key={e.id} className="p-4 space-y-2 hover-lift">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{e.expense?.category ?? "—"}</p>
                  <span className="text-destructive font-bold tabular-nums">{formatMoney(e.amount)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{e.expense?.vendor_name ?? "—"} • {e.expense?.project?.name ?? "—"}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="block text-[10px] text-muted-foreground">التاريخ</span>{formatDate(e.payment_date)}</div>
                  <div><span className="block text-[10px] text-muted-foreground">الطريقة</span>{e.payment_method ?? "—"}</div>
                </div>
              </Card>
            ))}
          </div>

          {projectId === ALL && ownerFilter === ALL && (
            <>
              <h3 className="font-semibold pt-2">المصاريف الخارجية ({extExpenses.length})</h3>
              {extExpenses.length === 0 && (
                <Card className="p-6 text-center text-muted-foreground">لا يوجد</Card>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {extExpenses.map((e: any) => (
                  <Card key={e.id} className="p-4 space-y-2 hover-lift">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold truncate">{e.expense_type ?? "—"}</p>
                      <span className="text-destructive font-bold tabular-nums">{formatMoney(e.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{e.beneficiary ?? "—"}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="block text-[10px] text-muted-foreground">التاريخ</span>{formatDate(e.expense_date)}</div>
                      <div><span className="block text-[10px] text-muted-foreground">الطريقة</span>{e.payment_method ?? "—"}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Movements */}
        <TabsContent value="movements" className="space-y-3">
          <h3 className="font-semibold">حركات المخزون ({filteredMovements.length})</h3>
          {filteredMovements.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">لا يوجد</Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMovements.map((m: any) => (
              <Card key={m.id} className="p-4 space-y-2 hover-lift">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{m.item?.name ?? "—"}</p>
                  {m.movement_type === "in" ? (
                    <Badge className="bg-success/15 text-success border-success/20">
                      <ArrowDownCircle className="w-3 h-3 ml-1" /> وارد
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/15 text-destructive border-destructive/20">
                      <ArrowUpCircle className="w-3 h-3 ml-1" /> مصروف
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{m.project?.name ?? "—"}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="block text-[10px] text-muted-foreground">الكمية</span><span className="tabular-nums font-semibold">{m.quantity} {m.item?.unit ?? ""}</span></div>
                  <div><span className="block text-[10px] text-muted-foreground">التاريخ</span>{formatDate(m.movement_date)}</div>
                  <div><span className="block text-[10px] text-muted-foreground">أدخلها</span>{m.entered_by ?? "—"}</div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground mt-4 text-center flex items-center justify-center gap-1">
        <Download className="w-3 h-3" /> استخدم زر "تصدير Excel" للحصول على تقرير شامل بعدة صفحات
      </p>
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: any) {
  const toneCls = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone as "success" | "destructive" | "warning"];
  return (
    <Card className="p-4 shadow-card hover-lift">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold mt-1 tabular-nums truncate">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${toneCls}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}