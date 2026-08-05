"use client";

import React, { useRef, useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";

interface GateRecord {
  id: string;
  name: string;
  visitorReason: string;
  entryTime: string;
  exitTime?: string;
  type: "employee" | "visitor" | "vehicle";
  date: string;
  details?: {
    driverName?: string;
    vehicleType?: string;
    plateNumber?: string;
  };
}

interface RecordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (guardId: string) => void;
  record: GateRecord | null;
  mode: "employee" | "visitor" | "vehicle";
  isSubmitting?: boolean;
}

export default function RecordVerificationModal({
  isOpen,
  onClose,
  onConfirm,
  record,
  mode,
  isSubmitting = false,
}: RecordVerificationModalProps) {
  const [guardId, setGuardId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const guardInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        guardInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const candidate = guardId.trim();
    setValidationError(null);
    if (!candidate) {
      setValidationError("Please enter Guard ID");
      return;
    }

    // Validate with server
    void (async () => {
      try {
        setValidating(true);
        const res = await fetch(`/api/guards/validate?accessId=${encodeURIComponent(candidate)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setValidationError(json?.message || "Guard ID not found");
          return;
        }

        // success -> call parent confirm
        onConfirm(candidate);
        setGuardId("");
      } catch (err) {
        void err;
        setValidationError("Failed to validate Guard ID");
      } finally {
        setValidating(false);
      }
    })();
  };

  const handleClose = () => {
    setGuardId("");
    setValidationError(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isSubmitting && !validating) {
      handleSubmit();
    }
  };

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={24} className="text-blue-600" />
            <h3 className="text-xl font-bold text-[#0c244c]">
              Confirm {mode === "employee" ? "Return" : "Exit"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Verification Details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">ID</p>
              <p className="text-lg font-mono font-bold text-[#0c244c]">{record.id}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Name</p>
              <p className="text-lg font-bold text-[#0c244c]">{record.name}</p>
            </div>

            {record.type === "visitor" && record.visitorReason && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Reason</p>
                <p className="text-sm text-[#0c244c]">{record.visitorReason}</p>
              </div>
            )}

            {record.type === "vehicle" && record.details && (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Vehicle Type</p>
                  <p className="text-sm text-[#0c244c]">{record.details.vehicleType}</p>
                </div>
                {record.details.driverName && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Driver Name</p>
                    <p className="text-sm text-[#0c244c]">{record.details.driverName}</p>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1 pt-3 border-t border-gray-300">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Entry Time</p>
              <p className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                {record.entryTime}
              </p>
            </div>
          </div>

          {/* Verification Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Verify the details above are correct before confirming the {mode === "employee" ? "return" : "exit"}.
            </p>
          </div>

          {/* Guard ID Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-[#4a5568] uppercase tracking-widest">
              Guard ID / Badge to Confirm *
            </label>
            <input
              ref={guardInputRef}
              type="text"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono text-center uppercase disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={guardId}
              onChange={(e) => setGuardId(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Scan guard badge..."
              disabled={isSubmitting || validating}
            />
            {validationError && (
              <p className="text-sm text-red-600">{validationError}</p>
            )}
            <p className="text-xs text-gray-500 italic">
              Scan your guard badge to authorize this {mode === "employee" ? "return" : "exit"}
            </p>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={isSubmitting || validating}
              className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-200 text-gray-800 font-bold rounded-lg transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!guardId || isSubmitting || validating}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              {isSubmitting || validating ? "Confirming..." : `Confirm ${mode === "employee" ? "Return" : "Exit"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
