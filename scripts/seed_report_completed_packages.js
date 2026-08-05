/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require("mysql2/promise");

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "1234",
  database: process.env.DB_NAME || "GuardSystemDB",
};

const timeValue = new Date().toLocaleTimeString("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const incomingSeed = [
  ["IN-RPT-0001", "12/15/2021", "single", null, "Completed customer delivery 1", "EMP1001", "Ayesha Perera", "ACME Corp", "Admin", "FedEx Sri Lanka", "Nimal Fernando", "KL-1001", "Motorcycle", "Guard completed verification 1", "GRD1001", "GRD2001"],
  ["IN-RPT-0002", "03/09/2022", "batch", "IN-BATCH-2022-001", "Completed customer delivery 2", "EMP1002", "Kasun Silva", "Beta Ltd", "Operations", "DHL", "Sunil Perera", "KL-1002", "Van", "Guard completed verification 2", "GRD1002", "GRD2002"],
  ["IN-RPT-0003", "07/22/2022", "single", null, "Completed customer delivery 3", "EMP1003", "Chamodi De Silva", "Gamma Pvt Ltd", "HR", "UPS", "Harsha Wickramasinghe", "KL-1003", "Car", "Guard completed verification 3", "GRD1003", "GRD2003"],
  ["IN-RPT-0004", "11/05/2023", "batch", "IN-BATCH-2023-001", "Completed customer delivery 4", "EMP1004", "Ishara Jayasinghe", "Delta Solutions", "Finance", "Aramex", "Dinesh Kumar", "KL-1004", "Motorcycle", "Guard completed verification 4", "GRD1004", "GRD2004"],
  ["IN-RPT-0005", "02/14/2023", "single", null, "Completed customer delivery 5", "EMP1005", "Tharindu Pathirana", "Omega Tech", "IT", "FedEx Sri Lanka", "Kamal Silva", "KL-1005", "Pickup", "Guard completed verification 5", "GRD1005", "GRD2005"],
  ["IN-RPT-0006", "05/18/2024", "batch", "IN-BATCH-2024-001", "Completed customer delivery 6", "EMP1006", "Piumi Herath", "Nova Industries", "Logistics", "DHL", "Ruwan Senanayake", "KL-1006", "Van", "Guard completed verification 6", "GRD1006", "GRD2006"],
  ["IN-RPT-0007", "09/30/2024", "single", null, "Completed customer delivery 7", "EMP1007", "Sahan Weerasinghe", "Prime Holdings", "Sales", "UPS", "Malinga Perera", "KL-1007", "Motorcycle", "Guard completed verification 7", "GRD1007", "GRD2007"],
  ["IN-RPT-0008", "01/11/2025", "batch", "IN-BATCH-2025-001", "Completed customer delivery 8", "EMP1008", "Dilini Rajapaksha", "Vertex Group", "Procurement", "Aramex", "Charith Dissanayake", "KL-1008", "Car", "Guard completed verification 8", "GRD1008", "GRD2008"],
  ["IN-RPT-0009", "06/25/2025", "single", null, "Completed customer delivery 9", "EMP1009", "Prabath Karunaratne", "Horizon PLC", "Support", "FedEx Sri Lanka", "Sampath Fernando", "KL-1009", "Van", "Guard completed verification 9", "GRD1009", "GRD2009"],
  ["IN-RPT-0010", "10/03/2025", "batch", "IN-BATCH-2025-002", "Completed customer delivery 10", "EMP1010", "Nadeesha Gamage", "Summit Co", "Admin", "DHL", "Thusitha Silva", "KL-1010", "Motorcycle", "Guard completed verification 10", "GRD1010", "GRD2010"],
];

