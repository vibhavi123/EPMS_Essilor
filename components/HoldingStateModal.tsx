import React, { useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";

interface HoldingStateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isSubmitting?: boolean;
  packageDetails: {
    customerName: string;
    trackingNumber: string;
    employeeName?: string;
  };
  onHoldingStateSet?: (data: {
    trackingNumber: string;
    reason: string;
    timestamp: string;
  }) => void;
}

export default function HoldingStateModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  packageDetails,
  onHoldingStateSet,
}: HoldingStateModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [holdingReason, setHoldingReason] = useState("");

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => {
      if (onHoldingStateSet) {
        onHoldingStateSet({
          trackingNumber: packageDetails.trackingNumber,
          reason: holdingReason || "No reason specified",
          timestamp: new Date().toISOString(),
        });
      }
      onConfirm(holdingReason);
      setConfirmed(false);
      setHoldingReason("");
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-6 py-4 bg-blue-50">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className="text-[#0c244c]" />
            <h3 className="text-xl font-semibold text-[#0c244c]">
              Package on Hold
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Package Summary */}
          <div className="space-y-3">
            <h4 className="font-semibold text-[#0c244c]">Package Details:</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tracking Number:</span>
                <span className="font-semibold">{packageDetails.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-semibold">{packageDetails.customerName}</span>
              </div>
              {packageDetails.employeeName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Employee:</span>
                  <span className="font-semibold">{packageDetails.employeeName}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Status:</span>
                <span className="font-semibold text-[#0c244c]"> HOLDING</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            Change Selection
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || confirmed}
            className={`flex-1 py-3 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
              confirmed
                ? "bg-green-500 text-white"
                : "bg-[#0c244c] hover:bg-[#0c2d5c] disabled:bg-gray-400 text-white"
            }`}
          >
            {confirmed ? (
              <>
                <CheckCircle size={20} />
                Confirmed
              </>
            ) : isSubmitting ? (
              "Submitting..."
            ) : (
              "Confirm & Hold"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
