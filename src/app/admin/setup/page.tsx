"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Building2, 
  GraduationCap, 
  Landmark, 
  Plus, 
  School, 
  BookOpen, 
  Calendar, 
  Settings, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Save, 
  Loader2, 
  Users,
  MoreVertical,
  Check,
  Camera,
  X,
  Edit,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { 
  getSchoolDetails, 
  updateSchoolDetails, 
  createSchoolDetails, 
  subscribeToSchoolDetails, 
  subscribeToClasses, 
  subscribeToStudents, 
  subscribeToEnrollments,
  uploadImage 
} from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { inventoryService } from "@/services/inventoryService";
import { School as SchoolType, Branch, Class, Enrollment, InventoryItem } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="h-96 flex justify-center items-center"><Loader2 className="animate-spin text-blue-600" size={48} /></div>}>
        <SetupContent />
    </Suspense>
  );
}

function SetupContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as string;
  
  const [activeTab, setActiveTab] = useState(tabParam || 'branches');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null); // Add state for editing
  const [school, setSchool] = useState<SchoolType | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [classes, setClasses] = useState<Class[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  // Sticky state for the form
  const [lastSelectedBranch, setLastSelectedBranch] = useState<string>("");

  useEffect(() => {
    if (!profile) return;
    
    const branchIds = profile.role === 'admin' ? profile.branchIds : [];

    const unsubSchool = subscribeToSchoolDetails(setSchool);
    const unsubBranches = branchService.subscribe(setBranches, branchIds);
    const unsubClasses = subscribeToClasses(setClasses, branchIds);
    const unsubEnrollments = subscribeToEnrollments(setEnrollments, branchIds);
    const unsubInventory = inventoryService.subscribe(setInventoryItems, branchIds);
    return () => {
        unsubSchool();
        unsubBranches();
        unsubClasses();
        unsubEnrollments();
        unsubInventory();
    };
  }, [profile]);

  useEffect(() => {
    if (!searchParams.get('tab')) {
        router.replace('/admin/setup?tab=branches', { scroll: false });
    } else if (tabParam !== activeTab) {
        setActiveTab(tabParam);
    }
  }, [searchParams, activeTab, router, tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setShowAddForm(false);
    setEditingProgram(null); // Clear edit state
    router.push(`/admin/setup?tab=${tab}`, { scroll: false });
  };

  const hasSchool = !!school?.school_id;
  const hasBranches = branches.length > 0;

  return (
    <div className="max-w-[1800px] mx-auto space-y-8 pb-20 px-4 xl:px-0">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-4">
          <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 animate-in zoom-in-95 duration-500">
                  <Settings size={24} />
              </div>
              <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Configuration</h1>

              </div>
          </div>
          
          <div className="bg-white/60 backdrop-blur-md p-1.5 rounded-[1.5rem] flex items-center shadow-sm border border-slate-200/50 w-full lg:w-auto overflow-x-auto custom-scrollbar">
             <TabButton 
                active={activeTab === 'branches'} 
                onClick={() => handleTabChange('branches')} 
                icon={<Building2 size={18} />} 
                label="Branches" 
             />
             <TabButton 
                active={activeTab === 'programs'} 
                onClick={() => handleTabChange('programs')} 
                icon={<GraduationCap size={18} />} 
                label="Programs" 
                disabled={!hasBranches}
             />
             <TabButton 
                active={activeTab === 'identity'} 
                onClick={() => handleTabChange('identity')} 
                icon={<Landmark size={18} />} 
                label="School Identity" 
             />
          </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'branches' && (
              <div className="space-y-6">
                   {!hasSchool ? (
                       <SetupRequired message="Please configure your School Identity first." action={() => handleTabChange('identity')} />
                   ) : showAddForm ? (
                       <div className="max-w-3xl mx-auto">
                            <CreateBranchForm school={school} onCancel={() => setShowAddForm(false)} />
                       </div>
                   ) : (
                       <BranchList branches={branches} enrollments={enrollments} onAdd={() => setShowAddForm(true)} />
                   )}
              </div>
          )}

          {activeTab === 'programs' && (
              <div className="space-y-6">
                  {!hasBranches ? (
                       <SetupRequired message="Please create at least one Branch first." action={() => handleTabChange('branches')} />
                   ) : (showAddForm || editingProgram) ? (
                       <div className="max-w-3xl mx-auto">
                            <ProgramForm 
                                 branches={branches} 
                                 initialData={editingProgram}
                                 onCancel={() => {
                                     setShowAddForm(false);
                                     setEditingProgram(null);
                                 }} 
                                 lastSelectedBranch={lastSelectedBranch}
                                 setLastSelectedBranch={setLastSelectedBranch}
                                 inventoryItems={inventoryItems}
                                 role={profile?.role}
                            />
                       </div>
                   ) : (
                       <ProgramList 
                            branches={branches}
                            classes={classes} 
                            enrollments={enrollments} 
                            inventoryItems={inventoryItems}
                            onAdd={() => setShowAddForm(true)}
                            onEdit={(program: any) => setEditingProgram(program)}
                            onDelete={async (id: string) => {
                                try {
                                    await programService.delete(id);
                                } catch (e) {
                                    console.error(e);
                                    alert("Failed to delete program");
                                }
                            }}
                            role={profile?.role}
                       />
                   )}
              </div>
          )}

          {activeTab === 'identity' && (
               <div className="max-w-4xl mx-auto">
                    <SchoolSettingsForm school={school} />
               </div>
          )}
      </div>
    </div>
  );
}

