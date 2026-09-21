import { describe, expect, it } from 'vitest';

import { Game } from '../src/game/Game';

describe('Game contract', () => {
  it('owns start and dispose lifecycle methods', () => {
    expect(typeof Game.prototype.start).toBe('function');
    expect(typeof Game.prototype.dispose).toBe('function');
  });
});
