import React, { useState } from 'react';
import { Sparkles, Shield, User, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Dropdown, DropdownItem, DropdownDivider } from './Dropdown';
import { Modal } from './Modal';
import { Button } from './Button';
import { settingsService } from '@/services/settingsService';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/services/apiClient';
import type { Role } from '@/types';

/**
 * Determines whether the portal is genuinely operating in local demo/mock mode.
 * Returns false in production environments and whenever an authenticated backend session exists.
 */
export const isDemoModeActive = (): boolean => {
  // If explicitly forced via environment variable
  const envDemo = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_MODE;
  if (envDemo === 'true') return true;
  if (envDemo === 'false') return false;

  // In production builds, never display mock data banner unless explicitly configured
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return false;
  }

  // If an authenticated backend token exists, we are connected to the live backend
  const token = apiClient.getAccessToken();
  if (token) return false;

  // In local development without backend session, allow demo mode
  return true;
};

export const DemoModeIndicator: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { success, error: toastError } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isDemo = isDemoModeActive();
  if (!isDemo) {
    return null;
  }

  const handleSwitch = (role: Role) => {
    switchRole(role);
    success(`Switched active view to ${role.toUpperCase()}`, 'Demo Mode');
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await settingsService.resetDemoData();
      success('All demo data restored to pristine state.', 'Demo Data Reset');
      setConfirmOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      toastError('Failed to reset demo data', 'Error');
      console.error(err);
      setIsResetting(false);
    }
  };

  return (
    <>
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
        onClick={() => setConfirmOpen(true)}
      >
        <span className="text-rose-600 dark:text-rose-400 font-medium">Reset Demo Data</span>
      </DropdownItem>
    </Dropdown>

    {/* Reset Confirmation Modal */}
    <Modal
      isOpen={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      title={
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5" />
          <span>Confirm Demo Reset</span>
        </div>
      }
      description="Restore all mock data across complaints, users, categories, notifications, and settings."
    >
      <div className="space-y-4 pt-2 text-xs text-slate-600 dark:text-slate-300">
        <p>
          Are you sure you want to reset all demo data?
        </p>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200">
          All ticket modifications, new registrations, comments, and settings changes will be reverted to pristine factory mock values.
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={isResetting}
            onClick={handleConfirmReset}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Reset Demo Data
          </Button>
        </div>
      </div>
    </Modal>
  </>
  );
};
