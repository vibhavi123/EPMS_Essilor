/**
 * Form Data Interfaces
 */

export interface IncomingPackageFormData {
  trackingNumber: string;
  referenceNumber: string;
  customerName: string;
  time: string;
  date: string;
  employeeName: string;
  department: string;
  employeeCompany: string;
  deliveryCompany: string;
  deliveryPersonName: string;
  vehicleNumber: string;
  vehicleType: string;
  remark: string;
}

export interface IncomingPackageRecord {
  Id: number;
  TrackingNumber: string;
  ReferenceNumber: string | null;
  Mode: string;
  CustomerName: string;
  DeliveryPersonName: string | null;
  VerificationStatus: string;
  Date: string;
  Time: string;
  HoldingState: number;
  GuardVerificationStatus: string;
  HandOverGuardId?: string | null;
}
export  interface IncomingPackage {
  id: number;
  trackingNumber: string;
  referenceNumber: string | null;
  mode: "single" | "batch";
  customerName: string;
  deliveryPersonName?: string | null;
  status: string;
  date: string;
  time: string;
  batchCount?: number;
  holdingState: number;
  guardVerificationStatus: string;
}

export interface OutgoingPackageFormData {
  trackingNumber: string;
  referenceNumber: string;
  customerName: string;
  packageDescription: string;
  deliveryPersonName: string;
  time: string;
  date: string;
  employeeName: string;
  employeeId: string;
  Department: string;
  employeeCompany: string;
  deliveryCompany: string;
}
export interface OutgoingPackageRecord {
  TrackingNumber: string;
  ReferenceNumber: string | null;
  Mode: string;
  DeliveryPersonName: string | null;
  PackageDescription: string | null;
  VerificationStatus: string;
  Date: string;
  Time: string;
  HoldingState: number;
  GuardVerificationStatus: string;
  EmployeeVerifiedId?: string | null;
  HandOverGuardId?: string | null;
}


export interface AddPackageFormData {
  packageType: 'incoming' | 'outgoing';
  trackingNumber: string;
  referenceNumber?: string;
  employeeId: string;
  employeeName: string;
  department: string;
  employeeCompany: string;
  customerName?: string;
  deliveryPersonName?: string;
  deliveryCompany: string;
  vehicleNumber?: string;
  vehicleType?: string;
  time?: string;
  date?: string;
}

export interface IncomingPackageVerificationFormData {
  employeeCompany: string;
  employeeId: string;
  Department: string;
  time: string;
  date: string;
}

export interface OutgoingPackageVerificationFormData {
  employeeCompany: string;
  employeeName: string;
  department: string;
  vehicleNumber: string;
  deliveryPersonName: string;
  vehicleType: string;
  time: string;
  date: string;
  deliveryCompany: string;
}

export interface HoldingPackage {
  id: number;
  trackingNumber?: string;
  trackingNumbers?: string[];
  referenceNumber?: string;
  customerName: string;
  holdingReason?: string;
  createdAt: string;
  type: "incoming" | "outgoing";
  mode: "single" | "batch";
  verified: boolean;
}

export interface HoldingPackageAlert {
  id: number;
  trackingNumber: string;
  customerName: string;
  type: "incoming" | "outgoing";
  holdTime: string;
}

export interface BatchPackage {
  id: number;
  trackingNumber: string;
  customerName: string;
  packageDescription: string;
  deliveryPersonName?: string;
  employeeName: string;
  employeeId: string;
  department: string;
  employeeCompany?: string;
}

export interface User {
  accessId: string;
  name: string;
  Username: string;
  type: string;
}

export interface Delivery {
  deliveryPersonNIC: string;
  deliveryPersonName: string;
  deliveryCompany: string;
}

export interface ReportPackage {
  id: string;
  type: "Incoming" | "Outgoing";
  mode: "single" | "batch";
  trackingNumber: string;
  trackingNumbers?: string[];
  referenceNumber?: string;
  status: string;
  customer: string;
  employee: string;
  employeeId: string;
  department: string;
  employeeCompany: string;
  deliveryCompany: string;
  deliveryPersonName?: string;
  packageDescription?: string;
  remark?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  date: string;
  time: string;
  createdAt: string;
  updatedAt: string;
  guardId?: string;
  employeeVerifiedId?: string;
  handOverGuardId?: string;
  guardVerifiedAt?: string;
}

