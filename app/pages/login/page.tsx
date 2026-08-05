"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useNavigation } from "@/hooks/useNavigation";

export default function LoginPage() {
  const nav = useNavigation();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in");
      }

      const redirectTo = data?.data?.redirectTo ?? "/pages/IncomingPackage";
      nav.router.push(redirectTo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center lg:justify-end overflow-hidden bg-[#f0f4f9]">
      <div className="absolute inset-0 z-0 hidden lg:block">
        <Image
          src="/images/Background_image_login.png"
          alt="Delivery Scene"
          fill
          sizes="100vw"
          className="object-cover object-left"
          priority
        />
      </div>

      <div className="absolute inset-0 z-0 lg:hidden bg-blue-50" />

      <div className="relative z-10 w-full max-w-135 px-4 sm:px-8 lg:mr-[8%] xl:mr-[12%]">
        <div className="bg-white rounded-[45px] sm:rounded-[60px] shadow-2xl p-8 sm:p-12 md:p-16 flex flex-col items-center">
          <div className="flex flex-col items-center mb-10">
            <div className="relative w-32 h-20 mb-4">
              <Image
                src="/logo/essilor.png"
                alt="Essilor Logo"
                fill
                sizes="128px"
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 tracking-tight">
              Log in to your account
            </h1>
          </div>

          <form className="w-full space-y-7" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className="block text-[15px] font-medium text-gray-700 ml-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-5 py-4 bg-[#f3f6f9] border border-transparent rounded-2xl text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[15px] font-medium text-gray-700 ml-1">
                Password
              </label>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-[#f3f6f9] border border-transparent rounded-2xl text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                >
                  {showPassword ? <Eye size={22} strokeWidth={1.5} /> : <EyeOff size={22} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-600 font-medium">Remember me</span>
              </label>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-[#5e5ce6] hover:bg-[#4e4ccb] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-lg font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] transform"
            >
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}