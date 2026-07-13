import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { useCategoryManager } from "@/hooks/useCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";

type CatalogType = "expense" | "payment_method" | "recipient";

const META: Record<CatalogType, { title: string; hint: string; queryKey: readonly string[]; placeholder: string }> = {
  expense: {
    title: "أنواع مصاريف المشاريع",
    hint: "تُستخدم عند إضافة بنود المصاريف في صفحة المدفوعات (مقاول، بليط، حديد…)",
    queryKey: ["categories", "expense"],
    placeholder: "مثال: عزل، دهان خارجي",
  },
  payment_method: {
    title: "طرق الدفع",
    hint: "تظهر في دفعات الزبائن، مصاريف المشاريع، والمصاريف الخارجية",
    queryKey: ["categories", "payment_method"],
    placeholder: "مثال: محفظة إلكترونية",
  },
  recipient: {
    title: "أسماء الواصلين",
    hint: "تظهر كقائمة منسدلة عند تسجيل الدفعات (مثال: عبدالله، أسامة) مع إمكانية الإدخال اليدوي",
    queryKey: ["categories", "recipient"],
    placeholder: "مثال: عبدالله، أسامة",
  },
};

export function CatalogManager({ type }: { type: CatalogType }) {
  const meta = META[type];
  const [newName, setNewName] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: meta.queryKey,
    queryFn: () => categoriesApi.list(type),
  });

  const { add, rename, remove } = useCategoryManager(type, meta.queryKey);

  const onAdd = async () => {
    const ok = await add(newName);
    if (ok) setNewName("");
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-bold">{meta.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{meta.hint}</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={meta.placeholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        />
        <Button type="button" onClick={onAdd} className="shrink-0 gap-1">
          <Plus className="w-4 h-4" /> إضافة
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد خيارات — أضف أول عنصر.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">{item.name}</span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => rename(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(item)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
