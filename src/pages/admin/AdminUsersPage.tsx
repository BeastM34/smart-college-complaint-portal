import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  GraduationCap,
  Wrench,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
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
  Pagination,
  Modal,
  SkeletonLoader,
} from '@/components/common';
import { userService } from '@/services/userService';
import { useToast } from '@/hooks/useToast';
import type { User, Role } from '@/types';

export const AdminUsersPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Change Role Modal
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<Role>('student');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Status Toggle Confirmation Modal
  const [statusModalUser, setStatusModalUser] = useState<User | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Department options from users list
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q));

      // Department
      const matchesDept =
        departmentFilter === 'all' ||
        (u.department && u.department.toLowerCase() === departmentFilter.toLowerCase());

      // Role
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;

      // Status
      const userStatus = u.status || 'active';
      const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;

      return matchesSearch && matchesDept && matchesRole && matchesStatus;
    });
  }, [users, search, departmentFilter, roleFilter, statusFilter]);

  // Paginated list
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const resetFilters = () => {
    setSearch('');
    setDepartmentFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  // Open role modal
  const handleOpenRoleModal = (user: User) => {
    setRoleModalUser(user);
    setNewRole(user.role);
  };

  // Submit role update
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;

    setIsUpdatingRole(true);
    try {
      const updated = await userService.updateUserRole(roleModalUser.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setRoleModalUser(null);
      success(
        `${updated.name}'s role updated to ${newRole.toUpperCase()}`,
        'Role Updated'
      );
    } catch (err) {
      toastError('Failed to change user role', 'Error');
      console.error(err);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Toggle user active / inactive status
  const handleToggleStatus = async () => {
    if (!statusModalUser) return;

    setIsTogglingStatus(true);
    try {
      const updated = await userService.toggleUserStatus(statusModalUser.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      const nextStatus = updated.status || 'active';
      setStatusModalUser(null);
      success(
        `${updated.name} has been ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`,
        'Status Changed'
      );
    } catch (err) {
      toastError('Failed to change user status', 'Error');
      console.error(err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage student records, staff privileges, role access control, and account activation states.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {filteredUsers.length} of {users.length} Registered Users
          </Badge>
        </div>
      </div>

      {/* Filter and Search Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="md:col-span-2">
              <Input
                placeholder="Search by name, student ID, email, department..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {/* Role Filter */}
            <div>
              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as Role | 'all');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'student', label: 'Student' },
                  { value: 'admin', label: 'Admin' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />
            </div>

            {/* Status Filter */}
            <div>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'active' | 'inactive' | 'all');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'inactive', label: 'Inactive / Suspended' },
                ]}
              />
            </div>
          </div>

          {/* Department Filter & Reset */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-72">
              <Select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>

            {(search ||
              departmentFilter !== 'all' ||
              roleFilter !== 'all' ||
              statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 h-8 self-end sm:self-auto"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table Card */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonLoader key={i} variant="card" height={48} />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Users className="w-8 h-8 text-slate-400" />}
                title="No users match filters"
                description="We couldn't find any user accounts matching your search criteria. Try resetting filters."
                action={
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 select-none">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Name</th>
                    <th className="px-3 py-3.5 font-semibold">Student ID</th>
                    <th className="px-4 py-3.5 font-semibold">Email</th>
                    <th className="px-4 py-3.5 font-semibold">Department</th>
                    <th className="px-3 py-3.5 font-semibold">Year</th>
                    <th className="px-3 py-3.5 font-semibold">Role</th>
                    <th className="px-3 py-3.5 font-semibold">Status</th>
                    <th className="px-3 py-3.5 font-semibold">Registered</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedUsers.map((u) => {
                    const isActive = (u.status || 'active') === 'active';
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Name with Avatar */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={u.avatarUrl}
                              alt={u.name}
                              size="sm"
                              name={u.name}
                            />
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                {u.name}
                              </p>
                              {u.phone && (
                                <p className="text-[10px] text-slate-400">{u.phone}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Student ID */}
                        <td className="px-3 py-3.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {u.studentId ? (
                            <span className="font-semibold">{u.studentId}</span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          {u.email}
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                          {u.department || 'Campus General'}
                        </td>

                        {/* Year */}
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {u.year || 'N/A'}
                        </td>

                        {/* Role Badge */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {u.role === 'admin' ? (
                            <Badge variant="critical" size="sm">
                              Admin
                            </Badge>
                          ) : u.role === 'staff' ? (
                            <Badge variant="warning" size="sm">
                              Staff
                            </Badge>
                          ) : (
                            <Badge variant="default" size="sm">
                              Student
                            </Badge>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {isActive ? (
                            <Badge variant="success" size="sm" dot>
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" size="sm" dot>
                              Inactive
                            </Badge>
                          )}
                        </td>

                        {/* Registration Date */}
                        <td className="px-3 py-3.5 whitespace-nowrap text-[11px] text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleOpenRoleModal(u)}
                            >
                              Change Role
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-xs ${
                                isActive
                                  ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              onClick={() => setStatusModalUser(u)}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {(currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, filteredUsers.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredUsers.length}
                </span>{' '}
                users
              </span>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: CHANGE ROLE MODAL */}
      <Modal
        isOpen={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        title={
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span>Change User Role</span>
          </div>
        }
        description={`Update system permissions and authorization tier for ${roleModalUser?.name}.`}
      >
        <form onSubmit={handleRoleSubmit} className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
            <p className="font-bold text-slate-900 dark:text-slate-100">{roleModalUser?.name}</p>
            <p className="text-slate-500">{roleModalUser?.email}</p>
            <p className="text-slate-400">
              Current Role:{' '}
              <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-400">
                {roleModalUser?.role}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select New System Role
            </label>
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              options={[
                { value: 'student', label: 'Student — Access student portal & submit complaints' },
                { value: 'admin', label: 'Admin — Full administrative triage & portal controls' },
                { value: 'staff', label: 'Staff — Maintenance technician view & service tasks' },
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRoleModalUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdatingRole}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Save Role Change
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: STATUS TOGGLE CONFIRMATION */}
      <Modal
        isOpen={!!statusModalUser}
        onClose={() => setStatusModalUser(null)}
        title={
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span>
              {(statusModalUser?.status || 'active') === 'active'
                ? 'Deactivate User Account'
                : 'Activate User Account'}
            </span>
          </div>
        }
        description={`Confirm status modification for ${statusModalUser?.name}.`}
      >
        <div className="space-y-4 pt-2 text-xs text-slate-600 dark:text-slate-400">
          <p>
            {(statusModalUser?.status || 'active') === 'active' ? (
              <>
                Are you sure you want to <strong>deactivate</strong> this account? The user will be unable to log in or submit new complaints until reactivated.
              </>
            ) : (
              <>
                Are you sure you want to <strong>activate</strong> this account? The user will regain full access to portal functions.
              </>
            )}
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusModalUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                (statusModalUser?.status || 'active') === 'active' ? 'danger' : 'primary'
              }
              size="sm"
              isLoading={isTogglingStatus}
              onClick={handleToggleStatus}
            >
              Confirm{' '}
              {(statusModalUser?.status || 'active') === 'active' ? 'Deactivation' : 'Activation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
