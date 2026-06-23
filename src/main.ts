// CLI demo of the engine: build a frame from a message, then dissect it back,
// proving the bytes are real and the round-trip is lossless.
//   npm run demo            -> uses "Hi"
//   npm run demo -- Hello   -> uses "Hello"
import { ProtocolRegistry } from './core/registry';
import { registerCoreProtocols } from './protocols';
import { buildFrame } from './core/builder';
import { dissect, describe } from './core/engine';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

const message = process.argv.slice(2).join(' ') || 'Hi';
const payload = [...new TextEncoder().encode(message)];

const frame = buildFrame(payload, registry);
const hex = frame.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

console.log(`\nMessage: "${message}"  (${payload.length} payload bytes)`);
console.log(`\nFrame on the wire (${frame.bytes.length} bytes):\n${hex}\n`);

const tree = dissect(frame.bytes, 'ethernet', registry);
console.log('Dissection:\n');
console.log(describe(tree));

const recovered = new TextDecoder().decode(Uint8Array.from(tree.child!.child!.payload));
console.log(`\nRecovered payload: "${recovered}"  ${recovered === message ? 'OK matches' : 'MISMATCH'}\n`);
