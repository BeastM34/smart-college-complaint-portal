import React, { useState } from 'react';
import type { TrendDataPoint } from '@/types';
import { cn } from '@/utils/cn';

export interface ComplaintTrendChartProps {
  data: TrendDataPoint[];
  className?: string;
  title?: string;
  description?: string;
}

export const ComplaintTrendChart: React.FC<ComplaintTrendChartProps> = ({
  data,
  className,
  title,
  description,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.submitted, d.resolved))
  );

  // Y-axis tick intervals
  const yTicks = [maxVal, Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {(title || description) && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 dark:bg-indigo-500" />
              <span>Submitted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>Resolved</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="relative flex-1 min-h-[200px] flex flex-col justify-end pt-6 pb-2">
        {/* Background Grid Lines & Y-Axis */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
          {yTicks.map((tick, idx) => (
            <div key={idx} className="flex items-center gap-2 w-full">
              <span className="text-[10px] font-mono text-slate-400 w-5 text-right shrink-0">
                {tick}
              </span>
              <div className="flex-1 border-b border-slate-100 dark:border-slate-800" />
            </div>
          ))}
        </div>

        {/* Bar Columns Container */}
        <div className="relative pl-7 flex items-end justify-between gap-1 sm:gap-2 h-44 z-10">
          {data.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              No timeline activity in this range
            </div>
          ) : (
            data.map((item, idx) => {
              const subHeight = (item.submitted / maxVal) * 100;
              const resHeight = (item.resolved / maxVal) * 100;
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-14 z-30 pointer-events-none whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-xl dark:bg-slate-800 dark:border dark:border-slate-700 animate-in fade-in zoom-in-95">
                      <p className="font-semibold text-slate-200 text-[10px] pb-0.5 border-b border-slate-700 mb-1">
                        {item.label}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-300">
                          Submitted: <strong>{item.submitted}</strong>
                        </span>
                        <span className="text-emerald-300">
                          Resolved: <strong>{item.resolved}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dual Bars */}
                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full pb-1">
                    {/* Submitted Bar */}
                    <div
                      className={cn(
                        'w-2 sm:w-3.5 rounded-t transition-all duration-200 bg-indigo-600 dark:bg-indigo-500',
                        isHovered ? 'opacity-100 ring-2 ring-indigo-400' : 'opacity-85 hover:opacity-100'
                      )}
                      style={{ height: `${Math.max(subHeight > 0 ? 4 : 0, subHeight)}%` }}
                    />

                    {/* Resolved Bar */}
                    <div
                      className={cn(
                        'w-2 sm:w-3.5 rounded-t transition-all duration-200 bg-emerald-500',
                        isHovered ? 'opacity-100 ring-2 ring-emerald-400' : 'opacity-85 hover:opacity-100'
                      )}
                      style={{ height: `${Math.max(resHeight > 0 ? 4 : 0, resHeight)}%` }}
                    />
                  </div>

                  {/* X-axis Label (Sample every N items on dense views) */}
                  <span
                    className={cn(
                      'text-[9px] sm:text-[10px] text-slate-400 truncate max-w-full block pt-1',
                      data.length > 15 && idx % 3 !== 0 && 'hidden sm:block',
                      isHovered && 'text-slate-900 dark:text-slate-100 font-bold'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
