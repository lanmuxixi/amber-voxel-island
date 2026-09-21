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

  it('rejects edits outside the finite world and never persists them', () => {
    const world = new World(generateIsland(9137).blocks);

    expect(world.setBlock({ x: -33, y: 20, z: 0 }, BlockId.Stone)).toBe(false);
    expect(world.setBlock({ x: 32, y: 20, z: 0 }, BlockId.Stone)).toBe(false);
    expect(world.setBlock({ x: 0, y: 20, z: -33 }, BlockId.Stone)).toBe(false);
    expect(world.setBlock({ x: 0, y: 20, z: 32 }, BlockId.Stone)).toBe(false);
    expect(world.getDelta()).toEqual([]);

    expect(world.setBlock({ x: -32, y: 20, z: -32 }, BlockId.Stone)).toBe(true);
    expect(world.setBlock({ x: 31, y: 20, z: 31 }, BlockId.Stone)).toBe(true);
    expect(world.getDelta()).toEqual([
      [-32, 20, -32, BlockId.Stone],
      [31, 20, 31, BlockId.Stone],
    ]);
  });

  it('ignores out-of-bounds deltas while applying valid persisted edits', () => {
    const world = new World(generateIsland(9137).blocks);

    world.applyDelta([
      [32, 20, 0, BlockId.Stone],
      [31, 20, 0, BlockId.Stone],
    ]);

    expect(world.getBlock({ x: 32, y: 20, z: 0 })).toBe(BlockId.Air);
    expect(world.getBlock({ x: 31, y: 20, z: 0 })).toBe(BlockId.Stone);
    expect(world.getDelta()).toEqual([[31, 20, 0, BlockId.Stone]]);
  });
});
