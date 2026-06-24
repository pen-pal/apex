// Edit distance (Levenshtein, 1965) — the minimum number of single-character insertions,
// deletions, or substitutions to turn one string into another. It's computed by dynamic
// programming: dp[i][j] = the cost to convert the first i characters of a into the first j
// of b. If the current characters match, no new edit is needed (carry the diagonal);
// otherwise it's 1 + the cheapest of deleting (up), inserting (left), or substituting
// (diagonal). Filling the table is O(m·n); tracing back from the bottom-right corner
// recovers the actual edits. It powers diff, spell-checkers, fuzzy search, and DNA
// alignment. Pure, tested against canonical pairs.

export type Op = 'match' | 'substitute' | 'insert' | 'delete';
export interface Edit { op: Op; a: string; b: string }

export interface Result { distance: number; table: number[][]; edits: Edit[] }

export function editDistance(a: string, b: string): Result {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i; // delete all of a's first i chars
  for (let j = 0; j <= n; j++) dp[0][j] = j; // insert all of b's first j chars

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  // backtrace one optimal path from (m,n) to (0,0)
  const edits: Edit[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { edits.push({ op: 'match', a: a[i - 1], b: b[j - 1] }); i--; j--; }
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { edits.push({ op: 'substitute', a: a[i - 1], b: b[j - 1] }); i--; j--; }
    else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { edits.push({ op: 'delete', a: a[i - 1], b: '' }); i--; }
    else { edits.push({ op: 'insert', a: '', b: b[j - 1] }); j--; }
  }
  edits.reverse();
  return { distance: dp[m][n], table: dp, edits };
}
