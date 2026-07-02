// GENERATED section registry chunk 0 — see sections/registry.tsx. One data row per section: title, sub, component.
import type { SectionEntry } from './registry';
import { GitObjectsSection } from '../GitObjectsSection';
import { CryptoView } from '../CryptoView';
import { ClassicalSection } from '../ClassicalSection';
import { OneTimePadSection } from '../OneTimePadSection';
import { AeadSection } from '../AeadSection';
import { RsaSection } from '../RsaSection';
import { PubKeySection } from '../PubKeySection';
import { EccSection } from '../EccSection';
import { EcdsaSection } from '../EcdsaSection';
import { SchnorrSection } from '../SchnorrSection';
import { ChachaSection } from '../ChachaSection';
import { LweSection } from '../LweSection';
import { BB84Section } from '../BB84Section';
import { StpSection } from '../StpSection';
import { SlaacSection } from '../SlaacSection';
import { LineCodingSection } from '../LineCodingSection';
import { EcbPenguinSection } from '../EcbPenguinSection';
import { LamportSection } from '../LamportSection';
import { QuorumSection } from '../QuorumSection';
import { Lz77Section } from '../Lz77Section';
import { CorsSection } from '../CorsSection';
import { TcpHandshakeSection } from '../TcpHandshakeSection';
import { TimeWaitSection } from '../TimeWaitSection';
import { DnssecSection } from '../DnssecSection';
import { KaminskySection } from '../KaminskySection';
import { PaxosSection } from '../PaxosSection';
import { WebInjectSection } from '../WebInjectSection';
import { BufferOverflowSection } from '../BufferOverflowSection';
import { NxSection } from '../NxSection';
import { RopSection } from '../RopSection';
import { AslrSection } from '../AslrSection';
import { DhKexSection } from '../DhKexSection';
import { CrcWalkSection } from '../CrcWalkSection';
import { SnowflakeSection } from '../SnowflakeSection';
import { PmtudSection } from '../PmtudSection';
import { CountMinSection } from '../CountMinSection';
import { MinHashSection } from '../MinHashSection';
import { SackSection } from '../SackSection';
import { BullySection } from '../BullySection';
import { CspSection } from '../CspSection';
import { EdDsaSection } from '../EdDsaSection';
import { HllSection } from '../HllSection';
import { TtlHopSection } from '../TtlHopSection';
import { BdpSection } from '../BdpSection';
import { WebAuthnSection } from '../WebAuthnSection';
import { AnycastSection } from '../AnycastSection';
import { MailAuthSection } from '../MailAuthSection';
import { ConsistencySection } from '../ConsistencySection';
import { ReedSolomonSection } from '../ReedSolomonSection';
import { CubicSection } from '../CubicSection';
import { WpaSection } from '../WpaSection';
import { BbrSection } from '../BbrSection';
import { BtreeSection } from '../BtreeSection';
import { LsmSection } from '../LsmSection';

