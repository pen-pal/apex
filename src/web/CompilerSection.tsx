// Guided story #9: how your code becomes machine code — lex → parse → codegen, on the GuidedStory engine. The CPU
// only runs numbered opcodes (see the CPU-cycle story); a compiler turns text into them. Scenes: the gap, tokenizing,
// parsing to an AST (precedence made visible), generating instructions, then a live box with a REAL tiny compiler —
// type an arithmetic expression and watch the actual tokens, tree, and pseudo-assembly it produces.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Tok = { t: 'num' | 'id' | 'op' | 'eq' | 'lp' | 'rp'; v: string };
type Node = { op: string; l: Node; r: Node } | { leaf: string; num: boolean };
const isLeaf = (n: Node): n is { leaf: string; num: boolean } => 'leaf' in n;

function lex(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*([A-Za-z_]\w*|\d+\.?\d*|[+\-*/]|=|\(|\))/g;
  let m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index !== i) throw new Error('unexpected character');
    i = re.lastIndex;
    const v = m[1];
    out.push({ v, t: /^\d/.test(v) ? 'num' : /^[A-Za-z_]/.test(v) ? 'id' : v === '=' ? 'eq' : v === '(' ? 'lp' : v === ')' ? 'rp' : 'op' });
  }
  if (i !== s.length) throw new Error('unexpected character');
  return out;
}

// recursive descent: program → (id '=')? expr ;  expr → term (('+'|'-') term)* ;  term → factor (('*'|'/') factor)* ;  factor → num | id | '(' expr ')'
function parse(toks: Tok[]): { target: string | null; ast: Node } {
  let p = 0;
  const peek = () => toks[p];
  const eat = (t?: string) => { const tk = toks[p]; if (!tk || (t && tk.t !== t && tk.v !== t)) throw new Error('syntax error'); p++; return tk; };
  const factor = (): Node => {
    const tk = peek(); if (!tk) throw new Error('unexpected end');
    if (tk.t === 'num' || tk.t === 'id') { p++; return { leaf: tk.v, num: tk.t === 'num' }; }
    if (tk.t === 'lp') { p++; const e = expr(); eat('rp'); return e; }
    throw new Error('unexpected token');
  };
  const term = (): Node => { let n = factor(); while (peek() && (peek().v === '*' || peek().v === '/')) { const op = eat().v; n = { op, l: n, r: factor() }; } return n; };
  const expr = (): Node => { let n = term(); while (peek() && (peek().v === '+' || peek().v === '-')) { const op = eat().v; n = { op, l: n, r: term() }; } return n; };
  let target: string | null = null;
  if (toks[0]?.t === 'id' && toks[1]?.t === 'eq') { target = toks[0].v; p = 2; }
  const ast = expr();
  if (p !== toks.length) throw new Error('trailing tokens');
  return { target, ast };
}

function astLines(n: Node, prefix = '', isRoot = true, last = true, lines: { text: string; op: boolean }[] = []): typeof lines {
  const S = String.fromCharCode(160); // nbsp; SVG <text> collapses ordinary leading spaces
  const conn = isRoot ? '' : last ? '└─' + S : '├─' + S;
  lines.push({ text: prefix + conn + (isLeaf(n) ? n.leaf : n.op), op: !isLeaf(n) });
  if (!isLeaf(n)) {
    const cp = prefix + (isRoot ? '' : last ? S + S + S : '│' + S + S);
    astLines(n.l, cp, false, false, lines);
    astLines(n.r, cp, false, true, lines);
  }
  return lines;
}

const OPN: Record<string, string> = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' };
function codegen(n: Node, out: string[] = []): string[] {
  if (isLeaf(n)) out.push(`${n.num ? 'CONST' : 'LOAD '} ${n.leaf}`);
  else { codegen(n.l, out); codegen(n.r, out); out.push(OPN[n.op]); }
  return out;
}

function compile(src: string) {
  try { const toks = lex(src); const { target, ast } = parse(toks); const asm = codegen(ast); if (target) asm.push(`STORE ${target}`); return { toks, lines: astLines(ast), asm, err: '' }; }
  catch (e) { return { toks: [] as Tok[], lines: [] as { text: string; op: boolean }[], asm: [] as string[], err: (e as Error).message }; }
}

type Phase = 'gap' | 'lex' | 'parse' | 'codegen' | 'run';
const EX = 'x = a + b * 2';

