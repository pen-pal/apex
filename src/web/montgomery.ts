// Montgomery multiplication — the trick that makes RSA and elliptic-curve crypto fast. Those algorithms spend
// almost all their time computing a·b mod n for a huge modulus n, over and over (a 2048-bit modular exponentiation
// is thousands of modular multiplies). The expensive part isn't the multiply — it's the "mod n": reducing a number
// modulo an arbitrary n needs a full multi-precision DIVISION, which is slow and, worse for crypto, its running
// time can leak information about the secret operands (a timing side channel). Peter Montgomery's 1985 idea is to
// change coordinates. Pick R = 2^k just bigger than n; represent every number a in "Montgomery form" ā = a·R mod n.
// In this form, multiplication is followed not by a division but by REDC — a reduction that only needs
// multiplies, additions, and — because R is a power of two — a bit-MASK (mod R) and a bit-SHIFT (divide by R),
// never a real division. REDC(T) computes T·R⁻¹ mod n like this: m = (T mod R)·n′ mod R, then t = (T + m·n)/R,
// where n′ = −n⁻¹ mod R is precomputed so that T + m·n is exactly divisible by R. So multiplying two
// Montgomery-form numbers and running REDC gives the Montgomery form of their product mod n — no division, and the
// same fixed sequence of operations regardless of the values, which is exactly what constant-time crypto wants.
// The one-time cost of converting in and out is amortized across the thousands of multiplies in one exponentiation.
// This models the setup (R, n′), REDC, the round-trip, modular multiply and exponentiation. Reference: Montgomery,
// "Modular Multiplication Without Trial Division," Mathematics of Computation (1985).

/** Extended Euclid → modular inverse a⁻¹ mod m (m > 0, gcd(a,m)=1). */
export function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [((a % m) + m) % m, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) { const q = old_r / r; [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; }
  return ((old_s % m) + m) % m;
}

export class Montgomery {
  readonly n: bigint;        // odd modulus
  readonly bits: number;     // k, with R = 2^k > n
  readonly R: bigint;        // 2^k
  readonly mask: bigint;     // R - 1  (mod R = & mask)
  readonly nPrime: bigint;   // -n^{-1} mod R
  readonly R2: bigint;       // R^2 mod n (to enter Montgomery form)

  constructor(n: bigint) {
    if (n <= 0n || n % 2n === 0n) throw new Error('modulus must be odd and positive');
    this.n = n;
    this.bits = n.toString(2).length;          // R = 2^bits > n
    this.R = 1n << BigInt(this.bits);
    this.mask = this.R - 1n;
    this.nPrime = (this.R - modInverse(n, this.R)) % this.R; // -n^{-1} mod R
    this.R2 = (this.R * this.R) % n;
  }

  /** REDC: given T < n·R, return T·R⁻¹ mod n using only ×, +, mask, shift — no division by n. */
  redc(T: bigint): bigint {
    const m = ((T & this.mask) * this.nPrime) & this.mask; // (T mod R)·n′ mod R
    const t = (T + m * this.n) >> BigInt(this.bits);        // (T + m·n)/R  — exact, R = 2^bits
    return t >= this.n ? t - this.n : t;
  }

  toMont(a: bigint): bigint { return this.redc((((a % this.n) + this.n) % this.n) * this.R2); } // a·R mod n
  fromMont(aBar: bigint): bigint { return this.redc(aBar); }                                    // ā·R⁻¹ = a
  /** Multiply two Montgomery-form numbers → Montgomery form of the product mod n. */
  mont(aBar: bigint, bBar: bigint): bigint { return this.redc(aBar * bBar); }

  /** Ordinary modular multiply a·b mod n, done through Montgomery form. */
  mulMod(a: bigint, b: bigint): bigint { return this.fromMont(this.mont(this.toMont(a), this.toMont(b))); }

  /** Modular exponentiation base^exp mod n, all in Montgomery form (square-and-multiply). */
  powMod(base: bigint, exp: bigint): bigint {
    let result = this.toMont(1n);
    let b = this.toMont(base);
    while (exp > 0n) {
      if (exp & 1n) result = this.mont(result, b);
      b = this.mont(b, b);
      exp >>= 1n;
    }
    return this.fromMont(result);
  }
}
