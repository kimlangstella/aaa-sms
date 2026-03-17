"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  UserPlus, 
  GraduationCap, 
  Wallet, 
  School, 
  MoreHorizontal, 
  Plus, 
  Search, 
  Bell, 
  ChevronDown, 
  TrendingUp, 
  Shield,
  LayoutGrid,
  LayoutDashboard,
  Calendar
} from "lucide-react";
import { 
    subscribeToStudents, 
    subscribeToEnrollments, 
    subscribeToDailyAttendance, 
    getClasses 
} from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { Student, Enrollment, Branch, Attendance, Class } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  AreaChart, 
  Area
} from 'recharts';

// --- Types ---

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalRevenue: number;
  activeClasses: number; // Mocked for now
}

// --- Components ---


function MetricCard({ title, value, icon: Icon, colorClass, iconBgClass, isPrimary, trend, trendValue }: any) {
    return (
        <div className={`group p-6 rounded-[2rem] border transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] relative overflow-hidden ${
            isPrimary 
                ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 border-indigo-400 text-white shadow-xl shadow-indigo-200' 
                : 'bg-white border-slate-100 shadow-sm hover:border-indigo-200'
        }`}>
            {/* Background pattern for primary card */}
            {isPrimary && (
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-700">
                    <Icon size={120} />
                </div>
            )}

            <div className="relative z-10 flex flex-col h-full justify-between">
                 <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 shadow-sm ${
                        isPrimary ? 'bg-white/20 backdrop-blur-md' : iconBgClass
                    }`}>
                        <Icon size={24} className={isPrimary ? 'text-white' : colorClass} />
                    </div>
                    <button className={`${isPrimary ? 'text-white/40 hover:text-white' : 'text-slate-300 hover:text-indigo-500'} transition-colors`}>
                        <MoreHorizontal size={18} />
                    </button>
                 </div>
                 
                 <div>
                    <h3 className={`text-3xl font-black tracking-tight mb-1 ${isPrimary ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${isPrimary ? 'text-indigo-100' : 'text-slate-400'}`}>{title}</p>
                 </div>

                 {(trendValue || trend) && (
                    <div className={`mt-4 pt-4 border-t flex items-center gap-2 ${isPrimary ? 'border-white/10' : 'border-slate-50'}`}>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            trend === 'up' ? (isPrimary ? 'bg-emerald-400/20 text-emerald-300' : 'bg-emerald-50 text-emerald-600') : (isPrimary ? 'bg-rose-400/20 text-rose-300' : 'bg-rose-50 text-rose-600')
                        }`}>
                            {trend === 'up' ? <TrendingUp size={10} /> : <TrendingUp size={10} className="rotate-180" />}
                            {trendValue}
                        </div>
                        <span className={`text-[10px] font-bold ${isPrimary ? 'text-indigo-200/60' : 'text-slate-300'}`}>vs last month</span>
                    </div>
                 )}
            </div>
        </div>
    )
}

function SectionHeader({ title, action }: { title: string, action?: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
            {action}
        </div>
    )
}

