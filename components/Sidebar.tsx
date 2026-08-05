"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useNavigation } from '@/hooks/useNavigation';
import { GateRecordRow } from '@/utils/formTypes';
import { OVERDUE_POLL_INTERVAL_MS } from '@/utils/overdueConfig';
import {
  Package,
  PackageSearch,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  LogOut,
  Menu,
  X,
  Shield,
  LogIn,
  AlertCircle,
  Monitor,
  User,

} from 'lucide-react';

interface NavLink {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconSize?: string;
  badge?: number;
  onClick: () => void;
}

interface UserProfile {
  username?: string;
  fullName?: string;
  role?: string;
  accessId?: string;
}

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const nav = useNavigation();
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueHours, setOverdueHours] = useState<number | null>(null);
  const [canShowOverdueAlert, setCanShowOverdueAlert] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const toggleSidebar = () => setIsOpen(!isOpen);

  // Load cached user profile and alert permissions on client mount to prevent SSR hydration mismatch
  useEffect(() => {
    try {
      const cachedProfile = sessionStorage.getItem('user_profile_cache');
      if (cachedProfile) {
        setUserProfile(JSON.parse(cachedProfile));
      }
      const cachedAlert = sessionStorage.getItem('can_overdue_alert_cache');
      if (cachedAlert !== null) {
        setCanShowOverdueAlert(cachedAlert === 'true');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const getInitials = (name?: string, username?: string) => {
    const target = name?.trim() || username?.trim() || 'U';
    const parts = target.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return target.substring(0, 2).toUpperCase();
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin':
        return { label: 'Super Admin', style: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'admin':
        return { label: 'Admin', style: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'guard':
        return { label: 'Guard', style: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'employee':
        return { label: 'Employee', style: 'bg-amber-100 text-amber-800 border-amber-300' };
      default:
        return { label: role || 'User', style: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadOverdueHours() {
      try {
        const res = await fetch('/api/admin/overdue');
        const data = await res.json();
        if (!data?.success || !mounted) return;
        const value = parseInt(String(data.value ?? ''), 10);
        if (!Number.isNaN(value) && value > 0) {
          setOverdueHours(value);
        }
      } catch {
        // no fallback; wait for admin-configured value
      }
    }

    void loadOverdueHours();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch current user details
  useEffect(() => {
    let mounted = true;
    async function loadUserProfile() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (mounted && data?.data) {
          setUserProfile(data.data);
          try {
            sessionStorage.setItem('user_profile_cache', JSON.stringify(data.data));
          } catch {}
        }
      } catch {
        // silent fail
      }
    }
    void loadUserProfile();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadOverduePermission() {
      try {
        const res = await fetch('/api/permissions/me');
        const data = await res.json();
        if (!mounted || !res.ok || !data?.success) {
          return;
        }

        const hasAlertPermission = Boolean(data?.data?.overdueEmployeeAlert);
        setCanShowOverdueAlert(hasAlertPermission);
        try {
          sessionStorage.setItem('can_overdue_alert_cache', String(hasAlertPermission));
        } catch {}
      } catch {
        if (mounted) {
          setCanShowOverdueAlert(false);
        }
      }
    }

    void loadOverduePermission();
    return () => {
      mounted = false;
    };
  }, []);

  // Poll for overdue employees using configured threshold every 60 s
  useEffect(() => {
    async function poll() {
      if (!canShowOverdueAlert) {
        setOverdueCount(0);
        return;
      }

      if (overdueHours === null) {
        setOverdueCount(0);
        return;
      }
      try {
        const res  = await fetch('/api/gate-records?type=employee');
        const data = await res.json();
        if (!data.success) return;
        
        const count = (data.data as GateRecordRow[]).filter((r) => {
          if (r.exitTime || !r.entryTime) return false;
          
          // Parse entry time (format: "HH:MM AM/PM")
          const timeMatch = r.entryTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (!timeMatch) return false;
          
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const period = timeMatch[3].toUpperCase();
          
          // Convert to 24-hour format
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          // Create a date object for today with entry time
          const entryDate = new Date();
          entryDate.setHours(hours, minutes, 0, 0);
          
          const now = Date.now();
          const diffH = (now - entryDate.getTime()) / 3_600_000;
          return diffH >= overdueHours;
        }).length;
        setOverdueCount(count);
      } catch { /* silent */ }
    }
    poll();
    const id = setInterval(poll, OVERDUE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [overdueHours, canShowOverdueAlert]);

  const outgoingLinks: NavLink[] = [
    { label: 'Add New Package', icon: Package, onClick: () => { nav.goToOutgoingPackages(); setIsOpen(false); } }
  ];

  const incomingLinks: NavLink[] = [
    { label: 'Add New Package', icon: Package, onClick: () => { nav.goToIncomingPackages(); setIsOpen(false); } }
  ];

  const otherLinks: NavLink[] = [
    { label: 'View all packages', icon: PackageSearch, onClick: () => { nav.goToAllPackages(); setIsOpen(false); } },
    { label: 'Report', icon: ClipboardList, onClick: () => { nav.goToReport(); setIsOpen(false); } },
    { label: 'Entry & Exit Recording', icon: LogIn, badge: overdueCount > 0 ? overdueCount : undefined, onClick: () => { nav.goToEntryExitRecording(); setIsOpen(false); } },
    { label: 'Verify Outgoing Packages', icon: PackageOpen, iconSize: 'h-7 w-7', onClick: () => { nav.goToAllOutgoingPackages(); setIsOpen(false); } },
    { label: 'Verify Incoming Packages', icon: PackageCheck, iconSize: 'h-7 w-7', onClick: () => { nav.goToAllIncomingPackages(); setIsOpen(false); } },
    { label: 'Verify Holding Packages', icon: AlertCircle, iconSize: 'h-7 w-7', onClick: () => { nav.goToHoldingVerification(); setIsOpen(false); } },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      sessionStorage.removeItem('user_profile_cache');
      sessionStorage.removeItem('can_overdue_alert_cache');
    } catch {
      // ignore storage errors
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout errors and still route the user out
    }

    nav.goToLogin();
    setIsOpen(false);
    setIsLoggingOut(false);
  };

  const userRole = userProfile?.role;
  const roleInfo = getRoleBadgeStyle(userRole);
  const isAdminUser = userRole === 'admin' || userRole === 'superAdmin';

  return (
    <>
      {/* --- MOBILE TOP BAR --- */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b px-4 py-2.5 fixed top-0 w-full z-50 shadow-xs">
        <div className="relative w-20 h-7">
          <Image
            src="/logo/essilor.png"
            alt="Essilor Logo"
            fill
            className="object-contain"
            loading="eager"
            sizes="96px"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {userProfile && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {getInitials(userProfile.fullName, userProfile.username)}
              </div>
              <span className="max-w-[90px] truncate">{userProfile.fullName || userProfile.username}</span>
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2 text-gray-600 focus:outline-none rounded-lg hover:bg-gray-100 transition-colors">
            {isOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* --- MOBILE OVERLAY --- */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={toggleSidebar}
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-full bg-[#e5e5e5] text-[#52525b] flex flex-col overflow-hidden z-50 border-r border-gray-300/80 shadow-sm transition-transform duration-300 ease-in-out lg:top-0 lg:h-screen lg:w-72 font-sans
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        
        {/* Logo Section */}
        <div className="bg-[#e5e5e5] border-b border-gray-300/60 px-4 py-2 flex justify-center items-center h-14 lg:h-16 shrink-0">
          <div className="relative w-28 h-12">
            <Image
              src="/logo/essilor.png"
              alt="Essilor Logo"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 1024px) 96px, 160px"
            />
          </div>
        </div>

        {/* User Profile Card */}
        <div className="px-3.5 pt-3 pb-1 shrink-0">
          <div className="p-3 rounded-2xl bg-white/90 border border-gray-300/70 shadow-xs flex items-center gap-3 transition-all hover:border-gray-400/80">
            {/* Avatar Circle */}
            <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-xs border border-white/20">
              {userProfile ? getInitials(userProfile.fullName, userProfile.username) : <User className="w-5 h-5" />}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-900 truncate leading-tight tracking-tight">
                {userProfile?.fullName || userProfile?.username || 'Authenticated User'}
              </p>
              {userProfile?.username && userProfile?.fullName && (
                <p className="text-[11px] font-medium text-gray-500 truncate leading-tight">
                  @{userProfile.username}
                </p>
              )}
              {userRole && (
                <div className="mt-1 flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleInfo.style}`}>
                    {roleInfo.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-0 py-1 overflow-y-auto scrollbar-thin">
          <NavSection title="Outgoing Package" links={outgoingLinks} onItemClick={() => setIsOpen(false)} />
          <NavSection title="Incoming Package" links={incomingLinks} onItemClick={() => setIsOpen(false)} />
          
          <div className="mt-3 border-t border-gray-300/60 pt-2 space-y-0.5 px-4">
            {otherLinks.map((link) => (
              <SidebarItem key={link.label} link={link} onClick={() => setIsOpen(false)} />
            ))}
          </div>

          {/* Admin Section - Only for admin and superAdmin */}
          {isAdminUser && (
            <div className="mt-2 border-t border-gray-300/60 pt-2">
              <h3 className="px-8 text-[11px] font-bold text-gray-500/80 uppercase tracking-wider mb-1.5">Administration</h3>
              <div className="px-4 space-y-0.5">
                <button
                  onClick={() => { nav.goToAllUsers(); setIsOpen(false); }}
                  className="w-full flex items-center gap-4 rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 group"
                >
                  <Shield className="h-5 w-5 text-gray-800/90 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-[13px] opacity-90 group-hover:opacity-100">Access Management</span>
                </button>
                <button
                  onClick={() => { nav.goToLoginMonitor(); setIsOpen(false); }}
                  className="w-full flex items-center gap-4 rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 group"
                >
                  <Monitor className="h-5 w-5 text-gray-800/90 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-[13px] opacity-90 group-hover:opacity-100">Login Monitor</span>
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-gray-300/60 px-5 py-2.5 bg-[#e5e5e5]">
          <button onClick={() => void handleLogout()} className="flex items-center justify-center gap-3 w-full group transition-all rounded-xl px-4 py-2.5 hover:bg-red-100/60 border border-transparent hover:border-red-200">
            <LogOut className="h-5 w-5 text-gray-600 group-hover:text-red-600 transition-colors" />
            <span className="font-bold text-[13px] text-gray-600 group-hover:text-red-600 transition-colors">{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function NavSection({ title, links, onItemClick }: { title: string, links: NavLink[], onItemClick: () => void }) {
  return (
    <div className="mt-2 border-t border-gray-300/60 pt-3">
      <h3 className="px-8 text-[11px] font-bold text-gray-500/80 uppercase tracking-wider mb-1.5">{title}</h3>
      <div className="px-4">
        {links.map(link => (
          <SidebarItem key={link.label} link={link} onClick={onItemClick} />
        ))}
      </div>
    </div>
  );
}

function SidebarItem({ link, onClick }: { link: NavLink, onClick: () => void }) {
  const iconSize = link.iconSize || 'h-6 w-6';
  return (
    <button onClick={() => { link.onClick(); onClick(); }} className="w-full flex items-center gap-4 rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 group">
      <link.icon className={`${iconSize} text-gray-800/90 group-hover:scale-110 transition-transform`} />
      <span className="font-bold text-[13px] opacity-90 group-hover:opacity-100 flex-1 text-left tracking-tight">{link.label}</span>
      {link.badge !== undefined && link.badge > 0 && (
        <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]">
          {link.badge > 9 ? '9+' : link.badge}
        </span>
      )}
    </button>
  );
}