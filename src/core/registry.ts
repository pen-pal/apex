import type { ProtocolSpec, Registry } from './types';

export class ProtocolRegistry implements Registry {
  private map = new Map<string, ProtocolSpec>();
  register(spec: ProtocolSpec): void {
    if (this.map.has(spec.id)) throw new Error(`Protocol already registered: ${spec.id}`);
    this.map.set(spec.id, spec);
  }
  get(id: string): ProtocolSpec | undefined { return this.map.get(id); }
  all(): ProtocolSpec[] { return [...this.map.values()]; }
}
