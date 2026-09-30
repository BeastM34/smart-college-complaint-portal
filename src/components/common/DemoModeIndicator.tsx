import React from 'react';
import { Sparkles, Shield, User, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Dropdown, DropdownItem, DropdownDivider } from './Dropdown';
import { clearAppStorage } from '@/utils/storage';
import { useToast } from '@/hooks/useToast';
import type { Role } from '@/types';

export const DemoModeIndicator: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { success } = useToast();

  const handleSwitch = (role: Role) => {
    switchRole(role);
    success(`Switched active view to ${role.toUpperCase()}`, 'Demo Mode');
  };

  const handleReset = () => {
    clearAppStorage();
    window.location.reload();
  };

  return (
    <Dropdown
      align="right"
      trigger={
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/15 transition-colors">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="hidden sm:inline">Demo Mode</span>
          <span className="capitalize font-semibold text-amber-800 dark:text-amber-200">
            ({user?.role || 'Guest'})
          </span>
        </div>
      }
    >
      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Demo Environment</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
          Phase 1 Foundation. Toggle simulated roles to preview interface experiences.
        </p>
      </div>

      <div className="py-1">
        <DropdownItem
          icon={<User className="w-4 h-4 text-indigo-500" />}
          onClick={() => handleSwitch('student')}
        >
          View as Student (Alex)
        </DropdownItem>
        <DropdownItem
          icon={<Shield className="w-4 h-4 text-purple-500" />}
          onClick={() => handleSwitch('admin')}
        >
          View as Admin (Dr. Connor)
        </DropdownItem>
      </div>

      <DropdownDivider />

      <DropdownItem
        icon={<RefreshCw className="w-4 h-4 text-slate-400" />}
        onClick={handleReset}
      >
        Reset Demo Storage
      </DropdownItem>
    </Dropdown>
  );
};
