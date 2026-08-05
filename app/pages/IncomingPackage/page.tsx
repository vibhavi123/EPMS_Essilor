"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import DateTime from "@/components/DateTime";
import { PermissionGuard } from "@/hooks/usePermissions";

export default function IncomingPackageHubPage() {

  return (
    <PermissionGuard permission="addIncomePackage">
      <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
        <Sidebar />

        <main className="flex-1 lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 transition-all duration-300">
        <br />

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-[#0c244c]">
                Incoming Package
              </h1>
              <p className="text-sm text-gray-600 mt-1">Register packages that are arriving at the Company</p>
            </div>
            <Image 
              src="/images/IncomingPage.png" 
              alt="Incoming Package" 
              width={192}
              height={192}
              className="object-contain shrink-0"
            />
          </div>
          <div className="w-full md:w-auto">
            <DateTime />
          </div>
        </header>

        <hr className="border-gray-300 mb-10" />

        {/* Mode Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {/* Single Package Card */}
          <Link href="/pages/IncomingPackage/Single">
            <div className="p-8 bg-white rounded-lg shadow-md hover:shadow-lg border-2 border-transparent hover:border-[#0084c8] transition-all cursor-pointer h-full">
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/images/mulitiple.jpg"
                  alt="Single Package"
                  width={200}
                  height={150}
                  className="object-cover rounded-lg mb-4"
                />
                <h2 className="text-2xl font-bold text-[#0c244c] mb-3">
                  Single Package
                </h2>
                <div className="mt-auto pt-4 inline-block px-8 py-2 bg-[#0084c8] text-white font-bold rounded-lg hover:bg-[#0071ad] transition-all">
                  Start
                </div>
              </div>
            </div>
          </Link>

          {/* Batch Packages Card */}
          <Link href="/pages/IncomingPackage/Batch">
            <div className="p-8 bg-white rounded-lg shadow-md hover:shadow-lg border-2 border-transparent hover:border-[#0084c8] transition-all cursor-pointer h-full">
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/images/single.jpg"
                  alt="Batch Packages"
                  width={200}
                  height={150}
                  className="object-cover rounded-lg mb-4"
                />
                <h2 className="text-2xl font-bold text-[#0c244c] mb-3">
                  Mulitiple Packages
                </h2>
                <div className="mt-auto pt-4 inline-block px-8 py-2 bg-[#0084c8] text-white font-bold rounded-lg hover:bg-[#0071ad] transition-all">
                  Start
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
    </PermissionGuard>
  );
}