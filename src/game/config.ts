export const GAME_CONFIG = Object.freeze({
  chunkSize: 16,
  worldDiameter: 64,
  worldHeight: 32,
  maxTerrainHeight: 16,
  playerRadius: 0.32,
  playerHeight: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 5.4,
  jumpSpeed: 7.2,
  gravity: 20,
  interactionDistance: 6,
  chunkRebuildsPerFrame: 2,
});

export type GameConfig = typeof GAME_CONFIG;
