import { embedText } from "./ai/embed";
import { bulkInsert, getDb, q, type Db } from "./db";
import { cosine } from "./stats";

/** ~120-word chunks with 25-word overlap, split on paragraph boundaries where possible. */
export function chunkText(text: string, size = 120, overlap = 25): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= size) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    out.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
  }
  return out;
}

export async function ingestDocument(
  doc: { region: string; title: string; docType: string; published: string | null; content: string; language?: string; synthetic?: boolean; sourceUrl?: string | null },
  db?: Db,
): Promise<string> {
  const d = db ?? (await getDb());
  const [row] = await d.query<{ id: string }>(
    `INSERT INTO documents (region_code, title, doc_type, source_url, published_date, language, content, is_synthetic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [doc.region, doc.title, doc.docType, doc.sourceUrl ?? null, doc.published, doc.language ?? "en", doc.content, doc.synthetic ?? false],
  );
  const chunks = chunkText(doc.content);
  await bulkInsert(
    d,
    "doc_chunks",
    ["document_id", "region_code", "chunk_index", "text", "embedding", "page"],
    chunks.map((c, i) => [row.id, doc.region, i, c, embedText(c), 1]),
  );
  return row.id;
}

export type Retrieved = { label: string; documentId: string; title: string; text: string; score: number; chunkIndex: number };

export async function retrieve(region: string, query: string, k = 5): Promise<Retrieved[]> {
  const rows = await q<{ document_id: string; title: string; text: string; embedding: number[]; chunk_index: number }>(
    `SELECT c.document_id, d.title, c.text, c.embedding, c.chunk_index
       FROM doc_chunks c JOIN documents d ON d.id = c.document_id WHERE c.region_code=$1`,
    [region],
  );
  const qv = embedText(query);
  return rows
    .map((r) => ({ r, s: cosine(qv, r.embedding) }))
    .filter((x) => x.s > 0.05)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x, i) => ({
      label: `[D${i + 1}]`,
      documentId: x.r.document_id,
      title: x.r.title,
      text: x.r.text,
      score: Math.round(x.s * 1000) / 1000,
      chunkIndex: x.r.chunk_index,
    }));
}
