"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    Plus, Loader2, Edit, Trash2, Camera, X, FolderOpen, PackageSearch
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { branchService } from "@/services/branchService";
import { inventoryService } from "@/services/inventoryService";
import { productGroupService } from "@/services/productGroupService";
import { programService } from "@/services/programService";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Branch, InventoryItem, InventoryVariant, ProductGroup, Program } from "@/lib/types";

// Sample size presets
const SAMPLE_PRESETS: Record<string, string[]> = {
    "S M L XL":   ["S", "M", "L", "XL"],
    "XXS–XXL":    ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
    "Kids/Adult": ["Kids", "Adult"],
    "1 2 3 4":    ["1", "2", "3", "4"],
};

export default function InventoryGroupsPage() {
    const { profile } = useAuth();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [groups, setGroups] = useState<ProductGroup[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [showGroupForm, setShowGroupForm] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

    // Confirm modal state
    const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        if (!profile) return;
        const branchIds: string[] = []; // Both admin and superAdmin see all
        const unsubBranches = branchService.subscribe(setBranches, branchIds);
        const unsubGroups = productGroupService.subscribe((data) => {
            setGroups(data);
            if (data.length > 0 && !activeGroupId) setActiveGroupId(data[0].id);
        }, branchIds);
        const unsubInventory = inventoryService.subscribe((data) => { setItems(data); setLoading(false); }, branchIds);
        const unsubPrograms = programService.subscribe(setPrograms, branchIds);
        return () => { unsubBranches(); unsubGroups(); unsubInventory(); unsubPrograms(); };
    }, [profile]);

    const handleDeleteProduct = async (id: string) => {
        setConfirmModal({
            message: "Delete this product? This cannot be undone.",
            onConfirm: async () => {
                try { await inventoryService.delete(id); }
                catch { /* silently ignore */ }
                setConfirmModal(null);
            }
        });
    };

    const handleDeleteGroup = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const groupItems = items.filter(i => i.groupId === id);
        const groupName = groups.find(g => g.id === id)?.name || "this group";
        const message = groupItems.length > 0
            ? `Delete "${groupName}" and all ${groupItems.length} product(s) inside? This cannot be undone.`
            : `Delete "${groupName}"? This cannot be undone.`;
        setConfirmModal({
            message,
            onConfirm: async () => {
                try {
                    await Promise.all(groupItems.map(item => inventoryService.delete(item.id)));
                    await productGroupService.delete(id);
                    if (activeGroupId === id) setActiveGroupId(groups.find(g => g.id !== id)?.id || null);
                } catch (err) {
                    console.error("Delete group failed:", err);
                }
                setConfirmModal(null);
            }
        });
    };

    const handleEditGroup = (group: ProductGroup, e: React.MouseEvent) => {
        e.stopPropagation(); setEditingGroup(group); setShowGroupForm(true);
    };

    if (!profile) return null;
    if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;

    const activeGroupProducts = items.filter(item => item.groupId === activeGroupId);
    const activeGroupData = groups.find(g => g.id === activeGroupId);

    return (
        <div className="w-full max-w-[1800px] mx-auto space-y-8 pb-20 px-4 sm:px-0 lg:px-0">
            {/* Confirm Delete Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-rose-600" />
                            </div>
                            <p className="text-slate-700 font-bold text-sm leading-relaxed">{confirmModal.message}</p>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
                            <button type="button" onClick={confirmModal.onConfirm} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-black text-sm hover:bg-rose-700 transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0"><FolderOpen size={32} /></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Custom Product Groups</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1">Create folders to organize your products.</p>
                    </div>
                </div>
                <div className="flex flex-nowrap items-center gap-3">
                    <button onClick={() => { setEditingGroup(null); setShowGroupForm(true); }} className="flex-none flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 border border-indigo-200 rounded-xl font-black text-xs hover:bg-indigo-50 transition-all shadow-sm whitespace-nowrap">
                        <Plus size={16} /> Create Group
                    </button>
                    {activeGroupId && (
                        <button onClick={() => { setEditingItem(null); setShowProductForm(true); }} className="flex-none flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all hover:-translate-y-0.5 whitespace-nowrap">
                            <Plus size={16} /> Add Product
                        </button>
                    )}
                </div>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {groups.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-black text-slate-700 mb-1">No Groups Yet</h3>
                        <button onClick={() => setShowGroupForm(true)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 mt-3">+ Create Group</button>
                    </div>
                ) : groups.map(group => {
                    const productCount = items.filter(i => i.groupId === group.id).length;
                    return (
                        <div key={group.id} onClick={() => setActiveGroupId(group.id)}
                            className={`p-5 rounded-3xl border transition-all cursor-pointer group flex flex-col relative ${activeGroupId === group.id ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100 -translate-y-1' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeGroupId === group.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                    <FolderOpen size={20} />
                                </div>
                                <div className="flex gap-1">
                                    <button type="button" onClick={(e) => handleEditGroup(group, e)} className={`p-1.5 rounded-md transition-colors ${activeGroupId === group.id ? 'text-white/70 hover:bg-white/20' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}><Edit size={14} /></button>
                                    {profile?.role === 'superAdmin' && (
                                        <button type="button" onClick={(e) => handleDeleteGroup(group.id, e)} className={`p-1.5 rounded-md transition-colors ${activeGroupId === group.id ? 'text-rose-300 hover:bg-white/20 hover:text-rose-200' : 'text-rose-400 hover:bg-rose-50 hover:text-rose-600'}`}><Trash2 size={14} /></button>
                                    )}
                                </div>
                            </div>
                            <h3 className={`font-black text-sm truncate ${activeGroupId === group.id ? 'text-white' : 'text-slate-800'}`}>{group.name}</h3>
                            <p className={`text-[10px] uppercase tracking-widest mt-1 font-bold ${activeGroupId === group.id ? 'text-indigo-200' : 'text-slate-400'}`}>{productCount} Products</p>
                        </div>
                    );
                })}
            </div>

            {/* Products in Active Group */}
            {activeGroupId && activeGroupData && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-black text-slate-800">Products in {activeGroupData.name}</h2>
                        {activeGroupData.description && <p className="text-sm text-slate-500 font-medium mt-1">{activeGroupData.description}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeGroupProducts.length === 0 ? (
                            <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-3">No products yet.</p>
                                <button onClick={() => setShowProductForm(true)} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-200">+ Add First Product</button>
                            </div>
                        ) : activeGroupProducts.map(item => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-indigo-200 hover:shadow-lg transition-all">
                                <div className="flex items-start gap-4 p-4">
                                    <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 shrink-0">
                                        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <PackageSearch size={22} className="text-slate-200" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Stock: {item.attributes?.totalStock ?? 0}</p>
                                        {item.attributes?.hasVariants ? (
                                            <span className="inline-block mt-1.5 text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">{item.attributes.variants?.length} SIZES</span>
                                        ) : (
                                            <span className="inline-block mt-1.5 text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">SINGLE</span>
                                        )}
                                    </div>
                                </div>
                                {/* Action bar */}
                                <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                                    <button
                                        onClick={() => { setEditingItem(item); setShowProductForm(true); }}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-indigo-600 hover:bg-indigo-50 transition-colors text-[11px] font-black uppercase tracking-widest"
                                    >
                                        <Edit size={13} /> Edit
                                    </button>
                                    {profile?.role === 'superAdmin' && (
                                        <button
                                            onClick={() => handleDeleteProduct(item.id)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-rose-500 hover:bg-rose-50 transition-colors text-[11px] font-black uppercase tracking-widest"
                                        >
                                            <Trash2 size={13} /> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Group Form Modal */}
            {showGroupForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl w-full max-w-md">
                        <h2 className="text-xl font-black text-slate-800 mb-6">{editingGroup ? "Edit Group" : "Create Group"}</h2>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const data = { name: fd.get('name') as string, description: fd.get('description') as string, branchId: editingGroup?.branchId || (branches[0]?.branch_id || "") };
                            try {
                                if (editingGroup) await productGroupService.update(editingGroup.id, data);
                                else { const id = await productGroupService.create(data); setActiveGroupId(id); }
                                setShowGroupForm(false);
                            } catch { alert("Failed to save group"); }
                        }}>
                            <div className="space-y-4">
                                <FloatingInput label="Group Name" name="name" required defaultValue={editingGroup?.name} />
                                <FloatingInput label="Description (Optional)" name="description" defaultValue={editingGroup?.description} />
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setShowGroupForm(false)} className="flex-1 py-3 bg-slate-50 text-slate-500 font-bold rounded-xl text-sm">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-sm hover:bg-indigo-700">Save Group</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product Form Modal */}
            {showProductForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-xl my-4 sm:my-10">
                        <MasterProductForm
                            branches={branches} groups={groups} programs={programs}
                            initialData={editingItem} defaultGroupId={activeGroupId}
                            onCancel={() => { setShowProductForm(false); setEditingItem(null); }}
                            onComplete={() => { setShowProductForm(false); setEditingItem(null); }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Product Form ──────────────────────────────────────────────────────────────
function MasterProductForm({ branches, groups, programs, initialData, defaultGroupId, onCancel, onComplete }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [groupId, setGroupId] = useState(initialData?.groupId || defaultGroupId || "");
    const [branchId, setBranchId] = useState(initialData?.branchId || (branches?.[0]?.branch_id || ""));
    const [programId, setProgramId] = useState(initialData?.programId || "");
    const [simpleStock, setSimpleStock] = useState<number>(initialData?.attributes?.totalStock ?? 0);
    const [variants, setVariants] = useState<InventoryVariant[]>(initialData?.attributes?.variants || []);

    // Programs filtered by selected branch
    const filteredPrograms = branchId ? programs.filter((p: any) => p.branchId === branchId || p.branch_id === branchId) : programs;

    const hasVariants = variants.length > 0;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const addVariant = (name = "") => {
        setVariants(prev => [...prev, {
            id: `v_${Date.now()}_${Math.random()}`,
            name, sku: "", retailPrice: 0, costPrice: 0, lowStockLevel: 5, stock: 0, status: 'In Stock'
        }]);
    };

    const addPreset = (sizes: string[]) => {
        const existing = variants.map(v => v.name.toLowerCase());
        const fresh = sizes.filter(s => !existing.includes(s.toLowerCase()));
        if (!fresh.length) return;
        setVariants(prev => [...prev, ...fresh.map(name => ({
            id: `v_${Date.now()}_${name}`, name, sku: "",
            retailPrice: 0, costPrice: 0, lowStockLevel: 5, stock: 0, status: 'In Stock' as const
        }))]);
    };

    const removeVariant = (id: string) => setVariants(v => v.filter(x => x.id !== id));

    const updateVariant = (id: string, u: Partial<InventoryVariant>) =>
        setVariants(v => v.map(x => x.id === id ? { ...x, ...u } : x));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fd = new FormData(e.target as HTMLFormElement);
            let imageUrl = initialData?.image_url || "";
            if (imageFile) {
                const snap = await uploadBytes(ref(storage, `inventory/${Date.now()}_${imageFile.name}`), imageFile);
                imageUrl = await getDownloadURL(snap.ref);
            }

            const basePrice = parseFloat(fd.get("price") as string) || 0;
            const totalStock = hasVariants ? variants.reduce((s, v) => s + (v.stock || 0), 0) : simpleStock;
            const finalVariants = variants.map(v => ({ ...v, retailPrice: v.retailPrice || basePrice, costPrice: v.costPrice || 0, lowStockLevel: v.lowStockLevel || 5 }));

            const data: any = {
                name: fd.get("name") as string,
                price: basePrice,
                category: 'Other' as InventoryItem['category'],
                groupId, programId: programId || null,
                branchId: branchId,
                sku: fd.get("sku") as string || "",
                costPrice: parseFloat(fd.get("costPrice") as string) || 0,
                image_url: imageUrl,
                attributes: {
                    hasVariants,
                    variants: hasVariants ? finalVariants : [],
                    totalStock,
                    stockIn: initialData?.attributes?.stockIn || totalStock,
                    stockOut: initialData?.attributes?.stockOut || 0,
                    lowStockLevel: 5,
                },
                created_at: initialData?.created_at || new Date().toISOString(),
            };

            if (initialData) await inventoryService.update(initialData.id, data);
            else await inventoryService.create(data);
            onComplete();
        } catch (err) {
            console.error(err);
            alert("Failed to save product.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] p-6 shadow-2xl relative w-full overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500" />
            <button type="button" onClick={onCancel} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all z-20"><X size={20} /></button>

            <div className="mb-5">
                <h2 className="text-xl font-black text-slate-800">{initialData ? "Edit Product" : "New Product"}</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo + Name */}
                <div className="flex gap-5">
                    <div className="relative group cursor-pointer w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden hover:border-indigo-400 transition-all shrink-0">
                        <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        {imagePreview || initialData?.image_url
                            ? <img src={imagePreview || initialData.image_url} alt="Preview" className="w-full h-full object-cover" />
                            : <><Camera size={24} className="text-slate-300 group-hover:text-indigo-500 mb-1" /><span className="text-[8px] font-black uppercase text-slate-400">Photo</span></>
                        }
                    </div>
                    <div className="flex-1">
                        <FloatingInput label="Product Name" name="name" required defaultValue={initialData?.name} />
                    </div>
                </div>

                {/* Group + Branch + Program */}
                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Group</label>
                        <select value={groupId} onChange={e => setGroupId(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-700 text-sm appearance-none cursor-pointer">
                            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Branch</label>
                            <select value={branchId} onChange={e => { setBranchId(e.target.value); setProgramId(""); }}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-700 text-sm appearance-none cursor-pointer">
                                <option value="">— All Branches —</option>
                                {branches.map((b: any) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Program</label>
                            <select value={programId} onChange={e => setProgramId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-700 text-sm appearance-none cursor-pointer">
                                <option value="">— None —</option>
                                {filteredPrograms.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Price + Stock */}
                <div className="grid grid-cols-2 gap-3">
                    <FloatingInput label="Price ($)" name="costPrice" type="number" step="0.01" defaultValue={initialData?.costPrice} />
                    {!hasVariants && (
                        <FloatingInput label="Current Stock" type="number" value={simpleStock} onChange={e => setSimpleStock(parseInt(e.target.value) || 0)} min="0" />
                    )}
                </div>
                <input type="hidden" name="price" value="0" />

                {/* ── Sizes Section ── */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Sizes {variants.length > 0 ? `(${variants.length})` : ""}
                        </span>
                        <button type="button" onClick={() => addVariant()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                            <Plus size={11} /> Add Size
                        </button>
                    </div>



                    {/* Size rows */}
                    <div className="divide-y divide-slate-50">
                        {variants.length === 0 ? (
                            <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest py-5">No sizes added — product will be a single item.</p>
                        ) : variants.map((v, idx) => (
                            <div key={v.id} className="px-4 py-3 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Size {idx + 1}</span>
                                    <button type="button" onClick={() => removeVariant(v.id)}
                                        className="w-6 h-6 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-full flex items-center justify-center transition-colors">
                                        <X size={11} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Name</label>
                                        <input value={v.name} onChange={e => updateVariant(v.id, { name: e.target.value })}
                                            placeholder="e.g. S" className="w-full bg-white border border-slate-200 px-2.5 py-2 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stock</label>
                                        <input type="number" value={v.stock} onChange={e => updateVariant(v.id, { stock: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white border border-slate-200 px-2.5 py-2 rounded-lg text-xs font-black text-center focus:ring-2 focus:ring-indigo-100 outline-none" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Price ($)</label>
                                        <input type="number" step="0.01" value={v.retailPrice || ''} onChange={e => updateVariant(v.id, { retailPrice: parseFloat(e.target.value) || 0 })}
                                            placeholder="0.00" className="w-full bg-white border border-slate-200 px-2.5 py-2 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onCancel} className="flex-1 py-3 font-bold rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all text-sm">Cancel</button>
                    <button type="submit" disabled={submitting} className="flex-[2] py-3 font-black rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                        {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
                        {submitting ? "Saving…" : initialData ? "Apply Changes" : "Save Product"}
                    </button>
                </div>
            </form>
        </div>
    );
}