const outgoingSeed = [
  ["OUT-RPT-0001", "02/08/2021", "single", null, "Completed outgoing package 1", "EMP2001", "Rashmi Perera", "ACME Corp", "Admin", "FedEx Sri Lanka", "Tech accessories", "Nimantha Silva", "KL-2001", "Motorcycle", "Outgoing verification completed 1", "EMPV2001", "GRD3001"],
  ["OUT-RPT-0002", "04/19/2022", "batch", "OUT-BATCH-2022-001", "Completed outgoing package 2", "EMP2002", "Janith Fernando", "Beta Ltd", "Operations", "DHL", "Office supplies", "Sahan Perera", "KL-2002", "Van", "Outgoing verification completed 2", "EMPV2002", "GRD3002"],
  ["OUT-RPT-0003", "08/27/2022", "single", null, "Completed outgoing package 3", "EMP2003", "Lakshani Silva", "Gamma Pvt Ltd", "HR", "UPS", "Documents", "Nuwan Kumara", "KL-2003", "Car", "Outgoing verification completed 3", "EMPV2003", "GRD3003"],
  ["OUT-RPT-0004", "12/14/2023", "batch", "OUT-BATCH-2023-001", "Completed outgoing package 4", "EMP2004", "Thilini Jayasuriya", "Delta Solutions", "Finance", "Aramex", "Hardware parts", "Chamara Perera", "KL-2004", "Motorcycle", "Outgoing verification completed 4", "EMPV2004", "GRD3004"],
  ["OUT-RPT-0005", "03/07/2023", "single", null, "Completed outgoing package 5", "EMP2005", "Kasun Madushanka", "Omega Tech", "IT", "FedEx Sri Lanka", "Stationery", "Manoj Fernando", "KL-2005", "Pickup", "Outgoing verification completed 5", "EMPV2005", "GRD3005"],
  ["OUT-RPT-0006", "06/21/2024", "batch", "OUT-BATCH-2024-001", "Completed outgoing package 6", "EMP2006", "Dilsha Seneviratne", "Nova Industries", "Logistics", "DHL", "Samples", "Isuru Perera", "KL-2006", "Van", "Outgoing verification completed 6", "EMPV2006", "GRD3006"],
  ["OUT-RPT-0007", "09/12/2024", "single", null, "Completed outgoing package 7", "EMP2007", "Prasadika Kumari", "Prime Holdings", "Sales", "UPS", "Marketing materials", "Ravindra Silva", "KL-2007", "Motorcycle", "Outgoing verification completed 7", "EMPV2007", "GRD3007"],
  ["OUT-RPT-0008", "01/29/2025", "batch", "OUT-BATCH-2025-001", "Completed outgoing package 8", "EMP2008", "Himasha Rajapaksha", "Vertex Group", "Procurement", "Aramex", "Return parcel", "Lakshan Dissanayake", "KL-2008", "Car", "Outgoing verification completed 8", "EMPV2008", "GRD3008"],
  ["OUT-RPT-0009", "07/16/2025", "single", null, "Completed outgoing package 9", "EMP2009", "Nisal Karunaratne", "Horizon PLC", "Support", "FedEx Sri Lanka", "Replacement item", "Kamal Ruwan", "KL-2009", "Van", "Outgoing verification completed 9", "EMPV2009", "GRD3009"],
  ["OUT-RPT-0010", "11/04/2025", "batch", "OUT-BATCH-2025-002", "Completed outgoing package 10", "EMP2010", "Sewmini Gamage", "Summit Co", "Admin", "DHL", "Returned documents", "Tharanga Silva", "KL-2010", "Motorcycle", "Outgoing verification completed 10", "EMPV2010", "GRD3010"],
];

