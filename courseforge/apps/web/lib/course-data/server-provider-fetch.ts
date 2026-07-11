type ServerProviderFetchOptions = {
  headers?: HeadersInit;
  timeoutMs?: number;
};

export async function fetchProviderJson<T>(
  url: string,
  { headers, timeoutMs = 8_000 }: ServerProviderFetchOptions = {}
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      console.error(`Course data provider request failed with status ${response.status}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Course data provider request failed: ${error.message}`
        : "Course data provider request failed."
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
