// M/M/1 queueing — the math behind "you can't fill the pipe without latency". Packets
// arrive at rate λ (Poisson) and a link serves them at rate μ; the utilisation is
// ρ = λ/μ. The mean time a packet spends in the system is W = 1/(μ−λ), which blows up
// as ρ→1: at 50% load the wait is one service time, at 90% it's ten, at 99% a hundred.
// That 1/(1−ρ) knee is why operators target ~70% and why bufferbloat hurts — a bigger
// buffer doesn't raise μ, it just lets the queue (and the delay) grow. Standard
// closed-form results (Little's law etc.), verified.

export interface MM1 {
  rho: number; // utilisation λ/μ
  stable: boolean; // ρ < 1 ?
  L: number; // mean packets in the system
  Lq: number; // mean packets waiting in the queue
  W: number; // mean time in system (queue + service)
  Wq: number; // mean time waiting in the queue
}

export function mm1(lambda: number, mu: number): MM1 {
  const rho = mu > 0 ? lambda / mu : Infinity;
  if (!(rho < 1) || mu <= 0) {
    return { rho, stable: false, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity };
  }
  return {
    rho,
    stable: true,
    L: rho / (1 - rho), // = λW (Little's law)
    Lq: (rho * rho) / (1 - rho),
    W: 1 / (mu - lambda),
    Wq: rho / (mu - lambda),
  };
}

/** Mean system time as a multiple of one service time, vs utilisation — the 1/(1−ρ) curve. */
export const latencyFactor = (rho: number): number => (rho < 1 ? 1 / (1 - rho) : Infinity);
