type IdSequenceKind = "accessId" | "employeeId" | "referenceNumber";

async function fetchGeneratedId(kind: IdSequenceKind, role?: string): Promise<string> {
  const params = new URLSearchParams({ kind });

  if (role) {
    params.set("role", role);
  }

  const response = await fetch(`/api/id-sequences?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "Failed to generate ID");
  }

  return String(data.data?.[kind] ?? "");
}

export function fetchNextAccessId(role: string): Promise<string> {
  return fetchGeneratedId("accessId", role);
}

export function fetchNextEmployeeId(): Promise<string> {
  return fetchGeneratedId("employeeId");
}

export function fetchNextReferenceNumber(): Promise<string> {
  return fetchGeneratedId("referenceNumber");
}