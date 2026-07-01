// Karatsuba multiplication — the algorithm that broke the O(n²) barrier for multiplying big numbers, found by a
// 23-year-old Anatoly Karatsuba in 1960 after Kolmogorov conjectured n² was optimal (it disproved the conjecture
// within a week). The schoolbook method multiplies every digit of one number by every digit of the other: n²
// single-digit multiplies. Karatsuba's insight is a bit of algebra. Split each n-digit number in half around the
// base B = 10^m:  x = a·B + b,  y = c·B + d. Then
//     x·y = ac·B² + (ad + bc)·B + bd
// which looks like FOUR products (ac, ad, bc, bd). But the cross term ad+bc can be recovered from just ONE extra
// product instead of two:
//     (a+b)(c+d) = ac + ad + bc + bd,  so  ad + bc = (a+b)(c+d) − ac − bd.
// So you compute only THREE half-size products — ac, bd, and (a+b)(c+d) — and combine. Recurse, and trading 4
// sub-multiplies for 3 at every level turns n² into n^log₂3 ≈ n^1.585. On 1000-digit numbers that's ~50× fewer
// multiplies; it's why big-integer libraries (and thus RSA/ECC key math) use Karatsuba above a few dozen digits,
// switching to Toom-Cook and then FFT-based multiplication for truly huge operands. This models the recursion and
// counts single-digit multiplies against schoolbook. Reference: Karatsuba & Ofman (1962).

export interface Node { x: bigint; y: bigint; m: number; children: Node[]; product: bigint }
export interface Trace { product: bigint; mults: number; tree: Node }

const digits = (n: bigint): number => (n < 0n ? -n : n).toString().length;

/** Karatsuba multiply, recording the recursion tree and counting base-case (single-digit) multiplies. */
export function karatsuba(x: bigint, y: bigint): Trace {
  let mults = 0;
  const rec = (x: bigint, y: bigint): Node => {
    if (x < 10n && y < 10n) { mults++; return { x, y, m: 0, children: [], product: x * y }; } // one digit×digit
    const m = Math.floor(Math.max(digits(x), digits(y)) / 2);
    const B = 10n ** BigInt(m);
    const a = x / B, b = x % B;     // high, low halves of x
    const c = y / B, d = y % B;     // high, low halves of y
    const z2 = rec(a, c);           // ac
    const z0 = rec(b, d);           // bd
    const z1 = rec(a + b, c + d);   // (a+b)(c+d)
    const cross = z1.product - z2.product - z0.product; // ad + bc, from one product not two
    const product = z2.product * B * B + cross * B + z0.product;
    return { x, y, m, children: [z2, z0, z1], product };
  };
  const tree = rec(x, y);
  return { product: tree.product, mults, tree };
}

/** Schoolbook multiply count: n×n single-digit multiplies for numbers of these digit-lengths. */
export const schoolbookMults = (x: bigint, y: bigint): number => digits(x) * digits(y);