// --- Main Page ---

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Real Data State
  const [classes, setClasses] = useState<Class[]>([]);
  const [todaysAttendance, setTodaysAttendance] = useState<Attendance[]>([]);

  // Chart Filter State
  const [trendFilter, setTrendFilter] = useState<'Week' | 'Month' | 'Year'>('Month');

  useEffect(() => {
    if (!profile) return;
    
    const branchIds: string[] = []; // Both admin and superAdmin see all

    const unsubStudents = subscribeToStudents((data) => {
        setStudents(data);
        setLoading(false);
    }, branchIds);
    const unsubEnrollments = subscribeToEnrollments(setEnrollments, branchIds);
    const unsubBranches = branchService.subscribe(setBranches, branchIds);
    
    // Fetch Classes once
    getClasses().then(setClasses);

    // Subscribe to today's attendance
    const today = new Date().toISOString().split('T')[0];
    const unsubAttendance = subscribeToDailyAttendance(today, setTodaysAttendance, branchIds);
    
    return () => {
      unsubStudents();
      unsubEnrollments();
      unsubBranches();
      unsubAttendance();
    };
  }, [profile]);

  // --- Statistics Calculation ---
  const activeStudents = students.filter(s => s.status === 'Active').length;
  const totalRevenue = enrollments.reduce((acc, curr) => acc + (Number(curr.paid_amount) || 0), 0);
  
  // --- Donut Chart: Students by Branch ---
  const branchData = useMemo(() => {
      // Colors for branches
      const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6']; // Indigo, Pink, Emerald, Amber, Violet
      
      return branches.map((b, index) => ({
          name: b.branch_name,
          value: students.filter(s => s.branch_id === b.branch_id && s.status === 'Active').length,
          color: colors[index % colors.length]
      }));
  }, [students, branches]);

  // --- Bar Chart: Admission Trends (REAL DATA) ---
  const admissionTrendData = useMemo(() => {
      const now = new Date();
      let data: Record<string, { active: number, inactive: number }> = {};
      let labels: string[] = [];
      
      if (trendFilter === 'Week') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue...
            labels.push(label);
            data[label] = { active: 0, inactive: 0 };
        }
        
        students.forEach(s => {
            const d = new Date(s.created_at);
            // Check if within last 7 days
            const diffTime = Math.abs(now.getTime() - d.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays <= 7) {
                const label = d.toLocaleDateString('en-US', { weekday: 'short' });
                if (data[label]) {
                    if (s.status === 'Active') data[label].active++;
                    else data[label].inactive++;
                }
            }
        });

      } else if (trendFilter === 'Month') {
          // Last 30 days? Or just this month? Let's do month view (Jan, Feb, etc is usually Year view).
          // 'Month' filter usually implies "This Month's daily breakdown" OR "Last 12 Months"? 
          // The mock data had "Jan, Feb.." which suggests Year view.
          // Let's make "Year" = Jan-Dec.
          // Let's make "Month" = Days of current month.
          
          // Actually, let's align with common dashboard patterns:
          // Week = Last 7 days (Daily)
          // Month = This Month (Daily) or Last 4 Weeks
          // Year = Monthly breakdown (Jan - Dec)

          // Re-implementing based on "Jan, Feb..." mock implied "Yearly" data.
          // But user selected "Month" as default in mock. 
          // Let's stick to:
          // Week: Daily
          // Month: Weekly buckets? Or Daily for 30 days. Let's do Daily for last 30 days? Too crowded.
          // Let's do Month = Weeks (Week 1, Week 2...) OR Month = Monthly (Jan, Feb) but filter is 'Year'.
          
          // Let's Simplify:
          // Week: Mon-Sun (Current Week)
          // Month: 1-30/31 (Current Month)
          // Year: Jan-Dec (Current Year)

          if (trendFilter === 'Month') {
             const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
             for(let i=1; i<=daysInMonth; i++) {
                 const label = `${i}`;
                 data[label] = { active: 0, inactive: 0 };
                 labels.push(label);
             }

             students.forEach(s => {
                 const d = new Date(s.created_at);
                 if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                     const label = `${d.getDate()}`;
                     if (data[label]) {
                        if (s.status === 'Active') data[label].active++;
                        else data[label].inactive++;
                     }
                 }
             });

          } else { // Year
             const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
             months.forEach(m => {
                 labels.push(m);
                 data[m] = { active: 0, inactive: 0 };
             });

             students.forEach(s => {
                 const d = new Date(s.created_at);
                 if (d.getFullYear() === now.getFullYear()) {
                     const label = months[d.getMonth()];
                     if (data[label]) {
                        if (s.status === 'Active') data[label].active++;
                        else data[label].inactive++;
                     }
                 }
             });
          }
      } else {
        // Fallback for logic if needed, but above covers Week/Month/Year
      }
      
      // If Week, actually implementing properly similar to Month/Year logic block structure
       if (trendFilter === 'Week') {
          // Reset data/labels to be clean
          data = {}; labels = [];
          
          // Get start of week (Sunday)
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday start?
          // Let's just do last 7 days including today? Or fixed Mon-Sun window?
          // Fixed Mon-Sun
          const currentDay = now.getDay(); // 0 is Sun
          const diff = now.getDate() - currentDay + (currentDay == 0 ? -6 : 1); // adjust when day is sunday
          const monday = new Date(now.setDate(diff));
          
          const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          weekDays.forEach(d => {
              labels.push(d);
              data[d] = { active: 0, inactive: 0 };
          });
          
          students.forEach(s => {
              const d = new Date(s.created_at);
              // Check if same week
              // Lazy check: Is it within the Monday timestamp and Monday+7 days?
              const mondayTime = monday.setHours(0,0,0,0);
              const nextMonTime = mondayTime + (7 * 24 * 60 * 60 * 1000);
              const dateTime = d.getTime();
              
              if (dateTime >= mondayTime && dateTime < nextMonTime) {
                  const dayIndex = (d.getDay() + 6) % 7; // Mon=0, Sun=6
                  const label = weekDays[dayIndex];
                  if (data[label]) {
                      if (s.status === 'Active') data[label].active++;
                      else data[label].inactive++;
                  }
              }
          });
      }

      return labels.map(label => ({
          name: label,
          active: data[label]?.active || 0,
          inactive: data[label]?.inactive || 0
      }));

  }, [trendFilter, students]);


  // --- Attendance Real Data ---
  const attendanceData = useMemo(() => {
      // Initialize hours 7am - 8pm? Or School hours.
      // Based on mock: 7am - 12pm.
      // We'll scan classes start times and build the axis effectively or just static hours.
      // Static hours is safer for UI consistency.
      const hours = ['07 am', '08 am', '09 am', '10 am', '11 am', '12 pm', '01 pm', '02 pm', '03 pm', '04 pm', '05 pm'];
      const data: Record<string, number> = {};
      hours.forEach(h => data[h] = 0);

      todaysAttendance.forEach(record => {
          if (record.status === 'Present' || record.status === 'Permission') { // Count present
              // Find class
              const cls = classes.find(c => c.class_id === record.class_id);
              if (cls && cls.startTime) {
                  // Format "08:00" -> "08 am"
                  const [h, m] = cls.startTime.split(':');
                  let hour = parseInt(h);
                  const suffix = hour >= 12 ? 'pm' : 'am';
                  const displayHour = hour > 12 ? hour - 12 : hour;
                  const formatted = `${displayHour.toString().padStart(2, '0')} ${suffix}`;
                  
                  if (data[formatted] !== undefined) {
                      data[formatted]++;
                  }
              }
          }
      });

      // Filter out late hours if empty to keep chart clean? Or keep fixed range?
      // Let's keep fixed range 7am - 5pm
      return hours.map(h => ({
          time: h,
          count: data[h]
      }));
  }, [todaysAttendance, classes]);

  return (
    <div className="bg-[#F3F4F6] min-h-screen px-4 md:px-0 font-sans">
      <div className="space-y-8 pb-20 pt-4 max-w-[1800px] mx-auto overflow-x-hidden">
      
      {/* Header Row: Title on Left, Actions on Right */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/50 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-[0_12px_24px_-8px_rgba(79,70,229,0.4)] shrink-0 transition-transform hover:scale-105 duration-300">
                  {typeof LayoutGrid !== 'undefined' ? <LayoutGrid size={28} /> : <Users size={28} />}
              </div>
              <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
              <button 
                  onClick={() => router.push('/admin/attendance')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 rounded-2xl font-black text-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all border border-slate-100 group w-full sm:w-auto active:scale-95"
              >
                  <Calendar size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <span>Track Attendance</span>
              </button>
              <button 
                  onClick={() => router.push('/admin/students/add')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-[0_12px_24px_-8px_rgba(79,70,229,0.4)] transition-all hover:-translate-y-0.5 active:scale-95"
              >
                  <Plus size={20} />
                  <span>Add Student</span>
              </button>
          </div>
      </div>
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
              title="Active Students" 
              value={activeStudents} 
              icon={Users} 
              colorClass="text-indigo-600" 
              iconBgClass="bg-indigo-50"
              isPrimary
              trend="up"
              trendValue="12.5%"
          />
          <MetricCard 
              title="Inactive Students" 
              value={students.length - activeStudents} 
              icon={UserPlus} 
              colorClass="text-blue-500" 
              iconBgClass="bg-blue-50" 
              trend="down"
              trendValue="2.1%"
          />
          <MetricCard 
              title="Total Revenue" 
              value={`$${totalRevenue.toLocaleString()}`} 
              icon={Wallet} 
              colorClass="text-emerald-500" 
              iconBgClass="bg-emerald-50" 
              trend="up"
              trendValue="8.4%"
          />
          <MetricCard 
              title="Insurance" 
              value="0" 
              icon={Shield} 
              colorClass="text-rose-500" 
              iconBgClass="bg-rose-50" 
          />
      </div>

      {/* Middle Section: Trends & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Chart: Admission Trends */}
          <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 transition-all duration-300 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]">
              <SectionHeader 
                title="Student Admission Trends" 
                action={
                   <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/30">
                      {['Week', 'Month', 'Year'].map((filter) => (
                           <button 
                                key={filter}
                                onClick={() => setTrendFilter(filter as any)}
                                className={`px-5 py-2 rounded-xl text-xs font-black transition-all duration-300 ${trendFilter === filter ? 'bg-white shadow-xl shadow-slate-200/50 text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                                {filter}
                           </button>
                      ))}
                   </div>
                } 
              />
              <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={admissionTrendData} barSize={18} barGap={6}>
                          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{
                              borderRadius: '14px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              fontSize: '12px'
                            }} 
                          />
                          <Bar dataKey="inactive" fill="#cbd5e1" radius={[4, 4, 4, 4]} name="Inactive" />
                          <Bar dataKey="active" fill="#6366f1" radius={[4, 4, 4, 4]} name="Active" />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Donut Chart: Students by Branch */}
          <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 flex flex-col transition-all duration-300 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]">
              <SectionHeader title="Students by Branch" />
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="h-[220px] w-full relative">
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="text-center group">
                              <span className="text-4xl font-black text-slate-800 transition-transform group-hover:scale-110 block">{activeStudents}</span>
                              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</p>
                          </div>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={branchData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {branchData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                  ))}
                              </Pie>
                              <Tooltip />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-2 mt-4 w-full">
                      {branchData.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex-1 min-w-[120px] justify-center sm:justify-start">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }}></span>
                              <div className="flex flex-col leading-none">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.name}</span>
                                <span className="text-[11px] font-semibold text-slate-600">{d.value} Students</span>
                              </div>
                          </div>
                      ))}
                      {branchData.length === 0 && <p className="text-xs text-slate-400 italic mt-2">No students assigned to branches.</p>}
                  </div>
              </div>
          </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
          
          {/* Attendance Line Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 transition-all duration-300 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]">
               <SectionHeader 
                    title="Attendance Today" 
                    action={<span className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Updates</span>}
               />
               <div className="h-[250px] mt-4">
                   <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={attendanceData}>
                           <defs>
                               <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#f97316" stopOpacity={0.15}/>
                                   <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                               </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                           <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)'}} 
                           />
                           <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" dot={{r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                       </AreaChart>
                   </ResponsiveContainer>
               </div>
          </div>

          {/* Promo / Summary Card (List widget removed as requested) */}
          <div className="bg-[#6C5DD3] p-8 rounded-[20px] shadow-xl shadow-indigo-200 text-white relative overflow-hidden flex flex-col justify-between">
               <div className="relative z-10">
                   <h3 className="text-3xl font-extrabold mb-1">{students.length}</h3>
                   <p className="opacity-80 text-sm">Total Students this month</p>
               </div>
               
               <div className="relative z-10">
                   <div className="h-16 w-full flex items-end gap-1">
                        {/* Fake sparklines - can be made real later if needed */}
                        {[40,30,50,45,60,75,50,60,70,80].map((h, i) => (
                             <div key={i} className="flex-1 bg-white/20 rounded-t-sm" style={{ height: `${h}%` }}></div>
                        ))}
                   </div>
                   <div className="flex justify-between items-end mt-4">
                        <div>
                             <span className="text-2xl font-bold">
                                {students.filter(s => {
                                    const d = new Date(s.created_at);
                                    const now = new Date();
                                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                }).length}
                             </span>
                             <p className="text-[10px] uppercase opacity-60 font-bold tracking-wider">New Admissions</p>
                        </div>
                   </div>
               </div>

               {/* Decor */}
               <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
          </div>

      </div>
      </div>
    </div>
  );
}
