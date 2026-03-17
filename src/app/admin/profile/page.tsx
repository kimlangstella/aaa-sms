"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { userService } from "@/services/userService";
import { uploadImage } from "@/lib/services/schoolService";
import { 
  User, 
  Mail, 
  Camera, 
  Save, 
  Loader2, 
  Shield,
  Signature
} from "lucide-react";

export default function ProfilePage() {
    const { profile, loading: authLoading } = useAuth();
    const [name, setName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

    useEffect(() => {
        if (profile) {
            setName(profile.name || "");
            setSignaturePreview(profile.signature_url || null);
        }
    }, [profile]);

    const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSignatureFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setSignaturePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        
        setSubmitting(true);
        try {
            let signatureUrl = profile.signature_url;
            
            if (signatureFile) {
                signatureUrl = await uploadImage(signatureFile, `signatures/${profile.uid}_${Date.now()}`);
            }

            await userService.updateProfile(profile.uid, {
                name,
                signature_url: signatureUrl
            });
            
            alert("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile.");
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="h-96 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center gap-6 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                    <User size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Profile</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Manage your account information and signature.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Form Section */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-lg font-black text-slate-800">Account Details</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                                        placeholder="Your Full Name"
                                        required
                                    />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={profile?.email || ""}
                                        disabled
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-slate-400 cursor-not-allowed"
                                    />
                                <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase tracking-widest italic">Email cannot be changed manually.</p>
                            </div>
                        </div>

                        {/* Signature Upload Section */}
                        <div className="space-y-4 pt-4 pt-6 border-t border-slate-100">
                            <div>
                                <label className="text-sm font-black text-slate-800 flex items-center gap-2 mb-1">
                                    <Signature size={18} className="text-indigo-600" /> Administrative Signature
                                </label>
                                <p className="text-xs text-slate-500 font-medium">This signature will appear on printed invoices and receipts.</p>
                            </div>

                            <div className="relative p-8 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group overflow-hidden bg-slate-50/30">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleSignatureChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                />
                                
                                {signaturePreview ? (
                                    <div className="relative w-full max-w-[300px] h-32 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center p-4 overflow-hidden group-hover:scale-[1.02] transition-transform">
                                        <img src={signaturePreview} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                                        <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Camera className="text-indigo-600" size={24} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-indigo-100/50">
                                            <Camera size={28} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-indigo-600">Click to Upload Signature</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supports PNG, JPG (Max 2MB)</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white rounded-[1.25rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                <span>Save Profile</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Side Info */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                        <Shield className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 rotate-12" />
                        
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6">
                                <Shield className="text-indigo-400" size={24} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Access Role</p>
                            <h3 className="text-2xl font-black tracking-tight mb-2 capitalize">{profile?.role || "Admin"}</h3>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                Your account has administrative privileges. You can manage student data, enrollments, and system settings.
                            </p>
                        </div>
                    </div>

                    <div className="bg-indigo-50 rounded-[2rem] p-8 border border-indigo-100 shadow-sm">
                        <h4 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                             <Signature size={16} className="text-indigo-600" /> Usage Note
                        </h4>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            Upload a clear image of your signature on a white background. This will be automatically placed in the "Received By" section of student invoices.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
