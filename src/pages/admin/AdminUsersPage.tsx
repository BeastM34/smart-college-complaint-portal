import React, { useEffect, useState } from 'react';
import { Users, Search, UserPlus, Shield, Info } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Select,
  Badge,
  Avatar,
  EmptyState,
} from '@/components/common';
import { userService } from '@/services/userService';
import type { User, Role } from '@/types';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService
      .getUsers()
      .then((data) => setUsers(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const matchesSearch =
      search === '' ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            User & Staff Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage student identities, maintenance technicians, and administration privileges.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
          <Info className="w-3.5 h-3.5" />
          <span>Phase 1 Scaffolding Placeholder</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Search user by name, email, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />

            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
              options={[
                { value: 'all', label: 'All Roles' },
                { value: 'student', label: 'Students' },
                { value: 'admin', label: 'Administrators' },
                { value: 'staff', label: 'Maintenance Staff' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Users className="w-6 h-6" />}
                title="No users found"
                description="Try refining your search terms or changing the active role filter."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Department / ID</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={u.avatarUrl}
                            name={u.name}
                            size="sm"
                            status="online"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.role} size="sm">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {u.department || 'General'}
                        {u.studentId && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {u.studentId}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {u.phone || 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
