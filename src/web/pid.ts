// PID controller — the feedback loop that quietly runs the physical and digital world: cruise control,
// thermostats, drone stabilization, disk-head positioning, and, increasingly, software autoscaling and
// congestion control. The setup is universal: you have a PROCESS whose output you measure (speed, temperature,
// queue depth, replica count), a SETPOINT you want it to hold, and a knob (the control signal) that pushes it.
// A PID controller decides the knob from the ERROR e = setpoint − measured, as the sum of three terms:
//   P — proportional: push in proportion to how far off you are (Kp·e). Fast, but alone it leaves a permanent
//       "droop" — a steady-state error, because to hold the output against a constant load it needs a nonzero
//       control signal, which requires a nonzero error.
//   I — integral: accumulate the error over time (Ki·∫e). This is what ERASES the steady-state error — it keeps
//       winding up until the output exactly hits the setpoint — at the cost of possible overshoot and "windup."
//   D — derivative: react to how fast the error is changing (Kd·de/dt). It anticipates and DAMPS overshoot and
//       oscillation, acting like a shock absorber, but amplifies measurement noise.
// Tuning Kp, Ki, Kd trades responsiveness against stability. This models a SECOND-ORDER plant (a positioning
// system: control force → acceleration → velocity → position, with light natural damping), the classic PID
// testbed — so P alone overshoots and oscillates, D damps that oscillation (it opposes velocity), and I erases
// the steady-state droop against a constant load. Reference: Åström & Murray, "Feedback Systems";
// Ziegler–Nichols tuning (1942).

const DAMPING = 0.8; // the plant's own light damping

export interface PIDConfig { kp: number; ki: number; kd: number; setpoint: number; load: number; steps: number; dt: number }
export interface Sample { t: number; x: number; u: number; e: number }
export interface PIDResult { series: Sample[]; steadyError: number; overshoot: number; settleStep: number; finalX: number }

export function simulate(cfg: PIDConfig): PIDResult {
  const { kp, ki, kd, setpoint, load, steps, dt } = cfg;
  let x = 0, v = 0, integral = 0, prevE = setpoint - x;
  const series: Sample[] = [];
  for (let t = 0; t < steps; t++) {
    const e = setpoint - x;
    integral += e * dt;
    const d = (e - prevE) / dt;
    const u = kp * e + ki * integral + kd * d;   // the PID control law
    series.push({ t, x, u, e });
    v = v + dt * (u - load - DAMPING * v);        // second-order plant: force → acceleration → velocity → position
    x = x + dt * v;
    prevE = e;
  }
  const finalX = x;
  const steadyError = setpoint - finalX;
  const overshoot = Math.max(0, Math.max(...series.map((s) => s.x)) - setpoint);
  const band = Math.abs(setpoint) * 0.02 + 1e-9;  // 2% settling band
  let settleStep = steps;
  for (let t = 0; t < series.length; t++) {
    if (series.slice(t).every((s) => Math.abs(s.x - setpoint) <= band)) { settleStep = t; break; }
  }
  return { series, steadyError, overshoot, settleStep, finalX };
}
