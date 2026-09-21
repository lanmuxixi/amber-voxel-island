import { describe, expect, it, vi } from 'vitest';

import { handlePageHide, handlePageShow } from '../src/game/pageLifecycle';

function createGameLifecycle() {
  return {
    dispose: vi.fn(),
    flushSave: vi.fn(),
    start: vi.fn(),
  };
}

describe('page lifecycle', () => {
  it('flushes without disposing when pagehide enters the back-forward cache', () => {
    const game = createGameLifecycle();

    handlePageHide(game, { persisted: true });

    expect(game.flushSave).toHaveBeenCalledTimes(1);
    expect(game.dispose).not.toHaveBeenCalled();
  });

  it('disposes on a normal pagehide', () => {
    const game = createGameLifecycle();

    handlePageHide(game, { persisted: false });

    expect(game.dispose).toHaveBeenCalledTimes(1);
    expect(game.flushSave).not.toHaveBeenCalled();
  });

  it('requests a render when a cached page is restored', () => {
    const game = createGameLifecycle();

    handlePageShow(game, { persisted: true });

    expect(game.start).toHaveBeenCalledTimes(1);
  });
});
