// Guided story: how a UPC-A barcode works — the bars encode 12 digits, and the last one is a mod-10 check digit that
// catches scan errors. Real UPC-A encoding (L/R codes + guard bars, 95 modules) and the real check-digit formula
// (odd positions ×3 + even positions, complement to a multiple of 10). Verified in node: check digits match 3 real
// barcodes, encoding is 95 modules, and it catches 100% of single-digit errors and adjacent transpositions except when
// the two swapped digits differ by 5 (the change 2·Δ is then a multiple of 10). The same
// one-extra-digit idea as ISBN / Luhn / packet checksums. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
const checkDigit = (d: number[]) => { let odd = 0, even = 0; for (let i = 0; i < 11; i++) { if (i % 2 === 0) odd += d[i]; else even += d[i]; } return (10 - ((3 * odd + even) % 10)) % 10; };
const encode = (d: number[]) => { let s = '101'; for (let i = 0; i < 6; i++) s += L[d[i]]; s += '01010'; for (let i = 6; i < 12; i++) s += R[d[i]]; s += '101'; return s; };
// This code has an adjacent 2,7 (differ by 5) — its transposition is the check digit's one blind spot.
const START = '027000291450'.split('').map(Number);

type Phase = 'digits' | 'notdata' | 'formula' | 'why' | 'scanner' | 'run';

export function BarcodeSection() {
  const [d, setD] = useState<number[]>(START);
  const bump = (i: number) => setD((prev) => prev.map((x, j) => (j === i ? (x + 1) % 10 : x)));
  const swap = (i: number) => setD((prev) => { const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; });
  const reset = () => setD(START);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Bar phase={key} d={START} /> });

  const scenes: StoryScene[] = [
    scene('digits', 'A barcode is just digits', 'Those bars encode 12 digits (a UPC-A code). Each digit becomes 7 black-and-white modules; taller guard bars mark the start, middle, and end so the scanner can orient itself and measure the module width. Read the widths and you recover the digits — the bars are only a font a laser can read.'),
    scene('notdata', 'The last digit isn’t data', 'Eleven of the digits identify the manufacturer and product. The twelfth carries no product information at all — it’s a check digit, computed from the other eleven. Its entire job is to catch errors: a smudged bar, a misread, a mistyped number.'),
    scene('formula', 'The mod-10 check digit', 'The formula: add the digits in the odd positions and multiply by 3, add the digits in the even positions, sum those, and the check digit is whatever brings the total up to the next multiple of 10. For this code that comes out to 0 — and a correct scan always totals a clean multiple of 10.'),
    scene('why', 'Why the ×3 catches errors', 'That weighting is what makes it work. Change any single digit and the weighted sum shifts by an amount that is never a multiple of 10, so the check fails — 100% of single-digit errors are caught. And because odd and even positions are weighted differently (3 vs 1), swapping two adjacent digits — the other common human error — usually changes the sum and is caught (the one blind spot: two digits that differ by 5).'),
    scene('scanner', 'The scanner just re-checks', 'On every scan the reader recomputes the check digit from the first eleven and compares it to the twelfth. A mismatch means it rejects the read and beeps, instead of ringing up the wrong product. The exact same one-extra-digit idea is an ISBN’s check digit, a credit card’s Luhn digit, and the checksum inside every network packet.'),
    { key: 'run', title: 'Catch it — then slip one past it', caption: 'Click any digit to change it: every single-digit slip turns the code red, exactly as a scanner rejects it — all of them caught. Now the surprise. Use the ⇄ handles to transpose two neighbours. Most swaps are caught too — but swap the 2 and the 7 (they differ by 5) and the code stays green while spelling a different product, 072000291450. That one transposition is invisible to the checksum, so a real scanner would ring up the wrong item. No checksum catches everything.', render: () => <Bar phase="run" d={d} onBump={bump} onSwap={swap} onReset={reset} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A UPC barcode is just 12 digits drawn as black-and-white bars a scanner can read. Eleven of them identify the product; the twelfth is a <strong>check digit</strong>, computed from the other eleven, that carries no information of its own. It exists purely to catch errors — a smudged bar, a misread, a typo — so the scanner refuses a bad read instead of charging you for the wrong item.</>,
        takeaway: <>The check digit is a mod-10 checksum: add the digits in the <strong>odd</strong> positions and multiply by 3, add the digits in the <strong>even</strong> positions, and the check digit is whatever brings the total up to a multiple of 10. That weighting is what makes it work — any single wrong digit shifts the weighted sum by an amount that isn’t a multiple of 10, so the check fails and the error is caught; and because odd and even positions are weighted differently (3 vs 1), swapping two adjacent digits — the other common human mistake — also changes the sum and is caught (except the one case where the two differ by 5). On every scan the reader recomputes the check digit from the first eleven and compares; a mismatch means it beeps and rejects rather than ringing up the wrong product. The same one-extra-digit idea is an ISBN’s check digit, a credit card’s <strong>Luhn</strong> digit, and the checksums inside every network packet — cheap insurance against errors that happen constantly.</>,
      }}
      controls={() => null}
    />
  );
}

