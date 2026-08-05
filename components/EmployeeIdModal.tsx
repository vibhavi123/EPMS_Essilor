import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Clock, Calendar } from "lucide-react";

interface EmployeeIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employeeId: string, time: string, date: string) => void;
  isSubmitting: boolean;
}

const getCurrentDateTime = () => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const time = `${hours}.${minutes} ${ampm}`;

  const month = now.getMonth() + 1;
  const day = String(now.getDate()).padStart(2, "0");
  const year = now.getFullYear();
  const date = `${month}.${day}.${year}`;

  return { time, date };
};

export default function EmployeeIdModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: EmployeeIdModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const employeeInputRef = useRef<HTMLInputElement>(null);

  const dateTime = useMemo(() => {
    if (isOpen) {
      return getCurrentDateTime();
    }
    return { time: "", date: "" };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const candidate = employeeId.trim();
    setValidationError(null);
    if (!candidate) {
      setValidationError("Please enter Employee ID");
      return;
    }

    // Validate with server
    void (async () => {
      try {
        setValidating(true);
        const res = await fetch(`/api/employees/validate?employeeId=${encodeURIComponent(candidate)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setValidationError(json?.message || "Employee ID not found");
          return;
        }

        // success -> call parent submit
        onSubmit(candidate, dateTime.time, dateTime.date);
        setEmployeeId("");
      } catch (err) {
        setValidationError("Failed to validate Employee ID");
      } finally {
        setValidating(false);
      }
    })();
  };

  const handleClose = () => {
    setEmployeeId("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isSubmitting) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex justify-between items-center border-b px-6 py-4">
          <h3 className="text-xl font-semibold text-[#0c244c]">Verify by Employee</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Clock size={18} />
                <span className="text-sm font-medium">Captured Time</span>
              </div>
              <p className="font-semibold text-xl text-[#0c244c]">{dateTime.time}</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Calendar size={18} />
                <span className="text-sm font-medium">Captured Date</span>
              </div>
              <p className="font-semibold text-xl text-[#0c244c]">{dateTime.date}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID <span className="text-red-500">*</span>
            </label>
            <input
              ref={employeeInputRef}
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter Employee ID"
              className="w-full px-5 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0084c8] text-lg"
              disabled={isSubmitting}
            />
            {validationError && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || validating || !employeeId.trim()}
            className="flex-1 py-3 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 text-white font-bold rounded-xl transition-all active:scale-95"
          >
            {isSubmitting || validating ? "Checking..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
