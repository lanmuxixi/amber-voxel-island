import { describe, expect, it } from 'vitest';

import { getPlayerBlockBounds, playerOverlapsBlock, type PlayerState } from '../src/player/physics';
import { resolveSafeSpawn } from '../src/player/spawn';
import { BLOCKS, BlockId } from '../src/world/blocks';
import { blockKey } from '../src/world/coords';
import { generateIsland } from '../src/world/terrain';
import { World } from '../src/world/World';

function expectPlayerClear(world: World, position: { x: number; y: number; z: number }): void {
  const state: PlayerState = {
    position,
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: false,
  };
  const { minX, maxX, minY, maxY, minZ, maxZ } = getPlayerBlockBounds(position);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const block = { x, y, z };
        if (playerOverlapsBlock(state, block)) {
          expect(world.getBlock(block), `spawn overlaps ${x},${y},${z}`).toBe(BlockId.Air);
        }
      }
    }
  }
}

describe('resolveSafeSpawn', () => {
  it('deterministically moves above blocks added inside the generated spawn volume', () => {
    const island = generateIsland(9137);
    const world = new World(island.blocks);
    const spawnY = Math.floor(island.spawn.y);
    expect(world.setBlock({ x: 0, y: spawnY, z: 0 }, BlockId.Stone)).toBe(true);
    expect(world.setBlock({ x: 0, y: spawnY + 1, z: 0 }, BlockId.Stone)).toBe(true);

    const first = resolveSafeSpawn(world, island.spawn);
    const second = resolveSafeSpawn(world, island.spawn);

    expect(first).toEqual(second);
    expect(first.y).toBeGreaterThan(island.spawn.y);
    expectPlayerClear(world, first);
    const support = world.getBlock({ x: Math.floor(first.x), y: Math.floor(first.y) - 1, z: Math.floor(first.z) });
    expect(BLOCKS[support].opaque).toBe(true);
  });

  it('can spawn above a filled top world column without clamping player height', () => {
    const blocks = new Map<string, BlockId>();
    for (let y = 0; y <= 31; y += 1) {
      blocks.set(blockKey({ x: 0, y, z: 0 }), BlockId.Stone);
    }
    const world = new World(blocks);

    const spawn = resolveSafeSpawn(world, { x: 0.5, y: 1.01, z: 0.5 });

    expect(spawn).toEqual({ x: 0.5, y: 32.01, z: 0.5 });
    expectPlayerClear(world, spawn);
  });
});
