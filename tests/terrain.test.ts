import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../src/game/config';
import { playerOverlapsBlock, type PlayerState } from '../src/player/physics';
import { BlockId } from '../src/world/blocks';
import { blockKey } from '../src/world/coords';
import { generateIsland } from '../src/world/terrain';
import { World } from '../src/world/World';

function expectSafeSpawn(seed: number): void {
  const island = generateIsland(seed);
  const world = new World(island.blocks);
  const player: PlayerState = {
    position: { ...island.spawn },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: false,
  };
  const minX = Math.floor(island.spawn.x - GAME_CONFIG.playerRadius);
  const maxX = Math.floor(island.spawn.x + GAME_CONFIG.playerRadius);
  const minY = Math.floor(island.spawn.y);
  const maxY = Math.floor(island.spawn.y + GAME_CONFIG.playerHeight - 0.001);
  const minZ = Math.floor(island.spawn.z - GAME_CONFIG.playerRadius);
  const maxZ = Math.floor(island.spawn.z + GAME_CONFIG.playerRadius);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const position = { x, y, z };
        if (playerOverlapsBlock(player, position)) {
          expect(world.getBlock(position), `seed ${seed} blocks spawn at ${x},${y},${z}`).toBe(BlockId.Air);
        }
      }
    }
  }
}

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

  it('keeps the complete player AABB clear for the known tree seed and a deterministic seed range', () => {
    for (const seed of [...Array.from({ length: 64 }, (_, index) => index), 75]) {
      expectSafeSpawn(seed);
    }
  });
});
