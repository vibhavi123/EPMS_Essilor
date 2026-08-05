"use client";

import React, { useRef } from "react";
import { Printer, Download } from "lucide-react";
import Barcode from "react-barcode";
import { Employee } from "@/utils/formTypes";

interface EmployeeBarcodePrintCardProps {
  employee: Employee;
  onAddAnother: () => void;
}

export default function EmployeeBarcodePrintCard({
  employee,
  onAddAnother,
}: EmployeeBarcodePrintCardProps) {
  const barcodeRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=750,height=850");
    if (!printWindow) return;

    // Close the window after printing
    printWindow.onafterprint = () => {
      printWindow.close();
    };

    // Write a compact print template with minimal margins to avoid browser header space
    printWindow.document.write(`
      <html>
        <head>
          <title>Employee ID Card - ${employee.employeeName}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            /* Print page sized to standard CR80 ID card: 3.375in x 2.125in */
            @page { margin: 0; size: 3.375in 2.125in; }
            body {
              margin: 0;
              padding: 0.12in; /* small margin around card for printer */
              font-family: Arial, sans-serif;
              background: #fff;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            /* Card sized exactly for printing */
            .card {
              width: 3.375in;
              height: 2.125in;
              box-sizing: border-box;
              border: 2px solid rgba(12, 36, 76, 0.12);
              border-radius: 0.08in;
              overflow: hidden;
              background: #fff;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 0.12in;
            }
            .header {
              background: linear-gradient(135deg, #0c244c 0%, #173a72 55%, #1f77b4 100%);
              color: white;
              padding: 0.06in 0.08in;
              text-align: center;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 1.6px;
              text-transform: uppercase;
            }
            .content {
              padding: 0.06in 0.08in 0.04in 0.08in;
              text-align: center;
              flex: 1 1 auto;
            }
            .name {
              font-size: 12px;
              font-weight: 700;
              color: #0c244c;
              margin: 0.02in 0 0.04in 0;
            }
            .field {
              font-size: 9px;
              color: #334155;
              margin: 0.02in 0;
            }
            .label {
              font-weight: bold;
              color: #0f4c81;
            }
            .barcode-container {
              margin: 0.04in 0;
              padding: 0.02in;
              background: #fff;
              border-radius: 0.04in;
              display: flex;
              justify-content: center;
            }
            svg { max-width: 100%; height: auto; }
            .footer {
              font-size: 9px;
              color: #6b7280;
              margin-top: 10px;
              line-height: 1.2;
              text-transform: uppercase;
              letter-spacing: 0.6px;
            }
            @media print {
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              body {
                padding: 0;
                background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%) !important;
              }

              .card {
                border-color: rgba(12, 36, 76, 0.12) !important;
                box-shadow: none !important;
                width: 3.375in !important;
                height: 2.125in !important;
                padding: 0.12in !important;
              }

              .header {
                color: white !important;
                border-bottom: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">Employee Identification Card</div>
            <div class="content">
              <div class="name">${employee.employeeName}</div>
              <div class="field"><span class="label">Company:</span> ${employee.employeeCompany}</div>
              <div class="field"><span class="label">Department:</span> ${employee.department}</div>
              <div class="barcode-container"><svg id="barcode"></svg></div>
              <div class="footer">Official Employee Identification<br/>Secure Facility Access</div>
            </div>
          </div>
          <script>
            JsBarcode("#barcode", "${employee.employeeId}", {
              format: "CODE128",
              width: 1.6,
              height: 46,
              displayValue: false,
              fontSize: 12,
              margin: 2
            });

            window.addEventListener("load", function () {
              // focus + print triggers print dialog in most browsers
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handleDownload = () => {
    const svg = barcodeRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `employee-${employee.employeeId}.png`;
      link.click();
    };

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
          <div ref={barcodeRef} className="bg-white rounded-lg shadow-lg overflow-hidden border border-[#d7e3f3]">
        {/* Header */}
        <div className="bg-linear-to-r from-[#0c244c] via-[#173a72] to-[#1f77b4] text-white p-4 text-center">
          <h2 className="text-base font-bold tracking-widest uppercase">Employee ID Card</h2>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-3 bg-linear-to-b from-white to-[#fbfdff]">
          <div className="text-2xl font-bold text-[#0c244c]">{employee.employeeName}</div>

          <div className="text-sm text-slate-700 space-y-1">
            <div><span className="font-bold text-[#0f4c81]">Company:</span> {employee.employeeCompany}</div>
            <div><span className="font-bold text-[#0f4c81]">Department:</span> {employee.department}</div>
          </div>

          {/* Barcode */}
          <div className="bg-linear-to-r from-[#f8fbff] to-[#eef6ff] p-4 rounded-lg flex justify-center border border-[#dbe8f5]">
            <Barcode value={employee.employeeId} format="CODE128" displayValue={false} height={56} width={1.5} />
          </div>

          <div className="text-[9px] text-slate-500 uppercase tracking-wide">Official Employee Identification Card</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center mt-6">
        <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2 bg-[#3ea5d9] hover:bg-[#2d8ab8] text-white font-bold rounded-lg transition-all shadow-md">
          <Printer size={16} />
          Print Card
        </button>

        <button onClick={handleDownload} className="flex items-center gap-2 px-5 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-all shadow-md">
          <Download size={16} />
          Download
        </button>

        <button onClick={onAddAnother} className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all shadow-md">
          Add Another
        </button>
      </div>
    </div>
  );
}
