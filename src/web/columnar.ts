// Columnar storage encoding — why Parquet/Arrow/ClickHouse keep a table by column instead of by row. Storing a column
// contiguously lets a query scan only the columns it needs, and puts similar values next to each other so they compress
// with cheap, vectorizable schemes. Two workhorses: DICTIONARY encoding maps the distinct values to small integer codes
// plus a dictionary (a win when cardinality ≪ rows), and RUN-LENGTH encoding replaces a run of equal codes with a
// (code, count) pair (a win when the column is sorted/clustered). This models the byte sizes of each stage so you can
// see when they crush a column and when they backfire. Sizes are the encoded-payload bytes, not a specific file format's
// exact framing.

export interface Encoded {
  n: number; distinct: number; raw: number;
  codeBits: number; codedBytes: number; dictBytes: number; dictTotal: number;
  runs: number; rleBytes: number; rleTotal: number;
}

const RUN_OVERHEAD = 2; // bytes to store a run's repeat count (a uint16)

export function encode(values: string[]): Encoded {
  const n = values.length;
  const raw = values.reduce((s, v) => s + v.length, 0);            // 1 byte/char, read whole on a row scan
  const distinctSet = new Set(values);
  const distinct = distinctSet.size;
  const codeBits = Math.max(1, Math.ceil(Math.log2(distinct)));    // bits per dictionary code
  const codedBytes = Math.ceil((n * codeBits) / 8);               // bit-packed codes
  const dictBytes = [...distinctSet].reduce((s, v) => s + v.length, 0); // each distinct value stored once
  const dictTotal = dictBytes + codedBytes;

  let runs = 0;
  for (let i = 0; i < n; i++) if (i === 0 || values[i] !== values[i - 1]) runs++;
  const rleBytes = runs * (Math.ceil(codeBits / 8) + RUN_OVERHEAD); // each run = code + count
  const rleTotal = dictBytes + rleBytes;

  return { n, distinct, raw, codeBits, codedBytes, dictBytes, dictTotal, runs, rleBytes, rleTotal };
}

export const ratio = (raw: number, encoded: number): number => (encoded === 0 ? 0 : raw / encoded);
