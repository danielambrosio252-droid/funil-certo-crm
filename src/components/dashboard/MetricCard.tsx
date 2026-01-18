import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning";
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = "vs mês anterior",
  icon: Icon,
  variant = "default",
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  const variantStyles = {
    default: "bg-card border-border",
    primary: "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20",
    success: "bg-gradient-to-br from-success/10 to-success/5 border-success/20",
    warning: "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20",
  };

  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/20 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive && (
                <span className="flex items-center text-success text-sm font-medium">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  +{change}%
                </span>
              )}
              {isNegative && (
                <span className="flex items-center text-destructive text-sm font-medium">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  {change}%
                </span>
              )}
              {change === 0 && (
                <span className="text-muted-foreground text-sm">0%</span>
              )}
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
}
