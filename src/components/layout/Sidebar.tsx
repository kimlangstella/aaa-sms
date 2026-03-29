"use client";

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  UserMinus, 
  CalendarCheck, 
  Settings,
  LogOut,
  ChevronDown, 
  ChevronRight,
  School,
  Search,
  X,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  User
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToSchoolDetails } from "@/lib/services/schoolService";
import { School as SchoolType } from "@/lib/types";
import { useAuth } from '@/lib/useAuth';

export function Sidebar({ isCollapsed, isOpen = false, onClose }: { isCollapsed?: boolean; isOpen?: boolean; onClose?: () => void }) {
  const { profile } = useAuth();
  const [activeGroup, setActiveGroup] = useState<string | null>("Dashboard");
  const router = useRouter();
  const [school, setSchool] = useState<SchoolType | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/admin/dashboard') {
        setActiveGroup('Dashboard');
    }
  }, [pathname]);

  useEffect(() => {
    const unsub = subscribeToSchoolDetails(setSchool);
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden"
            onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
         className={`
            fixed inset-y-0 left-0 z-50 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] 
            transition-all duration-300 ease-in-out md:translate-x-0 flex flex-col
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            ${isCollapsed ? 'md:w-24' : 'md:w-72 w-72'}
         `}
      >
        {/* Logo Section */}
        <div className={`flex items-center gap-4 p-6 mb-4 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-12 h-12 flex items-center justify-center overflow-hidden shrink-0 ">
             {school?.logo_url ? (
                <img src={school.logo_url} alt="Logo" className="w-full h-full object-contain" />
             ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                    {school?.school_name?.charAt(0) || "S"}
                </div>
             )}
          </div>
          {!isCollapsed && (
              <div className="min-w-0 animate-in fade-in duration-300">
                <h1 className="text-xl font-black font-sans tracking-tight text-slate-800 leading-tight break-words">
                    {school?.school_name || "SchoolSys"}
                </h1>
              </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden min-h-0 pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {/* Dashboard - Single Link */}
            <Link 
                href="/admin/dashboard"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between p-3'} rounded-2xl transition-all duration-300 group mb-1 relative overflow-hidden
                    ${activeGroup === 'Dashboard' ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
                onClick={() => setActiveGroup("Dashboard")}
                title={isCollapsed ? "Dashboard" : ""}
            >
                 <div className={`flex items-center gap-3 relative z-10 ${isCollapsed ? 'justify-center' : ''}`}>
                    <span className={`transition-colors duration-200 ${activeGroup === 'Dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        <LayoutDashboard size={20} />
                    </span>
                    {!isCollapsed && <span className="text-sm font-bold">Dashboard</span>}
                </div>
            </Link>

            <NavItem 
                title="Students" 
                icon={<Users size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "All Students", href: "/admin/students" },
                    { label: "Admissions", href: "/admin/students/add" },
                ]}
            />
            <NavItem 
                title="Enrollments" 
                icon={<UserMinus size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "Enrollment", href: "/admin/enrollments?tab=enrollment" },
                    { label: "Add Class", href: "/admin/enrollments?tab=add-class" },
                ]}
            />
            <NavItem 
                title="Payments" 
                icon={<CreditCard size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "All Payments", href: "/admin/payments" },
                ]}
            />
            <NavItem 
                title="Attendance" 
                icon={<CalendarCheck size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "Terms", href: "/admin/attendance/terms" },
                    { label: "Track Attendance", href: "/admin/attendance" },
                    { label: "Reports", href: "/admin/attendance/reports" },
                ]}
            />
            <NavItem 
                title="Academic" 
                icon={<BookOpen size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "Branch", href: "/admin/setup?tab=branches" },
                    { label: "Program", href: "/admin/setup?tab=programs" },
                ]}
            />

            <NavItem 
                title="Inventory" 
                icon={<ShoppingBag size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "Dashboard", href: "/admin/inventory" },
                    { label: "Categories & Groups", href: "/admin/inventory/groups" },
                ]}
            />

             <NavItem 
                title="Insurance" 
                icon={<ShieldCheck size={20} />} 
                activeGroup={activeGroup} 
                setActiveGroup={setActiveGroup}
                isCollapsed={isCollapsed}
                items={[
                    { label: "Dashboard", href: "/admin/insurance" },
                ]}
            />

            {profile?.role === 'superAdmin' && (
                <NavItem 
                    title="Settings" 
                    icon={<Settings size={20} />} 
                    activeGroup={activeGroup} 
                    setActiveGroup={setActiveGroup}
                    isCollapsed={isCollapsed}
                    items={[
                        { label: "User Management", href: "/admin/users" },
                    ]}
                />
            )}

            <Link 
                href="/admin/profile"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between p-3'} rounded-2xl transition-all duration-300 group mb-1 relative overflow-hidden
                    ${pathname === '/admin/profile' ? 'bg-indigo-50/80 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
                title={isCollapsed ? "My Profile" : ""}
            >
                 <div className={`flex items-center gap-3 relative z-10 ${isCollapsed ? 'justify-center' : ''}`}>
                    <span className={`transition-colors duration-200 ${pathname === '/admin/profile' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        <User size={20} />
                    </span>
                    {!isCollapsed && <span className="text-sm font-bold">My Profile</span>}
                </div>
            </Link>

        </nav>
        
        {/* User Profile / Logout */}
        <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 flex-shrink-0">
             <button 
                onClick={handleSignOut}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-500 transition-all duration-200`}
                title={isCollapsed ? "Sign Out" : ""}
             >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                    <LogOut size={16} />
                </div>
                {!isCollapsed && <span className="font-semibold text-sm">Sign Out</span>}
             </button>
        </div>
      </aside>
    </>
  );
}


