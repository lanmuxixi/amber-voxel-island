import { GAME_CONFIG } from '../game/config';

import { BLOCKS, BlockId, isBlockId } from './blocks';
import { blockKey, type Vec3i } from './coords';

export type BlockDeltaEntry = [x: number, y: number, z: number, block: BlockId];

export interface WorldReader {
  getBlock(position: Vec3i): BlockId;
}

export class World implements WorldReader {
  private readonly baseBlocks: Map<string, BlockId>;
  private readonly blocks: Map<string, BlockId>;
  private readonly delta = new Map<string, BlockDeltaEntry>();

  constructor(baseBlocks: ReadonlyMap<string, BlockId>) {
    this.baseBlocks = new Map(baseBlocks);
    this.blocks = new Map(baseBlocks);
  }

  getBlock(position: Vec3i): BlockId {
    if (position.y < 0 || position.y >= GAME_CONFIG.worldHeight) {
      return BlockId.Air;
    }
    return this.blocks.get(blockKey(position)) ?? BlockId.Air;
  }

  isSolid(position: Vec3i): boolean {
    const block = this.getBlock(position);
    return BLOCKS[block].opaque;
  }

  setBlock(position: Vec3i, block: BlockId): boolean {
    if (![position.x, position.y, position.z].every(Number.isInteger)) {
      return false;
    }
    if (position.y <= 0 || position.y >= GAME_CONFIG.worldHeight) {
      return false;
    }
    if (!isBlockId(block) || block === BlockId.Foundation) {
      return false;
    }

    const key = blockKey(position);
    const current = this.getBlock(position);
    if (current === BlockId.Foundation) {
      return false;
    }

    if (block === BlockId.Air) {
      this.blocks.delete(key);
    } else {
      this.blocks.set(key, block);
    }

    const baseBlock = this.baseBlocks.get(key) ?? BlockId.Air;
    if (block === baseBlock) {
      if (baseBlock === BlockId.Air) {
        this.blocks.delete(key);
      } else {
        this.blocks.set(key, baseBlock);
      }
      this.delta.delete(key);
      return true;
    }

    this.delta.set(key, [position.x, position.y, position.z, block]);
    return true;
  }

  applyDelta(entries: readonly BlockDeltaEntry[]): void {
    for (const [x, y, z, block] of entries) {
      this.setBlock({ x, y, z }, block);
    }
  }

  getDelta(): BlockDeltaEntry[] {
    return [...this.delta.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, entry]) => [...entry] as BlockDeltaEntry);
  }
}
