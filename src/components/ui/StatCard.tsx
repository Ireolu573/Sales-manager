import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  isLoading?: boolean;
  trend?: string;
}

export function StatCard({ title, value, icon, isLoading, trend }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]">
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        {trend && <span className="text-xs font-medium text-emerald-500">{trend}</span>}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {isLoading ? (
          <Skeleton className="h-8 w-24 mt-1" />
        ) : (
          <h3 className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </h3>
        )}
      </div>
    </div>
  );
}
