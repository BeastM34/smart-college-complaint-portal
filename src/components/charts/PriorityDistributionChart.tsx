import React from 'react';
import type { PriorityMetric, Priority } from '@/types';
import { cn } from '@/utils/cn';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, Inbox } from 'lucide-react';

export interface PriorityDistributionChartProps {
  data: PriorityMetric[];
  total: number;
  className?: string;
}

const PRIORITY_CONFIG: Record<
  Priority,
  {
    bgClass: string;
    textClass: string;
    badgeBg: string;
    barColor: string;
    icon: React.ReactNode;
  }
> = {
  critical: {
    bgClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    textClass: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500',
    barColor: 'bg-rose-500',
    icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
  },
  high: {
    bgClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    textClass: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500',
    barColor: 'bg-amber-500',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  },
  medium: {
    bgClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
    textClass: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500',
    barColor: 'bg-blue-500',
    icon: <AlertCircle className="w-4 h-4 text-blue-500" />,
  },
  low: {
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    textClass: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-400',
    barColor: 'bg-slate-400',
    icon: <Info className="w-4 h-4 text-slate-400" />,
  },
};

export const PriorityDistributionChart: React.FC<PriorityDistributionChartProps> = ({
  data,
  total,
  className,
}) => {
  if (total === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No priority data
        </p>
        <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
          No complaints logged in this period.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Combined Horizontal Stacked Bar */}
      <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-xs">
        {data.map((item) => {
          if (item.count === 0) return null;
          const cfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.low;
          return (
            <div
              key={item.priority}
              className={cn('h-full transition-all duration-300', cfg.barColor)}
              style={{ width: `${item.percentage}%` }}
              title={`${item.label}: ${item.count} (${item.percentage}%)`}
            />
          );
        })}
      </div>

      {/* Grid of Priority Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {data.map((item) => {
          const cfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.low;
          return (
            <div
              key={item.priority}
              className={cn(
                'p-3 rounded-xl border flex items-center justify-between transition-all hover:shadow-xs',
                cfg.bgClass
              )}
            >
              <div className="flex items-center gap-2">
                {cfg.icon}
                <div>
                  <span className="text-xs font-semibold block leading-tight">
                    {item.label}
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">
                    {item.percentage}% of total
                  </span>
                </div>
              </div>
              <span className="text-base font-bold font-mono">
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
