import React, { useState } from 'react';
import type { ComplaintStatus } from '@/types';

export interface StatusDonutChartProps {
  data: Record<ComplaintStatus, number>;
  total: number;
  className?: string;
  size?: number;
}

interface SegmentConfig {
  key: ComplaintStatus;
  label: string;
  color: string;
  fillClass: string;
  badgeBg: string;
  textClass: string;
}

const STATUS_SEGMENTS: SegmentConfig[] = [
  {
    key: 'pending',
    label: 'Pending',
    color: '#f59e0b', // amber-500
    fillClass: 'fill-amber-500 text-amber-500',
    badgeBg: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'assigned',
    label: 'Assigned',
    color: '#8b5cf6', // violet-500
    fillClass: 'fill-violet-500 text-violet-500',
    badgeBg: 'bg-violet-500',
    textClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    color: '#3b82f6', // blue-500
    fillClass: 'fill-blue-500 text-blue-500',
    badgeBg: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    color: '#10b981', // emerald-500
    fillClass: 'fill-emerald-500 text-emerald-500',
    badgeBg: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    color: '#f43f5e', // rose-500
    fillClass: 'fill-rose-500 text-rose-500',
    badgeBg: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
];

export const StatusDonutChart: React.FC<StatusDonutChartProps> = ({
  data,
  total,
  className = '',
  size = 180,
}) => {
  const [hoveredKey, setHoveredKey] = useState<ComplaintStatus | null>(null);

  // SVG Geometry
  const viewBoxSize = 120;
  const center = viewBoxSize / 2;
  const radius = 42;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  // Compute segments
  let accumulatedPercent = 0;
  const segments = STATUS_SEGMENTS.map((seg) => {
    const count = data[seg.key] || 0;
    const percent = total > 0 ? (count / total) * 100 : 0;
    const dashLength = (percent / 100) * circumference;
    const strokeDashoffset = -(accumulatedPercent / 100) * circumference;

    accumulatedPercent += percent;

    return {
      ...seg,
      count,
      percent: Math.round(percent),
      dashLength,
      strokeDashoffset,
    };
  });

  const activeSegment = hoveredKey
    ? segments.find((s) => s.key === hoveredKey)
    : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 ${className}`}>
      {/* SVG Donut */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="w-full h-full -rotate-90 transform"
        >
          {/* Background circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800"
          />

          {/* Slices */}
          {total > 0 &&
            segments.map((seg) => {
              if (seg.count === 0) return null;
              const isHovered = hoveredKey === seg.key;

              return (
                <circle
                  key={seg.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={`${seg.dashLength} ${circumference}`}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {activeSegment ? (
            <>
              <span className={`text-xs font-semibold ${activeSegment.textClass}`}>
                {activeSegment.label}
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none my-0.5">
                {activeSegment.count}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {activeSegment.percent}% of total
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                {total}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Total
              </span>
            </>
          )}
        </div>
      </div>

      {/* Responsive Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-1 gap-2.5 w-full sm:w-auto">
        {segments.map((seg) => {
          const isHovered = hoveredKey === seg.key;
          return (
            <div
              key={seg.key}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                isHovered
                  ? 'bg-slate-100/90 dark:bg-slate-800/90 shadow-xs'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${seg.badgeBg}`} />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {seg.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {seg.count}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({seg.percent}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
