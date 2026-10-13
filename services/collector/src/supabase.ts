// Minimal PostgREST client for the collector (service role; bypasses RLS).

export class Db {
  private base: string;
  private key: string;

  constructor(url: string, serviceRoleKey: string) {
    this.base = `${url.replace(/\/$/, '')}/rest/v1`;
    this.key = serviceRoleKey;
  }

  private async request<T>(method: string, path: string, body?: unknown, prefer?: string): Promise<T> {
    const headers: Record<string, string> = {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${this.base}/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} HTTP ${res.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  select<T>(table: string, query: string): Promise<T[]> {
    return this.request<T[]>('GET', `${table}?${query}`);
  }

  // Rows in one call must share the same keys (PostgREST bulk insert).
  upsert<T>(table: string, rows: object[], onConflict: string): Promise<T[]> {
    if (rows.length === 0) return Promise.resolve([]);
    return this.request<T[]>(
      'POST',
      `${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      rows,
      'resolution=merge-duplicates,return=representation',
    );
  }

  delete(table: string, filter: string): Promise<null> {
    return this.request<null>('DELETE', `${table}?${filter}`);
  }

  insert(table: string, rows: object[]): Promise<null> {
    if (rows.length === 0) return Promise.resolve(null);
    return this.request<null>('POST', table, rows, 'return=minimal');
  }
}
