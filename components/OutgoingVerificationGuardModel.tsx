import React, { useRef, useEffect, useState, useMemo } from "react";
import { X, Clock, Calendar, Shield } from "lucide-react";

interface OutgoingVerificationGuardModelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (guardId: string, time: string, date: string) => void;
  isSubmitting: boolean;
  packageDetails?: {
    trackingNumber?: string;
    customerName?: string;
  } | null;
}

const getCurrentDateTime = () => {
  const now = new Date();
  
  // Format time as H.MM AM/PM
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const time = `${hours}.${minutes} ${ampm}`;
  
  // Format date as M.DD.YYYY
  const month = now.getMonth() + 1;
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const date = `${month}.${day}.${year}`;
  
  return { time, date };
};

export default function OutgoingVerificationGuardModel({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  packageDetails,
}: OutgoingVerificationGuardModelProps) {
  const [guardId, setGuardId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const guardInputRef = useRef<HTMLInputElement>(null);

  // Compute dateTime reactively when modal opens (not state)
  const dateTime = useMemo(() => {
    if (isOpen) {
      return getCurrentDateTime();
    }
    return { time: "", date: "" };
  }, [isOpen]);

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

        // success -> call parent submit
        onSubmit(candidate, dateTime.time, dateTime.date);
        setGuardId("");
      } catch (err) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-[#0084c8]" />
            <h3 className="text-xl font-semibold text-[#0c244c]">
              Guard Assignment
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
          {/* Package Info */}
          {packageDetails && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Outgoing Package in Holding State</span>
              </p>
              {packageDetails.trackingNumber && (
                <p className="text-sm text-[#0c244c] font-semibold">
                  Tracking: {packageDetails.trackingNumber}
                </p>
              )}
              {packageDetails.customerName && (
                <p className="text-sm text-gray-700">
                  Customer: {packageDetails.customerName}
                </p>
              )}
            </div>
          )}

          {/* Captured Time and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Clock size={18} />
                <span className="text-sm font-medium">Time</span>
              </div>
              <p className="font-semibold text-lg text-[#0c244c]">{dateTime.time}</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Calendar size={18} />
                <span className="text-sm font-medium">Date</span>
              </div>
              <p className="font-semibold text-lg text-[#0c244c]">{dateTime.date}</p>
            </div>
          </div>

          {/* Guard ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guard ID <span className="text-red-500">*</span>
            </label>
            <input
              ref={guardInputRef}
              type="text"
              value={guardId}
              onChange={(e) => setGuardId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter Guard ID"
              className="w-full px-5 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0084c8] text-lg"
              disabled={isSubmitting || validating}
            />
            {validationError && (
              <p className="mt-2 text-sm text-red-600 font-medium">{validationError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex gap-3 bg-gray-50">
          <button
            onClick={handleClose}
            className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            disabled={isSubmitting || validating}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || validating || !guardId.trim()}
            className="flex-1 py-3 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 text-white font-bold rounded-xl transition-all active:scale-95"
          >
            {isSubmitting || validating ? "Confirming..." : "confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
