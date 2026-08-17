"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useNavigation } from "@/hooks/useNavigation";
import { 
  ArrowRight, 
  Lock, 
  ShieldCheck
} from "lucide-react";

import Image from "next/image";

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
      <div className="flex min-h-screen bg-[#f8f9fc]">
        <Sidebar />
        <main className="min-h-screen flex-1 lg:ml-72 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 animate-rise">
            <div className="size-9 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-navy">Checking permissions...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!hasPermission) return null;

  const sectionCards = [
    {
      key: "employee",
      badge: "Staff & Badges",
      title: "Employee Information",
      description: "Manage employee profiles, auto-generate scannable barcode cards, and maintain company departments.",
      features: ["Auto ID Generation", "Barcode Badges", "CSV Bulk Import"],
      href: "/Admin/AddPackage/AddEmployee",
      permission: packagePermissions.employee,
      iconPath: "/icons/hub/employee.svg",
    },
    {
      key: "description",
      badge: "Intake Vocabulary",
      title: "Package Descriptions",
      description: "Standardize package descriptions and intake categories for consistent logging across shifts.",
      features: ["Intake Categorization", "Custom Descriptions", "Duplicate Guard"],
      href: "/Admin/AddPackage/AddPackageDescription",
      permission: packagePermissions.description,
      iconPath: "/icons/hub/package.svg",
    },
    {
      key: "customer",
      badge: "Client Directory",
      title: "Customer Information",
      description: "Maintain the registered client and destination database for accurate package dispatch and delivery.",
      features: ["Client Registry", "Real-time Duplicate Check", "Fast Lookup"],
      href: "/Admin/AddPackage/AddCustomer",
      permission: packagePermissions.customer,
      iconPath: "/icons/hub/customer.svg",
    },
    {
      key: "delivery",
      badge: "Logistics Partners",
      title: "Delivery Companies",
      description: "Manage approved courier services, courier partners, and incoming dispatch providers.",
      features: ["Courier Tracking", "Authorized Couriers", "Quick Selection"],
      href: "/Admin/AddPackage/AddDelivery",
      permission: packagePermissions.delivery,
      iconPath: "/icons/hub/delivery.svg",
    }
  ];

  const permittedSections = sectionCards.filter(s => s.permission);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />
      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        <div className="max-w-4xl mx-auto">
          {/* Top Header Banner */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-rise">
            <div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                Package &amp; Employee Data Hub
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                Centralized management of master datasets that power package recording, guard verification, and employee check-ins.
              </p>
            </div>
          </div>

          {/* Modules Grid */}
          {permittedSections.length === 0 ? (
            <div className="mt-8 surface-card flex flex-col items-center justify-center p-12 text-center animate-rise">
              <div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive mb-4">
                <Lock className="size-7" />
              </div>
              <h2 className="text-lg font-bold text-navy">No data modules accessible</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                You do not have permission to access this page.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {permittedSections.map((section, i) => (
                <Link 
                  key={section.href} 
                  href={section.href}
                  className="surface-card group relative flex flex-col justify-between overflow-hidden p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-lift animate-rise cursor-pointer"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Top Animated Gradient Bar */}
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-brand transition-transform duration-300 group-hover:scale-x-100" />
                  
                  <div>
                    {/* Top Row: Flaticon-style SVG Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex size-20 sm:size-24 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-secondary/60 border border-border shadow-sm p-3 transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
                        <Image 
                          src={section.iconPath} 
                          alt={section.title} 
                          width={80} 
                          height={80} 
                          className="size-14 sm:size-16 object-contain drop-shadow-sm"
                        />
                      </div>
                      <span className="rounded-full border border-border bg-secondary/80 px-3.5 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        {section.badge}
                      </span>
                    </div>
                    
                    {/* Title & Description */}
                    <h2 className="mt-5 text-xl font-extrabold text-navy tracking-tight group-hover:text-primary transition-colors">
                      {section.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {section.description}
                    </p>

                    {/* Feature Highlights Pills */}
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {section.features.map((feat) => (
                        <span 
                          key={feat}
                          className="inline-flex items-center rounded-md bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-navy/80 border border-border/50"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Bottom Footer Action */}
                  <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-success" />
                      Authorized Access
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-all group-hover:bg-gradient-brand group-hover:text-white">
                      Open Module
                      <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
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