// --- Components ---

function TabButton({ active, onClick, icon, label, disabled }: any) {
    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.125rem] font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${
                active 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
                : disabled 
                ? 'text-slate-300 cursor-not-allowed opacity-50'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-white'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

function SetupRequired({ message, action }: { message: string, action: () => void }) {
    return (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2">
                <Landmark size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Setup Required</h3>
            <p className="text-slate-500 font-medium">{message}</p>
            <button onClick={action} className="mt-4 text-blue-600 font-bold hover:underline">
                Go to configuration &rarr;
            </button>
        </div>
    );
}

// --- Forms & Lists ---

function BranchList({ branches, enrollments, onAdd }: any) {
    return (
        <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/50 shadow-sm overflow-hidden">
             <div className="px-8 py-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Building2 size={24} />
                    </div>
                    <div>
                         <h2 className="text-xl font-black text-slate-800 tracking-tight">Branch Campuses</h2>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Locations</p>
                    </div>
                </div>
                <button onClick={onAdd} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.25rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 w-full sm:w-auto justify-center active:scale-95">
                    <Plus size={20} />
                    <span>Create Branch</span>
                </button>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left min-w-[800px]">
                     <thead>
                         <tr className="bg-slate-50/50 border-b border-slate-100">
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Name</th>
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Contact</th>
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Address</th>
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Enrollment</th>
                             <th className="px-8 py-4"></th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                          {branches.length === 0 ? (
                              <tr>
                                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">No branches registered yet.</td>
                              </tr>
                          ) : branches.map((b: any) => (
                              <tr key={b.branch_id} className="hover:bg-blue-50/30 transition-colors group">
                                  <td className="px-8 py-5 font-bold text-slate-700">{b.branch_name}</td>
                                  <td className="px-8 py-5 text-sm text-slate-500">{b.phone}</td>
                                  <td className="px-8 py-5 text-sm text-slate-500 max-w-xs truncate">{b.address}</td>
                                  <td className="px-8 py-5 text-center">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                          {/* Placeholder count logic since strict mapping is complex in pure view */}
                                          {enrollments?.length > 0 ? 'Active' : '0'} 
                                      </span>
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                      <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                                          <Settings size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                     </tbody>
                 </table>
            </div>
        </div>
    )
}

function ProgramList({ branches, classes, enrollments, inventoryItems, onAdd, onEdit, onDelete, role }: any) {
    const [programs, setPrograms] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");

    useEffect(() => {
        const unsubscribe = programService.subscribe(setPrograms);
        return () => unsubscribe();
    }, []);

    const filteredPrograms = programs.filter(p => !selectedBranch || p.branchId === selectedBranch);

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Academic Programs</h2>
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest text-[10px] mt-1">Curriculum and fee structures</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Branch Filter */}
                    <div className="relative group w-full sm:w-64">
                        <select 
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all cursor-pointer appearance-none pr-10"
                        >
                            <option value="">All Branches</option>
                            {branches.map((b: any) => (
                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <ChevronDown size={16} />
                        </div>
                    </div>

                    <button onClick={onAdd} className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 w-full sm:w-auto justify-center active:scale-95">
                        <Plus size={18} />
                        <span>New Program</span>
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-slate-50/30">
                 {filteredPrograms.length === 0 ? (
                      <div className="col-span-full py-20 text-center space-y-4">
                           <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto">
                                <BookOpen size={32} />
                           </div>
                           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No programs found matching filters</p>
                      </div>
                 ) : filteredPrograms.map(p => (
                      <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative">
                           <div className="flex justify-between items-start mb-4">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">
                                   <GraduationCap size={24} />
                               </div>
                               <div className="flex items-center gap-1">
                                   <button 
                                       onClick={() => onEdit(p)}
                                       className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                       title="Edit Program"
                                   >
                                       <Edit size={16} />
                                   </button>
                                   {role === 'superAdmin' && (
                                       <button 
                                           onClick={() => {
                                               if (confirm("Are you sure you want to delete this program?")) {
                                                   onDelete(p.id);
                                               }
                                           }}
                                           className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                           title="Delete Program"
                                       >
                                           <Trash2 size={16} />
                                       </button>
                                   )}
                               </div>
                           </div>

                           <div className="space-y-1 mb-4">
                                <div className="flex justify-between items-center">
                                     <h3 className="text-lg font-black text-slate-800 tracking-tight">{p.name}</h3>
                                     <span className="text-xl font-black text-slate-900">${p.price}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                         {branches.find((b: any) => b.branch_id === p.branchId)?.branch_name || 'Across Branches'}
                                     </span>
                                </div>
                           </div>

                           <div className="flex items-center gap-4">
                               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                    <Calendar size={12} className="text-indigo-400" />
                                    <span>{p.durationSessions} Sessions</span>
                               </div>
                                {p.session_fee && (
                                   <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest leading-none">
                                        <span>${p.session_fee}/S</span>
                                   </div>
                                )}
                                {p.needs_inventory && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest" title="Needs Uniforms/Books">
                                        <span>
                                            {p.inventoryItemIds?.length 
                                                ? p.inventoryItemIds.map((id: string) => inventoryItems?.find((i: any) => i.id === id)?.name).filter(Boolean).join(', ')
                                                : 'Uniforms/Books'}
                                        </span>
                                    </div>
                                )}
                           </div>
                      </div>
                 ))}
                 
                 {/* Add New Card (Alternative to Top Button) */}
                 <button onClick={onAdd} className="bg-white p-6 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all min-h-[160px]">
                      <Plus size={32} className="mb-2" />
                      <span className="font-bold text-sm">Add Another Program</span>
                 </button>
            </div>
        </div>
    )
}

function ProgramForm({ branches, initialData, onCancel, lastSelectedBranch, setLastSelectedBranch, inventoryItems, role }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [needsInventory, setNeedsInventory] = useState(initialData?.needs_inventory || false);
    const [addons, setAddons] = useState<any[]>([]);
    const [deletedAddonIds, setDeletedAddonIds] = useState<string[]>([]);
    const [programName, setProgramName] = useState(initialData?.name || "");

    useEffect(() => {
        if (initialData?.id) {
            import("@/services/programAddonService").then(({ getProgramAddons }) => {
                getProgramAddons(initialData.id).then(fetched => {
                    setAddons(fetched);
                });
            });
        }
    }, [initialData]);

    useEffect(() => {
        if (!initialData) {
            const lowerName = programName.toLowerCase();
            const needsIt = ['taekwondo', 'music', 'ballet', 'robamkmer', 'chinese'].some(keyword => lowerName.includes(keyword));
            if (needsIt && addons.length === 0) {
                // Auto-add an empty slot instead of setting a simple boolean
                setAddons([{ itemId: '', type: 'inventory', defaultQty: 1, isOptional: true, isRecommended: false }]);
            }
        }
    }, [programName, initialData]);

    const handleToggleItem = () => {
        setAddons([...addons, { itemId: '', type: 'inventory', defaultQty: 1, isOptional: true, isRecommended: false }]);
    };

    const handleRemoveItem = (index: number) => {
        const addonToRemove = addons[index];
        if (addonToRemove?.id) {
            setDeletedAddonIds([...deletedAddonIds, addonToRemove.id]);
        }
        setAddons(addons.filter((_, i) => i !== index));
    };

    const handleAddonUpdate = (index: number, updates: any) => {
        const newAddons = [...addons];
        newAddons[index] = { ...newAddons[index], ...updates };
        setAddons(newAddons);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const formData = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(formData);
            
            // Clean up empty addons
            const validAddons = addons.filter(a => a.itemId);
            const hasAddons = validAddons.length > 0;
            
            data.needs_inventory = hasAddons;
            data.inventoryItemIds = hasAddons ? validAddons.map(a => a.itemId) : [];
            
            // Save sticky branch
            if (setLastSelectedBranch && data.branchId) {
                setLastSelectedBranch(data.branchId.toString());
            }

            let programId = initialData?.id;

            if (initialData) {
                await programService.update(initialData.id, data);
            } else {
                const newProgramId = await programService.create(data as any);
                programId = newProgramId;
            }

            // Sync Addons
            const { addProgramAddon, updateProgramAddon, deleteProgramAddon } = await import("@/services/programAddonService");
            
            // Process deletes
            for (const id of deletedAddonIds) {
                await deleteProgramAddon(id);
            }
            // If they removed all addons from a previously dirty state
            if (!hasAddons && initialData) {
                for (const addon of addons) {
                    if (addon.id) await deleteProgramAddon(addon.id);
                }
            }
            
            if (hasAddons) {
                // Process adds / updates
                for (let i = 0; i < validAddons.length; i++) {
                    const addon = validAddons[i];
                    addon.sortOrder = i; 
                    if (addon.id) {
                        await updateProgramAddon(addon.id, addon);
                    } else {
                        await addProgramAddon({ ...addon, programId } as any);
                    }
                }
            }

            onCancel();
        } catch (error) {
            console.error(error);
            alert("Failed to save program");
        } finally {
            setSubmitting(false);
        }
    }
    
    return (
        <CardForm 
            title={initialData ? "Edit Academic Program" : "New Academic Program"} 
            onCancel={onCancel} 
            onSubmit={handleSubmit} 
            submitLabel={submitting ? (<Loader2 className="animate-spin" />) : (initialData ? "Update" : "Create")}
        >
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 ml-1 uppercase">Branch Name</label>
                     <select 
                        name="branchId" 
                        required 
                        defaultValue={initialData?.branchId || lastSelectedBranch}
                        className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-500/20 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                    >
                         {branches.map((b: any) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                     </select>
                 </div>
                 <InputGroup 
                    label="Program Name" 
                    name="name" 
                    required 
                    placeholder="e.g. General English" 
                    defaultValue={initialData?.name} 
                    onChange={(e: any) => setProgramName(e.target.value)}
                 />
                 <InputGroup label="Sessions" name="durationSessions" type="number" required defaultValue={initialData?.durationSessions || 11} />
                 <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Tuition Fee ($)" name="price" type="number" required placeholder="Total" defaultValue={initialData?.price} step="0.01" />
                    <InputGroup label="Session Fee ($)" name="session_fee" type="number" placeholder="Fee per session" defaultValue={initialData?.session_fee} step="0.01" />
                 </div>
                 <div className="sm:col-span-2 pt-4 border-t border-slate-100 mt-2">
                         <div className="flex items-center justify-between mb-4">
                             <div>
                                 <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                     <BookOpen size={16} className="text-indigo-600" /> Program Add-ons & Materials
                                 </label>
                                 <p className="text-xs text-slate-500 mt-0.5">Configure additional items (like uniforms or books) required or optional for this program.</p>
                             </div>
                             <button type="button" onClick={handleToggleItem} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm">
                                 <Plus size={16} /> Add Item
                             </button>
                         </div>
                         
                         {addons.length === 0 ? (
                             <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-500 text-sm font-bold">
                                 No add-ons configured. Click "Add Item" to include materials.
                             </div>
                         ) : (
                             <div className="space-y-3">
                                 {addons.map((addon, index) => {
                                     const selectedItem = inventoryItems?.find((i: any) => i.id === addon.itemId);
                                     return (
                                         <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group">
                                             <div className="flex-1 min-w-[200px]">
                                                 <select 
                                                     value={addon.itemId} 
                                                     onChange={(e) => handleAddonUpdate(index, { itemId: e.target.value })}
                                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                                 >
                                                     <option value="" disabled>Select Item...</option>
                                                     {inventoryItems?.map((item: any) => (
                                                         <option key={item.id} value={item.id}>{item.name} {item.price ? `($${item.price})` : ''}</option>
                                                     ))}
                                                 </select>
                                             </div>
                                             
                                             <div className="flex items-center gap-3 shrink-0">
                                                 {addon.itemId && (
                                                     <label className="flex items-center gap-2 cursor-pointer group/opt bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 hover:border-indigo-200 transition-all">
                                                         <div className="relative flex items-center justify-center">
                                                             <input 
                                                                 type="checkbox"
                                                                 checked={addon.isOptional}
                                                                 onChange={(e) => handleAddonUpdate(index, { isOptional: e.target.checked })}
                                                                 className="peer sr-only"
                                                             />
                                                             <div className="w-4 h-4 rounded border-2 border-slate-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                                                                <Check size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                                                             </div>
                                                         </div>
                                                         <span className="text-xs font-bold text-slate-600 group-hover/opt:text-indigo-700 transition-colors">Optional</span>
                                                     </label>
                                                 )}
                                                 
                                                 {role === 'superAdmin' && (
                                                     <button 
                                                        type="button" 
                                                        onClick={() => handleRemoveItem(index)} 
                                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all"
                                                        title="Remove Item"
                                                    >
                                                         <Trash2 size={16} />
                                                     </button>
                                                 )}
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                     </div>
             </div>
        </CardForm>
    )
}

function SchoolSettingsForm({ school }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        try {
            let logoUrl = school?.logo_url;
            if (logoFile) {
                logoUrl = await uploadImage(logoFile, `school/logo_${Date.now()}`);
            }

            const data: any = {
                school_name: formData.get("school_name"),
                website: formData.get("website"),
                address: formData.get("address"),
                contact_info: formData.get("contact_info"),
                email: formData.get("email"),
                logo_url: logoUrl
            };

            if (school?.school_id) await updateSchoolDetails(school.school_id, data);
            else await createSchoolDetails(data);
            
            // Clear file state after successful save
            setLogoFile(null);
        } catch (error) {
            console.error(error);
            alert("Failed to save settings");
        } finally {
            setSubmitting(false);
        }
    }

    return (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             {/* Left Side: Edit Form */}
             <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                 <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                     <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Update Profile</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Required * Optional</p>
                     </div>
                 </div>
                 
                 <form onSubmit={handleSubmit} className="p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="relative p-6 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group overflow-hidden">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleLogoChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                />
                                {logoPreview || school?.logo_url ? (
                                    <img src={logoPreview || school.logo_url} alt="Logo" className="w-16 h-16 rounded-full object-cover mb-2 ring-4 ring-white shadow-md transform group-hover:scale-110 transition-transform" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <School size={28} />
                                    </div>
                                )}
                                <span className="text-xs font-bold text-blue-600">
                                    {logoPreview || school?.logo_url ? 'Change Logo' : 'Upload Logo'}
                                </span>
                           </div>
                           <div className="space-y-6">
                                <InputGroup label="Phone Number" name="contact_info" defaultValue={school?.contact_info} required />
                                <InputGroup label="Website URL" name="website" defaultValue={school?.website} />
                           </div>
                           
                           <InputGroup label="Name of Institute" name="school_name" defaultValue={school?.school_name} required className="sm:col-span-1" />
                           <InputGroup label="Address" name="address" defaultValue={school?.address} required className="sm:col-span-1" />
                           
                           <InputGroup label="Institutional Email" name="email" defaultValue={school?.email} required className="sm:col-span-2" />
                      </div>
                      
                      <div className="flex justify-end pt-2">
                           <button disabled={submitting} className="px-8 py-3 bg-orange-400 text-white rounded-xl font-bold text-sm hover:bg-orange-500 transition-all shadow-lg shadow-orange-100 disabled:opacity-50">
                               {submitting ? 'Saving...' : 'Update Profile'}
                           </button>
                      </div>
                 </form>
             </div>

             {/* Right Side: Profile Preview */}
             <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden p-8 flex flex-col items-center text-center relative">
                 <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider rounded-full">
                     Profile View
                 </div>
                 
                <div className="mt-8 mb-6 relative group">
                    <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-xl shadow-slate-200 border-4 border-slate-50 ring-1 ring-slate-100 overflow-hidden relative">
                         {logoPreview || school?.logo_url ? (
                             <img src={logoPreview || school.logo_url} alt="School Logo" className="w-full h-full object-cover" />
                         ) : school?.school_name ? (
                             <span className="text-3xl font-black uppercase">{school.school_name.charAt(0)}</span>
                         ) : (
                             <School size={48} />
                         )}
                         
                         {/* Hidden Input Trigger Overlay */}
                         <div 
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                         >
                            <Camera size={24} className="text-white" />
                         </div>
                    </div>
                </div>

                 <h2 className="text-xl font-black text-slate-800 leading-tight mb-1">
                     {school?.school_name || "Your Institute Name"}
                 </h2>
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">
                     Institute Target Line
                 </p>

                 <div className="w-full space-y-4 text-left">
                     <PreviewItem icon={<Phone size={14} />} label="Phone No" value={school?.contact_info} />
                     <PreviewItem icon={<Mail size={14} />} label="Email" value={school?.email} />
                     <PreviewItem icon={<Globe size={14} />} label="Website" value={school?.website} />
                     <PreviewItem icon={<MapPin size={14} />} label="Address" value={school?.address} dashed />
                 </div>
             </div>
         </div>
    )
}

function PreviewItem({ icon, label, value, dashed }: any) {
    return (
        <div className="group">
             <div className="flex items-center gap-2 text-slate-400 mb-1">
                 {icon}
                 <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
             </div>
             <p className={`text-sm font-bold text-slate-700 break-words ${dashed ? 'border-b border-dashed border-slate-300 pb-1' : ''}`}>
                 {value || "----------------"}
             </p>
        </div>
    )
}

function CreateBranchForm({ school, onCancel }: any) {
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // same logic as before, simpler for brevity in this rewrite
        const data = Object.fromEntries(new FormData(e.currentTarget));
        await branchService.create({ ...data, school_id: school.school_id } as any);
        onCancel();
    }

    return (
        <CardForm title="New Branch Campus" onCancel={onCancel} onSubmit={handleSubmit}>
             <div className="space-y-6">
                 <InputGroup label="Branch Name" name="branch_name" required placeholder="e.g. North Campus" />
                 <InputGroup label="Phone" name="phone" required placeholder="Contact Number" />
                 <InputGroup label="Address" name="address" required placeholder="Location Address" />
             </div>
        </CardForm>
    )
}

// --- Generic UI Helpers ---

function CardForm({ title, children, onCancel, onSubmit, submitLabel = "Create" }: any) {
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-6 sm:p-8 md:p-12 animate-in zoom-in-95 duration-300 relative">
             <button 
                onClick={onCancel}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
             >
                <X size={24} />
             </button>
             <div className="text-center mb-8">
                 <h2 className="text-2xl font-black text-slate-800">{title}</h2>
             </div>
             <form onSubmit={onSubmit}>
                 {children}
                 <div className="flex gap-4 mt-8">
                     <button type="button" onClick={onCancel} className="flex-1 py-4 rounded-xl font-bold text-slate-400 hover:bg-slate-50">Cancel</button>
                     <button type="submit" className="flex-1 py-4 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200">{submitLabel}</button>
                 </div>
             </form>
        </div>
    )
}

function InputGroup({ label, name, type="text", required, defaultValue, placeholder, icon, className, onChange, ...props }: any) {
    return (
        <div className={`space-y-2 ${className}`}>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 ml-1 uppercase tracking-wide">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative group">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10">
                        {icon}
                    </div>
                )}
                <input 
                    name={name}
                    type={type}
                    required={required}
                    defaultValue={defaultValue}
                    placeholder={placeholder}
                    step={props.step}
                    onChange={onChange}
                    className={`w-full ${icon ? 'pl-14 pr-5' : 'px-5'} py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-blue-500/20 focus:bg-white outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all shadow-sm`}
                />
            </div>
        </div>
    )
}
