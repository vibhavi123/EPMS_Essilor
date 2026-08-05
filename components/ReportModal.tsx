import React from "react";
import { Download, X } from "lucide-react";
import { ReportPackage } from "@/utils/formTypes";

interface ReportModalProps {
  isOpen: boolean;
  filteredPackages: ReportPackage[];
  onClose: () => void;
  onDownload: () => void;
}

export default function ReportModal({
  isOpen,
  filteredPackages,
  onClose,
  onDownload,
}: ReportModalProps) {
  if (!isOpen) return null;

  const getRowKey = (pkg: ReportPackage) => {
    const baseIdentifier = pkg.mode === "batch"
      ? (pkg.referenceNumber || pkg.trackingNumber)
      : pkg.trackingNumber;
    return `${pkg.type}-${pkg.mode}-${baseIdentifier}-${pkg.id}-${pkg.createdAt}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#0c244c]">Report Preview</h2>
            <p className="text-sm text-gray-600 mt-1">Total Records: {filteredPackages.length}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-[#0084c8] hover:bg-[#0071ad] text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-all"
            >
              <Download size={16} /> Download CSV
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="p-6">
          {filteredPackages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No packages to display</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#0084c8]">
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Tracking Numbers</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Reference Number</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Package Type</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Package Mode</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Status</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Customer</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Employee Name</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Employee ID</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Department</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Employee Company</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Delivery Company</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Delivery Person</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Details</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Remarks</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Vehicle Number</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Vehicle Type</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Date</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Time</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Employee Verified ID</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Hand Over Guard ID</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Guard ID</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Verified Date</th>
                    <th className="px-4 py-3 text-left font-bold text-[#0084c8]">Verified Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPackages.map((pkg) => {
                    // Parse updatedAt to extract date and time
                    let verifiedDate = "N/A";
                    let verifiedTime = "N/A";
                    if (pkg.updatedAt && pkg.updatedAt !== "N/A") {
                      try {
                        const date = new Date(pkg.updatedAt);
                        verifiedDate = date.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });
                        verifiedTime = date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        });
                      } catch {
                        verifiedDate = String(pkg.updatedAt);
                      }
                    }

                    return (
                      <tr key={getRowKey(pkg)} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-[#0084c8]">
                          {pkg.mode === "batch" && pkg.trackingNumbers && pkg.trackingNumbers.length > 0 ? (
                            <div className="space-y-1">
                              {Array.from(new Set(pkg.trackingNumbers)).map((tn, idx) => (
                                <div key={idx} className="font-semibold text-[#0c244c]">
                                  {tn}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-semibold text-[#0c244c]">
                              {pkg.trackingNumber || "N/A"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          {pkg.referenceNumber || "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            pkg.type === "Incoming" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {pkg.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            pkg.mode === "single" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {pkg.mode === "single" ? "Single" : "Batch"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            pkg.status === "verified" || pkg.status === "Completed" ? "bg-green-100 text-green-700" :
                            pkg.status === "Pending" ? "bg-orange-100 text-orange-600" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {pkg.status || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{pkg.customer || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.employee || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.employeeId || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.department || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.employeeCompany || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.deliveryCompany || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.deliveryPersonName || "N/A"}</td>
                        <td className="px-4 py-3 max-w-xs truncate" title={pkg.type === "Incoming" ? pkg.remark : pkg.packageDescription}>
                          {pkg.type === "Outgoing" ? (pkg.packageDescription || "N/A") : "N/A"}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={pkg.type === "Incoming" ? pkg.remark : pkg.packageDescription}>
                          {pkg.type === "Incoming" ? (pkg.remark || "N/A") : "N/A"}
                        </td>
                        <td className="px-4 py-3">{pkg.vehicleNumber || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.vehicleType || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.date || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.time || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.employeeVerifiedId || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.handOverGuardId || "N/A"}</td>
                        <td className="px-4 py-3">{pkg.guardId || "N/A"}</td>
                        <td className="px-4 py-3">{verifiedDate}</td>
                        <td className="px-4 py-3">{verifiedTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
