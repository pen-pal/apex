// Multi-language code examples, part 2 — see langSamples.ts. Split out only to keep either file under the 800-line
// review limit; the two are merged in langSamples.ts. Every snippet is verified by scripts/verify-code-examples.mjs.
import type { ExampleSet } from './langSampleTypes';

export const EXTRA_EXAMPLES: Record<string, ExampleSet> = {
  sorting: {
    intro: 'Quicksort — partition around a pivot, recurse on each side. Sorting [5,2,9,1,5,6,3] gives 1 2 3 5 5 6 9. (C uses in-place Lomuto partitioning; C++ uses the standard library sort.)',
    expect: '1 2 3 5 5 6 9',
    snippets: [
      { lang: 'python', code: `def quicksort(a):
    if len(a) <= 1:
        return a
    pivot = a[len(a) // 2]
    less = [x for x in a if x < pivot]
    equal = [x for x in a if x == pivot]
    greater = [x for x in a if x > pivot]
    return quicksort(less) + equal + quicksort(greater)

print(" ".join(map(str, quicksort([5, 2, 9, 1, 5, 6, 3]))))` },
      { lang: 'go', code: `package main

import (
	"fmt"
	"strconv"
	"strings"
)

func quicksort(a []int) []int {
	if len(a) <= 1 {
		return a
	}
	pivot := a[len(a)/2]
	var less, equal, greater []int
	for _, x := range a {
		switch {
		case x < pivot:
			less = append(less, x)
		case x == pivot:
			equal = append(equal, x)
		default:
			greater = append(greater, x)
		}
	}
	out := append(quicksort(less), equal...)
	return append(out, quicksort(greater)...)
}

func main() {
	a := quicksort([]int{5, 2, 9, 1, 5, 6, 3})
	s := make([]string, len(a))
	for i, x := range a {
		s[i] = strconv.Itoa(x)
	}
	fmt.Println(strings.Join(s, " "))
}` },
      { lang: 'rust', code: `fn quicksort(a: Vec<i64>) -> Vec<i64> {
    if a.len() <= 1 {
        return a;
    }
    let pivot = a[a.len() / 2];
    let less: Vec<i64> = a.iter().filter(|&&x| x < pivot).cloned().collect();
    let equal: Vec<i64> = a.iter().filter(|&&x| x == pivot).cloned().collect();
    let greater: Vec<i64> = a.iter().filter(|&&x| x > pivot).cloned().collect();
    let mut out = quicksort(less);
    out.extend(equal);
    out.extend(quicksort(greater));
    out
}

fn main() {
    let sorted = quicksort(vec![5, 2, 9, 1, 5, 6, 3]);
    println!("{}", sorted.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" "));
}` },
      { lang: 'c', code: `#include <stdio.h>

void quicksort(int *a, int lo, int hi) {   // in-place Lomuto partition
    if (lo >= hi) return;
    int pivot = a[hi], i = lo;
    for (int j = lo; j < hi; j++)
        if (a[j] < pivot) { int t = a[i]; a[i] = a[j]; a[j] = t; i++; }
    int t = a[i]; a[i] = a[hi]; a[hi] = t;
    quicksort(a, lo, i - 1);
    quicksort(a, i + 1, hi);
}

int main(void) {
    int a[] = {5, 2, 9, 1, 5, 6, 3}, n = 7;
    quicksort(a, 0, n - 1);
    for (int i = 0; i < n; i++) printf("%d%s", a[i], i + 1 < n ? " " : "\\n");
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> a = {5, 2, 9, 1, 5, 6, 3};
    std::sort(a.begin(), a.end());
    for (size_t i = 0; i < a.size(); i++)
        std::cout << a[i] << (i + 1 < a.size() ? " " : "\\n");
}` },
    ],
  },

  quickselect: {
    intro: 'Quickselect — find the k-th smallest element without fully sorting, by partitioning and recursing into only the side that holds the answer (average O(n)). The 3rd smallest of [7,10,4,3,20,15] is 7.',
    expect: '7',
    snippets: [
      { lang: 'python', code: `def quickselect(a, k):            # k-th smallest, 1-indexed
    a = a[:]
    lo, hi, target = 0, len(a) - 1, k - 1
    while True:
        pivot, i = a[hi], lo
        for j in range(lo, hi):
            if a[j] < pivot:
                a[i], a[j] = a[j], a[i]
                i += 1
        a[i], a[hi] = a[hi], a[i]
        if i == target:
            return a[i]
        if i < target:
            lo = i + 1
        else:
            hi = i - 1

print(quickselect([7, 10, 4, 3, 20, 15], 3))` },
      { lang: 'go', code: `package main

import "fmt"

func quickselect(a []int, k int) int {
	a = append([]int(nil), a...)
	lo, hi, target := 0, len(a)-1, k-1
	for {
		pivot, i := a[hi], lo
		for j := lo; j < hi; j++ {
			if a[j] < pivot {
				a[i], a[j] = a[j], a[i]
				i++
			}
		}
		a[i], a[hi] = a[hi], a[i]
		if i == target {
			return a[i]
		}
		if i < target {
			lo = i + 1
		} else {
			hi = i - 1
		}
	}
}

func main() { fmt.Println(quickselect([]int{7, 10, 4, 3, 20, 15}, 3)) }` },
      { lang: 'rust', code: `fn quickselect(a: &[i64], k: usize) -> i64 {
    let mut a = a.to_vec();
    let (mut lo, mut hi, target) = (0usize, a.len() - 1, k - 1);
    loop {
        let pivot = a[hi];
        let mut i = lo;
        for j in lo..hi {
            if a[j] < pivot {
                a.swap(i, j);
                i += 1;
            }
        }
        a.swap(i, hi);
        if i == target {
            return a[i];
        }
        if i < target {
            lo = i + 1;
        } else {
            hi = i - 1;
        }
    }
}

fn main() { println!("{}", quickselect(&[7, 10, 4, 3, 20, 15], 3)); }` },
      { lang: 'c', code: `#include <stdio.h>

int quickselect(int *a, int n, int k) {
    int lo = 0, hi = n - 1, target = k - 1;
    while (1) {
        int pivot = a[hi], i = lo;
        for (int j = lo; j < hi; j++)
            if (a[j] < pivot) { int t = a[i]; a[i] = a[j]; a[j] = t; i++; }
        int t = a[i]; a[i] = a[hi]; a[hi] = t;
        if (i == target) return a[i];
        if (i < target) lo = i + 1; else hi = i - 1;
    }
}

int main(void) {
    int a[] = {7, 10, 4, 3, 20, 15};
    printf("%d\\n", quickselect(a, 6, 3));
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>

int quickselect(std::vector<int> a, int k) {
    int lo = 0, hi = a.size() - 1, target = k - 1;
    while (true) {
        int pivot = a[hi], i = lo;
        for (int j = lo; j < hi; j++)
            if (a[j] < pivot) std::swap(a[i++], a[j]);
        std::swap(a[i], a[hi]);
        if (i == target) return a[i];
        if (i < target) lo = i + 1; else hi = i - 1;
    }
}

int main() { std::cout << quickselect({7, 10, 4, 3, 20, 15}, 3) << "\\n"; }` },
    ],
  },

  fenwick: {
    intro: 'Fenwick tree (binary indexed tree) — prefix sums with point updates, both in O(log n), using the low-bit trick i & (-i) to walk the implicit tree. Built from [3,2,-1,6,5,4,-3,3], the prefix sum of the first six is 3+2-1+6+5+4 = 19.',
    expect: '19',
    snippets: [
      { lang: 'python', code: `def build(a):
    n = len(a)
    tree = [0] * (n + 1)
    for i, v in enumerate(a):
        j = i + 1
        while j <= n:
            tree[j] += v
            j += j & (-j)          # low bit: jump to the next range
    return tree

def prefix_sum(tree, i):           # sum of a[0..i-1]
    s = 0
    while i > 0:
        s += tree[i]
        i -= i & (-i)
    return s

tree = build([3, 2, -1, 6, 5, 4, -3, 3])
print(prefix_sum(tree, 6))` },
      { lang: 'go', code: `package main

import "fmt"

func build(a []int) []int {
	n := len(a)
	tree := make([]int, n+1)
	for i, v := range a {
		for j := i + 1; j <= n; j += j & (-j) {
			tree[j] += v
		}
	}
	return tree
}

func prefixSum(tree []int, i int) int {
	s := 0
	for ; i > 0; i -= i & (-i) {
		s += tree[i]
	}
	return s
}

func main() {
	fmt.Println(prefixSum(build([]int{3, 2, -1, 6, 5, 4, -3, 3}), 6))
}` },
      { lang: 'rust', code: `fn build(a: &[i64]) -> Vec<i64> {
    let n = a.len();
    let mut tree = vec![0i64; n + 1];
    for (i, &v) in a.iter().enumerate() {
        let mut j = i + 1;
        while j <= n {
            tree[j] += v;
            j += j & j.wrapping_neg(); // low bit
        }
    }
    tree
}

fn prefix_sum(tree: &[i64], mut i: usize) -> i64 {
    let mut s = 0;
    while i > 0 {
        s += tree[i];
        i -= i & i.wrapping_neg();
    }
    s
}

fn main() {
    let tree = build(&[3, 2, -1, 6, 5, 4, -3, 3]);
    println!("{}", prefix_sum(&tree, 6));
}` },
      { lang: 'c', code: `#include <stdio.h>

int tree[9];

int main(void) {
    int a[] = {3, 2, -1, 6, 5, 4, -3, 3}, n = 8;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j <= n; j += j & (-j)) tree[j] += a[i];
    int s = 0;
    for (int i = 6; i > 0; i -= i & (-i)) s += tree[i];
    printf("%d\\n", s);
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> a = {3, 2, -1, 6, 5, 4, -3, 3};
    int n = a.size();
    std::vector<int> tree(n + 1, 0);
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j <= n; j += j & (-j)) tree[j] += a[i];
    int s = 0;
    for (int i = 6; i > 0; i -= i & (-i)) s += tree[i];
    std::cout << s << "\\n";
}` },
    ],
  },

  crc32: {
    intro: 'CRC-32 (IEEE 802.3) — the checksum in Ethernet, zip, and PNG, computed bit by bit with the reflected polynomial 0xEDB88320. The check value for the ASCII string "123456789" is cbf43926 — the standard test vector every CRC-32 implementation must reproduce.',
    expect: 'cbf43926',
    snippets: [
      { lang: 'python', code: `def crc32(data):
    crc = 0xFFFFFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1))
    return crc ^ 0xFFFFFFFF

print(format(crc32(b"123456789"), "08x"))` },
      { lang: 'go', code: `package main

import "fmt"

func crc32(data []byte) uint32 {
	crc := uint32(0xFFFFFFFF)
	for _, b := range data {
		crc ^= uint32(b)
		for i := 0; i < 8; i++ {
			crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1))
		}
	}
	return crc ^ 0xFFFFFFFF
}

func main() { fmt.Printf("%08x\\n", crc32([]byte("123456789"))) }` },
      { lang: 'rust', code: `fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &b in data {
        crc ^= b as u32;
        for _ in 0..8 {
            crc = (crc >> 1) ^ (0xEDB88320 & (crc & 1).wrapping_neg());
        }
    }
    crc ^ 0xFFFFFFFF
}

fn main() { println!("{:08x}", crc32(b"123456789")); }` },
      { lang: 'c', code: `#include <stdio.h>
#include <stdint.h>
#include <string.h>

uint32_t crc32(const uint8_t *data, size_t len) {
    uint32_t crc = 0xFFFFFFFF;
    for (size_t k = 0; k < len; k++) {
        crc ^= data[k];
        for (int i = 0; i < 8; i++)
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return crc ^ 0xFFFFFFFF;
}

int main(void) {
    const char *s = "123456789";
    printf("%08x\\n", crc32((const uint8_t *)s, strlen(s)));
}` },
      { lang: 'cpp', code: `#include <cstdio>
#include <cstdint>
#include <string>

uint32_t crc32(const std::string& data) {
    uint32_t crc = 0xFFFFFFFF;
    for (unsigned char b : data) {
        crc ^= b;
        for (int i = 0; i < 8; i++)
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return crc ^ 0xFFFFFFFF;
}

int main() { printf("%08x\\n", crc32("123456789")); }` },
    ],
  },
};
