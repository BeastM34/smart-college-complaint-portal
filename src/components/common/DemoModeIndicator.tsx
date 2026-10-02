import React from 'react';
import { Sparkles, Shield, User, RefreshCw, Database } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Dropdown, DropdownItem, DropdownDivider } from './Dropdown';
import { settingsService } from '@/services/settingsService';
import { useToast } from '@/hooks/useToast';
import type { Role } from '@/types';

export const DemoModeIndicator: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { success } = useToast();

  const handleSwitch = (role: Role) => {
    switchRole(role);
    success(`Switched active view to ${role.toUpperCase()}`, 'Demo Mode');
  };

  const handleReset = async () => {
    await settingsService.resetDemoData();
    window.location.reload();
  };

  return (
    <Dropdown
      align="right"
      trigger={
        <div
          title="Demo Mode: Operating on local simulated mock database"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition-colors cursor-pointer select-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-semibold">Demo Mode</span>
          <span className="hidden sm:inline text-amber-600/80 dark:text-amber-400/80 text-[10px]">
            (Mock Data)
          </span>
        </div>
      }
    >
      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 max-w-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Database className="w-3.5 h-3.5 text-amber-500" />
          <span>Local Mock Environment</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
          This system operates on local mock data. All changes are persisted in browser memory and local storage.
        </p>
      </div>

      <div className="py-1">
        <DropdownItem
          icon={<User className="w-4 h-4 text-indigo-500" />}
          onClick={() => handleSwitch('student')}
        >
          Switch to Student View
        </DropdownItem>
        <DropdownItem
          icon={<Shield className="w-4 h-4 text-purple-500" />}
          onClick={() => handleSwitch('admin')}
        >
          Switch to Admin View
        </DropdownItem>
      </div>

      <DropdownDivider />

      <DropdownItem
        icon={<RefreshCw className="w-4 h-4 text-rose-500" />}
        onClick={handleReset}
      >
        <span className="text-rose-600 dark:text-rose-400 font-medium">Reset Demo Data</span>
      </DropdownItem>
    </Dropdown>
  );
};
