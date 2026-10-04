import React from 'react';
import type { DepartmentMetric } from '@/types';
import { cn } from '@/utils/cn';
import { Building2, Inbox } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/common';

export interface DepartmentPerformanceTableProps {
  data: DepartmentMetric[];
  className?: string;
}

export const DepartmentPerformanceTable: React.FC<DepartmentPerformanceTableProps> = ({
  data,
  className,
}) => {
  if (data.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No department data available
        </p>
        <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
          No complaints logged in the selected reporting period.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Department</TableHead>
            <TableHead className="text-center">Total</TableHead>
            <TableHead className="text-center">Active Queue</TableHead>
            <TableHead className="text-center">Pending</TableHead>
            <TableHead className="text-center">Resolved</TableHead>
            <TableHead className="text-right">Resolution Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((dept) => {
            const isHighPerformance = dept.resolutionRate >= 70;
            const isMidPerformance = dept.resolutionRate >= 40 && dept.resolutionRate < 70;

            return (
              <TableRow key={dept.department}>
                <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate max-w-xs">{dept.department}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono font-semibold">
                  {dept.total}
                </TableCell>
                <TableCell className="text-center font-mono text-amber-600 dark:text-amber-400 font-semibold">
                  {dept.active}
                </TableCell>
                <TableCell className="text-center font-mono text-slate-500 dark:text-slate-400">
                  {dept.pending}
                </TableCell>
                <TableCell className="text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {dept.resolved}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden hidden sm:block">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          isHighPerformance
                            ? 'bg-emerald-500'
                            : isMidPerformance
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        )}
                        style={{ width: `${dept.resolutionRate}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold',
                        isHighPerformance
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : isMidPerformance
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      )}
                    >
                      {dept.resolutionRate}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
