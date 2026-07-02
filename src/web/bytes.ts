// Shared byte helpers. Before this, ~a dozen crypto/encoding models each re-declared their own identical `hex`
// and `concat`; they now import from here so there's one definition to trust and test.

/** Lowercase hex of a byte array: [0xde,0xad] → "dead". */
export const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** UTF-8 encode a string to bytes. */
export const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Concatenate any number of byte arrays into one. */
export const concatBytes = (...arrs: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};
