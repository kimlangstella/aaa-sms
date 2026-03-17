import { X, FileText, Calendar, DollarSign, Image as ImageIcon, ExternalLink } from "lucide-react";
import { InsuranceClaim, Term } from "@/lib/types";

interface InsuranceClaimsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  claims: InsuranceClaim[];
  terms: Term[];
}

export function InsuranceClaimsHistoryModal({ 
  isOpen, 
  onClose, 
  studentName, 
  claims,
  terms
}: InsuranceClaimsHistoryModalProps) {
  if (!isOpen) return null;

  const getTermName = (id: string) => terms.find(t => t.term_id === id)?.term_name || id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl animate-in zoom-in-95 relative overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Claim Records</h3>
              <p className="text-xs text-slate-500 font-medium">
                Student: <span className="text-indigo-600 font-bold">{studentName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {claims.length === 0 ? (
            <div className="text-center py-12">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                  <DollarSign size={32} />
               </div>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No claim records found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {claims.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((claim, index) => (
                <div key={index} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{getTermName(claim.term_id)}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] font-bold text-slate-400 italic">{new Date(claim.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[13px] font-bold text-indigo-600 mt-0.5">${claim.amount.toLocaleString()}</p>
                      {claim.note && <p className="text-[10px] text-slate-500 font-medium mt-1 italic">{claim.note}</p>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 md:mt-0">
                    {claim.image_url ? (
                      <a 
                        href={claim.image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                      >
                        <ImageIcon size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Evidence</span>
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-3">No Evidence</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Claims:</span>
              <span className="text-xs font-black text-indigo-600">${claims.reduce((s, c) => s + c.amount, 0).toLocaleString()}</span>
           </div>
           <button 
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              Close
           </button>
        </div>
      </div>
    </div>
  );
}