export const chunk0: Record<string, SectionEntry> = {
  "crypto": { Component: CryptoView, title: <>Cryptography</>, sub: <>Real cryptography on sandbox values — never on captured streams. Watch structure become noise.</> },
  "classical": { Component: ClassicalSection, title: <>Classical ciphers</>, sub: <>Caesar and Vigenère — and how frequency analysis breaks them from the ciphertext alone, the failure that motivated modern ciphers designed to look like noise.</> },
  "otpad": { Component: OneTimePadSection, title: <>One-time pad</>, sub: <>The only cipher with proven perfect secrecy — XOR with a random pad reveals nothing, but reuse it once and it shatters.</> },
  "aead": { Component: AeadSection, title: <>CTR, nonce reuse &amp; AEAD</>, sub: <>Turn the block cipher into a stream cipher, watch a reused nonce leak two messages, then add a GHASH tag that catches tampering — all on real, NIST-verified bytes.</> },
  "rsa": { Component: RsaSection, title: <>RSA</>, sub: <>Pick two primes and watch the public/private keypair fall out — then encrypt the public way, decrypt the private way, sign, verify, and see the whole secret rest on factoring being hard.</> },
  "pubkey": { Component: PubKeySection, title: <>How public-key crypto works</>, sub: <>The idea RSA, ECC, and the TLS handshake all rest on: how you share a secret with someone you have never met, over a line everyone is reading. A narrated walk from the padlock intuition to the one-way trapdoor to a real tiny RSA — 65 encrypts to 2790 with the public key and back to 65 with the private one — then signatures, and a box you can encrypt in yourself.</> },
  "ecc": { Component: EccSection, title: <>Elliptic curves &amp; ECDH</>, sub: <>The whole finite group on one grid: walk kG to feel the discrete-log trapdoor, watch point addition add indices, and run ECDH to a shared secret.</> },
  "ecdsa": { Component: EcdsaSection, title: <>ECDSA &amp; nonce reuse</>, sub: <>Sign with the private scalar, verify with the public point — then watch a reused nonce hand an attacker the private key, the real PS3 / Bitcoin bug.</> },
  "schnorr": { Component: SchnorrSection, title: <>Zero-knowledge proof (Schnorr)</>, sub: <>Prove you know a secret without revealing it — the three-move commit/challenge/response, and why the challenge must come after the commitment.</> },
  "chacha": { Component: ChachaSection, title: <>ChaCha20</>, sub: <>A 4×4 matrix of words stirred by add–rotate–xor — step through the rounds, build the keystream, and XOR it over a message. No S-boxes, fast in software.</> },
  "pqc": { Component: LweSection, title: <>Post-quantum (LWE)</>, sub: <>Hide a secret in noise (Learning With Errors), encrypt a bit by burying it near 0 or q/2, and watch rounding recover it — the lattice kernel inside ML-KEM (Kyber).</> },
  "bb84": { Component: BB84Section, title: <>Quantum key distribution (BB84)</>, sub: <>Agree on a key secured by physics — send qubits in random bases, sift the matches, and watch an eavesdropper's measurements inject detectable errors.</> },
  "stptree": { Component: StpSection, title: <>Spanning Tree Protocol</>, sub: <>Redundant links keep a LAN alive but create loops that flood broadcasts forever. Watch STP elect a root bridge and block exactly the right ports to leave a single loop-free tree.</> },
  "slaac": { Component: SlaacSection, title: <>IPv6 SLAAC &amp; address types</>, sub: <>No DHCP needed — watch a host turn its MAC into an interface identifier (EUI-64), mint its own link-local and global addresses, and classify any IPv6 address by its leading bits.</> },
  "linecode": { Component: LineCodingSection, title: <>Line coding</>, sub: <>A 1 and a 0 must become real voltage on the wire — see the same bits drawn as NRZ-L, NRZI, Manchester, Differential Manchester, and AMI, and why some keep their own clock and some don't.</> },
  "ecbpenguin": { Component: EcbPenguinSection, title: <>Block-cipher modes &amp; the ECB penguin</>, sub: <>Same key, same AES — three modes. Watch a padlock image survive ECB encryption intact while CBC and CTR turn it to noise, the classic proof that &ldquo;encrypted&rdquo; isn&rsquo;t automatically &ldquo;hidden.&rdquo;</> },
  "lamport": { Component: LamportSection, title: <>Lamport logical clocks</>, sub: <>With no shared clock, how do distributed machines agree on order? Watch counters tick and messages bump them, building a causal order from one simple rule — and see exactly where it falls short.</> },
  "quorum": { Component: QuorumSection, title: <>Tunable quorum consistency</>, sub: <>One inequality — R + W &gt; N — decides whether a distributed read can ever return stale data. Slide the read and write quorums and watch the overlap that guarantees consistency appear and disappear.</> },
  "lz77": { Component: Lz77Section, title: <>LZ77 sliding-window compression</>, sub: <>The dictionary half of gzip and PNG. Step through the encoder as it finds repeats in a sliding window and replaces them with compact (distance, length, next) tokens — then watch an independent decoder rebuild the original exactly.</> },
  "cors": { Component: CorsSection, title: <>CORS &amp; the Same-Origin Policy</>, sub: <>Why can one site's JavaScript read another's data only with permission? Configure the page, the request, and the server's CORS headers, and watch the browser allow, preflight, or block the read.</> },
  "tcphand": { Component: TcpHandshakeSection, title: <>TCP handshake &amp; teardown</>, sub: <>The most-drawn diagram in networking, made exact. Step through SYN / SYN-ACK / ACK and the four-way close while both endpoints walk the TCP state machine — with real, editable sequence numbers.</> },
  "timewait": { Component: TimeWaitSection, title: <>TIME_WAIT &amp; ephemeral-port exhaustion</>, sub: <>Why the side that closes a TCP connection can't reuse its port for ~60s — and how a client opening too many short-lived connections runs out of ephemeral ports. Drag the connect rate, TIME_WAIT duration, and port pool to watch exhaustion appear, then click a fix and watch it clear.</> },
  "dnssec": { Component: DnssecSection, title: <>DNSSEC chain of trust</>, sub: <>How DNS answers become trustworthy: a chain of signatures from the root anchor down to the record. Validate it, then corrupt a DS hash or an RRSIG and watch it turn bogus at exactly the broken link.</> },
  "kaminsky": { Component: KaminskySection, title: <>DNS cache poisoning &amp; the Kaminsky attack</>, sub: <>How an off-path attacker forges a DNS reply to hijack a domain in a resolver's cache. The resolver accepts the first valid-looking answer, so the attacker guesses the query ID (and source port) and floods forgeries — Kaminsky's random-name trick makes every guess a fresh race. Toggle the defenses and watch the time to poison jump from a fraction of a second to infeasible.</> },
  "paxos": { Component: PaxosSection, title: <>Paxos consensus</>, sub: <>How distributed nodes agree on one value despite competing proposers and failures. Step through Prepare/Promise/Accept/Accepted and watch the safety rule that makes a chosen value impossible to override.</> },
  "webinject": { Component: WebInjectSection, title: <>Injection — SQLi &amp; XSS</>, sub: <>The most common web vulnerability class, made concrete: see the same payload pop a query built by string concatenation and a page built by raw HTML, then go inert against parameterization and escaping.</> },
  "bufferoverflow": { Component: BufferOverflowSection, title: <>How a buffer overflow hijacks a program</>, sub: <>The foundational binary exploit, shown byte by byte on a simulated stack frame: an unbounded copy writes past a fixed buffer, over the saved frame pointer, into the return address — so the function returns to an address you chose. A narrated walk from the overflow to a control-flow hijack to shellcode. Type input and watch it spill over the return address. Defenses (NX, ASLR, canaries) are the next stories.</> },
  "nxbit": { Component: NxSection, title: <>How NX / DEP stops your shellcode</>, sub: <>The first mitigation in the exploitation arms race. The overflow still overwrites the return address, but every memory page now carries an execute bit and the stack is marked writable-but-not-executable (W^X) — so the jump into your shellcode faults instead of running. A walk through page permissions, the fault, and why it forces attackers to reuse existing code (return-to-libc / ROP). Toggle NX and watch the same overflow run or die.</> },
  "rop": { Component: RopSection, title: <>How ROP bypasses NX</>, sub: <>NX forbade running injected code — so return-oriented programming runs code that is already there. The overflow lays a chain of “gadget” addresses (short instruction sequences ending in ret, borrowed from the binary and libc) up the stack; each ret pops the next, turning the stack into a program. Step through a real chain that loads "/bin/sh" into the argument register and calls libc’s system() — arbitrary execution with no injected byte, defeating NX. Motivates ASLR.</> },
  "aslr": { Component: AslrSection, title: <>How ASLR randomizes the addresses</>, sub: <>ROP hardcodes addresses — so ASLR loads libc, the stack, the heap, and the executable at a random base every run, and the stale chain jumps into nowhere. But everything inside libc shifts by the same offset, so leaking a single runtime address recovers the base and every gadget with it. Randomize, watch the blind chain crash, then leak an address and watch the recomputed chain land on system(). ASLR with no leak is strong; with one leak it falls.</> },
  "dhkex": { Component: DhKexSection, title: <>Diffie–Hellman key agreement</>, sub: <>Two strangers agree on a shared secret over a fully public channel while an eavesdropper watches every byte. The keystone behind TLS, SSH, WireGuard, and the Signal ratchet.</> },
  "crc32": { Component: CrcWalkSection, title: <>CRC-32 shift-register walk</>, sub: <>The checksum on every Ethernet frame, gzip stream, and PNG — watch the 32-bit register fold in each byte, expand the bit-level shifts, and flip one bit to see the whole checksum change.</> },
  "snowflake": { Component: SnowflakeSection, title: <>Snowflake IDs</>, sub: <>How a thousand servers mint unique, time-sortable 64-bit IDs without ever coordinating. Watch the four bit-fields and generate a burst to see the per-millisecond sequence climb.</> },
  "pmtud": { Component: PmtudSection, title: <>Path MTU Discovery</>, sub: <>A packet can only be as big as the narrowest link it crosses. Watch a Don't-Fragment packet shrink to fit via ICMP feedback — and black-hole when a firewall eats those ICMPs.</> },
  "countmin": { Component: CountMinSection, title: <>Count-Min Sketch</>, sub: <>Count how often each item appears in a massive stream using a tiny fixed grid, by accepting a one-sided error. Add items, watch the hashed cells climb, and compare the min-estimate against the truth.</> },
  "minhash": { Component: MinHashSection, title: <>MinHash — set similarity by sketch</>, sub: <>Estimate how similar two sets are (their Jaccard similarity) from tiny fixed-size signatures — the engine behind web-scale near-duplicate detection. Each signature slot is the minimum of one hash over the set, and two slots match with probability exactly equal to the Jaccard similarity, so the fraction of matching slots estimates it. Edit two documents and drag the signature size to watch the estimate converge on the truth.</> },
  "sack": { Component: SackSection, title: <>TCP Selective ACK (SACK)</>, sub: <>When a segment is lost but later ones arrive, how does the sender know what to resend? Drop segments on the wire and compare SACK (resend only the holes) with go-back-N (resend everything after the gap).</> },
  "bully": { Component: BullySection, title: <>Leader election (Bully algorithm)</>, sub: <>When the coordinator dies, who takes over — and how does everyone agree? Kill nodes, pick who starts the election, and step through the ELECTION/OK/COORDINATOR messages as the highest survivor bullies its way to the crown.</> },
  "csp": { Component: CspSection, title: <>Content-Security-Policy</>, sub: <>The defense-in-depth behind output-escaping: a policy telling the browser which scripts, styles, and images may load. Edit it and watch inline scripts, eval, and cross-origin loads get allowed or blocked.</> },
  "eddsa": { Component: EdDsaSection, title: <>EdDSA (Ed25519)</>, sub: <>A Schnorr-style signature whose nonce is derived deterministically from the secret and message — removing the random-nonce footgun that catastrophically breaks ECDSA when reused.</> },
  "hll": { Component: HllSection, title: <>HyperLogLog</>, sub: <>Estimate how many distinct items a massive stream contains using a few hundred bytes. Add items and batches and watch the registers fill while the cardinality estimate tracks the truth — duplicates cost nothing.</> },
  "ttlhop": { Component: TtlHopSection, title: <>TTL &amp; header-checksum recompute</>, sub: <>The two things every router does to every packet. Watch the TTL count down hop by hop and the real IPv4 header checksum recompute — until the packet expires and an ICMP Time Exceeded heads home.</> },
  "bdp": { Component: BdpSection, title: <>Bandwidth-Delay Product</>, sub: <>Why a fast link can still feel slow. Slide bandwidth, RTT, and window size and watch how much of the pipe your window can actually fill — and why window scaling was essential for long fat networks.</> },
  "webauthn": { Component: WebAuthnSection, title: <>Passkeys (WebAuthn / FIDO2)</>, sub: <>Passwordless login by public-key signature. Register a passkey, then watch a login succeed on the real site and fail on a phishing clone — because the device signs the origin it's actually visiting.</> },
  "anycast": { Component: AnycastSection, title: <>IP Anycast</>, sub: <>One IP address advertised from many locations — each client is routed to the nearest instance. Withdraw a site and watch its traffic re-route instantly. How root DNS, 1.1.1.1, and CDNs work.</> },
  "mailauth": { Component: MailAuthSection, title: <>Email authentication (SPF · DKIM · DMARC)</>, sub: <>Anyone can forge a From: address — these three DNS records make the claim checkable. Pick a scenario (genuine, spoofed, tampered, forwarded) and watch SPF, DKIM, and DMARC adjudicate it.</> },
  "consistency": { Component: ConsistencySection, title: <>Consistency models</>, sub: <>When clients share one value, which sets of read results are legal? Pick a history and watch a real checker search for a valid order to decide if it's linearizable, only sequentially consistent, or neither.</> },
  "reedsolomon": { Component: ReedSolomonSection, title: <>Reed-Solomon erasure coding</>, sub: <>The error correction behind scratched CDs, torn QR codes, and RAID-6. Encode a message with redundant symbols, scratch some off, and watch the data reconstruct itself from the survivors — using real GF(256) arithmetic.</> },
  "cubic": { Component: CubicSection, title: <>TCP CUBIC</>, sub: <>The congestion controller most of the internet runs by default. Watch its cubic window curve climb back toward the pre-loss window and probe beyond it — overlaid against Reno's slow linear sawtooth.</> },
  "wpa": { Component: WpaSection, title: <>WPA2 4-way handshake</>, sub: <>How your phone and the access point agree on a fresh encryption key from a shared Wi-Fi password — exchanging only nonces, never the key itself. Step through it and watch both sides derive the identical PTK.</> },
  "bbr": { Component: BbrSection, title: <>TCP BBR</>, sub: <>Congestion control that models the path instead of waiting for loss. Compare BBR and a loss-based flow on the same link — same throughput, but watch BBR keep the buffer empty while the other drowns in bufferbloat.</> },
  "btree": { Component: BtreeSection, title: <>B+tree index</>, sub: <>The balanced, sorted structure behind every database index. Insert keys and watch nodes fill, split, and push separators up — keeping every leaf at the same depth so every lookup is O(log n).</> },
  "gitobjects": { Component: GitObjectsSection, title: <>How Git stores your code</>, sub: <>Git is a content-addressed key/value store: every object is named by the SHA-1 of its own content. A narrated walk from blobs (a file by its hash) to trees (a directory) to commits (a snapshot plus history), and why one changed byte cascades up so history can’t be quietly rewritten. Edit a file and watch its real git object id — the exact one `git hash-object` prints — change.</> },
  "lsm": { Component: LsmSection, title: <>LSM-tree</>, sub: <>The write-optimized engine behind RocksDB and Cassandra. Put keys into the memtable, watch it flush to immutable SSTables, see read amplification grow — then compact to merge them and drop tombstones.</> },
};