export interface Employee {
  employeeId: string;
  employeeName: string;
  employeeCompany: string;
  department: string;
}

export interface EmployeeData extends Employee {
  id?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeFormData {
  employeeId: string;
  employeeName: string;
  employeeCompany: string;
  department: string;
}

export interface EmployeeApiResponse {
  success: boolean;
  message: string;
  data?: EmployeeData | EmployeeData[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface HoldingPackageRecord {
  id: number;
  trackingNumber?: string;
  referenceNumber?: string;
  customerName?: string;
  holdingReason?: string;
  createdAt: string;
  type: "incoming" | "outgoing";
  mode: "single" | "batch";
  verified: boolean;
  trackingNumbers?: string[];
  guardVerificationStatus: string;
}

export interface ReleasePackageBody {
  id: number;
  status: "completed" | "holding";
  guardId?: string | null;
  holdingReason?: string;
}

export interface VerifyPackageBody {
  id: number;
  holdingState: 0 | 1;
  guardVerificationStatus: "pending" | "verified";
  guardId?: string | null;
  handOverGuardId?: string | null;
  holdingReason?: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCompany?: string | null;
  department?: string | null;
}

export interface IncomingPackageBody {
  trackingNumber: string;
  referenceNumber?: string;
  mode: "single" | "batch";
  customerName: string;
  time: string;
  date: string;
  deliveryCompany: string;
  deliveryPersonName: string;
  vehicleNumber: string;
  vehicleType: string;
  remark?: string; 
  employeeId?: string;
  employeeName?: string;
  employeeCompany?: string;
  department?: string;
  holdingState: 0 | 1; 
  guardVerificationStatus: "verified" | "pending";
  guardId?: string | null;
  guardVerifiedAt?: string | null;
}

export interface ReleasePackageBody {
  id: number;
  status: "completed" | "holding"; 
  guardId?: string | null;
  holdingReason?: string;
}

export interface VerifyPackageBody {
  id: number;
  holdingState: 0 | 1;
  guardVerificationStatus: "pending" | "verified";
  guardId?: string | null;
  handOverGuardId?: string | null;
  holdingReason?: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCompany?: string | null;
  deliveryPersonName?: string | null;
  deliveryCompany?: string | null;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
}

// Gate Records

export interface GateRecordBody {
  personnelId: string;
  name?: string;
  category?: string;
  type: "employee" | "visitor" | "vehicle";
  entryTime: string;
  date: string;
  driverName?: string;
  vehicleType?: string;
  plateNumber?: string;
  vehicleArrivalReason?: string | null;
  employeeExitReason?: string | null;
}

export interface GateRecordRow {
  id: number;
  personnelId: string;
  name: string | null;
  visitorReason: string | null;
  type: "employee" | "visitor" | "vehicle";
  entryTime: string;
  exitTime: string | null;
  driverName: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
  date: string;
  guardId: string | null;
  guardVerifiedAt: string | null;
  createdAt: string;
  vehicleArrivalReason?: string | null;
  employeeExitReason?: string | null;
  employeeCompany?: string | null;
  employeeDepartment?: string | null;
}

export interface GateRecordExit {
  id: number;
  exitTime: string;
  guardId: string;
  exitReason?: string | null;
}

// Customers

export interface Customer {
  id: number;
  customerName: string;
  createdAt?: string;
}

export interface CustomerApiResponse {
  success: boolean;
  message: string;
  data?: Customer | Customer[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// Package Descriptions

export interface PackageDescription {
  id: number;
  packageDescription: string;
  createdAt?: string;
}

export interface PackageDescriptionApiResponse {
  success: boolean;
  message: string;
  data?: PackageDescription | PackageDescription[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface DeliveryCompany {
  id: number;
  deliveryCompany: string;
  createdAt?: string;
}

export interface DeliveryCompanyApiResponse {
  success: boolean;
  message: string;
  data?: DeliveryCompany | DeliveryCompany[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}