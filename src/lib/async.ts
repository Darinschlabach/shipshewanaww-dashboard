/** Race a promise against a timeout. Rejects on timeout. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "Operation"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Like withTimeout, but returns `fallback` instead of throwing. */
export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  try {
    return await withTimeout(promise, ms);
  } catch {
    return fallback;
  }
}
