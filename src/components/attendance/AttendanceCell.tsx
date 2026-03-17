"use client";

import { useState, useEffect } from "react";
import { AttendanceStatus, Attendance } from "@/lib/types";
import { X, Check } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

interface AttendanceCellProps {
  record?: Attendance;
  onChange: (status: AttendanceStatus | "", reason?: string) => void;
  readOnly?: boolean;
}

export function AttendanceCell({ record, onChange, readOnly }: AttendanceCellProps) {
  const { profile } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [makeupDate, setMakeupDate] = useState("");

  // Initialize from record
  useEffect(() => {
    if (record) {
      // Check if it's a Make-up class
      if (record.status === 'Present' && (record.reason?.startsWith('Make-up') || record.reason?.includes('Make-up'))) {
        setSelectedStatus("Make-up");
        
        // Parse reason for date and note
        // Format: "Make-up for MM/DD/YYYY - Note" or "Make-up Class - Note"
        if (record.reason) {
            const parts = record.reason.split(' - ');
            const mainPart = parts[0]; // "Make-up for ..." or "Make-up Class"
            const notePart = parts.slice(1).join(' - '); // Rest is note
            
            setNoteValue(notePart || "");
            
            if (mainPart.includes('for ')) {
                const dateStr = mainPart.split('for ')[1];
                // Try to parse date to YYYY-MM-DD for input
                try {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        setMakeupDate(date.toISOString().split('T')[0]);
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }
        }
      } else {
        setSelectedStatus(record.status);
        if (record.status === 'Permission' && record.reason) {
            setNoteValue(record.reason);
        } else {
            setNoteValue("");
        }
      }
    } else {
      setSelectedStatus("");
      setNoteValue("");
      setMakeupDate("");
    }
  }, [record]);

  const saveLeaveNote = () => {
    const trimmedNote = noteValue.trim();
    if (selectedStatus === "Make-up") {
        let finalReason = "Make-up Class";
        if (makeupDate) {
            // Format date nicely
            const d = new Date(makeupDate);
            finalReason = `Make-up for ${d.toLocaleDateString('en-US')}`;
        }
        if (trimmedNote) {
            finalReason += ` - ${trimmedNote}`;
        }
        onChange("Present", finalReason);
    } else {
        onChange('Permission', trimmedNote || "");
    }
    setShowNotePopup(false);
  };

  const cancelLeaveNote = () => {
    setShowNotePopup(false);
    // Revert to previous status
    if (record) {
      setSelectedStatus(record.status);
    } else {
      setSelectedStatus("");
    }
  };

  // Determine styling based on status
  const getStyle = () => {
    // Check for specific reasons first
    if ((selectedStatus === "Present" || record?.status === "Present") && (record?.reason === "Make-up" || record?.reason === "Make-up Class" || noteValue.includes("Make-up"))) {
       return "bg-indigo-50 border-indigo-200 text-indigo-700 font-black shadow-inner shadow-indigo-100/50";
    }

    if (selectedStatus === "Present") return "bg-emerald-50 border-emerald-200 text-emerald-700 font-black shadow-inner shadow-emerald-50";
    if (selectedStatus === "Absent") return "bg-rose-50 border-rose-200 text-rose-700 font-black shadow-inner shadow-rose-50";
    if (selectedStatus === "Permission") return "bg-amber-50 border-amber-200 text-amber-700 font-black shadow-inner shadow-amber-50";
    return "bg-white border-slate-100 text-slate-300 hover:border-slate-300 transition-colors";
  };

  const getDisplayText = () => {
    // Check for Make-up
    if (selectedStatus === 'Make-up' || (record?.status === "Present" && (record?.reason?.includes("Make-up")))) {
        return "M";
    }

    if (selectedStatus === "Present") return "P";
    if (selectedStatus === "Absent") return "A";
    if (selectedStatus === "Permission") return "L";
    return "-";
  };

  const getStatusLabel = () => {
    // Check for Make-up
    if (selectedStatus === 'Make-up' || (record?.status === "Present" && (record?.reason?.includes("Make-up")))) {
        return "Make-up";
    }

    if (selectedStatus === "Present") return "Present";
    if (selectedStatus === "Absent") return "Absent";
    if (selectedStatus === "Permission") return "Leave";
    return "No Status";
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    
    if (newStatus === "Make-up") {
       setSelectedStatus("Make-up");
       setNoteValue("");
       setMakeupDate(""); 
       setShowNotePopup(true);
       return;
    }

    if (newStatus === "") {
      setSelectedStatus("");
      onChange(""); // Clear status
      return;
    }

    // If selecting Leave/Permission, show popup
    if (newStatus === "Permission") {
      setSelectedStatus(newStatus);
      setShowNotePopup(true);
      setNoteValue(record?.reason || "");
    } else {
      setSelectedStatus(newStatus);
      // Clear reason if switching to standard Present/Absent
      onChange(newStatus as AttendanceStatus, "");
    }
  };

  return (
    <div className="flex justify-center relative">
      <div className="relative">
        <div 
            className={`w-16 h-10 flex items-center justify-center text-sm rounded-xl border transition-all duration-300 ${getStyle()}`}
            title={getStatusLabel()}
        >
          {getDisplayText()}
        </div>
        
        <select
          value={record?.status === "Present" && (record?.reason === "Make-up" || record?.reason === "Make-up Class") ? "Make-up" : selectedStatus}
          onChange={handleStatusChange}
          disabled={readOnly}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <option value="">-</option>
          <option value="Present">Present (P)</option>
          <option value="Absent">Absent (A)</option>
          <option value="Permission">Leave (L)</option>
          <option value="Make-up">Make-up (M)</option>
        </select>

        {record?.reason && (
          <div 
            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white z-20 cursor-pointer transition-all hover:scale-125 ${
                (record.status === 'Present' && (record.reason === 'Make-up' || record.reason?.includes('Make-up'))) ? 'bg-blue-500' : 'bg-amber-500'
            }`}
            title={record.reason}
            onClick={(e) => {
                e.stopPropagation(); // Prevent bubbling if needed
                setShowNotePopup(true);
            }}
          />
        )}
      </div>

      {showNotePopup && (
        <>
            <div 
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" 
                onClick={cancelLeaveNote}
            />
            {/* Centered Modal */}
            {/* Centered Modal */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white/95 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.15)] border border-white/50 w-[400px] animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${selectedStatus === 'Make-up' ? 'bg-indigo-500 shadow-lg shadow-indigo-200' : 'bg-amber-500 shadow-lg shadow-amber-200'}`}></div>
                        {selectedStatus === 'Make-up' ? 'Make-up Recording' : 'Leave Verification'}
                    </div>
                </div>

                {selectedStatus === 'Make-up' && (
                    <div className="mb-6">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                            Original Absence Date
                        </label>
                        <input 
                            type="date"
                            className="w-full text-sm font-bold text-slate-700 px-5 py-4 rounded-[1.25rem] bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white transition-all"
                            value={makeupDate}
                            onChange={(e) => setMakeupDate(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                        Reason & Additional Notes
                    </label>
                    <textarea 
                        className="w-full text-sm font-bold text-slate-700 p-5 rounded-[1.25rem] bg-slate-50 border border-slate-100 outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 focus:bg-white resize-none transition-all placeholder:text-slate-300"
                        placeholder={selectedStatus === 'Make-up' ? "Briefly explain the make-up context..." : "Document the reason for absence..."}
                        rows={3}
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveLeaveNote();
                            } else if (e.key === 'Escape') {
                                cancelLeaveNote();
                            }
                        }}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={cancelLeaveNote} 
                        className="flex-1 px-6 py-4 rounded-[1.25rem] text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={saveLeaveNote} 
                        className="flex-[1.5] px-6 py-4 rounded-[1.25rem] bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                    >
                        Save Record
                    </button>
                </div>
            </div>
        </>
      )}
    </div>
  );
}
