// Perlin noise — the algorithm that made computer-generated worlds stop looking computer-generated. Ken Perlin
// developed it in 1983, soon after working on the movie Tron, frustrated that everything CG looked too clean; it earned him a
// Technical Academy Award and now underlies procedural terrain, clouds, fire, marble and wood textures, and the
// wobble in a thousand animations. The problem it solves: you want randomness that is SMOOTH — a value at every
// point that looks noisy but has no jarring jumps, so zooming in reveals gentle hills, not static. Pure random
// numbers per pixel are white noise (harsh); Perlin's trick is GRADIENT noise. Lay down a grid; at each integer
// lattice point assign a random unit direction (a gradient), not a value. For any query point, take the four
// surrounding lattice gradients, dot each with the vector from that corner to the point, and blend the four
// results. Two details make it smooth: the blend weight uses the "fade" curve 6t⁵−15t⁴+10t³ (flat slope AND
// curvature at both ends, so cells join seamlessly), and because the value AT a lattice point is a gradient dotted
// with the zero offset, it is exactly 0 there — the randomness lives BETWEEN the grid points. Stack several
// copies at doubling frequency and halving amplitude (fractional Brownian motion / "octaves") and you get the
// self-similar roughness of real mountains and coastlines. This models the gradients, the fade blend, single-
// octave noise, and fBm. Reference: Perlin, "An Image Synthesizer," SIGGRAPH (1985); "Improving Noise" (2002).

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10); // 6t^5 - 15t^4 + 10t^3
const lerp = (t: number, a: number, b: number): number => a + t * (b - a);
// eight unit gradient directions at 45° steps (all length 1 → clean, bounded output)
const GRAD: [number, number][] = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);

export class Perlin {
  private perm: Int16Array; // permutation table, doubled to 512 to avoid wrapping

  constructor(seed = 1) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    let s = seed >>> 0 || 1;
    for (let i = 255; i > 0; i--) { // seeded Fisher-Yates shuffle
      s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Int16Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private grad(hash: number, x: number, y: number): number {
    const g = GRAD[hash & 7];
    return g[0] * x + g[1] * y;
  }

  /** Single-octave 2-D gradient noise. Exactly 0 at integer lattice points; smooth everywhere; range ⊂ [-√½, √½]. */
  noise2d(x: number, y: number): number {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const p = this.perm;
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const x1 = lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));
    return lerp(v, x1, x2);
  }

  /** Fractional Brownian motion: sum octaves at doubling frequency, halving amplitude. Normalized to ~[-1,1]. */
  fbm(x: number, y: number, octaves = 5, persistence = 0.5, lacunarity = 2): number {
    let total = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      total += amp * this.noise2d(x * freq, y * freq);
      norm += amp;
      amp *= persistence; freq *= lacunarity;
    }
    return total / norm;
  }
}
