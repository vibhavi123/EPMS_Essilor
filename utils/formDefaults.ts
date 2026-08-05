/**
 * Form Default Values
 */

import {
  IncomingPackageFormData,
  OutgoingPackageFormData,
  AddPackageFormData,
  IncomingPackageVerificationFormData,
  OutgoingPackageVerificationFormData,
  HoldingPackage,
} from "./formTypes";

export const incomingPackageDefaults: IncomingPackageFormData = {
  trackingNumber: "",
  referenceNumber: "",
  customerName: "",
  time: "",
  date: "",
  employeeName: "",
  department: "",
  employeeCompany: "",
  deliveryCompany: "",
  deliveryPersonName: "",
  vehicleNumber: "",
  vehicleType: "",
  remark: "",
};

export const outgoingPackageDefaults: OutgoingPackageFormData = {
  trackingNumber: "",
  referenceNumber: "",
  customerName: "",
  packageDescription: "",
  deliveryPersonName: "",
  time: "",
  date: "",
  employeeName: "",
  employeeId: "",
  Department: "",
  employeeCompany: "",
  deliveryCompany: "",
};

export const addPackageDefaults: AddPackageFormData = {
  packageType: "incoming",
  trackingNumber: "",
  referenceNumber: "",
  employeeId: " ",
  employeeName: "",
  department: "",
  employeeCompany: "",
  customerName: "",
  deliveryPersonName: "",
  deliveryCompany: "",
  vehicleNumber: "",
  vehicleType: "",
  time: "",
  date: "",
};

export const incomingPackageVerificationDefaults: IncomingPackageVerificationFormData = {
  employeeCompany: "",
  employeeId: "",
  Department: "",
  time: "",
  date: "",
};

export const outgoingPackageVerificationDefaults: OutgoingPackageVerificationFormData = {
  employeeCompany: "",
  employeeName: "",
  department: "",
  vehicleNumber: "",
  deliveryPersonName: "",
  vehicleType: "",
  time: "",
  date: "",
  deliveryCompany: "",
};

export const holdingPackageDefaults: HoldingPackage = {
  id: 0,
  trackingNumber: "",
  referenceNumber: "",
  customerName: "",
  holdingReason: "",
  createdAt: "",
  type: "incoming",
  mode: "single",
  verified: false,
};
