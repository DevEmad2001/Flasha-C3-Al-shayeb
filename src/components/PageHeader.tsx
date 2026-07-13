import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ViewToggle } from "@/components/ViewToggle";
import type { ViewMode } from "@/hooks/useViewMode";

interface Props {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  children?: React.ReactNode;
  viewMode?: ViewMode;
  onViewChange?: (v: ViewMode) => void;
}

export function PageHeader({ title, subtitle, onExport, children, viewMode, onViewChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-8 animate-fade-in pb-3 sm:pb-5 border-b border-border/70">
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-1.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        {viewMode && onViewChange && (
          <ViewToggle value={viewMode} onChange={onViewChange} />
        )}
        {children}
        {onExport && (
          <Button variant="outline" onClick={onExport} className="gap-2 rounded-xl shadow-sm hover:bg-secondary">
            <Download className="w-4 h-4 text-primary" />
            تصدير Excel
          </Button>
        )}
      </div>
    </div>
  );
}

