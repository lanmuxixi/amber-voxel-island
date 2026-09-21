import { GAME_CONFIG } from '../game/config';

import { BLOCKS, BlockId } from './blocks';
import type { WorldReader } from './World';

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  blockFaces: number;
}

const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
] as const;

export function buildChunkMeshData(world: WorldReader, chunkX: number, chunkZ: number): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let blockFaces = 0;
  const atlasGridSize = 3;
  const tileSize = 1 / atlasGridSize;
  const inset = 0.002;

  for (let localX = 0; localX < GAME_CONFIG.chunkSize; localX += 1) {
    for (let localZ = 0; localZ < GAME_CONFIG.chunkSize; localZ += 1) {
      for (let y = 0; y < GAME_CONFIG.worldHeight; y += 1) {
        const worldX = chunkX * GAME_CONFIG.chunkSize + localX;
        const worldZ = chunkZ * GAME_CONFIG.chunkSize + localZ;
        const block = world.getBlock({ x: worldX, y, z: worldZ });
        if (block === BlockId.Air) {
          continue;
        }

        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          const neighbor = world.getBlock({ x: worldX + nx, y: y + ny, z: worldZ + nz });
          if (BLOCKS[neighbor].opaque) {
            continue;
          }

          const tile = BLOCKS[block].atlasTile;
          const tileX = tile % atlasGridSize;
          const tileY = Math.floor(tile / atlasGridSize);
          const minU = tileX * tileSize + inset;
          const maxU = (tileX + 1) * tileSize - inset;
          const minV = tileY * tileSize + inset;
          const maxV = (tileY + 1) * tileSize - inset;
          const baseIndex = positions.length / 3;

          for (const [vx, vy, vz] of face.v) {
            positions.push(worldX + vx, y + vy, worldZ + vz);
            normals.push(nx, ny, nz);
          }

          uvs.push(maxU, maxV, maxU, minV, minU, minV, minU, maxV);
          indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
          blockFaces += 1;
        }
      }
    }
  }

  return { positions, normals, uvs, indices, blockFaces };
}
