"use client";

import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Plus, Search, UserRound, ShieldCheck, Building2, BadgeInfo, Package, Settings2, Users, AlertTriangle } from "lucide-react";
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
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />

      <main className="min-h-screen flex-1 min-w-0 px-4 pb-16 pt-20 lg:ml-72 lg:px-8 lg:pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-rise">
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Access Control Management</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => nav.goToAddPackage()}
              disabled={!viewerPermissions.addOngoingPackage && !viewerPermissions.addIncomePackage}
              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-45"
            >
              <Package size={16} />
              <span>Add Details</span>
            </button>
            <button
              onClick={() => nav.goToOverdueSettings()}
              disabled={!viewerPermissions.overdueEmployeeAlert && !viewerPermissions.accessManagementControl}
              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-45"
            >
              <Settings2 size={16} />
              <span>Overdue Settings</span>
            </button>
            <button
              onClick={() => nav.goToAddGuard()}
              disabled={!viewerPermissions.guardManagementAdd}
              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-secondary text-navy border border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-45"
            >
              <span>Guards & Barcodes</span>
            </button>
            <button
              onClick={() => nav.goToAddUser()}
              disabled={!viewerPermissions.accessManagementAdd}
              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 hover:shadow-lift disabled:pointer-events-none disabled:opacity-45"
            >
              <Plus size={16} />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm font-medium text-destructive animate-rise">
            <AlertTriangle className="size-5 shrink-0" />
            <span className="flex-1 font-semibold">{error}</span>
          </div>
        )}

        <div className="mt-7 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="surface-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <form onSubmit={handleSearch} className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search username, name, or role"
                  className="pl-9 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-navy placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="hidden" />
              </form>
              <p className="text-[13px] text-muted-foreground">
                <span className="font-bold text-navy">{users.length}</span> accounts
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-secondary/70">
                    {["Access ID", "Full Name", "Username", "Role", "Created"].map((h) => (
                      <th key={h} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="divide-y divide-border w-full">
                          {Array.from({ length: 8 }).map((_, r) => (
                            <div key={r} className="grid gap-4 px-5 py-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
                              {Array.from({ length: 5 }).map((_, c) => (
                                <div key={c} className="h-3.5 animate-pulse rounded-full bg-secondary" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} />
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-rise">
                          <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                            <UserRound className="size-7" />
                          </div>
                          <h3 className="text-base font-bold text-navy">No users found</h3>
                          <p className="max-w-sm text-sm text-muted-foreground">Try a different search term or create a new access account.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          selectedUser?.id === user.id ? 'bg-primary/8' : 'hover:bg-secondary/60'
                        }`}
                      >
                        <td className="relative px-5 py-3.5 font-mono text-[13px] font-semibold text-navy">
                          {selectedUser?.id === user.id && <span className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary" />}
                          {user.accessId}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-navy">{user.fullName}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{user.username}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ring-inset ${
                            user.role === 'superAdmin' ? 'bg-role-super/12 text-role-super ring-role-super/25' :
                            user.role === 'admin' ? 'bg-role-admin/12 text-role-admin ring-role-admin/25' :
                            user.role === 'guard' ? 'bg-role-guard/14 text-role-guard ring-role-guard/25' :
                            'bg-role-employee/12 text-role-employee ring-role-employee/25'
                          }`}>{user.role}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsShown={paginatedUsers.length}
                onPageChange={setCurrentPage}
              />
            </div>
          </section>

          <aside className="2xl:sticky 2xl:top-8 2xl:self-start">
            {selectedUser ? (
              <div className="surface-card overflow-hidden animate-rise">
                <div className="bg-gradient-navy px-5 py-6 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Selected account</p>
                  <h2 className="mt-1 text-xl font-extrabold">{selectedUser.fullName}</h2>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="rounded-md bg-white/12 px-2 py-1 font-mono text-[13px]">{selectedUser.accessId}</code>
                    <span className="rounded-md bg-white/12 px-2 py-1 text-[13px] font-medium">{selectedUser.role}</span>
                  </div>
                </div>
                <dl className="divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Username</dt>
                    <dd className="text-sm font-semibold text-navy">{selectedUser.username}</dd>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Department</dt>
                    <dd className="text-sm font-semibold text-navy">{selectedUser.department || "-"}</dd>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Company</dt>
                    <dd className="text-sm font-semibold text-navy">{selectedUser.company || "-"}</dd>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
                    <dd className="text-sm font-semibold text-navy">{selectedUser.isActive ? "Active" : "Inactive"}</dd>
                  </div>
                </dl>
                <div className="p-5 pt-4 border-t border-border">
                  <button
                    disabled={!selectedUser?.id || !viewerPermissions.accessManagementEdit}
                    onClick={() => selectedUser && nav.goToEditUser(selectedUser.id)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] h-11 px-4 text-sm bg-gradient-brand text-white shadow-card hover:brightness-110 hover:shadow-lift disabled:pointer-events-none disabled:opacity-45"
                  >
                    Edit User
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card">
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-rise">
                  <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                    <Users className="size-7" />
                  </div>
                  <h3 className="text-base font-bold text-navy">No account selected</h3>
                  <p className="max-w-sm text-sm text-muted-foreground">Select a row from the directory to inspect full account details.</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

