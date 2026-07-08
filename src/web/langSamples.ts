// Multi-language reference implementations for a section's core idea, shown beside the tested TypeScript model. These
// are read-only examples (Apex stays a static, offline, no-backend page — it doesn't execute them). They are kept
// honest instead of plausible-looking: every snippet prints the same `expect` value, and scripts/verify-code-examples.mjs
// compiles and runs each one (Python/Go/Rust/C/C++) and asserts that output — so a wrong sample fails the check, not the
// reader. Start small: one section, grown deliberately.

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

export const CODE_EXAMPLES: Record<string, ExampleSet> = {
  kadane: {
    intro: 'Kadane’s algorithm — the maximum sum of any contiguous subarray, in one pass. On [-2,1,-3,4,-1,2,1,-5,4] the best run is [4,-1,2,1], summing to 6.',
    expect: '6',
    snippets: [
      { lang: 'python', code: `def max_subarray(a):
    best = cur = a[0]
    for x in a[1:]:
        cur = max(x, cur + x)   # extend the run, or start fresh at x
        best = max(best, cur)
    return best

print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))` },
      { lang: 'go', code: `package main

import "fmt"

func maxSubarray(a []int) int {
	best, cur := a[0], a[0]
	for _, x := range a[1:] {
		if cur+x < x {
			cur = x
		} else {
			cur += x
		}
		if cur > best {
			best = cur
		}
	}
	return best
}

func main() {
	fmt.Println(maxSubarray([]int{-2, 1, -3, 4, -1, 2, 1, -5, 4}))
}` },
      { lang: 'rust', code: `fn max_subarray(a: &[i64]) -> i64 {
    let (mut best, mut cur) = (a[0], a[0]);
    for &x in &a[1..] {
        cur = x.max(cur + x); // extend the run, or start fresh at x
        best = best.max(cur);
    }
    best
}

fn main() {
    println!("{}", max_subarray(&[-2, 1, -3, 4, -1, 2, 1, -5, 4]));
}` },
      { lang: 'c', code: `#include <stdio.h>

long max_subarray(const long *a, int n) {
    long best = a[0], cur = a[0];
    for (int i = 1; i < n; i++) {
        cur = a[i] > cur + a[i] ? a[i] : cur + a[i];
        if (cur > best) best = cur;
    }
    return best;
}

int main(void) {
    long a[] = {-2, 1, -3, 4, -1, 2, 1, -5, 4};
    printf("%ld\\n", max_subarray(a, 9));
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <algorithm>

long max_subarray(const std::vector<long>& a) {
    long best = a[0], cur = a[0];
    for (size_t i = 1; i < a.size(); i++) {
        cur = std::max(a[i], cur + a[i]);
        best = std::max(best, cur);
    }
    return best;
}

int main() {
    std::cout << max_subarray({-2, 1, -3, 4, -1, 2, 1, -5, 4}) << "\\n";
}` },
    ],
  },
  editdist: {
    intro: 'Levenshtein edit distance — the fewest single-character insertions, deletions, or substitutions to turn one string into another. "kitten" → "sitting" is 3 (substitute k→s, e→i, insert g).',
    expect: '3',
    snippets: [
      { lang: 'python', code: `def edit_distance(a, b):
    m, n = len(a), len(b)
    dp = list(range(n + 1))          # one row of the DP table
    for i in range(1, m + 1):
        prev = dp[0]; dp[0] = i
        for j in range(1, n + 1):
            cur = dp[j]
            dp[j] = prev if a[i-1] == b[j-1] else 1 + min(dp[j], dp[j-1], prev)
            prev = cur
    return dp[n]

print(edit_distance("kitten", "sitting"))` },
      { lang: 'go', code: `package main

import "fmt"

func editDistance(a, b string) int {
	m, n := len(a), len(b)
	dp := make([]int, n+1)
	for j := 0; j <= n; j++ {
		dp[j] = j
	}
	for i := 1; i <= m; i++ {
		prev := dp[0]
		dp[0] = i
		for j := 1; j <= n; j++ {
			cur := dp[j]
			if a[i-1] == b[j-1] {
				dp[j] = prev
			} else {
				dp[j] = 1 + min(dp[j], min(dp[j-1], prev))
			}
			prev = cur
		}
	}
	return dp[n]
}

func min(x, y int) int {
	if x < y {
		return x
	}
	return y
}

func main() { fmt.Println(editDistance("kitten", "sitting")) }` },
      { lang: 'rust', code: `fn edit_distance(a: &str, b: &str) -> usize {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    let (m, n) = (a.len(), b.len());
    let mut dp: Vec<usize> = (0..=n).collect();
    for i in 1..=m {
        let mut prev = dp[0];
        dp[0] = i;
        for j in 1..=n {
            let cur = dp[j];
            dp[j] = if a[i-1] == b[j-1] { prev } else { 1 + dp[j].min(dp[j-1]).min(prev) };
            prev = cur;
        }
    }
    dp[n]
}

fn main() { println!("{}", edit_distance("kitten", "sitting")); }` },
      { lang: 'c', code: `#include <stdio.h>
#include <string.h>

int mn(int a, int b) { return a < b ? a : b; }

int edit_distance(const char *a, const char *b) {
    int m = strlen(a), n = strlen(b), dp[64];
    for (int j = 0; j <= n; j++) dp[j] = j;
    for (int i = 1; i <= m; i++) {
        int prev = dp[0]; dp[0] = i;
        for (int j = 1; j <= n; j++) {
            int cur = dp[j];
            dp[j] = a[i-1] == b[j-1] ? prev : 1 + mn(dp[j], mn(dp[j-1], prev));
            prev = cur;
        }
    }
    return dp[n];
}

int main(void) { printf("%d\\n", edit_distance("kitten", "sitting")); }` },
      { lang: 'cpp', code: `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

int edit_distance(const std::string& a, const std::string& b) {
    int m = a.size(), n = b.size();
    std::vector<int> dp(n + 1);
    for (int j = 0; j <= n; j++) dp[j] = j;
    for (int i = 1; i <= m; i++) {
        int prev = dp[0]; dp[0] = i;
        for (int j = 1; j <= n; j++) {
            int cur = dp[j];
            dp[j] = a[i-1] == b[j-1] ? prev : 1 + std::min({dp[j], dp[j-1], prev});
            prev = cur;
        }
    }
    return dp[n];
}

int main() { std::cout << edit_distance("kitten", "sitting") << "\\n"; }` },
    ],
  },

  kmp: {
    intro: 'KMP string search — find a pattern in a text in O(n+m) by precomputing a "failure function" (longest proper prefix that is also a suffix) so a mismatch never rescans text. First index of "ababcabc" in "ababcababcabc" is 5.',
    expect: '5',
    snippets: [
      { lang: 'python', code: `def kmp_search(text, pat):
    lps, k = [0] * len(pat), 0        # failure function
    for i in range(1, len(pat)):
        while k > 0 and pat[i] != pat[k]:
            k = lps[k-1]
        if pat[i] == pat[k]:
            k += 1
        lps[i] = k
    k = 0
    for i in range(len(text)):
        while k > 0 and text[i] != pat[k]:
            k = lps[k-1]
        if text[i] == pat[k]:
            k += 1
        if k == len(pat):
            return i - len(pat) + 1
    return -1

print(kmp_search("ababcababcabc", "ababcabc"))` },
      { lang: 'go', code: `package main

import "fmt"

func kmpSearch(text, pat string) int {
	lps := make([]int, len(pat))
	k := 0
	for i := 1; i < len(pat); i++ {
		for k > 0 && pat[i] != pat[k] {
			k = lps[k-1]
		}
		if pat[i] == pat[k] {
			k++
		}
		lps[i] = k
	}
	k = 0
	for i := 0; i < len(text); i++ {
		for k > 0 && text[i] != pat[k] {
			k = lps[k-1]
		}
		if text[i] == pat[k] {
			k++
		}
		if k == len(pat) {
			return i - len(pat) + 1
		}
	}
	return -1
}

func main() { fmt.Println(kmpSearch("ababcababcabc", "ababcabc")) }` },
      { lang: 'rust', code: `fn kmp_search(text: &str, pat: &str) -> i32 {
    let (text, pat) = (text.as_bytes(), pat.as_bytes());
    let mut lps = vec![0usize; pat.len()];
    let mut k = 0;
    for i in 1..pat.len() {
        while k > 0 && pat[i] != pat[k] { k = lps[k-1]; }
        if pat[i] == pat[k] { k += 1; }
        lps[i] = k;
    }
    k = 0;
    for i in 0..text.len() {
        while k > 0 && text[i] != pat[k] { k = lps[k-1]; }
        if text[i] == pat[k] { k += 1; }
        if k == pat.len() { return (i - pat.len() + 1) as i32; }
    }
    -1
}

fn main() { println!("{}", kmp_search("ababcababcabc", "ababcabc")); }` },
      { lang: 'c', code: `#include <stdio.h>
#include <string.h>

int kmp_search(const char *text, const char *pat) {
    int n = strlen(text), m = strlen(pat), lps[64] = {0}, k = 0;
    for (int i = 1; i < m; i++) {
        while (k > 0 && pat[i] != pat[k]) k = lps[k-1];
        if (pat[i] == pat[k]) k++;
        lps[i] = k;
    }
    k = 0;
    for (int i = 0; i < n; i++) {
        while (k > 0 && text[i] != pat[k]) k = lps[k-1];
        if (text[i] == pat[k]) k++;
        if (k == m) return i - m + 1;
    }
    return -1;
}

int main(void) { printf("%d\\n", kmp_search("ababcababcabc", "ababcabc")); }` },
      { lang: 'cpp', code: `#include <iostream>
#include <string>
#include <vector>

int kmp_search(const std::string& text, const std::string& pat) {
    int n = text.size(), m = pat.size();
    std::vector<int> lps(m, 0);
    int k = 0;
    for (int i = 1; i < m; i++) {
        while (k > 0 && pat[i] != pat[k]) k = lps[k-1];
        if (pat[i] == pat[k]) k++;
        lps[i] = k;
    }
    k = 0;
    for (int i = 0; i < n; i++) {
        while (k > 0 && text[i] != pat[k]) k = lps[k-1];
        if (text[i] == pat[k]) k++;
        if (k == m) return i - m + 1;
    }
    return -1;
}

int main() { std::cout << kmp_search("ababcababcabc", "ababcabc") << "\\n"; }` },
    ],
  },

  unionfind: {
    intro: 'Union-Find (disjoint-set) — track connected components under merges, near-O(1) per op with path compression. Starting with 10 singletons and unioning (0-1,1-2,3-4,5-6,6-7,7-3) leaves 4 components: {0,1,2}, {3,4,5,6,7}, {8}, {9}.',
    expect: '4',
    snippets: [
      { lang: 'python', code: `def count_components(n, edges):
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]   # path halving
            x = parent[x]
        return x
    for a, b in edges:
        parent[find(a)] = find(b)
    return len({find(i) for i in range(n)})

print(count_components(10, [(0,1),(1,2),(3,4),(5,6),(6,7),(7,3)]))` },
      { lang: 'go', code: `package main

import "fmt"

func countComponents(n int, edges [][2]int) int {
	parent := make([]int, n)
	for i := range parent {
		parent[i] = i
	}
	var find func(int) int
	find = func(x int) int {
		for parent[x] != x {
			parent[x] = parent[parent[x]]
			x = parent[x]
		}
		return x
	}
	for _, e := range edges {
		parent[find(e[0])] = find(e[1])
	}
	roots := map[int]bool{}
	for i := 0; i < n; i++ {
		roots[find(i)] = true
	}
	return len(roots)
}

func main() {
	fmt.Println(countComponents(10, [][2]int{{0, 1}, {1, 2}, {3, 4}, {5, 6}, {6, 7}, {7, 3}}))
}` },
      { lang: 'rust', code: `use std::collections::HashSet;

fn find(parent: &mut Vec<usize>, mut x: usize) -> usize {
    while parent[x] != x {
        parent[x] = parent[parent[x]]; // path halving
        x = parent[x];
    }
    x
}

fn count_components(n: usize, edges: &[(usize, usize)]) -> usize {
    let mut parent: Vec<usize> = (0..n).collect();
    for &(a, b) in edges {
        let (ra, rb) = (find(&mut parent, a), find(&mut parent, b));
        parent[ra] = rb;
    }
    (0..n).map(|i| find(&mut parent, i)).collect::<HashSet<_>>().len()
}

fn main() {
    println!("{}", count_components(10, &[(0, 1), (1, 2), (3, 4), (5, 6), (6, 7), (7, 3)]));
}` },
      { lang: 'c', code: `#include <stdio.h>

int parent[10];

int find(int x) {
    while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
}

int main(void) {
    int n = 10, edges[6][2] = {{0,1},{1,2},{3,4},{5,6},{6,7},{7,3}};
    for (int i = 0; i < n; i++) parent[i] = i;
    for (int i = 0; i < 6; i++) parent[find(edges[i][0])] = find(edges[i][1]);
    int count = 0;
    for (int i = 0; i < n; i++) if (find(i) == i) count++;
    printf("%d\\n", count);
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <set>

std::vector<int> parent;

int find(int x) {
    while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
}

int main() {
    int n = 10;
    std::vector<std::pair<int,int>> edges = {{0,1},{1,2},{3,4},{5,6},{6,7},{7,3}};
    parent.resize(n);
    for (int i = 0; i < n; i++) parent[i] = i;
    for (auto& e : edges) parent[find(e.first)] = find(e.second);
    std::set<int> roots;
    for (int i = 0; i < n; i++) roots.insert(find(i));
    std::cout << roots.size() << "\\n";
}` },
    ],
  },

  knapsack: {
    intro: '0/1 knapsack — the most valuable subset of items that fits a weight budget, each item taken at most once. With weights [1,3,4,5], values [1,4,5,7], capacity 7, the best is items 3+4 (weight 7, value 9).',
    expect: '9',
    snippets: [
      { lang: 'python', code: `def knapsack(weights, values, cap):
    dp = [0] * (cap + 1)             # dp[w] = best value in weight w
    for i in range(len(weights)):
        for w in range(cap, weights[i] - 1, -1):   # iterate down so each item is used once
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i])
    return dp[cap]

print(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7))` },
      { lang: 'go', code: `package main

import "fmt"

func knapsack(weights, values []int, cap int) int {
	dp := make([]int, cap+1)
	for i := 0; i < len(weights); i++ {
		for w := cap; w >= weights[i]; w-- {
			if dp[w-weights[i]]+values[i] > dp[w] {
				dp[w] = dp[w-weights[i]] + values[i]
			}
		}
	}
	return dp[cap]
}

func main() { fmt.Println(knapsack([]int{1, 3, 4, 5}, []int{1, 4, 5, 7}, 7)) }` },
      { lang: 'rust', code: `fn knapsack(weights: &[usize], values: &[i64], cap: usize) -> i64 {
    let mut dp = vec![0i64; cap + 1];
    for i in 0..weights.len() {
        for w in (weights[i]..=cap).rev() {   // down so each item is used once
            dp[w] = dp[w].max(dp[w - weights[i]] + values[i]);
        }
    }
    dp[cap]
}

fn main() { println!("{}", knapsack(&[1, 3, 4, 5], &[1, 4, 5, 7], 7)); }` },
      { lang: 'c', code: `#include <stdio.h>

int main(void) {
    int weights[] = {1, 3, 4, 5}, values[] = {1, 4, 5, 7}, cap = 7, dp[8] = {0};
    for (int i = 0; i < 4; i++)
        for (int w = cap; w >= weights[i]; w--) {
            int cand = dp[w - weights[i]] + values[i];
            if (cand > dp[w]) dp[w] = cand;
        }
    printf("%d\\n", dp[cap]);
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> weights = {1, 3, 4, 5}, values = {1, 4, 5, 7};
    int cap = 7;
    std::vector<int> dp(cap + 1, 0);
    for (size_t i = 0; i < weights.size(); i++)
        for (int w = cap; w >= (int)weights[i]; w--)
            dp[w] = std::max(dp[w], dp[w - weights[i]] + values[i]);
    std::cout << dp[cap] << "\\n";
}` },
    ],
  },
};

export const hasExamples = (id: string): boolean => id in CODE_EXAMPLES;
export const examplesFor = (id: string): ExampleSet | undefined => CODE_EXAMPLES[id];
