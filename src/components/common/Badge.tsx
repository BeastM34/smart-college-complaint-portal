import React from 'react';
import { cn } from '@/utils/cn';
import type { ComplaintStatus, Priority, Role } from '@/types';

export type BadgeVariant =
  | ComplaintStatus
  | Priority
  | Role
  | 'default'
  | 'outline'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    // Status mappings (Pending: Amber, Assigned: Violet, In Progress: Blue, Resolved: Emerald, Rejected: Rose)
    pending: {
      container:
        'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80',
      dot: 'bg-amber-500',
    },
    assigned: {
      container:
        'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/80',
      dot: 'bg-violet-500',
    },
    in_progress: {
      container:
        'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/80',
      dot: 'bg-blue-500 animate-pulse',
    },
    resolved: {
      container:
        'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80',
      dot: 'bg-emerald-500',
    },
    rejected: {
      container:
        'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/80',
      dot: 'bg-rose-500',
    },

    // Priority mappings (Low: Slate, Medium: Blue, High: Amber, Critical: Rose)
    low: {
      container:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    medium: {
      container:
        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      dot: 'bg-blue-500',
    },
    high: {
      container:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    critical: {
      container:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-semibold',
      dot: 'bg-rose-600 animate-ping',
    },

    // Role mappings
    student: {
      container:
        'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      dot: 'bg-indigo-500',
    },
    admin: {
      container:
        'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      dot: 'bg-purple-500',
    },
    staff: {
      container:
        'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
      dot: 'bg-teal-500',
    },

    // General purpose
    default: {
      container:
        'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      dot: 'bg-slate-500',
    },
    outline: {
      container:
        'bg-transparent text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    info: {
      container:
        'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      dot: 'bg-indigo-500',
    },
    success: {
      container:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    warning: {
      container:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    error: {
      container:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      dot: 'bg-rose-500',
    },
  };

  const styleConfig = variantStyles[variant] || variantStyles.default;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border tracking-wide transition-colors whitespace-nowrap capitalize',
        styleConfig.container,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', styleConfig.dot)}
        />
      )}
      {children}
    </span>
  );
};
