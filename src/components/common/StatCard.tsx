import React from 'react';
import { Card, CardContent } from '@/components/common/Card';
import { cn } from '@/utils/cn';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'amber' | 'blue' | 'emerald' | 'rose' | 'violet' | 'indigo';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  onClick,
  className,
}) => {
  const variantStyles = {
    default: {
      border: 'border-slate-200/80 dark:border-slate-800',
      iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
      titleColor: 'text-slate-500 dark:text-slate-400',
    },
    indigo: {
      border: 'border-indigo-200/60 dark:border-indigo-900/40',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
      titleColor: 'text-indigo-600 dark:text-indigo-400',
    },
    amber: {
      border: 'border-amber-200/60 dark:border-amber-900/40',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
      titleColor: 'text-amber-600 dark:text-amber-400',
    },
    blue: {
      border: 'border-blue-200/60 dark:border-blue-900/40',
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
      titleColor: 'text-blue-600 dark:text-blue-400',
    },
    emerald: {
      border: 'border-emerald-200/60 dark:border-emerald-900/40',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
      titleColor: 'text-emerald-600 dark:text-emerald-400',
    },
    rose: {
      border: 'border-rose-200/60 dark:border-rose-900/40',
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
      titleColor: 'text-rose-600 dark:text-rose-400',
    },
    violet: {
      border: 'border-violet-200/60 dark:border-violet-900/40',
      iconBg: 'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400',
      titleColor: 'text-violet-600 dark:text-violet-400',
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.default;

  return (
    <Card
      hoverEffect
      onClick={onClick}
      className={cn(
        currentVariant.border,
        onClick && 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600',
        className
      )}
    >
      <CardContent className="p-4 sm:p-5 flex items-center justify-between">
        <div className="space-y-1">
          <p className={cn('text-xs font-medium', currentVariant.titleColor)}>
            {title}
          </p>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-150 group-hover:scale-105',
            currentVariant.iconBg
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
};
