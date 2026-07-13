import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/useViewMode";

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5 shadow-soft">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-all",
          value === "table"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="عرض جدول"
      >
        <TableIcon className="w-3.5 h-3.5" />
        جدول
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-all",
          value === "cards"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="عرض بطاقات"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        بطاقات
      </button>
    </div>
  );
}
