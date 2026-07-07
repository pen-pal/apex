// The section registry: id -> { title, sub, Component }. Adding a plain section is one row in a chunk file.
import type { ComponentType } from 'react';
import type { ReactNode } from 'react';
import { chunk0 } from './chunk0';
import { chunk1 } from './chunk1';
import { chunk2 } from './chunk2';
import { chunk3 } from './chunk3';
import { chunk4 } from './chunk4';
import { chunk5 } from './chunk5';
import { chunk6 } from './chunk6';

// onOpen lets a section navigate to another (e.g. the kill-chain finale linking back to each stage's rung).
// Optional, so the 400+ sections that don't navigate need no change.
export interface SectionEntry { Component: ComponentType<{ onOpen?: (id: string) => void }>; title: ReactNode; sub: ReactNode }

export const SECTIONS: Record<string, SectionEntry> = {
  ...chunk0,
  ...chunk1,
  ...chunk2,
  ...chunk3,
  ...chunk4,
  ...chunk5,
  ...chunk6,
};
