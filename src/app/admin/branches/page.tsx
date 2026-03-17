"use client";

import { useEffect, useState } from "react";
import { branchService } from "@/services/branchService";
import { Branch } from "@/lib/types";
import { Plus, Building2, MapPin, Edit } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/useAuth";

export default function BranchesPage() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ branch_name: "", location: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    const branchIds = profile.role === 'admin' ? profile.branchIds : [];
    
    const unsub = branchService.subscribe((data) => {
        setBranches(data);
        setLoading(false);
    }, branchIds);

    return () => unsub();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branch_name) return;
    
    setSubmitting(true);
    try {
      await branchService.create({
        ...formData,
        school_id: "default", // Placeholder
        address: "",
        phone: ""
      });
      setFormData({ branch_name: "", location: "" });
      setIsModalOpen(false);
    } catch (error) {
      alert("Failed to create branch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this branch?")) {
      try {
        await branchService.delete(id);
      } catch (error) {
        alert("Failed to delete branch");
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Branch Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage all your school branches here.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/30 transition-all font-medium"
        >
          <Plus className="h-5 w-5" />
          Add Branch
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center p-12 glass-card">
          <Building2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300">No branches found</h3>
          <p className="text-slate-400 mt-2">Get started by creating your first branch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.branch_id} className="glass-card group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 flex gap-2">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Edit className="h-4 w-4" />
                  </button>
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{branch.branch_name}</h3>
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {branch.location || "No location"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Branch"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Branch Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Main Campus"
              value={formData.branch_name}
              onChange={(e) => setFormData({...formData, branch_name: e.target.value})}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
            <input 
              type="text" 
              placeholder="e.g. Phnom Penh"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg shadow-indigo-500/30 transition-all"
            >
              {submitting ? "Creating..." : "Create Branch"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
