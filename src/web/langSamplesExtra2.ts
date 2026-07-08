// Multi-language code examples, part 3 — see langSamples.ts. Split out only to keep every data file under the 800-line
// review limit; all three are merged in langSamples.ts. Every snippet is verified by scripts/verify-code-examples.mjs.
import type { ExampleSet } from './langSampleTypes';

export const EXTRA2_EXAMPLES: Record<string, ExampleSet> = {
  varint: {
    intro: 'LEB128 varint — the variable-length integer encoding used by Protocol Buffers and WebAssembly. Each byte carries 7 bits of the number, low group first, with the high bit set to mean "more bytes follow". 624485 encodes to three bytes: e5 8e 26.',
    expect: 'e5 8e 26',
    snippets: [
      { lang: 'python', code: `def leb128(n):
    out = []
    while True:
        byte = n & 0x7F            # low 7 bits
        n >>= 7
        if n:
            out.append(byte | 0x80)  # more bytes follow
        else:
            out.append(byte)
            break
    return out

print(" ".join(f"{b:02x}" for b in leb128(624485)))` },
      { lang: 'go', code: `package main

import (
	"fmt"
	"strings"
)

func leb128(n uint64) []byte {
	var out []byte
	for {
		b := byte(n & 0x7F)
		n >>= 7
		if n != 0 {
			out = append(out, b|0x80)
		} else {
			out = append(out, b)
			break
		}
	}
	return out
}

func main() {
	var parts []string
	for _, b := range leb128(624485) {
		parts = append(parts, fmt.Sprintf("%02x", b))
	}
	fmt.Println(strings.Join(parts, " "))
}` },
      { lang: 'rust', code: `fn leb128(mut n: u64) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let b = (n & 0x7F) as u8;
        n >>= 7;
        if n != 0 {
            out.push(b | 0x80); // more bytes follow
        } else {
            out.push(b);
            break;
        }
    }
    out
}

fn main() {
    let hex: Vec<String> = leb128(624485).iter().map(|b| format!("{:02x}", b)).collect();
    println!("{}", hex.join(" "));
}` },
      { lang: 'c', code: `#include <stdio.h>

int main(void) {
    unsigned long n = 624485;
    unsigned char out[10];
    int len = 0;
    while (1) {
        unsigned char b = n & 0x7F;
        n >>= 7;
        if (n) out[len++] = b | 0x80; else { out[len++] = b; break; }
    }
    for (int i = 0; i < len; i++) printf("%02x%s", out[i], i + 1 < len ? " " : "\\n");
}` },
      { lang: 'cpp', code: `#include <vector>
#include <cstdio>

int main() {
    unsigned long n = 624485;
    std::vector<unsigned char> out;
    while (true) {
        unsigned char b = n & 0x7F;
        n >>= 7;
        if (n) out.push_back(b | 0x80); else { out.push_back(b); break; }
    }
    for (size_t i = 0; i < out.size(); i++) printf("%02x%s", out[i], i + 1 < out.size() ? " " : "\\n");
}` },
    ],
  },

  base58: {
    intro: 'Base58 — the text encoding behind Bitcoin addresses and IPFS CIDs, dropping the ambiguous 0/O/I/l. The bytes are one big base-256 number, repeatedly divided by 58 (done here as long division over a digit array, so no bignum library is needed); the 5 bytes of "Hello" encode to 9Ajdvzr.',
    expect: '9Ajdvzr',
    snippets: [
      { lang: 'python', code: `ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def base58(data):
    n = int.from_bytes(bytes(data), "big")
    out = ""
    while n > 0:
        n, r = divmod(n, 58)
        out = ALPHABET[r] + out
    for b in data:              # leading zero bytes become leading '1's
        if b == 0:
            out = "1" + out
        else:
            break
    return out

print(base58([72, 101, 108, 108, 111]))   # "Hello"` },
      { lang: 'go', code: `package main

import "fmt"

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

func base58(data []byte) string {
	digits := []int{0}
	for _, b := range data { // long division: base-256 in, base-58 out
		carry := int(b)
		for j := range digits {
			carry += digits[j] << 8
			digits[j] = carry % 58
			carry /= 58
		}
		for carry > 0 {
			digits = append(digits, carry%58)
			carry /= 58
		}
	}
	out := ""
	for _, b := range data {
		if b == 0 {
			out += "1"
		} else {
			break
		}
	}
	for i := len(digits) - 1; i >= 0; i-- {
		out += string(alphabet[digits[i]])
	}
	return out
}

func main() { fmt.Println(base58([]byte{72, 101, 108, 108, 111})) }` },
      { lang: 'rust', code: `const ALPHABET: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

fn base58(data: &[u8]) -> String {
    let mut digits = vec![0u32];
    for &b in data {
        let mut carry = b as u32;
        for d in digits.iter_mut() {
            carry += *d << 8;
            *d = carry % 58;
            carry /= 58;
        }
        while carry > 0 {
            digits.push(carry % 58);
            carry /= 58;
        }
    }
    let mut out = String::new();
    for &b in data {
        if b == 0 { out.push('1'); } else { break; }
    }
    for &d in digits.iter().rev() {
        out.push(ALPHABET[d as usize] as char);
    }
    out
}

fn main() { println!("{}", base58(&[72, 101, 108, 108, 111])); }` },
      { lang: 'c', code: `#include <stdio.h>

int main(void) {
    const char *alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    unsigned char data[] = {72, 101, 108, 108, 111};   // "Hello"
    int n = 5, digits[32], dlen = 1;
    digits[0] = 0;
    for (int i = 0; i < n; i++) {
        int carry = data[i];
        for (int j = 0; j < dlen; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry /= 58; }
        while (carry > 0) { digits[dlen++] = carry % 58; carry /= 58; }
    }
    for (int i = 0; i < n && data[i] == 0; i++) putchar('1');
    for (int i = dlen - 1; i >= 0; i--) putchar(alphabet[digits[i]]);
    putchar('\\n');
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <string>

int main() {
    const std::string alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    std::vector<unsigned char> data = {72, 101, 108, 108, 111};  // "Hello"
    std::vector<int> digits = {0};
    for (unsigned char b : data) {
        int carry = b;
        for (int& d : digits) { carry += d << 8; d = carry % 58; carry /= 58; }
        while (carry > 0) { digits.push_back(carry % 58); carry /= 58; }
    }
    std::string out;
    for (unsigned char b : data) { if (b == 0) out += '1'; else break; }
    for (auto it = digits.rbegin(); it != digits.rend(); ++it) out += alphabet[*it];
    std::cout << out << "\\n";
}` },
    ],
  },

  maxflow: {
    intro: 'Edmonds-Karp maximum flow — repeatedly find a shortest augmenting path (by BFS) in the residual graph and push as much flow as its tightest edge allows, until no path from source to sink remains. On the classic CLRS network the maximum flow from node 0 to node 5 is 23.',
    expect: '23',
    snippets: [
      { lang: 'python', code: `from collections import deque

def max_flow(cap, s, t):
    n = len(cap)
    flow = 0
    while True:
        parent = [-1] * n
        parent[s] = s
        q = deque([s])
        while q:                       # BFS for a shortest augmenting path
            u = q.popleft()
            for v in range(n):
                if parent[v] == -1 and cap[u][v] > 0:
                    parent[v] = u
                    q.append(v)
        if parent[t] == -1:
            break
        f, v = float("inf"), t
        while v != s:
            f = min(f, cap[parent[v]][v]); v = parent[v]
        v = t
        while v != s:
            cap[parent[v]][v] -= f; cap[v][parent[v]] += f; v = parent[v]
        flow += f
    return flow

n = 6
cap = [[0] * n for _ in range(n)]
for u, v, c in [(0,1,16),(0,2,13),(1,3,12),(2,1,4),(2,4,14),(3,2,9),(3,5,20),(4,3,7),(4,5,4)]:
    cap[u][v] = c
print(max_flow(cap, 0, 5))` },
      { lang: 'go', code: `package main

import "fmt"

func maxFlow(cap [][]int, s, t int) int {
	n := len(cap)
	flow := 0
	for {
		parent := make([]int, n)
		for i := range parent {
			parent[i] = -1
		}
		parent[s] = s
		queue := []int{s}
		for len(queue) > 0 {
			u := queue[0]
			queue = queue[1:]
			for v := 0; v < n; v++ {
				if parent[v] == -1 && cap[u][v] > 0 {
					parent[v] = u
					queue = append(queue, v)
				}
			}
		}
		if parent[t] == -1 {
			break
		}
		f := 1 << 30
		for v := t; v != s; v = parent[v] {
			if cap[parent[v]][v] < f {
				f = cap[parent[v]][v]
			}
		}
		for v := t; v != s; v = parent[v] {
			cap[parent[v]][v] -= f
			cap[v][parent[v]] += f
		}
		flow += f
	}
	return flow
}

func main() {
	n := 6
	cap := make([][]int, n)
	for i := range cap {
		cap[i] = make([]int, n)
	}
	edges := [][3]int{{0, 1, 16}, {0, 2, 13}, {1, 3, 12}, {2, 1, 4}, {2, 4, 14}, {3, 2, 9}, {3, 5, 20}, {4, 3, 7}, {4, 5, 4}}
	for _, e := range edges {
		cap[e[0]][e[1]] = e[2]
	}
	fmt.Println(maxFlow(cap, 0, 5))
}` },
      { lang: 'rust', code: `use std::collections::VecDeque;

fn max_flow(cap: &mut Vec<Vec<i64>>, s: usize, t: usize) -> i64 {
    let n = cap.len();
    let mut flow = 0;
    loop {
        let mut parent = vec![usize::MAX; n];
        parent[s] = s;
        let mut q = VecDeque::from([s]);
        while let Some(u) = q.pop_front() {
            for v in 0..n {
                if parent[v] == usize::MAX && cap[u][v] > 0 {
                    parent[v] = u;
                    q.push_back(v);
                }
            }
        }
        if parent[t] == usize::MAX {
            break;
        }
        let (mut f, mut v) = (i64::MAX, t);
        while v != s {
            f = f.min(cap[parent[v]][v]);
            v = parent[v];
        }
        v = t;
        while v != s {
            cap[parent[v]][v] -= f;
            cap[v][parent[v]] += f;
            v = parent[v];
        }
        flow += f;
    }
    flow
}

fn main() {
    let n = 6;
    let mut cap = vec![vec![0i64; n]; n];
    for &(u, v, c) in &[(0,1,16),(0,2,13),(1,3,12),(2,1,4),(2,4,14),(3,2,9),(3,5,20),(4,3,7),(4,5,4)] {
        cap[u][v] = c;
    }
    println!("{}", max_flow(&mut cap, 0, 5));
}` },
      { lang: 'c', code: `#include <stdio.h>
#define N 6

int cap[N][N];

int max_flow(int s, int t) {
    int flow = 0;
    while (1) {
        int parent[N], queue[N], head = 0, tail = 0;
        for (int i = 0; i < N; i++) parent[i] = -1;
        parent[s] = s; queue[tail++] = s;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < N; v++)
                if (parent[v] == -1 && cap[u][v] > 0) { parent[v] = u; queue[tail++] = v; }
        }
        if (parent[t] == -1) break;
        int f = 1 << 30;
        for (int v = t; v != s; v = parent[v]) if (cap[parent[v]][v] < f) f = cap[parent[v]][v];
        for (int v = t; v != s; v = parent[v]) { cap[parent[v]][v] -= f; cap[v][parent[v]] += f; }
        flow += f;
    }
    return flow;
}

int main(void) {
    int edges[9][3] = {{0,1,16},{0,2,13},{1,3,12},{2,1,4},{2,4,14},{3,2,9},{3,5,20},{4,3,7},{4,5,4}};
    for (int i = 0; i < 9; i++) cap[edges[i][0]][edges[i][1]] = edges[i][2];
    printf("%d\\n", max_flow(0, 5));
}` },
      { lang: 'cpp', code: `#include <iostream>
#include <vector>
#include <queue>
#include <algorithm>

int max_flow(std::vector<std::vector<int>>& cap, int s, int t) {
    int n = cap.size(), flow = 0;
    while (true) {
        std::vector<int> parent(n, -1);
        parent[s] = s;
        std::queue<int> q;
        q.push(s);
        while (!q.empty()) {
            int u = q.front(); q.pop();
            for (int v = 0; v < n; v++)
                if (parent[v] == -1 && cap[u][v] > 0) { parent[v] = u; q.push(v); }
        }
        if (parent[t] == -1) break;
        int f = 1 << 30;
        for (int v = t; v != s; v = parent[v]) f = std::min(f, cap[parent[v]][v]);
        for (int v = t; v != s; v = parent[v]) { cap[parent[v]][v] -= f; cap[v][parent[v]] += f; }
        flow += f;
    }
    return flow;
}

int main() {
    int n = 6;
    std::vector<std::vector<int>> cap(n, std::vector<int>(n, 0));
    int edges[9][3] = {{0,1,16},{0,2,13},{1,3,12},{2,1,4},{2,4,14},{3,2,9},{3,5,20},{4,3,7},{4,5,4}};
    for (auto& e : edges) cap[e[0]][e[1]] = e[2];
    std::cout << max_flow(cap, 0, 5) << "\\n";
}` },
    ],
  },
};
