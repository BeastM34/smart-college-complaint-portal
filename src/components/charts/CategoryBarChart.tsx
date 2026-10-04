import React from 'react';
import type { CategoryMetric } from '@/types';
import { cn } from '@/utils/cn';
import { Inbox } from 'lucide-react';

export interface CategoryBarChartProps {
  data: CategoryMetric[];
  total: number;
  className?: string;
}

export const CategoryBarChart: React.FC<CategoryBarChartProps> = ({
  data,
  total,
  className,
}) => {
  if (data.length === 0 || total === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No category data
        </p>
        <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
          No complaints were logged in the selected reporting period.
        </p>
      </div>
    );
  }

  // Display top categories up to 8
  const displayed = data.slice(0, 8);

  return (
    <div className={cn('space-y-3.5', className)}>
      {displayed.map((item) => {
        return (
          <div key={item.category} className="space-y-1 group">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[70%]">
                {item.label}
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {item.count}
                </span>
                <span className="text-[11px] text-slate-400">
                  ({item.percentage}%)
                </span>
              </div>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 transition-all duration-300"
                style={{ width: `${Math.max(item.percentage > 0 ? 3 : 0, item.percentage)}%` }}
              />
            </div>
          </div>
        );
      })}

      {data.length > 8 && (
        <p className="text-[11px] text-slate-400 pt-1 text-center italic">
          + {data.length - 8} more categories
        </p>
      )}
    </div>
  );
};
