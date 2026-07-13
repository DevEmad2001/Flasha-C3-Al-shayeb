import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const range = useMemo(() => {
    const parts = month.split("-");
    if (parts.length !== 2) return { start: "", end: "" };
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (isNaN(y) || isNaN(m)) return { start: "", end: "" };
    const start = `${month}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [month]);

  const { data } = useQuery({
    queryKey: ["report", range.start, range.end],
    queryFn: () => reportsApi.summary(range.start, range.end),
    enabled: !!range.start && !!range.end,
  });

  const totalIn = (data?.cps ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const totalProjectOut = (data?.peps ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const totalExtOut = (data?.exps ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const totalOut = totalProjectOut + totalExtOut;

  const remainingByCustomer = (data?.customers ?? []).map((c: any) => {
    const paid = (c.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    return { name: c.name, total: Number(c.total_amount), paid, remaining: Number(c.total_amount) - paid };
  }).filter((c) => c.remaining > 0).sort((a, b) => b.remaining - a.remaining);

  const projectExpensesMap = new Map<string, number>();
  (data?.peps ?? []).forEach((p: any) => {
    const name = p.expense?.project?.name ?? "بدون مشروع";
    projectExpensesMap.set(name, (projectExpensesMap.get(name) ?? 0) + Number(p.amount));
  });
  const projectTotals = Array.from(projectExpensesMap.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">

      <PageHeader title="التقارير الشهرية" subtitle="ملخص شامل للحركات المالية"
        onExport={() => exportToExcel((data?.cps ?? []).map((p: any) => ({
          "التاريخ": formatDate(p.payment_date), "الزبون": p.customer?.name, "المشروع": p.project?.name,
          "المبلغ": Number(p.amount), "طريقة الدفع": p.payment_method, "الواصل": p.recipient, "أدخلها": p.entered_by,
        })), `أقساط_${month}`)} />

      <Card className="p-4 mb-4">
        <Label>الشهر</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-xs mt-1.5" />
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={TrendingUp} label="إجمالي المدخلات" value={formatMoney(totalIn)} tone="success" />
        <SummaryCard icon={TrendingDown} label="إجمالي المصاريف" value={formatMoney(totalOut)} tone="destructive" />
        <SummaryCard icon={Wallet} label="الصافي" value={formatMoney(totalIn - totalOut)} tone={totalIn - totalOut >= 0 ? "success" : "destructive"} />
        <SummaryCard icon={AlertCircle} label="المتبقي على الزبائن" value={formatMoney(remainingByCustomer.reduce((s, c) => s + c.remaining, 0))} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">الأقساط المدفوعة خلال الشهر</h3>
          <Table>
            <TableHeader><TableRow><TableHead className="text-right">التاريخ</TableHead><TableHead className="text-right">الزبون</TableHead><TableHead className="text-right">المبلغ</TableHead><TableHead className="text-right">أدخلها</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.cps ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">لا يوجد</TableCell></TableRow>}
              {(data?.cps ?? []).map((p: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-right">{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="text-right">{p.customer?.name}</TableCell>
                  <TableCell className="text-success font-semibold text-right">{formatMoney(p.amount)}</TableCell>
                  <TableCell className="text-right">{p.entered_by ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">مصاريف كل مشروع</h3>
          <Table>
            <TableHeader><TableRow><TableHead className="text-right">المشروع</TableHead><TableHead className="text-right">الإجمالي</TableHead></TableRow></TableHeader>
            <TableBody>
              {projectTotals.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">لا يوجد</TableCell></TableRow>}
              {projectTotals.map(([name, total]) => (
                <TableRow key={name}><TableCell className="text-right">{name}</TableCell><TableCell className="font-semibold text-right">{formatMoney(total)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">المتبقي على الزبائن</h3>
        {remainingByCustomer.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">جميع الزبائن دفعوا بالكامل</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {remainingByCustomer.map((c) => {
              const progress = c.total > 0 ? Math.min(100, (c.paid / c.total) * 100) : 0;
              return (
                <Card key={c.name} className="p-4 rounded-xl border border-border/70 shadow-sm">
                  <p className="font-bold text-sm truncate mb-3 text-right">{c.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="p-1.5 rounded-md bg-muted/40">
                      <div className="text-[10px] text-muted-foreground">التوتال</div>
                      <div className="font-semibold text-xs tabular-nums">{formatMoney(c.total)}</div>
                    </div>
                    <div className="p-1.5 rounded-md bg-success/10">
                      <div className="text-[10px] text-muted-foreground">المدفوع</div>
                      <div className="font-semibold text-xs tabular-nums text-success">{formatMoney(c.paid)}</div>
                    </div>
                    <div className="p-1.5 rounded-md bg-accent/10">
                      <div className="text-[10px] text-muted-foreground">المتبقي</div>
                      <div className="font-bold text-xs tabular-nums text-accent">{formatMoney(c.remaining)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>نسبة السداد</span>
                      <span className="tabular-nums">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

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
