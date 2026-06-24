// RSA, the original public-key cryptosystem — the trapdoor made visible. Anyone
// can compute c = m^e mod n (the public direction); only the holder of d can undo
// it, and recovering d means factoring n, which is easy for our small teaching
// modulus and astronomically hard at 2048 bits. All arithmetic is real BigInt and
// the worked example (p=61, q=53) matches the canonical RSA vector. Sandbox values
// only — a teaching keypair, never a real private key.

/** Modular exponentiation by square-and-multiply (the engine of RSA). */
export function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

export interface ExpStep { bit: number; afterSquare: bigint; multiplied: boolean; value: bigint }

/** Square-and-multiply, but processed MSB→LSB and recording each step for the view. */
export function modpowTrace(base: bigint, exp: bigint, mod: bigint): { value: bigint; steps: ExpStep[] } {
  const bits = exp.toString(2).split('').map(Number); // MSB first
  let acc = 1n;
  const steps: ExpStep[] = [];
  for (const bit of bits) {
    acc = (acc * acc) % mod; // square
    const afterSquare = acc;
    const multiplied = bit === 1;
    if (multiplied) acc = (acc * (base % mod)) % mod; // multiply by base when bit set
    steps.push({ bit, afterSquare, multiplied, value: acc });
  }
  return { value: acc, steps };
}

function egcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {
  if (b === 0n) return { g: a, x: 1n, y: 0n };
  const r = egcd(b, a % b);
  return { g: r.g, x: r.y, y: r.x - (a / b) * r.y };
}

/** Modular inverse a^{-1} mod m (how the private exponent d is derived). */
export function modinv(a: bigint, m: bigint): bigint {
  const r = egcd(((a % m) + m) % m, m);
  if (r.g !== 1n) throw new Error('no inverse — e and φ(n) share a factor');
  return ((r.x % m) + m) % m;
}

export function gcd(a: bigint, b: bigint): bigint {
  while (b) { [a, b] = [b, a % b]; }
  return a < 0n ? -a : a;
}

export interface RsaKey {
  p: bigint; q: bigint;
  n: bigint; phi: bigint; // modulus and Euler totient
  e: bigint; d: bigint; // public / private exponents
}

/** Build an RSA keypair from two primes and a public exponent e. */
export function rsaKeygen(p: bigint, q: bigint, e: bigint): RsaKey {
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  if (gcd(e, phi) !== 1n) throw new Error('e must be coprime with φ(n)');
  const d = modinv(e, phi);
  return { p, q, n, phi, e, d };
}

export const rsaEncrypt = (m: bigint, key: RsaKey) => modpow(m, key.e, key.n); // public
export const rsaDecrypt = (c: bigint, key: RsaKey) => modpow(c, key.d, key.n); // private
export const rsaSign = (h: bigint, key: RsaKey) => modpow(h, key.d, key.n); // private
export const rsaVerify = (s: bigint, key: RsaKey) => modpow(s, key.e, key.n); // public → recovers h

/** A few small primes for the picker (all genuinely prime). */
export const SMALL_PRIMES = [53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n, 101n, 103n, 107n, 109n, 113n];

/** Naive factorisation — to show that breaking the small modulus is trivial,
 *  and (by contrast) why a 2048-bit n is not. */
export function factor(n: bigint): [bigint, bigint] | null {
  for (let i = 2n; i * i <= n; i++) if (n % i === 0n) return [i, n / i];
  return null;
}
