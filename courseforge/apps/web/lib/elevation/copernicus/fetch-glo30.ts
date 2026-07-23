// Live Copernicus GLO-30 tile fetch. Thin, fetchImpl-injectable wrapper kept
// separate from pure tile math so provider logic stays offline-testable.
// Keyless anonymous S3 (AWS Open Data) — no credentials, no auth header.

export type FetchGlo30Options = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

/** Download a GLO-30 COG tile as raw bytes. Throws on a non-ok response. */
export async function fetchGlo30Tile(url: string, options: FetchGlo30Options = {}): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, { signal: options.signal });
  if (!response.ok) {
    throw new Error(`Copernicus GLO-30 tile fetch failed with status ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
