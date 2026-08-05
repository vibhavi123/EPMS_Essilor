"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { GateRecordRow } from "@/utils/formTypes";
import { AlertTriangle, User, X, BellOff } from "lucide-react";
import { OVERDUE_POLL_INTERVAL_MS, OVERDUE_SNOOZE_MS } from "@/utils/overdueConfig";

const POLL_INTERVAL_MS = OVERDUE_POLL_INTERVAL_MS;
const SNOOZE_MS = OVERDUE_SNOOZE_MS;

interface OverdueEmployee {
  record: GateRecordRow;
  hoursElapsed: number;
  minutesElapsed: number;
  totalMinutes: number;
}

/** Returns elapsed hours/minutes since entry time (handles timezone issues better) */
function getElapsed(entryTime: string, date: string) {
  const now = new Date();
  
  // Parse entry time string (format: "HH:MM AM/PM")
  const timeMatch = entryTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) {
    // Fallback: if time format is unexpected, return 0
    return { hoursElapsed: 0, minutesElapsed: 0, totalMinutes: 0 };
  }
  
  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const period = timeMatch[3].toUpperCase();
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  // Create a date object for today with entry time
  const entryDate = new Date();
  entryDate.setHours(hours, minutes, 0, 0);
  
  const diffMs = now.getTime() - entryDate.getTime();
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hoursElapsed = Math.floor(totalMinutes / 60);
  const minutesElapsed = totalMinutes % 60;
  return { hoursElapsed, minutesElapsed, totalMinutes };
}

