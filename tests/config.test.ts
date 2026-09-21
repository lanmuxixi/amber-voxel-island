import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/game/config';

describe('GAME_CONFIG', () => {
  it('uses compatible dimensions', () => {
    expect(GAME_CONFIG.worldDiameter % GAME_CONFIG.chunkSize).toBe(0);
    expect(GAME_CONFIG.worldHeight).toBeGreaterThan(GAME_CONFIG.maxTerrainHeight);
  });

  it('fits the player through a block-wide corridor', () => {
    expect(GAME_CONFIG.playerRadius * 2).toBeLessThan(1);
    expect(GAME_CONFIG.playerHeight).toBeGreaterThan(1);
  });
});
