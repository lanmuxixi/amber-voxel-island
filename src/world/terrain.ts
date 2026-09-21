import { GAME_CONFIG } from '../game/config';

import { BlockId } from './blocks';
import { blockKey, type Vec3i } from './coords';

export interface GeneratedIsland {
  blocks: ReadonlyMap<string, BlockId>;
  spawn: { x: number; y: number; z: number };
}

export function hash2(seed: number, x: number, z: number): number {
  let value = seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(z, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

export function surfaceHeight(seed: number, x: number, z: number): number {
  const radius = GAME_CONFIG.worldDiameter / 2;
  const radial = Math.hypot(x + 0.5, z + 0.5) / radius;
  const falloff = Math.max(0, 1 - radial * radial);
  const broadNoise = hash2(seed, x, z) * 0.8 + hash2(seed ^ 0x9e3779b9, x * 2, z * 2) * 0.2;
  const ridge = Math.max(0, 1 - Math.abs(hash2(seed ^ 0x68bc21eb, x, z) - 0.5) * 2);
  const rawHeight = 1 + falloff * 14 + falloff * broadNoise * 2.4 + falloff * ridge * 1.5;
  return Math.max(1, Math.min(GAME_CONFIG.maxTerrainHeight, Math.floor(rawHeight)));
}

function setBlock(blocks: Map<string, BlockId>, position: Vec3i, block: BlockId): void {
  if (block === BlockId.Air) {
    blocks.delete(blockKey(position));
    return;
  }
  blocks.set(blockKey(position), block);
}

export function generateIsland(seed: number): GeneratedIsland {
  const blocks = new Map<string, BlockId>();
  const half = GAME_CONFIG.worldDiameter / 2;

  for (let x = -half; x < half; x += 1) {
    for (let z = -half; z < half; z += 1) {
      setBlock(blocks, { x, y: 0, z }, BlockId.Foundation);

      const height = surfaceHeight(seed, x, z);
      if (height <= 1) {
        continue;
      }

      for (let y = 1; y <= height; y += 1) {
        const block =
          y === height ? (height <= 4 ? BlockId.Sand : BlockId.Grass) : height - y <= 3 ? BlockId.Dirt : BlockId.Stone;
        setBlock(blocks, { x, y, z }, block);
      }

      const hasTree =
        height >= 6 && Math.hypot(x, z) < 27 && hash2(seed ^ 0x68bc21eb, x, z) >= 0.985;
      if (!hasTree) {
        continue;
      }

      for (let trunkY = height + 1; trunkY <= height + 3; trunkY += 1) {
        setBlock(blocks, { x, y: trunkY, z }, BlockId.Wood);
      }

      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dz = -2; dz <= 2; dz += 1) {
          for (let dy = 2; dy <= 4; dy += 1) {
            if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 3) > 4) {
              continue;
            }
            if (dx === 0 && dz === 0 && dy <= 3) {
              continue;
            }
            const leafPosition = { x: x + dx, y: height + dy, z: z + dz };
            if ((blocks.get(blockKey(leafPosition)) ?? BlockId.Air) === BlockId.Air) {
              setBlock(blocks, leafPosition, BlockId.Leaves);
            }
          }
        }
      }
    }
  }

  const spawn = {
    x: 0.5,
    y: surfaceHeight(seed, 0, 0) + 1.01,
    z: 0.5,
  };
  const minX = Math.floor(spawn.x - GAME_CONFIG.playerRadius);
  const maxX = Math.floor(spawn.x + GAME_CONFIG.playerRadius);
  const minY = Math.floor(spawn.y);
  const maxY = Math.floor(spawn.y + GAME_CONFIG.playerHeight - 0.001);
  const minZ = Math.floor(spawn.z - GAME_CONFIG.playerRadius);
  const maxZ = Math.floor(spawn.z + GAME_CONFIG.playerRadius);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        setBlock(blocks, { x, y, z }, BlockId.Air);
      }
    }
  }

  return {
    blocks,
    spawn,
  };
}
