import { describe, expect, it } from 'vitest';

import { tileColorWithLightness } from '../src/world/atlas';
import { BlockId } from '../src/world/blocks';
import { buildChunkMeshData } from '../src/world/mesh';
import type { WorldReader } from '../src/world/World';

class TestWorld implements WorldReader {
  constructor(private readonly blocks = new Map<string, BlockId>()) {}

  getBlock(position: { x: number; y: number; z: number }): BlockId {
    return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? BlockId.Air;
  }
}

describe('buildChunkMeshData', () => {
  it('renders all six faces for an isolated block', () => {
    const world = new TestWorld(new Map([['0,1,0', BlockId.Stone]]));
    const mesh = buildChunkMeshData(world, 0, 0);

    expect(mesh.blockFaces).toBe(6);
    expect(mesh.indices).toHaveLength(36);
  });

  it('culls faces against solid neighbors across chunk boundaries', () => {
    const world = new TestWorld(
      new Map([
        ['15,1,0', BlockId.Stone],
        ['16,1,0', BlockId.Stone],
      ]),
    );

    const mesh = buildChunkMeshData(world, 0, 0);
    expect(mesh.blockFaces).toBe(5);
    expect(mesh.indices).toHaveLength(30);
  });
});

describe('tileColorWithLightness', () => {
  it('clamps rgb channels when applying lightness changes', () => {
    expect(tileColorWithLightness('#000000', -20)).toBe('#000000');
    expect(tileColorWithLightness('#ffffff', 20)).toBe('#ffffff');
  });
});
