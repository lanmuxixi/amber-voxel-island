import { BlockId } from '../world/blocks';
import { WORLD_BOUNDS } from '../world/coords';
import type { WorldReader } from '../world/World';

import { playerOverlapsWorld, type Vec3 } from './physics';

const SPAWN_CLEARANCE = 0.01;

function hasSupport(world: WorldReader, position: Vec3): boolean {
  const support = {
    x: Math.floor(position.x),
    y: Math.floor(position.y) - 1,
    z: Math.floor(position.z),
  };
  return world.getBlock(support) !== BlockId.Air;
}

function isClear(world: WorldReader, position: Vec3): boolean {
  return !playerOverlapsWorld(world, position);
}

interface RankedSpawn {
  position: Vec3;
  distanceSquared: number;
  horizontalDistanceSquared: number;
  cellX: number;
  cellZ: number;
}

function isBetterSpawn(candidate: RankedSpawn, current: RankedSpawn | null): boolean {
  if (!current) {
    return true;
  }
  return (
    candidate.distanceSquared < current.distanceSquared ||
    (candidate.distanceSquared === current.distanceSquared && candidate.position.y < current.position.y) ||
    (candidate.distanceSquared === current.distanceSquared &&
      candidate.position.y === current.position.y &&
      candidate.horizontalDistanceSquared < current.horizontalDistanceSquared) ||
    (candidate.distanceSquared === current.distanceSquared &&
      candidate.position.y === current.position.y &&
      candidate.horizontalDistanceSquared === current.horizontalDistanceSquared &&
      candidate.cellZ < current.cellZ) ||
    (candidate.distanceSquared === current.distanceSquared &&
      candidate.position.y === current.position.y &&
      candidate.horizontalDistanceSquared === current.horizontalDistanceSquared &&
      candidate.cellZ === current.cellZ &&
      candidate.cellX < current.cellX)
  );
}

export function resolveSafeSpawn(world: WorldReader, preferred: Vec3): Vec3 {
  if (hasSupport(world, preferred) && isClear(world, preferred)) {
    return { ...preferred };
  }

  let best: RankedSpawn | null = null;
  for (let x = WORLD_BOUNDS.minX; x <= WORLD_BOUNDS.maxX; x += 1) {
    for (let z = WORLD_BOUNDS.minZ; z <= WORLD_BOUNDS.maxZ; z += 1) {
      for (let supportY = WORLD_BOUNDS.minY; supportY <= WORLD_BOUNDS.maxY; supportY += 1) {
        if (world.getBlock({ x, y: supportY, z }) === BlockId.Air) {
          continue;
        }
        const position = { x: x + 0.5, y: supportY + 1 + SPAWN_CLEARANCE, z: z + 0.5 };
        if (!isClear(world, position)) {
          continue;
        }
        const dx = position.x - preferred.x;
        const dy = position.y - preferred.y;
        const dz = position.z - preferred.z;
        const ranked = {
          position,
          distanceSquared: dx * dx + dy * dy + dz * dz,
          horizontalDistanceSquared: dx * dx + dz * dz,
          cellX: x,
          cellZ: z,
        };
        if (isBetterSpawn(ranked, best)) {
          best = ranked;
        }
      }
    }
  }

  if (!best) {
    throw new Error('The generated world has no supported safe spawn.');
  }
  return best.position;
}
