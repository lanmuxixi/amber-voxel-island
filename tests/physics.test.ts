import { describe, expect, it } from 'vitest';

import { BlockId } from '../src/world/blocks';
import type { WorldReader } from '../src/world/World';
import { playerOverlapsBlock, stepPlayer, type PlayerState } from '../src/player/physics';

class FlatWorld implements WorldReader {
  constructor(private readonly extraBlocks = new Map<string, BlockId>()) {}

  getBlock(position: { x: number; y: number; z: number }): BlockId {
    if (position.y === 0) {
      return BlockId.Foundation;
    }
    return this.extraBlocks.get(`${position.x},${position.y},${position.z}`) ?? BlockId.Air;
  }
}

const resting: PlayerState = {
  position: { x: 0.5, y: 1.001, z: 0.5 },
  velocity: { x: 0, y: 0, z: 0 },
  yaw: 0,
  pitch: 0,
  grounded: true,
};

describe('stepPlayer', () => {
  it('lands a falling player onto the ground', () => {
    const world = new FlatWorld();
    let player: PlayerState = {
      ...resting,
      position: { x: 0.5, y: 8, z: 0.5 },
      grounded: false,
    };

    for (let index = 0; index < 120; index += 1) {
      player = stepPlayer(world, player, { forward: 0, right: 0, jump: false }, 1 / 60);
    }

    expect(player.position.y).toBeGreaterThanOrEqual(1);
    expect(player.position.y).toBeLessThanOrEqual(1.01);
    expect(player.grounded).toBe(true);
  });

  it('stops the player against a solid block on the x axis', () => {
    const world = new FlatWorld(new Map([['1,1,0', BlockId.Stone]]));
    let player = resting;

    for (let index = 0; index < 20; index += 1) {
      player = stepPlayer(world, player, { forward: 0, right: 1, jump: false }, 1 / 60);
    }

    expect(player.position.x).toBeLessThanOrEqual(0.68);
  });

  it('allows only a single jump while airborne', () => {
    const world = new FlatWorld();
    const jumping = stepPlayer(world, resting, { forward: 0, right: 0, jump: true }, 1 / 60);
    const doubleJump = stepPlayer(world, jumping, { forward: 0, right: 0, jump: true }, 1 / 60);

    expect(jumping.velocity.y).toBeGreaterThan(0);
    expect(doubleJump.velocity.y).toBeLessThan(jumping.velocity.y);
  });
});

describe('playerOverlapsBlock', () => {
  it('detects intersections between the player body and a block cube', () => {
    expect(playerOverlapsBlock(resting, { x: 0, y: 1, z: 0 })).toBe(true);
    expect(playerOverlapsBlock(resting, { x: 2, y: 1, z: 0 })).toBe(false);
  });
});
