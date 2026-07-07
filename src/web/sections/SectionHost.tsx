// Renders any registry section: its header (title + sub) then its component. Replaces ~328 inline blocks in main.tsx.
import { SECTIONS } from './registry';

export function SectionHost({ id, onOpen }: { id: string; onOpen?: (id: string) => void }) {
  const e = SECTIONS[id];
  if (!e) return null;
  const { Component } = e;
  return (
    <>
      <header>
        <h1>{e.title}</h1>
        <p className="sub">{e.sub}</p>
      </header>
      <Component onOpen={onOpen} />
    </>
  );
}
