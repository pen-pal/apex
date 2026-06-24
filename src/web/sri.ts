// Subresource Integrity (SRI) — how a page pins the exact bytes of a script it loads from a CDN, so
// a compromised or swapped CDN file can't run. The author hashes the known-good file and puts the
// digest in the tag: <script src="//cdn/lib.js" integrity="sha256-…" crossorigin>. The browser
// fetches the file, hashes what it ACTUALLY received, and runs it only if the digest matches —
// otherwise the resource is blocked entirely. It's a content address: the hash IS the identity, so
// any tampering (even one byte) changes the hash and fails the check. We compute real SHA-256 (the
// same verified implementation used elsewhere) and base64-encode it exactly as SRI requires. Tested
// against the NIST SHA-256("abc") vector.
import { sha256 } from './sha256';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** The SRI metadata string for some content: "sha256-<base64 of the SHA-256 digest>". */
export function sriHash(content: string): string {
  return 'sha256-' + base64(sha256(enc(content)));
}

export interface IntegrityResult {
  ok: boolean; // does the fetched content match the pinned digest?
  computed: string; // hash of what was actually served
  expected: string; // the integrity attribute the page pinned
  runs: boolean; // the browser executes the resource iff ok
}

/** Verify served content against a pinned integrity attribute (the browser's SRI check). */
export function verifyIntegrity(servedContent: string, integrity: string): IntegrityResult {
  const computed = sriHash(servedContent);
  const ok = computed === integrity.trim();
  return { ok, computed, expected: integrity.trim(), runs: ok };
}
