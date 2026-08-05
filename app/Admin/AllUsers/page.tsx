"use client";

import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Plus, Search, UserRound, ShieldCheck, Building2, BadgeInfo, Package, Settings2 } from "lucide-react";
import { useNavigation } from "@/hooks/useNavigation";
import Pagination, { usePagination } from "@/components/Pagination";

type UserRow = {
  id: number;
  accessId: string;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  company: string | null;
  isActive: number | boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ViewerPermissions = {
  accessManagementAdd: boolean;
  accessManagementEdit: boolean;
  accessManagementControl: boolean;
  guardManagementAdd: boolean;
  guardManagementEdit: boolean;
  guardManagementDelete: boolean;
  guardManagementView: boolean;
  addOngoingPackage: boolean;
  addIncomePackage: boolean;
  overdueEmployeeAlert: boolean;
};

export default function AccessControlListPage() {
  const nav = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions>({
    accessManagementAdd: false,
    accessManagementEdit: false,
    accessManagementControl: false,
    guardManagementAdd: false,
    guardManagementEdit: false,
    guardManagementDelete: false,
    guardManagementView: false,
    addOngoingPackage: false,
    addIncomePackage: false,
    overdueEmployeeAlert: false,
  });
  const { currentPage, setCurrentPage, paginatedItems: paginatedUsers, totalPages, totalItems } = usePagination({
    items: users,
    itemsPerPage: 10,
  });

  const fetchUsers = useCallback(async (search = "") => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/users${params.toString() ? `?${params.toString()}` : ""}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load users");
      }

      const usersList = Array.isArray(data.data) ? data.data : [];
      setUsers(usersList);
      setCurrentPage(1);
      setSelectedUser((current) => {
        if (!current) {
          return usersList[0] ?? null;
        }

        return usersList.find((user: UserRow) => user.id === current.id) ?? usersList[0] ?? null;
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to load users";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setCurrentPage]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    async function loadMyPermissions() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!response.ok || !data?.success) return;
        const permissions = data?.data?.permissions ?? {};
        setViewerPermissions({
          addOngoingPackage: Boolean(permissions.addOngoingPackage),
          addIncomePackage: Boolean(permissions.addIncomePackage),
          overdueEmployeeAlert: Boolean(permissions.overdueEmployeeAlert),
          accessManagementAdd: Boolean(permissions.accessManagementAdd),
          accessManagementEdit: Boolean(permissions.accessManagementEdit),
          accessManagementControl: Boolean(permissions.accessManagementControl),
          guardManagementAdd: Boolean(permissions.guardManagementAdd),
          guardManagementEdit: Boolean(permissions.guardManagementEdit),
          guardManagementDelete: Boolean(permissions.guardManagementDelete),
          guardManagementView: Boolean(permissions.guardManagementView),
        });
      } catch {
        // keep locked-down defaults
      }
    }
    void loadMyPermissions();
  }, []);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchUsers(searchQuery);
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] font-sans text-[#2d3748]">
      <Sidebar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 pt-24 lg:pt-10 transition-all">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-4 gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0c244c]">Access Control Management</h1>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search username, name, or role"
                className="w-full pl-4 pr-10 py-2 bg-white border border-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 bg-[#3ea5d9] hover:bg-[#3494c7] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              Search
            </button>
          </form>
        </header>

        <hr className="border-gray-200 mb-6" />

        <div className="flex justify-end gap-3 mb-6">
          <button
            onClick={() => nav.goToAddPackage()}
            disabled={!viewerPermissions.addOngoingPackage && !viewerPermissions.addIncomePackage}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#0c244c] px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95"
          >
            <Package size={20} />
          <span className="text-sm">Add Details</span>
          </button>
          <button
            onClick={() => nav.goToOverdueSettings()}
            disabled={!viewerPermissions.overdueEmployeeAlert && !viewerPermissions.accessManagementControl}
            className="flex items-center gap-2  bg-white border border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed  text-[#0c244c] px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-"
          >
            <Settings2 size={20} />
            <span className="text-sm">Overdue Settings</span>
          </button>
          <button
            onClick={() => nav.goToAddUser()}
            disabled={!viewerPermissions.accessManagementAdd}
            className="flex items-center gap-2 bg-[#3ea5d9] hover:bg-[#3494c7] text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
          >
            <Plus size={24} />
            <span className="text-lg">Add New</span>
          </button>
          <button
            onClick={() => nav.goToAddGuard()}
            disabled={!viewerPermissions.guardManagementAdd}
            className="flex items-center gap-2 bg-[#3ea5d9] hover:bg-[#3494c7] text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
          >
            <Plus size={24} />
            <span className="text-lg">Add Guard</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.9fr)] gap-6 items-start">
          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0c244c]">Users</h2>
              <span className="text-sm text-gray-500">{loading ? "Loading..." : `${users.length} records`}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Access ID</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!loading && paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`cursor-pointer transition-colors ${
                          selectedUser?.id === user.id ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <td className="px-4 py-4 font-mono text-sm font-semibold text-blue-600">{user.accessId}</td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-800">{user.fullName}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{user.username}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{user.role}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US") : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 pb-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsShown={paginatedUsers.length}
                onPageChange={setCurrentPage}
              />
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <div className="flex items-center gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-[#0c244c]">Selected User</h2>
                <p className="text-sm text-gray-500">Details for the highlighted account</p>
              </div>
            </div>

            {selectedUser ? (
              <div className="space-y-4">
                <DetailItem icon={BadgeInfo} label="Access ID" value={selectedUser.accessId} />
                <DetailItem icon={UserRound} label="Full Name" value={selectedUser.fullName} />
                <DetailItem icon={ShieldCheck} label="Username / Role" value={`${selectedUser.username} • ${selectedUser.role}`} />
                <DetailItem icon={Building2} label="Department" value={selectedUser.department || "-"} />
                <DetailItem icon={Building2} label="Company" value={selectedUser.company || "-"} />
                <DetailItem icon={BadgeInfo} label="Status" value={selectedUser.isActive ? "Active" : "Inactive"} />
                <div className="flex gap-3 pt-4">
                  <button
                    disabled={!selectedUser?.id || !viewerPermissions.accessManagementEdit}
                    onClick={() => selectedUser && nav.goToEditUser(selectedUser.id)}
                    className="flex-1 bg-[#0084c8] hover:bg-[#0071ad] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
                  >
                    Edit User
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-gray-500">
                Select a user from the table to see details.
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
function DetailItem({
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 font-bold">
        {label}
      </div>
      <div className="mt-1 font-semibold text-[#0c244c] wrap-break-word">{value}</div>
    </div>
  );
}