async function upsertIncoming(pool, row) {
  const [
    trackingNumber, dateValue, mode, referenceNumber, customerName,
    employeeId, employeeName, employeeCompany, department, deliveryCompany,
    deliveryPersonName, vehicleNumber, vehicleType, remark, guardId, handOverGuardId,
  ] = row;

  const [existing] = await pool.query(
    "SELECT Id FROM IncomingPackages WHERE TrackingNumber = ? LIMIT 1",
    [trackingNumber]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE IncomingPackages SET
        ReferenceNumber = ?, \`Mode\` = ?, CustomerName = ?, \`Time\` = ?, \`Date\` = ?,
        EmployeeId = ?, EmployeeName = ?, EmployeeCompany = ?, Department = ?,
        DeliveryCompany = ?, DeliveryPersonName = ?, VehicleNumber = ?, VehicleType = ?,
        Remark = ?, VerificationStatus = 'completed', HoldingState = 0,
        GuardVerificationStatus = 'verified', GuardId = ?, HandOverGuardId = ?,
        GuardVerifiedAt = NOW(6), VerifiedAt = NOW(6), UpdatedAt = NOW(6)
       WHERE TrackingNumber = ?`,
      [
        referenceNumber, mode, customerName, timeValue, dateValue,
        employeeId, employeeName, employeeCompany, department,
        deliveryCompany, deliveryPersonName, vehicleNumber, vehicleType,
        remark, guardId, handOverGuardId, trackingNumber,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO IncomingPackages (
      TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName, \`Time\`, \`Date\`,
      EmployeeId, EmployeeName, EmployeeCompany, Department,
      DeliveryCompany, DeliveryPersonName, VehicleNumber, VehicleType,
      Remark, VerificationStatus, HoldingState, GuardVerificationStatus,
      GuardId, HandOverGuardId, GuardVerifiedAt, VerifiedAt, CreatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 0, 'verified', ?, ?, NOW(6), NOW(6), NOW(6))`,
    [
      trackingNumber, referenceNumber, mode, customerName, timeValue, dateValue,
      employeeId, employeeName, employeeCompany, department,
      deliveryCompany, deliveryPersonName, vehicleNumber, vehicleType,
      remark, guardId, handOverGuardId,
    ]
  );
}

async function upsertOutgoing(pool, row) {
  const [
    trackingNumber, dateValue, mode, referenceNumber, customerName,
    employeeId, employeeName, employeeCompany, department, deliveryCompany,
    packageDescription, deliveryPersonName, vehicleNumber, vehicleType,
    remark, employeeVerifiedId, handOverGuardId,
  ] = row;

  const [existing] = await pool.query(
    "SELECT Id FROM OutgoingPackages WHERE TrackingNumber = ? LIMIT 1",
    [trackingNumber]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE OutgoingPackages SET
        ReferenceNumber = ?, \`Mode\` = ?, CustomerName = ?, DeliveryPersonName = ?,
        PackageDescription = ?, \`Time\` = ?, \`Date\` = ?,
        EmployeeId = ?, EmployeeName = ?, EmployeeCompany = ?, Department = ?,
        DeliveryCompany = ?, VehicleNumber = ?, VehicleType = ?, Remark = ?,
        VerificationStatus = 'completed', HoldingState = 0,
        GuardVerificationStatus = 'verified', EmployeeVerifiedId = ?, HandOverGuardId = ?,
        GuardVerifiedAt = NOW(6), VerifiedAt = NOW(6), UpdatedAt = NOW(6)
       WHERE TrackingNumber = ?`,
      [
        referenceNumber, mode, customerName, deliveryPersonName,
        packageDescription, timeValue, dateValue,
        employeeId, employeeName, employeeCompany, department,
        deliveryCompany, vehicleNumber, vehicleType, remark,
        employeeVerifiedId, handOverGuardId, trackingNumber,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO OutgoingPackages (
      TrackingNumber, ReferenceNumber, \`Mode\`, CustomerName, DeliveryPersonName,
      PackageDescription, \`Time\`, \`Date\`, EmployeeId, EmployeeName, EmployeeCompany,
      Department, DeliveryCompany, VehicleNumber, VehicleType, Remark,
      VerificationStatus, HoldingState, GuardVerificationStatus,
      EmployeeVerifiedId, HandOverGuardId, GuardVerifiedAt, VerifiedAt, CreatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 0, 'verified', ?, ?, NOW(6), NOW(6), NOW(6))`,
    [
      trackingNumber, referenceNumber, mode, customerName, deliveryPersonName,
      packageDescription, timeValue, dateValue,
      employeeId, employeeName, employeeCompany, department,
      deliveryCompany, vehicleNumber, vehicleType, remark,
      employeeVerifiedId, handOverGuardId,
    ]
  );
}

async function main() {
  let pool;

  try {
    pool = await mysql.createPool(config);
    console.log("Connected to MySQL");

    for (const row of incomingSeed) {
      await upsertIncoming(pool, row);
    }
    console.log("Seeded incoming report packages");

    for (const row of outgoingSeed) {
      await upsertOutgoing(pool, row);
    }
    console.log("Seeded outgoing report packages");

    console.log("Seed complete");
  } catch (error) {
    console.error("Seed failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main();