export default function OverdueEmployeeAlert() {
  const [overdueList, setOverdueList] = useState<OverdueEmployee[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [overdueHours, setOverdueHours] = useState<number | null>(null);
  const [canShowOverdueAlert, setCanShowOverdueAlert] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isMarkingReturnId, setIsMarkingReturnId] = useState<number | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkOverdue = useCallback(async () => {
    // Respect snooze
    if (snoozedUntil && Date.now() < snoozedUntil) return;
    if (overdueHours === null) return;

    try {
      const res = await fetch("/api/gate-records?type=employee");
      const data = await res.json();
      if (!data.success) return;

      const active: GateRecordRow[] = data.data;

      const overdue: OverdueEmployee[] = active
        .filter((r) => !r.exitTime && r.entryTime)
        .map((r) => {
          const elapsed = getElapsed(r.entryTime, r.date);
          return { record: r, ...elapsed };
        })
        .filter((e) => e.hoursElapsed >= overdueHours)
        .sort((a, b) => b.totalMinutes - a.totalMinutes); 

      setOverdueList(overdue);
      if (overdue.length > 0) {
        setIsVisible(true);
      }
    } catch {
      // silently fail — don't interrupt normal flow
    }
  }, [snoozedUntil, overdueHours]);

  // Fetch configured overdue hours from admin settings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const permissionRes = await fetch("/api/permissions/me");
        const permissionData = await permissionRes.json();
        if (mounted && permissionRes.ok && permissionData?.success) {
          setCanShowOverdueAlert(Boolean(permissionData?.data?.overdueEmployeeAlert));
        }

        const res = await fetch("/api/admin/overdue");
        const data = await res.json();
        if (data?.success && mounted) {
          const val = parseInt(String(data.value ?? ""), 10);
          if (!Number.isNaN(val) && val > 0) {
            setOverdueHours(val);
          }
        }
      } catch {
        // ignore; alert stays disabled until config exists
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Initial check + interval
  useEffect(() => {
    if (!canShowOverdueAlert) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void checkOverdue();
    }, 0);
    intervalRef.current = setInterval(checkOverdue, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkOverdue, canShowOverdueAlert]);

  const handleDismiss = () => {
    setAlertError(null);
    setIsVisible(false);
  };

  const handleSnooze = () => {
    setAlertError(null);
    setSnoozedUntil(Date.now() + SNOOZE_MS);
    setIsVisible(false);
  };

  const validateAdminCredentials = useCallback(async () => {
    const password = adminPassword.trim();
    
    if (!password) {
      setAlertError("Please enter admin password.");
      return null;
    }

    setIsAuthorizing(true);
    setAlertError(null);
    try {
      const res = await fetch("/api/admin/overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data?.success) {
        setAlertError(data?.message || "Authorization failed.");
        return null;
      }
      return data.data.accessId; // Return the validated access ID from server
    } catch {
      setAlertError("Could not verify credentials right now.");
      return null;
    } finally {
      setIsAuthorizing(false);
    }
  }, [adminPassword]);

  const getExitTimeForStorage = () =>
    new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  const handleConfirmReturn = async () => {
    const validated = await validateAdminCredentials();
    if (!validated) return;
    
    // Mark all overdue employees as returned
    const returnPromises = overdueList.map(async (item) => {
      try {
        const res = await fetch("/api/gate-records/exit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.record.id,
            exitTime: getExitTimeForStorage(),
            guardId: validated,
          }),
        });
        return { success: res.ok, id: item.record.id };
      } catch {
        return { success: false, id: item.record.id };
      }
    });
    
    try {
      const results = await Promise.all(returnPromises);
      const failedCount = results.filter(r => !r.success).length;
      
      if (failedCount > 0) {
        setAlertError(`Failed to mark ${failedCount} employee(s) as returned.`);
      } else {
        setOverdueList([]);
        setIsVisible(false);
        setAdminPassword("");
      }
    } catch {
      setAlertError("Network error while marking returns.");
    }
  };


  if (!canShowOverdueAlert || !isVisible || overdueList.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={handleDismiss} />
        <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden alert-card-enter">

          {/* Top red accent bar */}
          <div className="h-1.5 w-full bg-red-600" />
          <div className="px-8 pt-8 pb-6 text-center relative">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full p-1.5"
              title="Close"
            >
              <X size={20} />
            </button>

            {/* Siren icon cluster */}
            <div className="flex justify-center mb-5">
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* Outer pulsing ring */}
                <div className="absolute inset-0 rounded-full border-4 border-red-100 alert-ring-pulse" />
                {/* Background circle */}
                <div className="absolute inset-2 rounded-full bg-red-50" />
                {/* Icon */}
                <div className="relative z-10 flex items-center justify-center text-red-600 alert-icon-bounce">
                  <AlertTriangle size={80} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0c244c]">
                Overdue Employee Alert
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                {overdueList.length} employee{overdueList.length > 1 ? "s have" : " has"} been outside for more than <span className="font-bold text-red-600">{overdueHours} hours</span>.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 max-h-72 overflow-y-auto border-t border-b border-gray-100 alert-scroll">
            <div className="space-y-3">
              {overdueList.map((e) => (
                <div
                  key={e.record.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-red-200 rounded-xl px-4 py-3 shadow-sm hover:border-red-300 transition-colors"
                >
                  {/* Avatar */}
                  <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-red-50 items-center justify-center border border-red-100">
                    <User size={18} className="text-red-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0c244c] font-bold text-sm truncate">
                      {e.record.name ?? e.record.personnelId}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs font-medium">
                        ID: {e.record.personnelId}
                      </span>
                      <span className="text-gray-300 text-xs">&bull;</span>
                      <span className="text-gray-500 text-xs">
                        Exited at {e.record.entryTime}
                      </span>
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="shrink-0">
                    <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="text-red-700 font-bold text-sm whitespace-nowrap">
                        {e.hoursElapsed}h {e.minutesElapsed}m
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Buttons*/}
          <div className="px-6 py-4 bg-white flex flex-col gap-3">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin Password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              disabled={isAuthorizing}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSnooze}
                disabled={isAuthorizing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm transition-all"
              >
                <BellOff size={16} className="text-gray-500" />
                Snooze 30 min
              </button>
              <button
                onClick={() => void handleConfirmReturn()}
                disabled={isAuthorizing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
              >
                {isAuthorizing ? "Verifying..." : "Confirm Return"}
              </button>
            </div>
          </div>
          {alertError && (
            <div className="px-6 pb-4">
              <p className="text-xs text-red-600 font-medium">{alertError}</p>
            </div>
          )}
        </div>
      </div>

      {/*Keyframes & Styles */}
      <style>{`
        @keyframes alertRingPulse {
          0% { transform: scale(0.8); opacity: 1; border-width: 4px; }
          100% { transform: scale(1.4); opacity: 0; border-width: 0px; }
        }
        @keyframes alertIconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes alertCardEnter {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .alert-ring-pulse {
          animation: alertRingPulse 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .alert-icon-bounce {
          animation: alertIconBounce 2s ease-in-out infinite;
        }
        .alert-card-enter {
          animation: alertCardEnter 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards;
        }
        
        .alert-scroll::-webkit-scrollbar { width: 6px; }
        .alert-scroll::-webkit-scrollbar-track { background: transparent; }
        .alert-scroll::-webkit-scrollbar-thumb { background: #fca5a5; border-radius: 3px; }
        .alert-scroll::-webkit-scrollbar-thumb:hover { background: #f87171; }
      `}</style>
    </>
  );
}
