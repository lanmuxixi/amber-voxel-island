import { describe, expect, it } from 'vitest';

import { BlockId } from '../src/world/blocks';
import { blockKey } from '../src/world/coords';
import { generateIsland } from '../src/world/terrain';

describe('generateIsland', () => {
  it('is deterministic for a fixed seed and yields a safe spawn', () => {
    const first = generateIsland(9137);
    const second = generateIsland(9137);
    expect([...first.blocks.entries()]).toEqual([...second.blocks.entries()]);
    expect(first.spawn).toEqual(second.spawn);
    expect(first.blocks.get(blockKey({ x: 0, y: 0, z: 0 }))).toBe(BlockId.Foundation);
    expect(first.blocks.get(blockKey({ x: 31, y: 1, z: 31 })) ?? BlockId.Air).toBe(BlockId.Air);

    const belowSpawn = blockKey({
      x: Math.floor(first.spawn.x),
      y: Math.floor(first.spawn.y - 1),
      z: Math.floor(first.spawn.z),
    });
    expect((first.blocks.get(belowSpawn) ?? BlockId.Air) !== BlockId.Air).toBe(true);
  });
});
