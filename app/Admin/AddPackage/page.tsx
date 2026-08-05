"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useNavigation } from "@/hooks/useNavigation";

export default function AddPackagePage() {
  const nav = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [packagePermissions, setPackagePermissions] = useState({
    employee: false,
    description: false,
    customer: false,
    delivery: false,
  });

  useEffect(() => {
    async function checkPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          nav.goToAllUsers();
          return;
        }
        const canAddPackages = Boolean(data?.data?.permissions?.addOngoingPackage) || Boolean(data?.data?.permissions?.addIncomePackage);
        if (!canAddPackages) {
          nav.goToAllUsers();
          return;
        }
        setPackagePermissions({
          employee: Boolean(data?.data?.permissions?.addPackageEmployee),
          description: Boolean(data?.data?.permissions?.addPackageDescription),
          customer: Boolean(data?.data?.permissions?.addPackageCustomer),
          delivery: Boolean(data?.data?.permissions?.addPackageDelivery),
        });
        setHasPermission(true);
      } catch {
        nav.goToAllUsers();
      } finally {
        setIsCheckingPermissions(false);
      }
    }
    void checkPermissions();
  }, [nav]);

  if (isCheckingPermissions) {
    return (
      <div className="flex h-screen bg-[#f8f9fc]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) return null;

  // Build sections array based on permissions
  const sections = [
    {
      title: "Add Employee Information",
      description: "Enter employee name, ID, company, and department",
      href: "/Admin/AddPackage/AddEmployee",
      permission: packagePermissions.employee,
    },
    {
      title: "Add Package Description",
      description: "Describe the package details and contents",
      href: "/Admin/AddPackage/AddPackageDescription",
      permission: packagePermissions.description,
    },
    {
      title: "Add Customer Information",
      description: "Enter the customer name and details",
      href: "/Admin/AddPackage/AddCustomer",
      permission: packagePermissions.customer,
    },
    {
      title: "Add Delivery Company Information",
      description: "Enter the delivery company name and details",
      href: "/Admin/AddPackage/AddDelivery",
      permission: packagePermissions.delivery,
    }
  ].filter(section => section.permission);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">
            Add Package & Employee
          </h1>
          <div className="bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString('en-US')}
          </div>
        </header>

        <hr className="border-gray-200 mb-10" />

        <div className="max-w-5xl mx-auto">
          {sections.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <p className="text-blue-800 font-semibold">No package subsections available</p>
              <p className="text-blue-600 text-sm mt-2">You do not have permission to access any package subsections.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((section) => (
                <Link key={section.href} href={section.href}>
                  <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer hover:border-[#3ea5d9] border-2 border-transparent">
                    <h2 className="text-xl font-bold text-[#0c244c] mb-3">
                      {section.title}
                    </h2>
                    <p className="text-gray-600 mb-6">{section.description}</p>
                    <div className="flex items-center text-[#3ea5d9] font-semibold">
                      Continue 
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}