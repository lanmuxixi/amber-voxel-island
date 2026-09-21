import { describe, expect, it } from 'vitest';

import { BlockId } from '../src/world/blocks';
import { World } from '../src/world/World';
import { generateIsland } from '../src/world/terrain';

describe('World', () => {
  it('tracks only edits that differ from the generated base world', () => {
    const island = generateIsland(9137);
    const world = new World(island.blocks);
    const target = { x: 0, y: 5, z: 0 };
    const original = world.getBlock(target);

    expect(original).not.toBe(BlockId.Air);
    expect(world.setBlock(target, BlockId.Air)).toBe(true);
    expect(world.getDelta()).toEqual([[target.x, target.y, target.z, BlockId.Air]]);

    expect(world.setBlock(target, original)).toBe(true);
    expect(world.getDelta()).toEqual([]);
  });

  it('rejects edits to the foundation layer', () => {
    const world = new World(generateIsland(9137).blocks);

    expect(world.setBlock({ x: 0, y: 0, z: 0 }, BlockId.Stone)).toBe(false);
  });
});