function NavItem({ title, icon, items, activeGroup, setActiveGroup, isCollapsed }: any) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    const isActive = items.some((i: any) => {
        if (i.href === '/admin/dashboard' && pathname !== '/admin/dashboard') return false; 
        const basePath = i.href.split('?')[0];
        return pathname === basePath || pathname.startsWith(basePath + '/');
    });
    
    // Auto-expand if child is active and not collapsed
    useEffect(() => {
        if (isActive) {
           setActiveGroup(title);
        }
    }, [isActive, title, setActiveGroup]);

    const isOpen = activeGroup === title;

    const handleClick = () => {
        if (isCollapsed) {
            // Can't toggle open submenus in collapsed mode easily without a popover/flyout
            // For now, let's just set the group active, and maybe we can show a popover in a future refinement
            // Or simpler: Expand the sidebar when clicking a group?
            setActiveGroup(title);
        } else {
            if (isOpen) {
                setActiveGroup(null);
            } else {
                setActiveGroup(title);
            }
        }
    };

    return (
        <div className="mb-1 relative group/navitem">
            <button 
                onClick={handleClick}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between p-3'} rounded-2xl transition-all duration-300 group relative overflow-hidden
                    ${isActive ? 'bg-indigo-50/50 text-indigo-700 font-bold border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
                title={isCollapsed ? title : ""}
            >
                <div className={`flex items-center gap-3 relative z-10 ${isCollapsed ? 'justify-center' : ''}`}>
                    <span className={`transition-all duration-300 ${isActive ? 'text-indigo-600 rotate-3' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        {icon}
                    </span>
                    {!isCollapsed && <span className="text-sm">{title}</span>}
                </div>
                {!isCollapsed && (
                    <span className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}>
                        <ChevronDown size={14} />
                    </span>
                )}
            </button>

            {/* Submenu */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen && !isCollapsed ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="ml-5 space-y-1 py-1 border-l-2 border-slate-100 pl-2">
                    {items.map((item: any, idx: number) => {
                        let isItemActive = false;
                        if (item.href.includes('?')) {
                            const [path, query] = item.href.split('?');
                             isItemActive = pathname === path && searchParams?.toString().includes(query);
                        } else {
                            isItemActive = pathname === item.href;
                        }

                        return (
                            <Link 
                                key={idx} 
                                href={item.href}
                                className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all relative
                                    ${isItemActive 
                                        ? 'text-indigo-600 bg-indigo-50/50' 
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}
                                `}
                            >
                                {isItemActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-indigo-400 rounded-r-full" />}
                                <span className={isItemActive ? "translate-x-1 transition-transform" : ""}>{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Hover Flyout for Collapsed Mode (Simplest Implementation) */}
            {isCollapsed && (
                <div className="absolute left-full top-0 ml-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 opacity-0 group-hover/navitem:opacity-100 pointer-events-none group-hover/navitem:pointer-events-auto transition-opacity z-50">
                     <div className="text-xs font-black text-slate-400 uppercase tracking-wider px-3 py-2 mb-1">{title}</div>
                     {items.map((item: any, idx: number) => (
                         <Link 
                            key={idx} 
                            href={item.href}
                            className="block px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg font-medium transition-colors"
                        >
                            {item.label}
                        </Link>
                     ))}
                </div>
            )}
        </div>
    )
}
