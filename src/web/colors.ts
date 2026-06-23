// Deterministic colours for the byte grid. Each layer gets a base hue so its
// bytes read as a group; fields within a layer vary in lightness so neighbours
// stay distinguishable. Keyed by fieldKey (`${depth}:${name}`) — no protocol
// names appear here, only stack depth.
const LAYER_HUE = [212, 150, 28, 280, 330]; // depth 0,1,2,... cycles

export function layerHue(depth: number): number {
  return LAYER_HUE[depth % LAYER_HUE.length];
}

/** Colour for a header field, varying lightness by the field's index in its layer. */
export function fieldColor(depth: number, fieldIndex: number, fieldCount: number): string {
  const hue = layerHue(depth);
  // spread lightness across 38%..64% so adjacent fields alternate clearly
  const t = fieldCount > 1 ? fieldIndex / (fieldCount - 1) : 0.5;
  const light = 40 + t * 22;
  const sat = 58 - (fieldIndex % 2) * 14; // alternate saturation too
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export const PAYLOAD_COLOR = 'hsl(280 30% 46%)';
export const TRAILER_COLOR = 'hsl(220 8% 42%)';
