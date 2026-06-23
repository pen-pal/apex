// Verified against standard test vectors (see tests/checksum.test.ts).
// These make the bytes REAL — never fake a checksum.

/** Internet checksum, RFC 1071. One's-complement sum of 16-bit words. */
export function inetChecksum(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += (bytes[i] << 8) | (i + 1 < bytes.length ? bytes[i + 1] : 0);
  }
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return (~sum) & 0xffff;
}

const CRC_TABLE = (() => {
  const t = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE 802.3), used for the Ethernet Frame Check Sequence. */
export function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
