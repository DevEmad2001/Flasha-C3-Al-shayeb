import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
};

export function PageShell({ children, className, narrow }: Props) {
  return (
    <div
      className={cn(
        "page-shell w-full min-w-0 mx-auto px-3 py-3 sm:px-6 sm:py-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        narrow ? "max-w-4xl" : "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
