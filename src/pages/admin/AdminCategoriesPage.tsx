import React, { useEffect, useState } from 'react';
import { Tags, Plus, Clock, CheckCircle2, Info } from 'lucide-react';
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
} from '@/components/common';
import { categoryService } from '@/services/categoryService';
import { useToast } from '@/hooks/useToast';
import type { CategoryItem } from '@/types';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatSla, setNewCatSla] = useState('24');
  const { success } = useToast();

  useEffect(() => {
    categoryService
      .getCategories()
      .then((data) => setCategories(data))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    const created = await categoryService.createCategory({
      name: newCatName,
      slug: newCatName.toLowerCase().replace(/\s+/g, '-'),
      description: newCatDesc,
      active: true,
      complaintCount: 0,
      slaHours: Number(newCatSla) || 24,
    });
    setCategories((prev) => [...prev, created]);
    setShowModal(false);
    setNewCatName('');
    setNewCatDesc('');
    success(`Category "${created.name}" created successfully.`, 'Category Added');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Category & SLA Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define maintenance categories, assignable teams, and default SLA turnaround hours.
          </p>
        </div>

        <Button size="sm" onClick={() => setShowModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} hoverEffect className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{cat.name}</CardTitle>
                <Badge variant={cat.active ? 'success' : 'outline'} size="sm">
                  {cat.active ? 'Active' : 'Archived'}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2 mt-1">
                {cat.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  SLA: {cat.slaHours || 24} hrs
                </span>
                <span>{cat.complaintCount || 0} tickets</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Maintenance Category"
        description="Configure a new complaint domain for student reporting."
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Category Name"
            required
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Laboratory Safety & Chemicals"
          />

          <Input
            label="Target SLA Turnaround (Hours)"
            type="number"
            required
            value={newCatSla}
            onChange={(e) => setNewCatSla(e.target.value)}
          />

          <Textarea
            label="Description"
            rows={3}
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
            placeholder="Specify what type of issues fall under this category..."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
