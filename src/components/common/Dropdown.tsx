import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = 'right',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            'absolute z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const DropdownItem: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; danger?: boolean }
> = ({ className, icon, danger, children, ...props }) => (
  <button
    role="menuitem"
    className={cn(
      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 text-left cursor-pointer',
      danger && 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40',
      className
    )}
    {...props}
  >
    {icon && <span className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>}
    <span className="flex-1 truncate">{children}</span>
  </button>
);

export const DropdownDivider: React.FC = () => (
  <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
);
