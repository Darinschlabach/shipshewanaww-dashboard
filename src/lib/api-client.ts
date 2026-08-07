export type ApiMutationResult<T> = {
  data?: T;
  invoice?: T;
  error?: string;
  syncError?: string | null;
  syncStatus?: string;
  ok?: boolean;
};

export async function apiJson<T>(
  url: string,
  init?: RequestInit
): Promise<ApiMutationResult<T> & { okHttp: boolean; status: number }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as ApiMutationResult<T>;
  return {
    ...json,
    okHttp: res.ok,
    status: res.status,
    error: res.ok ? json.error : json.error || `Request failed (${res.status})`,
  };
}
