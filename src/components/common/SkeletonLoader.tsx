import React from 'react';
import { cn } from '@/utils/cn';

export interface SkeletonLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  count?: number;
  width?: string | number;
  height?: string | number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  count = 1,
  width,
  height,
  className,
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full w-10 h-10';
      case 'rectangular':
        return 'rounded-xl h-24 w-full';
      case 'card':
        return 'rounded-2xl h-48 w-full p-5 flex flex-col justify-between';
      case 'text':
      default:
        return 'rounded-md h-4 w-full';
    }
  };

  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className="space-y-4">
        {items.map((i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4',
              className
            )}
            {...props}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      {items.map((i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse bg-slate-200 dark:bg-slate-800 transition-colors',
            getVariantStyles(),
            className
          )}
          style={{
            width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
            height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
            ...style,
          }}
          {...props}
        />
      ))}
    </div>
  );
};
