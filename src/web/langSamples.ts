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
};

export const hasExamples = (id: string): boolean => id in CODE_EXAMPLES;
export const examplesFor = (id: string): ExampleSet | undefined => CODE_EXAMPLES[id];
