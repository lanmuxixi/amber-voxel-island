import { describe, expect, it } from 'vitest';

import { ParticlePool } from '../src/effects/BlockEffects';

describe('ParticlePool', () => {
  it('reuses entries when capacity is exhausted or released', () => {
    const pool = new ParticlePool(24);
    const acquired = Array.from({ length: 24 }, () => pool.acquire(0.45));

    expect(acquired[0]?.index).toBe(0);
    expect(acquired[23]?.index).toBe(23);
    expect(pool.acquire(0.45).index).toBe(0);

    pool.release(3);
    expect(pool.acquire(0.45).index).toBe(3);
  });

  it('expires active entries after their duration elapses', () => {
    const pool = new ParticlePool(24);
    const entry = pool.acquire(0.1);

    pool.update(0.11);

    expect(entry.active).toBe(false);
  });
});
