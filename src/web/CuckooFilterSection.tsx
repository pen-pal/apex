// Cuckoo filter, made visible. A small table of buckets holding fingerprints. Type an item and insert / query / delete
// it: insert shows the fingerprint land in one of its two candidate buckets (with a kick count if it had to evict),
// query highlights the two candidates and reports maybe-present / definitely-not, and delete removes it — the thing a
// Bloom filter can't do. Model + tests in cuckoofilter.ts.
import { useState } from 'react';
import { insert, contains, remove, fingerprint, bucket1, altBucket, empty, load, SLOTS, BUCKETS, type Buckets } from './cuckoofilter';

const hx = (f: number) => f.toString(16).padStart(2, '0');
const SEED = ['apple', 'mango', 'cherry', 'kiwi', 'plum', 'grape'];

export function CuckooFilterSection() {
  const [buckets, setBuckets] = useState<Buckets>(() => SEED.reduce((b, x) => insert(b, x).buckets, empty()));
  const [item, setItem] = useState('mango');
  const [status, setStatus] = useState<{ text: string; kind: 'ok' | 'no' | 'info' }>({ text: 'The 6 seed fruits are in. Query “mango”, then delete it — something a Bloom filter can’t do.', kind: 'info' });

  const f = fingerprint(item || ' ');
  const i1 = bucket1(item || ' '), i2 = altBucket(i1, f);

  const onInsert = () => {
    if (!item) return;
    const r = insert(buckets, item);
    if (!r.ok) { setStatus({ text: `Insert of “${item}” failed after 32 kicks — its bucket pair is full. A cuckoo filter can’t exceed ~95% load.`, kind: 'no' }); return; }
    setBuckets(r.buckets);
    setStatus({ text: `Inserted “${item}” (fingerprint ${hx(f)}) into bucket ${r.landed}${r.kicks ? ` after ${r.kicks} cuckoo kick${r.kicks > 1 ? 's' : ''}` : ''}.`, kind: 'ok' });
  };
  const onQuery = () => setStatus(contains(buckets, item)
    ? { text: `“${item}” → maybe present — fingerprint ${hx(f)} is in bucket ${i1} or ${i2}. (Could be a false positive if another item shares the fingerprint.)`, kind: 'ok' }
    : { text: `“${item}” → definitely not present — fingerprint ${hx(f)} is in neither candidate bucket. No false negatives, ever.`, kind: 'no' });
  const onDelete = () => {
    const r = remove(buckets, item);
    setBuckets(r.buckets);
    setStatus(r.removed
      ? { text: `Deleted “${item}” — its fingerprint is gone and a query now says “not present”. This is the whole point over Bloom filters.`, kind: 'ok' }
      : { text: `“${item}” wasn’t in the filter, so there’s nothing to delete.`, kind: 'no' });
  };

  return (
    <div className="ckf">
      <div className="ckf-controls">
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="item" spellCheck={false} className="ckf-input" />
        <span className="ckf-fp">fingerprint <b>{hx(f)}</b> → buckets <b>{i1}</b> &amp; <b>{i2}</b></span>
        <div className="ckf-btns">
          <button type="button" onClick={onInsert}>insert</button>
          <button type="button" onClick={onQuery}>query</button>
          <button type="button" onClick={onDelete}>delete</button>
        </div>
      </div>

      <div className="ckf-table">
        {buckets.map((slots, i) => (
          <div key={i} className={`ckf-bucket ${i === i1 || i === i2 ? 'ckf-cand' : ''}`}>
            <span className="ckf-bnum">b{i}</span>
            <div className="ckf-slots">
              {Array.from({ length: SLOTS }, (_, s) => {
                const fp = slots[s];
                return <span key={s} className={`ckf-slot ${fp !== undefined ? 'ckf-full' : ''} ${fp === f && (i === i1 || i === i2) ? 'ckf-match' : ''}`}>{fp !== undefined ? hx(fp) : '·'}</span>;
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="ckf-load">load {load(buckets)} / {BUCKETS * SLOTS} fingerprints · highlighted = the current item’s two candidate buckets</div>
      <div className={`ckf-status ckf-${status.kind}`}>{status.text}</div>

      <p className="ckf-foot">
        A <strong>Bloom filter</strong> answers “is x in the set?” with a small array of bits and zero false negatives —
        but flipping bits is one-way, so you can never remove an element. The <strong>cuckoo filter</strong> keeps the
        same guarantee and adds delete by storing a short <strong>fingerprint</strong> in a cuckoo hash table instead of
        raw bits. The elegant part is <strong>partial-key</strong> cuckoo hashing: a fingerprint’s two buckets are
        <code> i</code> and <code>i ⊕ hash(fingerprint)</code>, which is self-inverse, so an evicted fingerprint can be
        kicked to its other bucket knowing only the fingerprint — you never need the original key. The price is that,
        like any cuckoo table, inserts fail near ~95% load and a rare fingerprint collision is a false positive. It also
        beats Bloom on space below ~3% false-positive rate, which is why it shows up in databases and network switches
        that need a deletable approximate set. (Fan et al., 2014.)
      </p>
    </div>
  );
}
