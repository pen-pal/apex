// The byte / anatomy view: a hex grid where every byte is coloured by the field
// that owns it, a legend of the layers, and a decode panel for the selected
// byte. Everything is derived from the ByteModel (engine output) — this file
// knows no protocol layouts.
import { useMemo, useState } from 'react';
import type { ByteCell, ByteModel, FieldSlice } from './byteModel';
import { fieldColor, PAYLOAD_COLOR, TRAILER_COLOR } from './colors';

function buildColorMap(model: ByteModel): Map<string, string> {
  const map = new Map<string, string>();
  for (const layer of model.layers) {
    layer.fields.forEach((f, i) => map.set(f.fieldKey, fieldColor(layer.depth, i, layer.fields.length)));
  }
  return map;
}

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');
const bin8 = (v: number) => v.toString(2).padStart(8, '0');
const printable = (v: number) => (v >= 0x20 && v <= 0x7e ? String.fromCharCode(v) : null);

/** Background for a cell: a single colour, or a bit-proportional gradient for packed bytes. */
function cellBackground(cell: ByteCell, colors: Map<string, string>): string {
  if (cell.region === 'payload') return PAYLOAD_COLOR;
  if (cell.region === 'trailer') return TRAILER_COLOR;
  if (cell.slices.length === 1) return colors.get(cell.slices[0].fieldKey)!;
  // Packed byte: split left→right by each field's bit width within the byte.
  const stops: string[] = [];
  let pct = 0;
  for (const s of cell.slices) {
    const width = ((s.loBit - s.hiBit + 1) / 8) * 100;
    const c = colors.get(s.fieldKey)!;
    stops.push(`${c} ${pct}%`, `${c} ${pct + width}%`);
    pct += width;
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function FlagBreakdown({ slice }: { slice: FieldSlice }) {
  const f = slice.field;
  const labels = f.field.flagBits;
  if (!labels) return null;
  const n = labels.length;
  return (
    <div className="bits">
      {labels.map((label, i) => {
        const on = (f.value >> (n - 1 - i)) & 1;
        return (
          <span key={label} className={`bit ${on ? 'on' : 'off'}`}>
            {label}={on}
          </span>
        );
      })}
    </div>
  );
}

function FieldDetail({ slice, cell }: { slice: FieldSlice; cell: ByteCell }) {
  const p = slice.field;
  const f = p.field;
  const isFlags = f.type === 'flags' && f.flagBits;
  const isSubByte = p.bits < 8 || p.bits % 8 !== 0;
  return (
    <div className="field-detail">
      <div className="fd-head">
        <span className="fd-label">{f.label}</span>
        <span className="fd-meta">
          {p.bits} bit{p.bits === 1 ? '' : 's'} · this byte: bit {slice.hiBit}
          {slice.loBit !== slice.hiBit ? `–${slice.loBit}` : ''}
        </span>
      </div>
      <div className="fd-value">
        <code>{p.display}</code>
      </div>
      {p.meaning && f.type !== 'flags' && <div className="fd-meaning">{p.meaning}</div>}
      {isFlags && <FlagBreakdown slice={slice} />}
      {isSubByte && !isFlags && (
        <div className="fd-meaning subtle">
          Packed sub-byte field — it shares byte {cell.index} with its neighbours.
        </div>
      )}
      {f.desc && <p className="fd-desc">{f.desc}</p>}
      {!f.desc && f.note && f.note !== p.meaning && <div className="fd-note">{f.note}</div>}
      {f.detail && (
        <details className="fd-deep" open>
          <summary>Deep dive</summary>
          <div className="fd-detail">{f.detail}</div>
        </details>
      )}
    </div>
  );
}

/** Bit-level dissection of one byte: 8 bits, grouped and coloured by the field(s) that own them. */
function ByteBits({ cell, colors }: { cell: ByteCell; colors: Map<string, string> }) {
  const bits = Array.from({ length: 8 }, (_, i) => (cell.value >> (7 - i)) & 1);
  const neutral = cell.region === 'payload' ? PAYLOAD_COLOR : TRAILER_COLOR;
  const groups = cell.slices.length
    ? cell.slices.map((s) => ({ label: s.field.field.label, start: s.hiBit, span: s.loBit - s.hiBit + 1, color: colors.get(s.fieldKey)! }))
    : [{ label: cell.region, start: 0, span: 8, color: neutral }];
  const ownerColor = (pos: number) => groups.find((g) => pos >= g.start && pos < g.start + g.span)?.color ?? neutral;

  return (
    <div className="bitgrid">
      <div className="bitlabels">
        {groups.map((g, i) => (
          <span key={i} className="bitgroup" style={{ flex: g.span, background: g.color }} title={g.label}>
            {g.label}
          </span>
        ))}
      </div>
      <div className="bitrow">
        {bits.map((bit, i) => (
          <span key={i} className={`bitcell ${bit ? 'on' : 'off'}`} style={bit ? { color: ownerColor(i) } : undefined}>
            {bit}
          </span>
        ))}
      </div>
      <div className="bitidx">
        {bits.map((_, i) => (
          <span key={i} className="bitn">{7 - i}</span>
        ))}
      </div>
    </div>
  );
}

function DecodePanel({ cell, colors }: { cell: ByteCell | null; colors: Map<string, string> }) {
  if (!cell) {
    return (
      <div className="panel empty">
        <p>Click a byte to decode it.</p>
        <p className="subtle">
          Each colour is a field. Click a byte and every byte of the same field lights up — watch a
          48-bit MAC or a 32-bit IP span its bytes.
        </p>
      </div>
    );
  }
  const ch = printable(cell.value);
  const regionNote =
    cell.region === 'payload'
      ? `Application data carried by ${cell.layerName}. ${cell.slices.length === 0 && printable(cell.value) ? `As a text protocol, its content is ASCII — here, '${printable(cell.value)}'.` : ''}`.trim()
      : cell.region === 'trailer'
        ? 'Frame trailer — the Ethernet FCS (CRC-32). The link layer appends it; the engine surfaces it as the bytes past the IPv4 total-length boundary.'
        : null;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="byte-no">byte {cell.index}</span>
        <span className="layer-tag">{cell.layerName}</span>
        <span className={`region-tag ${cell.region}`}>{cell.region}</span>
      </div>
      <p className="layer-summary"><strong>{cell.layerName}</strong> — {cell.layerSummary}</p>
      <div className="byte-faces">
        <div><span className="k">hex</span><code>0x{hex2(cell.value)}</code></div>
        <div><span className="k">bin</span><code>{bin8(cell.value)}</code></div>
        <div><span className="k">dec</span><code>{cell.value}</code></div>
        <div><span className="k">ascii</span><code>{ch ? `'${ch}'` : '—'}</code></div>
      </div>
      <ByteBits cell={cell} colors={colors} />
      {regionNote && <p className="region-note">{regionNote}</p>}
      {cell.slices.map((s) => (
        <FieldDetail key={s.fieldKey} slice={s} cell={cell} />
      ))}
    </div>
  );
}

const BYTES_PER_ROW = 16;

export function ByteView({ model }: { model: ByteModel }) {
  const colors = useMemo(() => buildColorMap(model), [model]);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedCell = selected != null ? model.cells[selected] ?? null : null;
  const selectedKeys = useMemo(
    () => new Set(selectedCell ? selectedCell.slices.map((s) => s.fieldKey) : []),
    [selectedCell],
  );

  const rows: ByteCell[][] = [];
  for (let i = 0; i < model.cells.length; i += BYTES_PER_ROW) {
    rows.push(model.cells.slice(i, i + BYTES_PER_ROW));
  }

  return (
    <div className="byteview">
      <div className="grid-wrap">
        <div className="grid">
          {rows.map((row, ri) => (
            <div className="grid-row" key={ri}>
              <span className="offset">{(ri * BYTES_PER_ROW).toString(16).toUpperCase().padStart(4, '0')}</span>
              {row.map((cell) => {
                const inField = cell.slices.some((s) => selectedKeys.has(s.fieldKey));
                const isSel = cell.index === selected;
                return (
                  <button
                    key={cell.index}
                    className={`cell ${cell.region} ${inField ? 'in-field' : ''} ${isSel ? 'sel' : ''}`}
                    style={{ background: cellBackground(cell, colors) }}
                    onClick={() => setSelected(cell.index)}
                    title={`byte ${cell.index} · ${cell.layerName} · ${cell.region}`}
                  >
                    {hex2(cell.value)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <Legend model={model} colors={colors} selectedKeys={selectedKeys} onPick={(k) => {
          const first = model.cells.find((c) => c.slices.some((s) => s.fieldKey === k));
          if (first) setSelected(first.index);
        }} />
      </div>
      <DecodePanel cell={selectedCell} colors={colors} />
    </div>
  );
}

function Legend({
  model,
  colors,
  selectedKeys,
  onPick,
}: {
  model: ByteModel;
  colors: Map<string, string>;
  selectedKeys: Set<string>;
  onPick: (fieldKey: string) => void;
}) {
  return (
    <div className="legend">
      {model.layers.map((layer) => (
        <div className="legend-layer" key={layer.depth}>
          <div className="legend-title">{layer.name}</div>
          <div className="legend-fields">
            {layer.fields.map((f) => (
              <button
                key={f.fieldKey}
                className={`chip ${selectedKeys.has(f.fieldKey) ? 'on' : ''}`}
                onClick={() => onPick(f.fieldKey)}
              >
                <span className="swatch" style={{ background: colors.get(f.fieldKey) }} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="legend-layer">
        <div className="legend-title">Frame</div>
        <div className="legend-fields">
          <span className="chip static"><span className="swatch" style={{ background: PAYLOAD_COLOR }} />Payload</span>
          <span className="chip static"><span className="swatch" style={{ background: TRAILER_COLOR }} />FCS / trailer</span>
        </div>
      </div>
    </div>
  );
}
