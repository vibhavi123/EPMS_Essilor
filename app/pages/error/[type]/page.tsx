"use client";

import React, { use, useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { AlertCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

interface ErrorPageProps {
  params: Promise<{
    type: string;
  }>;
}

const errorConfig = {
  "incoming-package-error": {
    title: "Error Loading Incoming Packages",
    backPath: "/pages/AllIncomingPackage",
    backButtonText: "Back to Incoming Packages",
  },
  "outgoing-package-error": {
    title: "Error Loading Outgoing Packages",
    backPath: "/pages/AllOutgoingPackage",
    backButtonText: "Back to Outgoing Packages",
  },
  "incoming-verification-error": {
    title: "Error Verifying Incoming Package",
    backPath: "/pages/AllIncomingPackage",
    backButtonText: "Back to Incoming Packages",
  },
  "outgoing-verification-error": {
    title: "Error Verifying Outgoing Package",
    backPath: "/pages/AllOutgoingPackage",
    backButtonText: "Back to Outgoing Packages",
  },
};

export default function ErrorPage({ params }: ErrorPageProps) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorMessage = searchParams.get("error") || "An error occurred";

  console.log("[ErrorPage] Type:", resolvedParams.type);
  console.log("[ErrorPage] Error:", errorMessage);

  const config = errorConfig[resolvedParams.type as keyof typeof errorConfig] || {
    title: "Error",
    backPath: "/pages",
    backButtonText: "Go Back",
  };

  const [redirectCountdown, setRedirectCountdown] = useState(2);

  // Handle countdown timer
  useEffect(() => {
    if (redirectCountdown <= 0) return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle navigation when countdown reaches 0
  useEffect(() => {
    if (redirectCountdown <= 0) {
      router.push(config.backPath);
    }
  }, [redirectCountdown, config.backPath, router]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-8">
            <div className="flex gap-4">
              <AlertCircle className="w-8 h-8 text-red-600 shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-800 mb-3">
                  {config.title}
                </h2>
                <p className="text-red-700 mb-6">
                  {decodeURIComponent(errorMessage)}
                </p>
                <div className="flex gap-4">
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
