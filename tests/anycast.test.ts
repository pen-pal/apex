import { describe, it, expect } from 'vitest';
import { nearest, distribute, type Site, type Client } from '../src/web/anycast';

const sites = (up = [true, true, true]): Site[] =>
  [{ id: 0, name: 'NYC', up: up[0] }, { id: 1, name: 'LON', up: up[1] }, { id: 2, name: 'TYO', up: up[2] }];

// costs are path costs to [NYC, LON, TYO]
const clients: Client[] = [
  { id: 0, name: 'Boston', costs: [2, 8, 20] },   // nearest NYC
  { id: 1, name: 'Paris', costs: [9, 2, 18] },    // nearest LON
  { id: 2, name: 'Osaka', costs: [22, 17, 1] },   // nearest TYO
  { id: 3, name: 'Chicago', costs: [4, 9, 19] },  // nearest NYC
];

describe('anycast routing to the nearest instance', () => {
  it('each client reaches its lowest-cost site', () => {
    const s = sites();
    expect(nearest(clients[0], s)).toBe(0); // Boston → NYC
    expect(nearest(clients[1], s)).toBe(1); // Paris → LON
    expect(nearest(clients[2], s)).toBe(2); // Osaka → TYO
  });

  it('distributes load by geography', () => {
    const d = distribute(clients, sites());
    expect(d.load).toEqual({ 0: 2, 1: 1, 2: 1 }); // NYC gets Boston+Chicago
    expect(d.assignment[3]).toBe(0);
  });
});

describe('automatic failover when a site is withdrawn', () => {
  it('clients of a downed site re-route to the next nearest', () => {
    const down = sites([false, true, true]); // NYC withdrawn
    expect(nearest(clients[0], down)).toBe(1); // Boston → LON (8 < 20)
    expect(nearest(clients[3], down)).toBe(1); // Chicago → LON (9 < 19)
    const d = distribute(clients, down);
    expect(d.load[1]).toBe(3); // LON now serves Paris + Boston + Chicago
    expect(d.load[0]).toBe(0);
  });

  it('returns null only when every site is down', () => {
    expect(nearest(clients[0], sites([false, false, false]))).toBe(null);
    const d = distribute(clients, sites([false, false, false]));
    expect(d.assignment[0]).toBe(null);
  });

  it('ties break to the lower site id', () => {
    const tie: Client = { id: 9, name: 'tie', costs: [5, 5, 9] };
    expect(nearest(tie, sites())).toBe(0);
  });
});
