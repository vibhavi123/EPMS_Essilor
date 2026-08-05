import { ReportPackage } from "./formTypes";

export const generateReportCSV = (filteredPackages: ReportPackage[]) => {
  if (filteredPackages.length === 0) {
    alert("No packages to export");
    return;
  }

  const batchTrackingByRef = new Map<string, string[]>();
  filteredPackages.forEach((pkg) => {
    if (pkg.mode !== "batch" || !pkg.referenceNumber) {
      return;
    }

    const key = `${pkg.type}-${pkg.referenceNumber}`;
    const existing = batchTrackingByRef.get(key) ?? [];
    const collected = new Set(existing);

    if (pkg.trackingNumbers?.length) {
      pkg.trackingNumbers.forEach((trackingNumber) => collected.add(trackingNumber));
    } else if (pkg.trackingNumber) {
      collected.add(pkg.trackingNumber);
    }

    batchTrackingByRef.set(key, Array.from(collected));
  });

  const headers = [
    "Tracking Numbers",
    "Reference Number",
    "Package Type",
    "Package Mode",
    "Status",
    "Customer",
    "Employee Name",
    "Employee ID",
    "Department",
    "Employee Company",
    "Delivery Company",
    "Delivery Person",
    "Details",
    "Remarks",
    "Vehicle Number",
    "Vehicle Type",
    "Date",
    "Time",
    "Employee Verified ID",
    "Hand Over Guard ID",
    "Verified Date",
    "Verified Time",
  ];

  const rows = filteredPackages.map((pkg) => {
    const uniqueTrackingNumbers = pkg.trackingNumbers?.length
      ? Array.from(new Set(pkg.trackingNumbers))
      : [];
    const aggregatedTrackingNumbers =
      pkg.mode === "batch" && pkg.referenceNumber
        ? batchTrackingByRef.get(`${pkg.type}-${pkg.referenceNumber}`) ?? []
        : [];

    const trackingNumbersForExport =
      aggregatedTrackingNumbers.length > 0 ? aggregatedTrackingNumbers : uniqueTrackingNumbers;

    const trackingNumbersDisplay =
      pkg.trackingNumber && !pkg.trackingNumbers
        ? pkg.trackingNumber
        : trackingNumbersForExport.length > 0
          ? trackingNumbersForExport.join(" | ")
          : pkg.trackingNumber || "N/A";

    let verifiedDate = "";
    let verifiedTime = "";
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

    return [
      trackingNumbersDisplay,
      pkg.referenceNumber || "N/A",
      pkg.type || "",
      pkg.mode || "",
      pkg.status || "N/A",
      pkg.customer || "N/A",
      pkg.employee || "N/A",
      pkg.employeeId || "N/A",
      pkg.department || "N/A",
      pkg.employeeCompany || "N/A",
      pkg.deliveryCompany || "N/A",
      pkg.deliveryPersonName || "N/A",
      pkg.type === "Outgoing" ? (pkg.packageDescription || "N/A") : "N/A",
      pkg.type === "Incoming" ? (pkg.remark || "N/A") : "N/A",
      pkg.vehicleNumber || "N/A",
      pkg.vehicleType || "N/A",
      pkg.date || "",
      pkg.time || "",
      pkg.employeeVerifiedId || pkg.guardId || "N/A",
      pkg.handOverGuardId || "N/A",
      verifiedDate,
      verifiedTime,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell ?? "").replace(/"/g, '""');
          return `"${cellStr}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  const timestamp = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
  link.href = url;
  link.download = `report_${timestamp}_${time}.csv`;
  link.click();

  window.URL.revokeObjectURL(url);
};
