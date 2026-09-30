import React, { useState } from 'react';
import { cn } from '@/utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  name,
  size = 'md',
  status,
  className,
  ...props
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const getInitials = (n?: string) => {
    if (!n) return '?';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const statusIndicatorSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    busy: 'bg-rose-500',
    away: 'bg-amber-500',
  };

  const showImage = src && !imageFailed;

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)} {...props}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-medium overflow-hidden border border-slate-200 dark:border-slate-700 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
          sizeClasses[size]
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-slate-900',
            statusIndicatorSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
};
