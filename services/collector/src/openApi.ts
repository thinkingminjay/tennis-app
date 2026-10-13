// Seoul open data plaza: ListPublicReservationSport (OA-2266).
// Only this API is called from the server; yeyak.seoul.go.kr is never fetched (CLAUDE.md "확인 사항").

export interface OpenApiRow {
  SVCID: string;
  MINCLASSNM: string;
  SVCSTATNM: string;
  SVCNM: string;
  PAYATNM: string;
  PLACENM: string;
  SVCURL: string;
  X: string;
  Y: string;
  SVCOPNBGNDT: string;
  SVCOPNENDDT: string;
  RCPTBGNDT: string;
  RCPTENDDT: string;
  AREANM: string;
  IMGURL: string;
  TELNO?: string;
  DTLCONT?: string; // HTML notice text
}

const SERVICE = 'ListPublicReservationSport';
const PAGE_SIZE = 1000; // API maximum per call
const MIN_INTERVAL_MS = 1100; // sequential, under 1 request/sec

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchAllRows(apiKey: string, contactEmail: string): Promise<OpenApiRow[]> {
  const rows: OpenApiRow[] = [];
  let total = Infinity;
  for (let start = 1; start <= total; start += PAGE_SIZE) {
    if (start > 1) await sleep(MIN_INTERVAL_MS);
    const end = start + PAGE_SIZE - 1;
    const url = `http://openapi.seoul.go.kr:8088/${encodeURIComponent(apiKey)}/json/${SERVICE}/${start}/${end}/`;
    const res = await fetch(url, {
      headers: { 'User-Agent': `tennis-app-collector (contact: ${contactEmail})` },
    });
    if (!res.ok) throw new Error(`open API HTTP ${res.status}`);
    const body = await res.json();
    const page = body[SERVICE];
    if (!page) throw new Error(`open API error: ${JSON.stringify(body.RESULT ?? body).slice(0, 200)}`);
    if (page.RESULT?.CODE !== 'INFO-000') throw new Error(`open API ${page.RESULT?.CODE}: ${page.RESULT?.MESSAGE}`);
    total = page.list_total_count;
    rows.push(...page.row);
  }
  return rows;
}
