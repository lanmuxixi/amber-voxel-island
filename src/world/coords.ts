import { GAME_CONFIG } from '../game/config';

export interface Vec3i {
  x: number;
  y: number;
  z: number;
}

const halfWorld = GAME_CONFIG.worldDiameter / 2;

export const WORLD_BOUNDS = Object.freeze({
  minX: -halfWorld,
  maxX: halfWorld - 1,
  minY: 0,
  maxY: GAME_CONFIG.worldHeight - 1,
  minZ: -halfWorld,
  maxZ: halfWorld - 1,
});

export function isEditableBlockPosition(position: Vec3i): boolean {
  return (
    [position.x, position.y, position.z].every(Number.isInteger) &&
    position.x >= WORLD_BOUNDS.minX &&
    position.x <= WORLD_BOUNDS.maxX &&
    position.y > WORLD_BOUNDS.minY &&
    position.y <= WORLD_BOUNDS.maxY &&
    position.z >= WORLD_BOUNDS.minZ &&
    position.z <= WORLD_BOUNDS.maxZ
  );
}

export function blockKey({ x, y, z }: Vec3i): string {
  return `${x},${y},${z}`;
}

export function worldToChunk({ x, z }: Vec3i): {
  chunkX: number;
  chunkZ: number;
  localX: number;
  localZ: number;
} {
  const size = GAME_CONFIG.chunkSize;
  const chunkX = Math.floor(x / size);
  const chunkZ = Math.floor(z / size);
  return {
    chunkX,
    chunkZ,
    localX: x - chunkX * size,
    localZ: z - chunkZ * size,
  };
}
