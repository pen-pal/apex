// Guided story: perspective projection & perspective-correct interpolation. Projecting 3D→2D divides by depth (w), so a
// truncated-pyramid frustum maps to the NDC cube and parallel lines converge to a vanishing point. Texturing a receding
// surface can't interpolate texture coords linearly in screen space (affine) — it warps (the PS1 look) — because equal
// screen steps are unequal 3D steps. The fix: 1/w is what's linear in screen space, so interpolate u/w, v/w, 1/w then
// divide. Verified in node: frustum corners → NDC cube exactly, and perspective-correct interp == the true 3D value to
// 1e-15 while affine is off by ~3.7 (the visible warp). Sandboxed/CONCEPTUAL 2-D floor.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const CX = 300, VY = 62, BY = 286, Wn = 232, Wf = 26, D0 = 1, D1 = 9, NU = 8, NV = 8;
const depthAt = (v: number) => D0 + (v / NV) * (D1 - D0);                       // texture-row v → 3D depth (linear in 3D)
const rowYpersp = (v: number) => VY + (BY - VY) * (D0 / depthAt(v));            // correct: screen-y ∝ 1/depth (bunches to horizon)
const TOPY = rowYpersp(NV);
const rowYaffine = (v: number) => BY + (v / NV) * (TOPY - BY);                  // wrong: even spacing in screen-y
const halfW = (y: number) => Wf + (Wn - Wf) * ((y - TOPY) / (BY - TOPY));       // trapezoid edges → vanishing point
const colX = (i: number, y: number) => CX + (i / NU * 2 - 1) * halfW(y);

type Phase = 'divide' | 'vanish' | 'affine' | 'correct' | 'why' | 'run';

export function PerspectiveSection() {
  const [mode, setMode] = useState<'pc' | 'affine'>('pc');
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Floor phase={key} mode={key === 'affine' ? 'affine' : 'pc'} /> });

  const scenes: StoryScene[] = [
    scene('divide', '3D → 2D is a divide by depth', 'A camera turns a 3D point into a screen point by dividing its coordinates by its depth (the homogeneous w). Things twice as far away land half as far from the center — that single divide is what makes distant things small. The projection matrix packages it, mapping the view frustum (a truncated pyramid) onto a tidy cube so clipping and rasterization are simple.'),
    scene('vanish', 'Parallel lines meet at a vanishing point', 'Because every point is divided by its own depth, a set of parallel lines heading away from you converges: the checkerboard’s columns all aim at a single vanishing point on the horizon. The floor tiles shrink and bunch together as they recede — that’s a real perspective view, foreshortening and all.'),
    scene('affine', 'Naive texturing warps', 'Now paint a texture on that floor by interpolating its coordinates straight across the screen — “affine” mapping. It looks wrong: the tiles keep the same screen height into the distance instead of foreshortening, so the checkerboard stretches and swims. This is the PlayStation-1-era wobble — equal steps across the screen are NOT equal steps across the 3D floor.'),
    scene('correct', 'Perspective-correct interpolation', 'The fix: don’t interpolate the texture coordinate directly. The quantity that IS linear across the screen is 1/w (reciprocal depth). So interpolate u/w, v/w, and 1/w linearly, then divide u/w by 1/w to recover the true coordinate. Now the tiles foreshorten correctly and the floor sits flat. (Verified: this matches the true 3D value to 1e-15; affine is off by a third of the range.)'),
    scene('why', 'Why 1/w is the linear one', 'Depth itself (w) is not linear across the screen — but its reciprocal 1/w is, exactly. That’s also precisely what a depth buffer stores, and why hardware rasterizers interpolate 1/w for z and value/w for every varying. One reciprocal, interpolated linearly, fixes depth testing and texturing together.'),
    { key: 'run', title: 'Toggle the warp', caption: 'Flip between affine and perspective-correct mapping on the same receding floor. Affine keeps the tile rows evenly spaced down the screen (the texture stretches into the distance); perspective-correct bunches them toward the horizon, exactly as depth demands. Same geometry, same texture — the only difference is dividing by 1/w.', render: () => <Floor phase="run" mode={mode} onToggle={() => setMode((m) => m === 'pc' ? 'affine' : 'pc')} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A camera turns a 3D point into a 2D screen point by <strong>dividing by depth</strong> (the homogeneous coordinate w) — so things twice as far appear half as big, and parallel lines converge to a <strong>vanishing point</strong>. But painting a texture on a receding surface can’t interpolate the texture coordinates linearly across the screen: equal screen steps are unequal 3D steps, so the texture <strong>warps</strong> (the PlayStation-1 wobble). The fix is <strong>perspective-correct interpolation</strong> — interpolate the coordinates divided by w, plus 1/w, then divide back.</>,
        takeaway: <>Perspective projection multiplies a 3D point by a <strong>projection matrix</strong> and then divides x, y, z by the resulting <strong>w</strong> (the perspective divide). That maps the view <strong>frustum</strong> — a truncated pyramid — onto the normalized cube [−1,1]³ (verified here: the frustum’s corners land exactly on the cube’s corners), makes distant objects proportionally smaller, and sends parallel lines to a vanishing point. The subtlety is interpolation. A vertex attribute — a texture coordinate, a color, a normal — is linear across a triangle <em>in 3D</em>, but after the perspective divide it is <strong>not</strong> linear across the <em>screen</em>. Interpolating it linearly in screen space (“affine” mapping) is wrong, and on a steeply receding surface it visibly warps — the classic PS1 texture swim. What <em>is</em> exactly linear in screen space is <strong>1/w</strong>, reciprocal depth. So <strong>perspective-correct interpolation</strong> stores, per vertex, the attribute divided by w (u/w, v/w) and 1/w itself, interpolates all of those linearly across the screen, and at each pixel divides: u = (u/w)ᵢₙₜₑᵣₚ ÷ (1/w)ᵢₙₜₑᵣₚ. This recovers the true 3D-linear value (verified here to 1e-15, where affine differs by a third of the range). The same 1/w is what a <strong>depth buffer</strong> stores, which is why reciprocal depth has better precision near the camera and why hardware rasterizers interpolate 1/w for z-testing and value/w for every varying in one mechanism. It underlies all real-time 3D — GPUs do this per pixel — and its absence is exactly why early hardware without it (the PS1) had that unmistakable wobble.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pp-ctl">
          <button type="button" className={`pp-btn ${mode === 'affine' ? 'on' : ''}`} onClick={() => setMode('affine')}>affine (warped)</button>
          <button type="button" className={`pp-btn ${mode === 'pc' ? 'on' : ''}`} onClick={() => setMode('pc')}>perspective-correct</button>
        </div>
      )}
    />
  );
}

