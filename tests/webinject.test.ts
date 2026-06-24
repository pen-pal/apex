import { describe, it, expect } from 'vitest';
import { analyzeSqli, parameterizedSqli, escapeHtml, analyzeXss } from '../src/web/webinject';

describe('SQL injection (string concatenation vs parameterized)', () => {
  it('a benign name is not vulnerable', () => {
    const a = analyzeSqli('Robert');
    expect(a.breaksOut).toBe(false);
    expect(a.vulnerable).toBe(false);
    expect(a.concatQuery).toBe("SELECT * FROM users WHERE name = 'Robert'");
  });

  it("the classic ' OR '1'='1 tautology breaks out and is vulnerable", () => {
    const a = analyzeSqli("' OR '1'='1");
    expect(a.breaksOut).toBe(true);
    expect(a.tautology).toBe(true);
    expect(a.vulnerable).toBe(true);
  });

  it("admin'-- comments out the rest of the query", () => {
    const a = analyzeSqli("admin'--");
    expect(a.breaksOut).toBe(true);
    expect(a.comments).toBe(true);
    expect(a.vulnerable).toBe(true);
  });

  it('a stacked "; DROP TABLE" query is flagged', () => {
    expect(analyzeSqli("x'; DROP TABLE users; --").vulnerable).toBe(true);
  });

  it('parameterized queries are never vulnerable — the input stays bound data', () => {
    const p = parameterizedSqli("' OR '1'='1");
    expect(p.vulnerable).toBe(false);
    expect(p.query).toBe('SELECT * FROM users WHERE name = ?');
    expect(p.boundParam).toBe("' OR '1'='1"); // preserved verbatim, never parsed
  });
});

describe('HTML escaping (the XSS fix)', () => {
  it('escapes the five dangerous HTML characters', () => {
    expect(escapeHtml(`<script>"&'`)).toBe('&lt;script&gt;&quot;&amp;&#39;');
  });
});

describe('cross-site scripting', () => {
  it('a <script> payload executes when inserted unescaped, not when escaped', () => {
    const a = analyzeXss('<script>alert(1)</script>');
    expect(a.executesRaw).toBe(true);
    expect(a.executesEscaped).toBe(false);
    expect(a.escapedHtml).toContain('&lt;script&gt;');
  });

  it('an event-handler payload also executes raw but not escaped', () => {
    const a = analyzeXss('<img src=x onerror=alert(1)>');
    expect(a.executesRaw).toBe(true);
    expect(a.executesEscaped).toBe(false);
  });

  it('plain text is safe either way', () => {
    const a = analyzeXss('hello world');
    expect(a.executesRaw).toBe(false);
    expect(a.executesEscaped).toBe(false);
  });
});
