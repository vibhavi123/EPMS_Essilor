"use client";

import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// ROUTE DEFINITIONS
export const ROUTES = {
  // Auth Routes
  AUTH: {
    LOGIN: "/login",
  },
  
  // Package Routes
  PACKAGES: {
    ALL: "/pages/AllPackage",
    INCOMING: "/pages/IncomingPackage",
    OUTGOING: "/pages/OutgoingPackage",
    ALL_INCOMING: "/pages/AllIncomingPackage",
    ALL_OUTGOING: "/pages/AllOutgoingPackage",
  },

  // Package Details Route
  PACKAGE_DETAILS: {
    INCOMING: "/pages/AllPackage/IncomingPackageDetails",
    OUTGOING: "/pages/AllPackage/OutgoingPackageDetails",
  },

  // Package Update Routes
  PACKAGE_UPDATE: {
    INCOMING: "/pages/AllPackage/UpdatePackagePage/IncomingPackageUpdate",
    OUTGOING: "/pages/AllPackage/UpdatePackagePage/OutgoingPackageUpdate",
  },
  
  // Verification Routes
  VERIFICATION: {
    INCOMING: "/pages/IncomingPackageVerification",
    OUTGOING: "/pages/OutgoingPackageVerification",
    HOLDING: "/pages/VerifyHoldingPackages",
  },
  
  // Admin Routes
  ADMIN: {
    ADD_USER: "/Admin/AddUser",
    ADD_GUARD: "/Admin/AddGuard",
    EDIT_USER: "/Admin/EditUser",
    ALL_USERS: "/Admin/AllUsers",
    CONTROL_USER: "/Admin/ControlUser",
    DELETE_USER: "/Admin/DeleteUser",
    ADD_PACKAGE: "/Admin/AddPackage",
    OVERDUE_SETTINGS: "/Admin/OverdueSettings",
    LOGIN_MONITOR: "/Admin/LoginMonitor",
  },
  
  // Other Routes
  REPORT: "/pages/Report",
  ENTRY_EXIT_RECORDING: "/pages/EntryExitRecording",
} as const;



// NAVIGATION HOOK
export function useNavigation() {
  const router: AppRouterInstance = useRouter();

  return {
    // Direct route access
    routes: ROUTES,
    
    // Router instance
    router,
    
    // Navigation helpers
    goToLogin: () => router.push(ROUTES.AUTH.LOGIN),
    goToIncomingPackages: () => router.push(ROUTES.PACKAGES.INCOMING),
    goToOutgoingPackages: () => router.push(ROUTES.PACKAGES.OUTGOING),
    goToAllPackages: () => router.push(ROUTES.PACKAGES.ALL),
    goToAllIncomingPackages: () => router.push(ROUTES.PACKAGES.ALL_INCOMING),
    goToAllOutgoingPackages: () => router.push(ROUTES.PACKAGES.ALL_OUTGOING),
    goToIncomingPackageDetails: (trackingNumber?: string) => {
      const url = trackingNumber 
        ? `${ROUTES.PACKAGE_DETAILS.INCOMING}?trackingNumber=${trackingNumber}`
        : ROUTES.PACKAGE_DETAILS.INCOMING;
      router.push(url);
    },
    goToOutgoingPackageDetails: (trackingNumber?: string) => {
      const url = trackingNumber 
        ? `${ROUTES.PACKAGE_DETAILS.OUTGOING}?trackingNumber=${trackingNumber}`
        : ROUTES.PACKAGE_DETAILS.OUTGOING;
      router.push(url);
    },
    goToIncomingPackageUpdate: (trackingNumber?: string) => {
      const url = trackingNumber ? `${ROUTES.PACKAGE_UPDATE.INCOMING}?trackingNumber=${encodeURIComponent(trackingNumber)}` : ROUTES.PACKAGE_UPDATE.INCOMING;
      router.push(url);
    },
    goToOutgoingPackageUpdate: (trackingNumber?: string) => {
      const url = trackingNumber ? `${ROUTES.PACKAGE_UPDATE.OUTGOING}?trackingNumber=${encodeURIComponent(trackingNumber)}` : ROUTES.PACKAGE_UPDATE.OUTGOING;
      router.push(url);
    },
    goToIncomingVerification: (trackingNumber?: string, referenceNumber?: string, mode?: "single" | "batch") => {
      let url: string = ROUTES.VERIFICATION.INCOMING;
      if (mode === "batch" && referenceNumber) {
        url = `${ROUTES.VERIFICATION.INCOMING}?referenceNumber=${referenceNumber}`;
      } else if (trackingNumber) {
        url = `${ROUTES.VERIFICATION.INCOMING}?trackingNumber=${trackingNumber}`;
      }
      router.push(url);
    },
    goToOutgoingVerification: (trackingNumber?: string, referenceNumber?: string, mode?: "single" | "batch") => {
      let url: string = ROUTES.VERIFICATION.OUTGOING;
      if (mode === "batch" && referenceNumber) {
        url = `${ROUTES.VERIFICATION.OUTGOING}?referenceNumber=${referenceNumber}`;
      } else if (trackingNumber) {
        url = `${ROUTES.VERIFICATION.OUTGOING}?trackingNumber=${trackingNumber}`;
      }
      router.push(url);
    },
    goToHoldingVerification: () => router.push(ROUTES.VERIFICATION.HOLDING),
    goToReport: () => router.push(ROUTES.REPORT),
    goToEntryExitRecording: () => router.push(ROUTES.ENTRY_EXIT_RECORDING),
    goToAddUser: () => router.push(ROUTES.ADMIN.ADD_USER),
    goToAddGuard: () => router.push(ROUTES.ADMIN.ADD_GUARD),
    goToEditUser: (userId: string | number) => router.push(`${ROUTES.ADMIN.EDIT_USER}?id=${userId}`),
    goToAllUsers: () => router.push(ROUTES.ADMIN.ALL_USERS),
    goToControlUser: () => router.push(ROUTES.ADMIN.CONTROL_USER),
    goToDeleteUser: () => router.push(ROUTES.ADMIN.DELETE_USER),
    goToAddPackage: () => router.push(ROUTES.ADMIN.ADD_PACKAGE),
    goToOverdueSettings: () => router.push(ROUTES.ADMIN.OVERDUE_SETTINGS),
    goToLoginMonitor: () => router.push(ROUTES.ADMIN.LOGIN_MONITOR),
  };
}
