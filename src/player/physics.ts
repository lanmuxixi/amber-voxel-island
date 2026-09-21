import { GAME_CONFIG } from '../game/config';

import { BlockId } from '../world/blocks';
import type { Vec3i } from '../world/coords';
import type { WorldReader } from '../world/World';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
}

export interface PlayerInput {
  forward: number;
  right: number;
  jump: boolean;
}

export interface PlayerBlockBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function getPlayerBlockBounds(position: Vec3): PlayerBlockBounds {
  return {
    minX: Math.floor(position.x - GAME_CONFIG.playerRadius),
    maxX: Math.floor(position.x + GAME_CONFIG.playerRadius),
    minY: Math.floor(position.y),
    maxY: Math.floor(position.y + GAME_CONFIG.playerHeight - 0.001),
    minZ: Math.floor(position.z - GAME_CONFIG.playerRadius),
    maxZ: Math.floor(position.z + GAME_CONFIG.playerRadius),
  };
}

export function hasSafePlayerCollisionBounds(position: Vec3): boolean {
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    return false;
  }
  return Object.values(getPlayerBlockBounds(position)).every(Number.isSafeInteger);
}

export function playerOverlapsWorld(world: WorldReader, position: Vec3): boolean {
  const bounds = getPlayerBlockBounds(position);
  const state: PlayerState = {
    position,
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: false,
  };
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
        const block = { x, y, z };
        if (world.getBlock(block) !== BlockId.Air && playerOverlapsBlock(state, block)) {
          return true;
        }
      }
    }
  }
  return false;
}

function moveAxis(
  world: WorldReader,
  state: PlayerState,
  axis: 'x' | 'y' | 'z',
  delta: number,
): { collided: boolean; grounded: boolean } {
  const direction = Math.sign(delta);
  const totalSteps = Math.max(1, Math.ceil(Math.abs(delta) / 0.2));
  const step = delta / totalSteps;

  for (let index = 0; index < totalSteps; index += 1) {
    state.position[axis] += step;
    if (!playerOverlapsWorld(world, state.position)) {
      continue;
    }
    state.position[axis] -= step;
    state.velocity[axis] = 0;
    return { collided: true, grounded: axis === 'y' && direction < 0 };
  }

  return { collided: false, grounded: false };
}

export function playerOverlapsBlock(state: PlayerState, block: Vec3i): boolean {
  const playerMinX = state.position.x - GAME_CONFIG.playerRadius;
  const playerMaxX = state.position.x + GAME_CONFIG.playerRadius;
  const playerMinY = state.position.y;
  const playerMaxY = state.position.y + GAME_CONFIG.playerHeight;
  const playerMinZ = state.position.z - GAME_CONFIG.playerRadius;
  const playerMaxZ = state.position.z + GAME_CONFIG.playerRadius;

  return (
    playerMinX < block.x + 1 &&
    playerMaxX > block.x &&
    playerMinY < block.y + 1 &&
    playerMaxY > block.y &&
    playerMinZ < block.z + 1 &&
    playerMaxZ > block.z
  );
}

export function stepPlayer(
  world: WorldReader,
  previous: PlayerState,
  input: PlayerInput,
  rawDt: number,
): PlayerState {
  const state: PlayerState = {
    position: { ...previous.position },
    velocity: { ...previous.velocity },
    yaw: previous.yaw,
    pitch: previous.pitch,
    grounded: previous.grounded,
  };
  const dt = Math.min(rawDt, 0.05);
  const magnitude = Math.hypot(input.forward, input.right);
  const forward = magnitude > 0 ? input.forward / Math.max(1, magnitude) : 0;
  const right = magnitude > 0 ? input.right / Math.max(1, magnitude) : 0;
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);

  state.velocity.x = (right * cos - forward * sin) * GAME_CONFIG.walkSpeed;
  state.velocity.z = (-forward * cos - right * sin) * GAME_CONFIG.walkSpeed;

  if (state.grounded && input.jump) {
    state.velocity.y = GAME_CONFIG.jumpSpeed;
    state.grounded = false;
  }

  state.velocity.y -= GAME_CONFIG.gravity * dt;

  moveAxis(world, state, 'x', state.velocity.x * dt);
  moveAxis(world, state, 'z', state.velocity.z * dt);
  state.grounded = false;
  const yResult = moveAxis(world, state, 'y', state.velocity.y * dt);
  state.grounded = yResult.grounded;

  return state;
}