export function CompilerSection() {
  const [src, setSrc] = useState(EX);
  const live = compile(src);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Stage phase={key} src={EX} r={compile(EX)} /> });

  const scenes: StoryScene[] = [
    narrated('gap', 'From text to opcodes', 'You write x = a + b * 2. The CPU cannot read that — it only runs numbered opcodes (that is the CPU-cycle story). A compiler bridges the gap in a few passes, each turning one representation into a simpler one.'),
    narrated('lex', 'Lexing — split into tokens', 'First a scanner walks the characters left to right and groups them into tokens: names, numbers, and operators. Whitespace is dropped. Now the compiler works with words, not characters.'),
    narrated('parse', 'Parsing — build the tree', 'The parser turns the flat token stream into a tree that follows the grammar — and encodes precedence. Because × binds tighter than +, b * 2 sits below the +, so it is computed first. The structure is the meaning.'),
    narrated('codegen', 'Codegen — walk the tree', 'A post-order walk of the tree emits instructions: visit the children (compute the operands), then emit the operation. Leaves load a value; an internal node emits its op. Out comes a straight-line program the CPU can run.'),
    { key: 'run', title: 'Compile it yourself', caption: 'Type an arithmetic expression (names, numbers, + − × ÷, parentheses). This runs a real tiny lexer, recursive-descent parser, and code generator on it — the tokens, tree, and assembly below are all produced from what you type.', render: () => <Stage phase="run" src={src} r={live} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="cmp-live-lbl">source:</span>
          <input className="cmp-input" value={src} spellCheck={false} onChange={(e) => setSrc(e.target.value)} />
          <span className="cmp-live-note">{live.err ? `✗ ${live.err}` : `${live.toks.length} tokens · ${live.asm.length} instructions`}</span>
        </>
      )}
    />
  );
}

const TCLS: Record<string, string> = { num: 'num', id: 'id', op: 'op', eq: 'op', lp: 'op', rp: 'op' };

function Stage({ phase, src, r }: { phase: Phase; src: string; r: ReturnType<typeof compile> }) {
  const on = (p: Phase) => phase === p;
  const showTok = on('lex') || on('parse') || on('codegen') || on('run');
  const showAst = on('parse') || on('codegen') || on('run');
  const showAsm = on('codegen') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* source */}
      <text x="40" y="60" className="cmp-stage-lbl">source</text>
      <rect x="40" y="72" width="380" height="40" rx="6" className="cmp-src" />
      <text x="60" y="98" className="cmp-src-txt">{src || ' '}</text>

      {on('gap') && <>
        <text x="450" y="98" className="cmp-arrow" textAnchor="middle">⟶</text>
        <rect x="520" y="72" width="340" height="40" rx="6" className="cmp-mc" />
        <text x="690" y="98" className="cmp-mc-txt" textAnchor="middle">10110000 00000001 …  (opcodes)</text>
        <text x="450" y="250" className="cmp-mid" textAnchor="middle">the CPU runs numbers, not text — the compiler is the bridge</text>
        <text x="450" y="290" className="cmp-mid dim" textAnchor="middle">lex → parse → generate, each pass simpler than the last</text>
      </>}

      {/* tokens */}
      {showTok && !r.err && <>
        <text x="40" y="150" className="cmp-stage-lbl">tokens</text>
        {r.toks.map((t, i) => (
          <g key={i}>
            <rect x={40 + i * 62} y="162" width="56" height="30" rx="15" className={`cmp-tok ${TCLS[t.t]}`} />
            <text x={40 + i * 62 + 28} y="182" className="cmp-tok-txt" textAnchor="middle">{t.v}</text>
          </g>
        ))}
      </>}

      {/* AST */}
      {showAst && !r.err && <>
        <text x="40" y="235" className="cmp-stage-lbl">AST</text>
        {r.lines.map((l, i) => (
          <text key={i} x="50" y={258 + i * 24} className={`cmp-ast ${l.op ? 'op' : ''}`}>{l.text}</text>
        ))}
        {on('parse') && <text x="470" y="300" className="cmp-mid" textAnchor="middle">× is below + → b × 2 is evaluated first</text>}
      </>}

      {/* ASM */}
      {showAsm && !r.err && <>
        <text x="470" y="235" className="cmp-stage-lbl">generated code</text>
        {r.asm.map((a, i) => (
          <text key={i} x="480" y={258 + i * 24} className="cmp-asm">{a}</text>
        ))}
      </>}

      {r.err && (on('lex') || on('parse') || on('codegen') || on('run')) && <text x="450" y="260" className="cmp-err" textAnchor="middle">✗ {r.err}</text>}

      <text x="450" y="465" className="cmp-foot" textAnchor="middle">
        {on('gap') ? 'a few passes, each lowering the code toward the machine'
          : on('lex') ? 'characters → tokens: the compiler now reasons about words'
          : on('parse') ? 'tokens → a tree: precedence and grouping become structure'
          : on('codegen') ? 'post-order walk: operands first, then the operation'
          : (r.err ? 'fix the expression above' : 'real lexer + parser + codegen — the output is produced from your input')}
      </text>
    </svg>
  );
}
