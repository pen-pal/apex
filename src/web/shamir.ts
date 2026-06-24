// Shamir Secret Sharing — split a secret into n shares so that any k of them rebuild
// it, but k−1 reveal NOTHING. The trick is a polynomial of degree k−1 over a finite
// field whose constant term IS the secret: f(0) = secret, and each share is a point
// (x, f(x)). k points pin down a degree-(k−1) polynomial exactly (Lagrange), so k
// shares recover f(0); with only k−1 points, every secret is still equally possible.
// Real arithmetic over GF(257) so a secret is one byte. Tested.

export const P = 257; // prime > 255, so a secret is a byte 0..255

const mod = (n: number) => ((n % P) + P) % P;

/** Modular inverse in GF(P) via extended Euclid. */
export function modinv(a: number): number {
  let [r, nr] = [mod(a), P];
  let [t, nt] = [1, 0];
  while (nr !== 0) {
    const q = Math.floor(r / nr);
    [r, nr] = [nr, r - q * nr];
    [t, nt] = [nt, t - q * nt];
  }
  if (r !== 1) throw new Error('not invertible');
  return mod(t);
}

export interface Share { x: number; y: number }

/** f(x) = secret + c1·x + … + c_{k-1}·x^{k-1} (mod P); shares are (x, f(x)) for x=1..n. */
export function split(secret: number, n: number, k: number, coeffs: number[]): Share[] {
  const c = [secret, ...coeffs.slice(0, k - 1)];
  const shares: Share[] = [];
  for (let x = 1; x <= n; x++) {
    let y = 0;
    for (let j = 0; j < k; j++) y = mod(y + c[j] * Math.pow(x, j));
    shares.push({ x, y: mod(y) });
  }
  return shares;
}

/** Lagrange-interpolate the shares back to f(0) = the secret. */
export function reconstruct(shares: Share[]): number {
  let secret = 0;
  for (let i = 0; i < shares.length; i++) {
    let num = 1, den = 1;
    for (let j = 0; j < shares.length; j++) {
      if (i === j) continue;
      num = mod(num * (0 - shares[j].x)); // evaluate the basis polynomial at x = 0
      den = mod(den * (shares[i].x - shares[j].x));
    }
    secret = mod(secret + shares[i].y * num * modinv(den));
  }
  return secret;
}
