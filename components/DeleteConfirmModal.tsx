import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isSubmitting = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className="text-red-600" />
            <h3 className="text-xl font-semibold text-red-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="leading-relaxed text-gray-700">{message}</p>
        </div>

        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-gray-200 px-4 py-3 font-bold text-gray-800 transition-all hover:bg-gray-300 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-200"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSubmitting ? "Removing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
