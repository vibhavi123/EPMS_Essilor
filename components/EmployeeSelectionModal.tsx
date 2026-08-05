import React, { useState } from "react";
import { X, CheckCircle, Clock } from "lucide-react";

interface EmployeeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeAvailable: () => void;
  onNoEmployeeAvailable: () => void;
}

export default function EmployeeSelectionModal({
  isOpen,
  onClose,
  onEmployeeAvailable,
  onNoEmployeeAvailable,
}: EmployeeSelectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<"available" | "unavailable" | null>(null);

  const handleSelect = (option: "available" | "unavailable") => {
    setSelectedOption(option);
    if (option === "available") {
      setTimeout(() => {
        onEmployeeAvailable();
        setSelectedOption(null);
      }, 300);
    } else {
      setTimeout(() => {
        onNoEmployeeAvailable();
        setSelectedOption(null);
      }, 300);
    }
  };

  const handleClose = () => {
    setSelectedOption(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex justify-between items-center border-b px-6 py-4">
          <h3 className="text-xl font-semibold text-[#0c244c]">Employee Availability</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600 text-center mb-6">
            Is an Employee available to verify this package now?
          </p>

          <button
            onClick={() => handleSelect("available")}
            className={`w-full p-6 border-2 rounded-xl transition-all transform hover:scale-105 ${
              selectedOption === "available"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 bg-white hover:border-green-300"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-full ${
                  selectedOption === "available" ? "bg-green-200" : "bg-blue-100"
                }`}
              >
                <CheckCircle
                  size={28}
                  className={selectedOption === "available" ? "text-green-600" : "text-blue-600"}
                />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-[#0c244c] text-lg">Employee Available</h4>
                <p className="text-sm text-gray-600">Verify now with Employee ID</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelect("unavailable")}
            className={`w-full p-6 border-2 rounded-xl transition-all transform hover:scale-105 ${
              selectedOption === "unavailable"
                ? "border-orange-500 bg-orange-50"
                : "border-gray-200 bg-white hover:border-orange-300"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-full ${
                  selectedOption === "unavailable" ? "bg-orange-200" : "bg-gray-100"
                }`}
              >
                <Clock
                  size={28}
                  className={selectedOption === "unavailable" ? "text-orange-600" : "text-gray-600"}
                />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-[#0c244c] text-lg">No Employee Available</h4>
                <p className="text-sm text-gray-600">Hold package until Employee verifies</p>
              </div>
            </div>
          </button>
        </div>

        <div className="border-t px-6 py-4">
          <button
            onClick={handleClose}
            className="w-full py-3 text-gray-600 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
