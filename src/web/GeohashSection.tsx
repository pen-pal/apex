// Geohash, made visible. Type a latitude/longitude and a precision; watch the geohash grow
// character by character as the bounding box shrinks, and compare two points to see how a
// shared prefix tracks how close they are. Real encode/decode in geohash.ts (tested against
// the ezs42 vector).
import { useMemo, useState } from 'react';
import { encode, decode, commonPrefix } from './geohash';

const PLACES = [
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { name: 'Oakland', lat: 37.8044, lon: -122.2712 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
];

export function GeohashSection() {
  const [lat, setLat] = useState(37.7749);
  const [lon, setLon] = useState(-122.4194);
  const [prec, setPrec] = useState(6);
  const [b, setB] = useState(1); // second place for comparison

  const growth = useMemo(() => Array.from({ length: prec }, (_, i) => ({ ch: i + 1, hash: encode(lat, lon, i + 1), box: decode(encode(lat, lon, i + 1)) })), [lat, lon, prec]);

  const other = PLACES[b];
  const otherHash = encode(other.lat, other.lon, prec);
  const here = encode(lat, lon, prec);
  const shared = commonPrefix(here, otherHash);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Geohash — a map coordinate as a sortable string</h2></div>
        <p className="jsec-sub">
          A geohash turns a point on Earth into a short string by repeatedly halving the world — each character narrows a box, even bits
          splitting longitude and odd bits latitude. The longer the string, the smaller the box; and because every character refines the
          <em> same</em> nested grid, nearby points share a leading prefix. That makes “find things near here” a cheap prefix scan.
        </p>

        <div className="geo-inputs">
          <label>lat <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(+e.target.value)} /></label>
          <label>lon <input type="number" step="0.0001" value={lon} onChange={(e) => setLon(+e.target.value)} /></label>
          <label>precision <input type="range" min={1} max={9} value={prec} onChange={(e) => setPrec(+e.target.value)} /><b>{prec}</b></label>
          <span className="geo-presets">{PLACES.map((p, i) => <button key={i} onClick={() => { setLat(p.lat); setLon(p.lon); }}>{p.name}</button>)}</span>
        </div>

        <div className="geo-hash">{growth.map((g, i) => <span key={i} className="geo-ch">{g.hash[g.hash.length - 1]}</span>)}</div>

        <div className="geo-growth">
          {growth.map((g) => {
            const w = g.box.lonMax - g.box.lonMin, h = g.box.latMax - g.box.latMin;
            return (
              <div key={g.ch} className="geo-grow-row">
                <code>{g.hash}</code>
                <span className="geo-box">box ≈ {h.toFixed(h < 1 ? 4 : 1)}° × {w.toFixed(w < 1 ? 4 : 1)}°</span>
              </div>
            );
          })}
        </div>

        <div className="geo-compare">
          <div className="jsec-head"><h2>Prefix = proximity</h2></div>
          <p className="jsec-sub">Compare your point with another and see how much of the geohash they share:</p>
          <div className="geo-cmp-pick">{PLACES.map((p, i) => <button key={i} className={b === i ? 'on' : ''} onClick={() => setB(i)}>{p.name}</button>)}</div>
          <div className="geo-cmp">
            <div className="geo-cmp-line">here&nbsp;: <span>{[...here].map((c, i) => <em key={i} className={i < shared ? 'match' : ''}>{c}</em>)}</span></div>
            <div className="geo-cmp-line">{other.name}: <span>{[...otherHash].map((c, i) => <em key={i} className={i < shared ? 'match' : ''}>{c}</em>)}</span></div>
            <div className="geo-cmp-verdict">{shared > 0 ? `share ${shared} leading character${shared === 1 ? '' : 's'} — ${shared >= 4 ? 'very close' : shared >= 2 ? 'same region' : 'same hemisphere-ish'}` : 'nothing in common — far apart'}</div>
          </div>
        </div>

        <p className="geo-foot">
          The catch is the <em>edge problem</em>: two points can be metres apart yet straddle a box boundary and share no prefix, so a
          real proximity search also checks the eight neighbouring cells. Geohashes are also a clever way to give spatial data a 1-D sort
          order (a space-filling Z-curve), which is exactly why key-value and search engines use them to index locations — Redis
          <code> GEOADD</code>, Elasticsearch geo-queries, and countless “restaurants near me” features.
        </p>
      </section>
    </div>
  );
}
