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

  heap: {
    intro: 'Heapsort — build a binary max-heap in place, then repeatedly swap the largest to the end and sift the root down. O(n log n), no extra memory. [5,2,9,1,5,6,3] sorts to 1 2 3 5 5 6 9.',
    expect: '1 2 3 5 5 6 9',
    snippets: [
      { lang: 'python', code: `def heapsort(a):
    n = len(a)
    def sift_down(start, end):
        root = start
        while 2*root + 1 <= end:
            child = 2*root + 1
            if child + 1 <= end and a[child] < a[child+1]:
                child += 1
            if a[root] < a[child]:
                a[root], a[child] = a[child], a[root]
                root = child
            else:
                return
    for start in range(n//2 - 1, -1, -1):   # build the heap
        sift_down(start, n-1)
    for end in range(n-1, 0, -1):           # repeatedly extract the max
        a[0], a[end] = a[end], a[0]
        sift_down(0, end-1)
    return a

print(" ".join(map(str, heapsort([5, 2, 9, 1, 5, 6, 3]))))` },
      { lang: 'go', code: `package main

import (
	"fmt"
	"strconv"
	"strings"
)

func siftDown(a []int, start, end int) {
	root := start
	for 2*root+1 <= end {
		child := 2*root + 1
		if child+1 <= end && a[child] < a[child+1] {
			child++
		}
		if a[root] < a[child] {
			a[root], a[child] = a[child], a[root]
			root = child
		} else {
			return
		}
	}
}

func heapsort(a []int) []int {
	n := len(a)
	for start := n/2 - 1; start >= 0; start-- {
		siftDown(a, start, n-1)
	}
	for end := n - 1; end > 0; end-- {
		a[0], a[end] = a[end], a[0]
		siftDown(a, 0, end-1)
	}
	return a
}

func main() {
	a := heapsort([]int{5, 2, 9, 1, 5, 6, 3})
	s := make([]string, len(a))
	for i, x := range a {
		s[i] = strconv.Itoa(x)
	}
	fmt.Println(strings.Join(s, " "))
}` },
      { lang: 'rust', code: `fn sift_down(a: &mut Vec<i64>, start: usize, end: usize) {
    let mut root = start;
    while 2*root + 1 <= end {
        let mut child = 2*root + 1;
        if child + 1 <= end && a[child] < a[child+1] { child += 1; }
        if a[root] < a[child] { a.swap(root, child); root = child; } else { return; }
    }
}

fn heapsort(mut a: Vec<i64>) -> Vec<i64> {
    let n = a.len();
    for start in (0..n/2).rev() { sift_down(&mut a, start, n-1); }
    for end in (1..n).rev() { a.swap(0, end); sift_down(&mut a, 0, end-1); }
    a
}

fn main() {
    let sorted = heapsort(vec![5, 2, 9, 1, 5, 6, 3]);
    println!("{}", sorted.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" "));
}` },
      { lang: 'c', code: `#include <stdio.h>

void sift_down(int *a, int start, int end) {
    int root = start;
    while (2*root + 1 <= end) {
        int child = 2*root + 1;
        if (child + 1 <= end && a[child] < a[child+1]) child++;
        if (a[root] < a[child]) { int t = a[root]; a[root] = a[child]; a[child] = t; root = child; }
        else return;
    }
}

int main(void) {
    int a[] = {5, 2, 9, 1, 5, 6, 3}, n = 7;
    for (int start = n/2 - 1; start >= 0; start--) sift_down(a, start, n-1);
    for (int end = n-1; end > 0; end--) { int t = a[0]; a[0] = a[end]; a[end] = t; sift_down(a, 0, end-1); }
    for (int i = 0; i < n; i++) printf("%d%s", a[i], i+1 < n ? " " : "\\n");
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>

void sift_down(std::vector<int>& a, int start, int end) {
    int root = start;
    while (2*root + 1 <= end) {
        int child = 2*root + 1;
        if (child + 1 <= end && a[child] < a[child+1]) child++;
        if (a[root] < a[child]) { std::swap(a[root], a[child]); root = child; }
        else return;
    }
}

int main() {
    std::vector<int> a = {5, 2, 9, 1, 5, 6, 3};
    int n = a.size();
    for (int start = n/2 - 1; start >= 0; start--) sift_down(a, start, n-1);
    for (int end = n-1; end > 0; end--) { std::swap(a[0], a[end]); sift_down(a, 0, end-1); }
    for (int i = 0; i < n; i++) std::cout << a[i] << (i+1 < n ? " " : "\\n");
}` },
    ],
  },

  bellmanford: {
    intro: 'Bellman-Ford — single-source shortest paths that, unlike Dijkstra, handles negative edge weights by relaxing every edge V-1 times. On the CLRS example graph (which has negative edges) the shortest distance from node 0 to node 3 is 4.',
    expect: '4',
    snippets: [
      { lang: 'python', code: `def bellman_ford(n, edges, src, dst):
    INF = float("inf")
    dist = [INF] * n
    dist[src] = 0
    for _ in range(n - 1):                    # relax every edge V-1 times
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    return dist[dst]

edges = [(0,1,6),(0,2,7),(1,2,8),(1,3,5),(1,4,-4),(2,3,-3),(2,4,9),(3,1,-2),(4,0,2),(4,3,7)]
print(bellman_ford(5, edges, 0, 3))` },
      { lang: 'go', code: `package main

import "fmt"

func bellmanFord(n int, edges [][3]int, src, dst int) int {
	const INF = 1 << 30
	dist := make([]int, n)
	for i := range dist {
		dist[i] = INF
	}
	dist[src] = 0
	for k := 0; k < n-1; k++ {
		for _, e := range edges {
			u, v, w := e[0], e[1], e[2]
			if dist[u] != INF && dist[u]+w < dist[v] {
				dist[v] = dist[u] + w
			}
		}
	}
	return dist[dst]
}

func main() {
	edges := [][3]int{{0, 1, 6}, {0, 2, 7}, {1, 2, 8}, {1, 3, 5}, {1, 4, -4}, {2, 3, -3}, {2, 4, 9}, {3, 1, -2}, {4, 0, 2}, {4, 3, 7}}
	fmt.Println(bellmanFord(5, edges, 0, 3))
}` },
      { lang: 'rust', code: `fn bellman_ford(n: usize, edges: &[(usize, usize, i64)], src: usize, dst: usize) -> i64 {
    const INF: i64 = 1 << 30;
    let mut dist = vec![INF; n];
    dist[src] = 0;
    for _ in 0..n - 1 {
        for &(u, v, w) in edges {
            if dist[u] != INF && dist[u] + w < dist[v] {
                dist[v] = dist[u] + w;
            }
        }
    }
    dist[dst]
}

fn main() {
    let edges = [(0,1,6),(0,2,7),(1,2,8),(1,3,5),(1,4,-4),(2,3,-3),(2,4,9),(3,1,-2),(4,0,2),(4,3,7)];
    println!("{}", bellman_ford(5, &edges, 0, 3));
}` },
      { lang: 'c', code: `#include <stdio.h>
#define INF (1 << 30)

int main(void) {
    int edges[10][3] = {{0,1,6},{0,2,7},{1,2,8},{1,3,5},{1,4,-4},{2,3,-3},{2,4,9},{3,1,-2},{4,0,2},{4,3,7}};
    int n = 5, dist[5];
    for (int i = 0; i < n; i++) dist[i] = INF;
    dist[0] = 0;
    for (int k = 0; k < n - 1; k++)
        for (int e = 0; e < 10; e++) {
            int u = edges[e][0], v = edges[e][1], w = edges[e][2];
            if (dist[u] != INF && dist[u] + w < dist[v]) dist[v] = dist[u] + w;
        }
    printf("%d\\n", dist[3]);
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <array>

int main() {
    const int INF = 1 << 30;
    std::vector<std::array<int,3>> edges = {{0,1,6},{0,2,7},{1,2,8},{1,3,5},{1,4,-4},{2,3,-3},{2,4,9},{3,1,-2},{4,0,2},{4,3,7}};
    int n = 5;
    std::vector<int> dist(n, INF);
    dist[0] = 0;
    for (int k = 0; k < n - 1; k++)
        for (auto& e : edges)
            if (dist[e[0]] != INF && dist[e[0]] + e[2] < dist[e[1]]) dist[e[1]] = dist[e[0]] + e[2];
    std::cout << dist[3] << "\\n";
}` },
    ],
  },

  huffman: {
    intro: 'Huffman coding cost — repeatedly merge the two least-frequent nodes; each merge adds one bit to every symbol beneath it, so the running sum of merge weights is the total encoded size. For "abracadabra" (a:5 b:2 r:2 c:1 d:1) that total is 23 bits — an invariant even though the specific codes can differ.',
    expect: '23',
    snippets: [
      { lang: 'python', code: `import heapq

def huffman_bits(freqs):
    heap = list(freqs)
    heapq.heapify(heap)
    total = 0
    while len(heap) > 1:
        a = heapq.heappop(heap)
        b = heapq.heappop(heap)
        total += a + b            # this merge adds a bit to every symbol below it
        heapq.heappush(heap, a + b)
    return total

print(huffman_bits([5, 2, 2, 1, 1]))   # letter counts of "abracadabra"` },
      { lang: 'go', code: `package main

import (
	"container/heap"
	"fmt"
)

type IntHeap []int

func (h IntHeap) Len() int            { return len(h) }
func (h IntHeap) Less(i, j int) bool  { return h[i] < h[j] }
func (h IntHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *IntHeap) Push(x any)         { *h = append(*h, x.(int)) }
func (h *IntHeap) Pop() any           { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

func huffmanBits(freqs []int) int {
	h := IntHeap(append([]int(nil), freqs...))
	heap.Init(&h)
	total := 0
	for h.Len() > 1 {
		a := heap.Pop(&h).(int)
		b := heap.Pop(&h).(int)
		total += a + b
		heap.Push(&h, a+b)
	}
	return total
}

func main() { fmt.Println(huffmanBits([]int{5, 2, 2, 1, 1})) }` },
      { lang: 'rust', code: `use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn huffman_bits(freqs: &[i64]) -> i64 {
    let mut heap: BinaryHeap<Reverse<i64>> = freqs.iter().map(|&f| Reverse(f)).collect();
    let mut total = 0;
    while heap.len() > 1 {
        let Reverse(a) = heap.pop().unwrap();
        let Reverse(b) = heap.pop().unwrap();
        total += a + b;
        heap.push(Reverse(a + b));
    }
    total
}

fn main() { println!("{}", huffman_bits(&[5, 2, 2, 1, 1])); }` },
      { lang: 'c', code: `#include <stdio.h>

int extract_min(int *heap, int *size) {   // linear-scan min extraction
    int mi = 0;
    for (int i = 1; i < *size; i++) if (heap[i] < heap[mi]) mi = i;
    int v = heap[mi];
    heap[mi] = heap[--(*size)];
    return v;
}

int main(void) {
    int heap[] = {5, 2, 2, 1, 1}, size = 5, total = 0;
    while (size > 1) {
        int a = extract_min(heap, &size);
        int b = extract_min(heap, &size);
        total += a + b;
        heap[size++] = a + b;
    }
    printf("%d\\n", total);
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <queue>
#include <vector>

int huffman_bits(std::vector<int> freqs) {
    std::priority_queue<int, std::vector<int>, std::greater<int>> pq(freqs.begin(), freqs.end());
    int total = 0;
    while (pq.size() > 1) {
        int a = pq.top(); pq.pop();
        int b = pq.top(); pq.pop();
        total += a + b;
        pq.push(a + b);
    }
    return total;
}

int main() { std::cout << huffman_bits({5, 2, 2, 1, 1}) << "\\n"; }` },
    ],
  },
};
