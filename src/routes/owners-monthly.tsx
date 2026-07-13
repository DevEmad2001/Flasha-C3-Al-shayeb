import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { customerPaymentsApi, projectExpensePaymentsApi, projectsApi, externalExpensesApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { TrendingUp, TrendingDown, Wallet, Building2 } from "lucide-react";
import { useOwners } from "@/hooks/useOwners";
import { OwnerFilter } from "@/components/OwnerFilter";

export const Route = createFileRoute("/owners-monthly")({ component: OwnersMonthlyPage });

function OwnersMonthlyPage() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const [owner, setOwner] = useState<string>("__all__");
  const [start, setStart] = useState(firstOfMonth);
  const [end, setEnd] = useState(today);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-owners"],
    queryFn: () => projectsApi.listWithOwner(),
  });

  const owners = useOwners(projects as any[]);

  const ownerProjectIds = useMemo(() => {
    if (owner === "__all__") return projects.map((p: any) => p.id);
    return projects.filter((p: any) => (p.owner_name ?? "").trim() === owner).map((p: any) => p.id);
  }, [owner, projects]);

  const { data } = useQuery({
    queryKey: ["owners-monthly", owner, start, end, ownerProjectIds.join(",")],
    enabled: projects.length > 0,
    queryFn: async () => {
      const ids = new Set(ownerProjectIds);
      if (ids.size === 0) return { payments: [], expenses: [] };

      const [paymentsAll, expensesAll, extExpenses] = await Promise.all([
        customerPaymentsApi.list({ start, end, include_relations: true }),
        projectExpensePaymentsApi.list({ start, end }),
        owner === "__all__"
          ? externalExpensesApi.list({ start, end })
          : Promise.resolve([]),
      ]);

      const payments = paymentsAll.filter((p) => p.project_id && ids.has(p.project_id));
      const projectExpenses = expensesAll.filter((e) => e.expense?.project_id && ids.has(e.expense.project_id));
      const externalMapped = extExpenses.map((e) => ({
        id: `ext-${e.id}`,
        amount: e.amount,
        payment_date: e.expense_date,
        payment_method: e.payment_method,
        entered_by: e.entered_by,
        notes: e.notes,
        expense_type: e.expense_type,
        beneficiary: e.beneficiary,
        expense: null,
      }));
      const expenses = owner === "__all__"
        ? [...projectExpenses, ...externalMapped]
        : projectExpenses;
      return { payments, expenses: expenses as any[] };
    },
  });

  const payments = data?.payments ?? [];
  const expenses = data?.expenses ?? [];

  const totalIn = payments.reduce((s, p: any) => s + Number(p.amount), 0);
  const totalOut = expenses.reduce((s, p: any) => s + Number(p.amount), 0);
  const net = totalIn - totalOut;

  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const p of payments) {
      const key = (p.payment_date ?? "").slice(0, 7);
      if (!key) continue;
      const row = map.get(key) ?? { in: 0, out: 0 };
      row.in += Number(p.amount);
      map.set(key, row);
    }
    for (const e of expenses) {
      const key = (e.payment_date ?? "").slice(0, 7);
      if (!key) continue;
      const row = map.get(key) ?? { in: 0, out: 0 };
      row.out += Number(e.amount);
      map.set(key, row);
    }

    const months: { label: string; in: number; out: number; net: number }[] = [];
    if (!start || !end) return months;
    const [sy, sm] = start.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    if (sy > ey || (sy === ey && sm > em)) return months;

    let cy = sy, cm = sm;
    while (cy < ey || (cy === ey && cm <= em)) {
      const key = `${cy}-${String(cm).padStart(2, "0")}`;
      const row = map.get(key) ?? { in: 0, out: 0 };
      months.push({ label: `${monthNames[cm - 1]} ${cy}`, in: row.in, out: row.out, net: row.in - row.out });
      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }
    return months;
  }, [payments, expenses, start, end]);

  const handleExport = () => {
    const paymentRows = payments.map((p: any) => ({
      "النوع": "قسط مدفوع",
      "التاريخ": formatDate(p.payment_date),
      "المالك": p.project?.owner_name ?? "—",
      "المشروع": p.project?.name ?? "—",
      "الزبون": p.customer?.name ?? "—",
      "المبلغ (وارد)": Number(p.amount),
      "المبلغ (مصروف)": "",
      "طريقة الدفع": p.payment_method ?? "—",
      "الواصل": p.recipient ?? "—",
      "أدخلها": p.entered_by ?? "—",
      "ملاحظات": p.notes ?? "",
    }));
    const expenseRows = expenses.map((e: any) => ({
      "النوع": "مصروف",
      "التاريخ": formatDate(e.payment_date),
      "المالك": e.expense?.project?.owner_name ?? "—",
      "المشروع": e.expense?.project?.name ?? e.beneficiary ?? "—",
      "الزبون": "—",
      "المبلغ (وارد)": "",
      "المبلغ (مصروف)": Number(e.amount),
      "طريقة الدفع": e.payment_method ?? "—",
      "الواصل": e.expense?.vendor_name ?? "—",
      "أدخلها": e.entered_by ?? "—",
      "ملاحظات": [e.expense?.category ?? e.expense_type, e.notes].filter(Boolean).join(" — "),
    }));
    const monthSummaryRows = monthlyBreakdown.map((m) => ({
      "النوع": `صافي ${m.label}`,
      "المبلغ (وارد)": m.in,
      "المبلغ (مصروف)": m.out,
      "الواصل": m.net,
    }));
    const summary = [
      {},
      { "النوع": "الإجمالي الوارد", "المبلغ (وارد)": totalIn },
      { "النوع": "الإجمالي المصروف", "المبلغ (مصروف)": totalOut },
      { "النوع": "الصافي", "المبلغ (وارد)": net },
    ];
    const fileName = `جرد_الملاك_${owner === "__all__" ? "الكل" : owner}_${start}_${end}`;
    exportToExcel([...paymentRows, ...expenseRows, ...monthSummaryRows, ...summary], fileName);
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <PageHeader
        title="جرد الملاك"
        subtitle="عرض الحركات المالية لكل مالك خلال فترة محددة"
        onExport={handleExport}
      />

      <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <OwnerFilter value={owner} onChange={setOwner} owners={owners} allValue="__all__" />
        <div>
          <Label>من تاريخ</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>إلى تاريخ</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1.5" />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={TrendingUp} label="الأقساط المدفوعة" value={formatMoney(totalIn)} tone="success" />
        <SummaryCard icon={TrendingDown} label="إجمالي المصاريف" value={formatMoney(totalOut)} tone="destructive" />
        <SummaryCard icon={Wallet} label="الصافي" value={formatMoney(net)} tone={net >= 0 ? "success" : "destructive"} />
        <SummaryCard icon={Building2} label="عدد المشاريع" value={String(ownerProjectIds.length)} tone="warning" />
      </div>

      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-3">الصافي الشهري</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الشهر</TableHead>
              <TableHead className="text-right">الوارد</TableHead>
              <TableHead className="text-right">المصروف</TableHead>
              <TableHead className="text-right">الصافي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyBreakdown.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">لا يوجد</TableCell></TableRow>
            )}
            {monthlyBreakdown.map((m, i) => (
              <TableRow key={i}>
                <TableCell className="text-right font-medium">{m.label}</TableCell>
                <TableCell className="text-success font-semibold tabular-nums text-right">{formatMoney(m.in)}</TableCell>
                <TableCell className="text-destructive font-semibold tabular-nums text-right">{formatMoney(m.out)}</TableCell>
                <TableCell className={`font-semibold tabular-nums text-right ${m.net >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(m.net)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">الأقساط المدفوعة خلال الفترة</h3>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الزبون</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">لا يوجد</TableCell></TableRow>
                )}
                {payments.map((p: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-right">{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="text-right">{p.customer?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{p.project?.name ?? "—"}</TableCell>
                    <TableCell className="text-success font-semibold tabular-nums text-right">{formatMoney(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">المصاريف خلال الفترة</h3>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">البند</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">لا يوجد</TableCell></TableRow>
                )}
                {expenses.map((e: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-right">{formatDate(e.payment_date)}</TableCell>
                    <TableCell className="text-right">{e.expense?.category ?? e.expense_type ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{e.expense?.project?.name ?? e.beneficiary ?? "—"}</TableCell>
                    <TableCell className="text-destructive font-semibold tabular-nums text-right">{formatMoney(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: any) {
  const toneCls = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone as "success" | "destructive" | "warning"];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${toneCls}`}><Icon className="w-5 h-5" /></div>
      </div>
    </Card>
  );
}
