// Shared types for the multi-language code examples (see langSamples.ts). Split out so the data can live in more than
// one file without either importing the other.

export type Lang = 'python' | 'go' | 'rust' | 'c' | 'cpp';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'python', label: 'Python' }, { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' },
  { id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' },
];

export interface Snippet { lang: Lang; code: string }
export interface ExampleSet {
  intro: string;      // what the snippets compute
  expect: string;     // the stdout every snippet must print (the verification anchor)
  snippets: Snippet[];
}
