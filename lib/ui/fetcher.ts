export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export async function deleteJson<T>(url: string): Promise<T> {
  return fetchJson<T>(url, { method: "DELETE" });
}
