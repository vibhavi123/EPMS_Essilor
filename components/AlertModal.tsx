import React from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  buttonText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  buttonText = "OK",
}: AlertModalProps) {
  if (!isOpen) return null;

  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      headerBg: "bg-green-50",
      titleColor: "text-green-900",
      buttonBg: "bg-green-600 hover:bg-green-700",
      iconColor: "text-green-600",
    },
    error: {
      icon: AlertCircle,
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      headerBg: "bg-red-50",
      titleColor: "text-red-900",
      buttonBg: "bg-red-600 hover:bg-red-700",
      iconColor: "text-red-600",
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      headerBg: "bg-yellow-50",
      titleColor: "text-yellow-900",
      buttonBg: "bg-yellow-600 hover:bg-yellow-700",
      iconColor: "text-yellow-600",
    },
    info: {
      icon: Info,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      headerBg: "bg-blue-50",
      titleColor: "text-blue-900",
      buttonBg: "bg-blue-600 hover:bg-blue-700",
      iconColor: "text-blue-600",
    },
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`flex justify-between items-center border-b ${config.borderColor} px-6 py-4 ${config.headerBg}`}>
          <div className="flex items-center gap-3">
            <IconComponent size={24} className={config.iconColor} />
            <h3 className={`text-xl font-semibold ${config.titleColor}`}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className={`py-3 px-6 font-medium rounded-xl transition-colors ${config.buttonBg} text-white active:scale-95`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
