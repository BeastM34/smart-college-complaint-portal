import React, { useEffect, useState, useMemo } from 'react';
import {
  Tags,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Power,
  RotateCcw,
  Search,
  Layers,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Modal,
  Input,
  Textarea,
  EmptyState,
  SkeletonLoader,
} from '@/components/common';
import { categoryService } from '@/services/categoryService';
import { useToast } from '@/hooks/useToast';
import type { CategoryItem } from '@/types';

export const AdminCategoriesPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Category Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addSla, setAddSla] = useState('24');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Category Modal State
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSla, setEditSla] = useState('24');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [categories, search]);

  // Handle Add Category
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;

    setIsSubmittingAdd(true);
    try {
      const created = await categoryService.createCategory({
        name: addName.trim(),
        slug: addName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: addDesc.trim(),
        active: true,
        complaintCount: 0,
        slaHours: Number(addSla) || 24,
      });

      setCategories((prev) => [...prev, created]);
      setShowAddModal(false);
      setAddName('');
      setAddDesc('');
      setAddSla('24');
      success(`Category "${created.name}" created successfully.`, 'Category Added');
    } catch (err) {
      toastError('Failed to create category', 'Error');
      console.error(err);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
    setEditSla(String(cat.slaHours || 24));
  };

  // Handle Edit Category
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) return;

    setIsSubmittingEdit(true);
    try {
      const updated = await categoryService.updateCategory(editingCategory.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        slaHours: Number(editSla) || 24,
      });

      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCategory(null);
      success(`Category "${updated.name}" updated successfully.`, 'Category Modified');
    } catch (err) {
      toastError('Failed to update category', 'Error');
      console.error(err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Activate / Deactivate
  const handleToggleStatus = async (cat: CategoryItem) => {
    try {
      const updated = await categoryService.toggleCategoryStatus(cat.id);
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      success(
        `Category "${updated.name}" is now ${updated.active ? 'Active' : 'Inactive'}.`,
        'Status Toggled'
      );
    } catch (err) {
      toastError('Failed to toggle category status', 'Error');
      console.error(err);
    }
  };

  const totalComplaints = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.complaintCount || 0), 0);
  }, [categories]);

  const activeCategoriesCount = useMemo(() => {
    return categories.filter((c) => c.active).length;
  }, [categories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Category Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure maintenance classifications, SLA resolution standards, and category availability.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add New Category
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Categories</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {categories.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Tags className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Active Categories
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {activeCategoriesCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                Total Tracked Complaints
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {totalComplaints}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Input */}
      <div className="max-w-md">
        <Input
          placeholder="Search categories by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Categories Table / Card Grid */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonLoader key={i} variant="card" height={52} />
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={<Tags className="w-8 h-8 text-slate-400" />}
                title="No categories found"
                description="Try clearing your search query or add a new category to get started."
                action={
                  <Button size="sm" onClick={() => setShowAddModal(true)}>
                    Create Category
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 select-none">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Category Name</th>
                    <th className="px-5 py-3.5 font-semibold">Description</th>
                    <th className="px-4 py-3.5 font-semibold">Turnaround SLA</th>
                    <th className="px-4 py-3.5 font-semibold">Complaint Count</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {cat.name}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 pl-4">
                          slug: {cat.slug}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-5 py-4 max-w-sm">
                        <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                          {cat.description || 'No description provided.'}
                        </p>
                      </td>

                      {/* SLA */}
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          {cat.slaHours || 24} hours
                        </span>
                      </td>

                      {/* Complaint Count */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {cat.complaintCount || 0} tickets
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {cat.active ? (
                          <Badge variant="success" size="sm" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" size="sm" dot>
                            Inactive
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleOpenEdit(cat)}
                            leftIcon={<Edit2 className="w-3 h-3" />}
                          >
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 text-xs ${
                              cat.active
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            onClick={() => handleToggleStatus(cat)}
                            leftIcon={<Power className="w-3 h-3" />}
                          >
                            {cat.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: ADD CATEGORY MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            <span>Create Complaint Category</span>
          </div>
        }
        description="Add a new campus facility category to the student complaint portal."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Category Name *
            </label>
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Laboratory Equipment"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Resolution SLA (Hours)
            </label>
            <Input
              type="number"
              min="1"
              max="720"
              value={addSla}
              onChange={(e) => setAddSla(e.target.value)}
              placeholder="24"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <Textarea
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              placeholder="Describe what issues fall under this classification..."
              rows={3}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Create Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT CATEGORY MODAL */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title={
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-indigo-600" />
            <span>Edit Category</span>
          </div>
        }
        description={`Update settings and description for "${editingCategory?.name}".`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Category Name *
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Electrical Maintenance"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Resolution SLA (Hours)
            </label>
            <Input
              type="number"
              min="1"
              max="720"
              value={editSla}
              onChange={(e) => setEditSla(e.target.value)}
              placeholder="24"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Describe what issues fall under this classification..."
              rows={3}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingCategory(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