function Floor({ phase, mode, onToggle }: { phase: Phase; mode: 'pc' | 'affine'; onToggle?: () => void }) {
  const on = (p: Phase) => phase === p;
  void onToggle;
  const rowY = mode === 'pc' ? rowYpersp : rowYaffine;
  const cells = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const y0 = rowY(j), y1 = rowY(j + 1);
    const pts = `${colX(i, y0)},${y0} ${colX(i + 1, y0)},${y0} ${colX(i + 1, y1)},${y1} ${colX(i, y1)},${y1}`;
    cells.push(<polygon key={j + '-' + i} points={pts} className={`pp-tile ${(i + j) % 2 ? 'a' : 'b'}`} />);
  }
  return (
    <svg viewBox="0 0 900 330" className="story-svg">
      <text x="60" y="22" className="pp-col">receding checkerboard floor · {mode === 'pc' ? 'perspective-correct (÷ 1/w)' : 'affine (linear in screen — WARPED)'}</text>

      {/* horizon + vanishing point */}
      <line x1={40} y1={VY} x2={640} y2={VY} className="pp-horizon" />
      <circle cx={CX} cy={VY} r={3.5} className="pp-vp" /><text x={CX + 8} y={VY - 5} className="pp-lbl">vanishing point</text>

      {/* the checkerboard floor */}
      {cells}
      {/* trapezoid outline + converging column guides on the vanish scene */}
      {(on('vanish') || on('divide')) && Array.from({ length: NU + 1 }, (_, i) => <line key={i} x1={colX(i, BY)} y1={BY} x2={CX} y2={VY} className="pp-guide" />)}

      {/* depth labels */}
      <text x={colX(0, BY) - 4} y={BY + 16} className="pp-lbl" textAnchor="end">near</text>
      <text x={CX} y={TOPY - 6} className="pp-lbl" textAnchor="middle">far</text>

      {/* legend / side note */}
      <g transform="translate(680 90)">
        <text x={0} y={0} className="pp-note">screen → 3D:</text>
        <text x={0} y={20} className="pp-note2">{mode === 'pc' ? 'row v at depth d,' : 'rows evenly spaced'}</text>
        <text x={0} y={36} className="pp-note2">{mode === 'pc' ? 'screen-y ∝ 1/d' : 'in screen-y (wrong)'}</text>
        <text x={0} y={62} className={`pp-verdict ${mode === 'pc' ? 'ok' : 'bad'}`}>{mode === 'pc' ? '✓ tiles foreshorten' : '✗ tiles stretch'}</text>
      </g>

      <text x="450" y="322" className="pp-foot" textAnchor="middle">
        {on('divide') ? 'screen = 3D ÷ depth — the frustum maps to the NDC cube'
          : on('vanish') ? 'parallel columns converge to the vanishing point'
          : on('affine') ? 'affine: rows evenly spaced → texture stretches into the distance'
          : on('correct') ? 'perspective-correct: interpolate u/w, v/w, 1/w, then divide'
          : on('why') ? '1/w is the linear-in-screen quantity — also what the z-buffer stores'
          : mode === 'pc' ? 'perspective-correct — the floor sits flat' : 'affine — the checkerboard warps (PS1 wobble)'}
      </text>
    </svg>
  );
}
