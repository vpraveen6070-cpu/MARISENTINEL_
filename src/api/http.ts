/** Shared transport helper. Point BASE_URL at a real gateway to go live. */
export const BASE_URL = import.meta.env["VITE_MARISENTINEL_API"] ?? "";

export async function mockLatency<T>(payload: T, ms = 220): Promise<T> {
  await new Promise((r) => setTimeout(r, ms));
  return payload;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new Error("API_UNAVAILABLE: no upstream configured, using mock data");
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}