function Bar({ phase, d, onBump, onSwap, onReset }: { phase: Phase; d: number[]; onBump?: (i: number) => void; onSwap?: (i: number) => void; onReset?: () => void }) {
  const on = (p: Phase) => phase === p;
  const bits = encode(d);
  const computed = checkDigit(d.slice(0, 11));
  const valid = d[11] === computed;
  const tampered = d.some((x, i) => x !== START[i]);
  const slipped = on('run') && valid && tampered; // a wrong code the checksum accepts
  const MW = 6, x0 = 90, yTop = 70, barH = 180;
  const isGuard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  const cx = (i: number) => x0 + (i < 6 ? (3 + i * 7 + 3.5) : (50 + (i - 6) * 7 + 3.5)) * MW;
  const dy = yTop + barH + 30;
  let odd = 0, even = 0; for (let i = 0; i < 11; i++) { if (i % 2 === 0) odd += d[i]; else even += d[i]; }
  const total = 3 * odd + even;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="40" className={`upc-col ${slipped ? 'slip' : ''}`}>UPC-A · 12 digits → 95 modules{on('run') ? (slipped ? ' · WRONG PRODUCT, ACCEPTED ⚠️' : valid ? ' · VALID ✓' : ' · REJECTED ✗') : ''}</text>
      {on('run') && tampered && <text x="840" y="40" className="upc-reset" textAnchor="end" onClick={onReset} style={{ cursor: 'pointer' }}>⟲ reset</text>}

      {/* bars — red when the checksum rejects, amber when a wrong code slipped through */}
      {[...bits].map((b, i) => b === '1' && (
        <rect key={i} x={x0 + i * MW} y={yTop} width={MW} height={barH + (isGuard(i) ? 22 : 0)} className={`upc-bar ${on('run') && !valid ? 'bad' : ''} ${slipped ? 'slip' : ''}`} />
      ))}

      {/* digits, clickable to +1 in run; changed ones highlighted */}
      {d.map((dig, i) => {
        const isCheck = i === 11; const changed = on('run') && dig !== START[i];
        return (
          <g key={i} onClick={onBump ? () => onBump(i) : undefined} style={{ cursor: onBump ? 'pointer' : 'default' }}>
            <rect x={cx(i) - 15} y={dy} width="30" height="34" rx="4" className={`upc-dbox ${isCheck ? 'check' : ''} ${changed ? 'changed' : ''} ${on('run') && !valid && isCheck ? 'bad' : ''}`} />
            <text x={cx(i)} y={dy + 23} className="upc-dig" textAnchor="middle">{dig}</text>
            {isCheck && (on('notdata') || on('formula') || on('scanner') || on('run')) && <text x={cx(i)} y={dy + 52} className="upc-dlbl" textAnchor="middle">check</text>}
          </g>
        );
      })}

      {/* swap handles between adjacent digits (run only): transpose two neighbours */}
      {on('run') && onSwap && Array.from({ length: 11 }, (_, i) => (
        <g key={'s' + i} onClick={() => onSwap(i)} style={{ cursor: 'pointer' }}>
          <circle cx={(cx(i) + cx(i + 1)) / 2} cy={dy + 17} r="8" className="upc-swap" />
          <text x={(cx(i) + cx(i + 1)) / 2} y={dy + 21} className="upc-swap-ico" textAnchor="middle">⇄</text>
        </g>
      ))}

      {(on('formula') || on('why') || on('run')) && (
        <text x="450" y={yTop + barH + 130} className="upc-formula" textAnchor="middle">
          3 × (odd sum {odd}) + (even sum {even}) = {total} → next multiple of 10 needs {computed}{on('run') ? `  ·  printed: ${d[11]} ${valid ? '✓ match' : '✗ mismatch'}` : ''}
        </text>
      )}

      <text x="450" y="452" className={`upc-foot ${slipped ? 'slip' : ''}`} textAnchor="middle">
        {on('digits') ? 'each digit = 7 modules; guard bars (taller) mark start / middle / end'
          : on('notdata') ? '11 digits = the product; the 12th is a check digit, computed from them'
          : on('formula') ? 'odd positions ×3 + even positions, completed to a multiple of 10'
          : on('why') ? 'any single-digit error shifts the sum off a multiple of 10 → caught'
          : on('scanner') ? 'recompute + compare on every scan → reject bad reads, not charge wrong'
          : slipped ? `${d.join('')} ≠ ${START.join('')} — a different product, same check digit → the scanner rings it up`
          : !valid ? `rejected — recomputed check ${computed} ≠ printed ${d[11]}; the scanner beeps`
          : 'valid — the original code; click a digit, or ⇄ two neighbours, to try to fool it'}
      </text>
    </svg>
  );
}
