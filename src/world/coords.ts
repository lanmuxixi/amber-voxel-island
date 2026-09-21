import { GAME_CONFIG } from '../game/config';

export interface Vec3i {
  x: number;
  y: number;
  z: number;
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
