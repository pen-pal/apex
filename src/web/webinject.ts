// Injection attacks (SQLi & XSS), and the one idea that stops both: keep untrusted input
// as DATA, never let it become CODE. SQL injection happens when input is concatenated
// into a query so a quote can close the string literal and the rest is parsed as SQL;
// parameterized queries bind the value out-of-band so quotes stay data. Cross-site
// scripting happens when input is dropped into HTML so a '<' can start a <script> or an
// event-handler element; HTML-escaping turns '<' into '&lt;' so it can only be text.
// This models the exact boundary — what breaks out, and how the fix neutralizes it.
// Pure and tested against canonical OWASP payloads.

// ── SQL injection ──────────────────────────────────────────────────────────────
export interface SqliAnalysis {
  concatQuery: string;   // the query a naive string-concatenation builds
  breaksOut: boolean;    // input contains a quote that closes the '...' literal
  comments: boolean;     // input contains a SQL comment that truncates the rest
  tautology: boolean;    // input adds an always-true condition (OR 1=1 / OR 'a'='a')
  vulnerable: boolean;
}

const TEMPLATE = "SELECT * FROM users WHERE name = '<INPUT>'";

export function analyzeSqli(input: string): SqliAnalysis {
  const concatQuery = TEMPLATE.replace('<INPUT>', input);
  const breaksOut = input.includes("'");
  const comments = /--|#|\/\*/.test(input);
  const tautology = /\bor\b\s+('?\w+'?\s*=\s*'?\w+'?|\d+\s*=\s*\d+)/i.test(input);
  return { concatQuery, breaksOut, comments, tautology, vulnerable: breaksOut && (comments || tautology || /;\s*\w/.test(input)) };
}

/** The parameterized form: the value is bound separately, so it is never parsed as SQL. */
export function parameterizedSqli(input: string): { query: string; boundParam: string; vulnerable: boolean } {
  return { query: "SELECT * FROM users WHERE name = ?", boundParam: input, vulnerable: false };
}

// ── Cross-site scripting ───────────────────────────────────────────────────────
const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** OWASP HTML-context escaping. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

/** Would this string execute script if dropped into an HTML body context? Each vector
 *  requires a LIVE tag (a raw '<'), so HTML-escaping — which removes every raw '<' —
 *  neutralizes all of them. A bare "javascript:" in text is harmless and not flagged. */
function executes(html: string): boolean {
  return /<\s*script/i.test(html)            // a <script> element
    || /<[^>]+\son\w+\s*=/i.test(html)       // a tag with an on*= event handler
    || /<[^>]+javascript:/i.test(html);      // a tag attribute with a javascript: URL
}

export interface XssAnalysis {
  rawHtml: string;
  escapedHtml: string;
  executesRaw: boolean;     // unescaped insertion runs the payload
  executesEscaped: boolean; // after escaping it cannot
}

export function analyzeXss(input: string): XssAnalysis {
  const rawHtml = `<div class="comment">${input}</div>`;
  const escapedHtml = `<div class="comment">${escapeHtml(input)}</div>`;
  return { rawHtml, escapedHtml, executesRaw: executes(rawHtml), executesEscaped: executes(escapedHtml) };
}
