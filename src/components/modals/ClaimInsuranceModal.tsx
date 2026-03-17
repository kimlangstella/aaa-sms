import { useState, useEffect } from "react";
import { X, CheckCircle2, DollarSign, ShieldAlert, Image as ImageIcon, Calendar, Upload } from "lucide-react";
import { updateStudent, getStudentById, uploadImage } from "@/lib/services/schoolService";
import { termService } from "@/services/termService";
import { Student, Term } from "@/lib/types";

interface ClaimInsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  coverageAmount: number;
  currentClaimed: number;
}

export function ClaimInsuranceModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  studentId, 
  studentName,
  coverageAmount,
  currentClaimed 
}: ClaimInsuranceModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [claimAmount, setClaimAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");

  const remainingCoverage = coverageAmount - currentClaimed;

  // Fetch terms
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = termService.subscribe((data) => {
        setTerms(data);
        const active = data.find(t => t.status === 'Active');
        if (active) setSelectedTermId(active.term_id);
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setClaimAmount("");
      setError(null);
      setImageFile(null);
      setImagePreview(null);
    }
  }, [isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    const amount = Number(claimAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (amount > remainingCoverage) {
      setError(`Claim amount exceeds remaining coverage ($${remainingCoverage.toLocaleString()}).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const student = await getStudentById(studentId);
      if (!student || !student.insurance_info) {
        throw new Error("Student insurance info not found.");
      }

      let imageUrl = "";
      if (imageFile) {
          imageUrl = await uploadImage(imageFile, `insurance_claims/${studentId}_${Date.now()}`);
      }

      const newClaim = {
          amount: amount,
          date: new Date().toISOString(),
          term_id: selectedTermId,
          image_url: imageUrl,
          note: `Claim recorded on ${new Date().toLocaleDateString()}`
      };

      const updatedClaims = [...(student.insurance_info.claims || []), newClaim];

      const updatedInsurance = {
        ...student.insurance_info,
        claimed_amount: (student.insurance_info.claimed_amount || 0) + amount,
        claims: updatedClaims
      };

      await updateStudent(studentId, { insurance_info: updatedInsurance });
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error submitting claim:", err);
      setError("Failed to record claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl animate-in zoom-in-95 relative overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Record Insurance Claim</h3>
              <p className="text-xs text-slate-500 font-medium">
                For: <span className="text-indigo-600 font-bold">{studentName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Coverage</p>
              <p className="text-sm font-black text-slate-700">${coverageAmount.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Remaining</p>
              <p className="text-sm font-black text-emerald-600">${remainingCoverage.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Term</label>
                <div className="relative">
                    <select 
                        value={selectedTermId}
                        onChange={(e) => setSelectedTermId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-bold outline-none border border-slate-200 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                        {terms.map((t: Term) => (
                            <option key={t.term_id} value={t.term_id}>{t.term_name}</option>
                        ))}
                    </select>
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Claim Amount ($)</label>
                <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600">
                    <DollarSign size={16} />
                </div>
                <input 
                    type="number"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    placeholder="0.00" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-amber-500/10 border border-slate-200 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    autoFocus
                />
                </div>
                {error && (
                <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    {error}
                </p>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidence Image (Optional)</label>
                <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                        <div className="relative group overflow-hidden bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-2xl p-4 transition-all h-32 flex flex-col items-center justify-center text-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors">
                                        <Upload size={20} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">Click to upload doc</p>
                                </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </div>
                    </label>
                    {imagePreview && (
                        <button 
                            type="button" 
                            onClick={() => { setImageFile(null); setImagePreview(null); }}
                            className="bg-rose-50 text-rose-500 p-2 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting || !claimAmount}
              className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
            >
              {submitting ? "Processing..." : (
                <>
                  <CheckCircle2 size={16} />
                  Submit Claim
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
