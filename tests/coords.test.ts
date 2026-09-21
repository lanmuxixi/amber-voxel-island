import { describe, expect, it } from 'vitest';

import { blockKey, worldToChunk } from '../src/world/coords';

describe('worldToChunk', () => {
  it('maps positive and negative positions into chunk-local coordinates', () => {
    expect(worldToChunk({ x: 15, y: 3, z: 15 })).toEqual({
      chunkX: 0,
      chunkZ: 0,
      localX: 15,
      localZ: 15,
    });
    expect(worldToChunk({ x: 16, y: 3, z: 16 })).toEqual({
      chunkX: 1,
      chunkZ: 1,
      localX: 0,
      localZ: 0,
    });
    expect(worldToChunk({ x: -1, y: 3, z: -1 })).toEqual({
      chunkX: -1,
      chunkZ: -1,
      localX: 15,
      localZ: 15,
    });
  });
});

describe('blockKey', () => {
  it('serializes integer coordinates deterministically', () => {
    expect(blockKey({ x: -2, y: 7, z: 9 })).toBe('-2,7,9');
  });
});
