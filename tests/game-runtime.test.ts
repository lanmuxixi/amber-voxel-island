import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayerState } from '../src/player/physics';

const spies = vi.hoisted(() => ({
  hudNotice: vi.fn(),
}));

vi.mock('three', () => {
  class WebGLRenderer {
    readonly shadowMap = { enabled: false, type: 0 };

    outputColorSpace = '';

    setPixelRatio(): void {}

    setSize(): void {}

    render(): void {}

    dispose(): void {}
  }

  class Scene {
    fog: unknown = null;

    add(): void {}
  }

  class PerspectiveCamera {
    aspect = 1;

    updateProjectionMatrix(): void {}
  }

  class DirectionalLight {
    readonly position = { set: () => undefined };

    readonly shadow = {
      mapSize: { set: () => undefined },
      camera: { left: 0, right: 0, top: 0, bottom: 0 },
    };

    castShadow = false;
  }

  return {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    DirectionalLight,
    HemisphereLight: class {},
    Fog: class {},
    PCFSoftShadowMap: 1,
    SRGBColorSpace: 'srgb',
  };
});

vi.mock('../src/effects/BlockEffects', () => ({
  BlockEffects: class {
    remove(): void {}

    place(): void {}

    update(): void {}

    dispose(): void {}
  },
}));

vi.mock('../src/interaction/BlockInteraction', () => ({
  BlockInteraction: class {
    update(): void {}

    getTarget(): null {
      return null;
    }

    dispose(): void {}
  },
}));

vi.mock('../src/player/PlayerController', () => ({
  PlayerController: class {
    private state: PlayerState;

    constructor(_canvas: HTMLCanvasElement, _camera: unknown, _world: unknown, initial: PlayerState) {
      this.state = structuredClone(initial);
    }

    requestLock(): void {}

    isLocked(): boolean {
      return false;
    }

    update(): void {}

    getState(): PlayerState {
      return structuredClone(this.state);
    }

    setState(state: PlayerState): void {
      this.state = structuredClone(state);
    }

    replaceWorld(): void {}

    dispose(): void {}
  },
}));

vi.mock('../src/ui/Hud', () => ({
  Hud: class {
    notice = spies.hudNotice;

    renderHotbar(): void {}

    setPaused(): void {}

    dismissOnboarding(): void {}

    async confirmReset(): Promise<boolean> {
      return false;
    }

    dispose(): void {}
  },
}));

vi.mock('../src/world/ChunkRenderer', () => ({
  ChunkRenderer: class {
    buildAll(): void {}

    markBlockDirty(): void {}

    getMeshes(): [] {
      return [];
    }

    rebuildPending(): void {}

    replaceWorld(): void {}

    dispose(): void {}
  },
}));

vi.mock('../src/world/terrain', () => ({
  generateIsland: () => ({
    blocks: new Map(),
    spawn: { x: 0.5, y: 6.25, z: -0.5 },
  }),
}));

import { Game } from '../src/game/Game';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function createStorage(): StoragePort & { setItem: ReturnType<typeof vi.fn> } {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

function installBrowser(getStorage: () => StoragePort): {
  requestFrame: ReturnType<typeof vi.fn>;
  cancelFrame: ReturnType<typeof vi.fn>;
} {
  const browserWindow = new EventTarget() as Window;
  Object.assign(browserWindow, { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 });
  Object.defineProperty(browserWindow, 'localStorage', { configurable: true, get: getStorage });

  const browserDocument = new EventTarget() as Document;
  Object.defineProperty(browserDocument, 'hidden', { configurable: true, value: false });

  let nextFrame = 1;
  const requestFrame = vi.fn(() => nextFrame++);
  const cancelFrame = vi.fn();

  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('document', browserDocument);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('crypto', {
    getRandomValues(values: Uint32Array): Uint32Array {
      values[0] = 777;
      return values;
    },
  });
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getStorage });

  return { requestFrame, cancelFrame };
}

function createGame(): Game {
  return new Game(
    { clientWidth: 1280, clientHeight: 720 } as HTMLCanvasElement,
    {} as HTMLElement,
  );
}

beforeEach(() => {
  spies.hudNotice.mockClear();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Game runtime boundaries', () => {
  it('starts with a fallback and reports unavailable storage when the localStorage accessor throws', () => {
    installBrowser(() => {
      throw new Error('storage access denied');
    });

    expect(() => createGame()).not.toThrow();
    expect(spies.hudNotice).toHaveBeenCalledWith(
      '浏览器存储不可用，本次进度可能无法保留。',
      true,
    );
  });

  it('immediately persists the generated initial snapshot when no valid save exists', () => {
    const storage = createStorage();
    installBrowser(() => storage);

    createGame();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.setItem.mock.calls[0]?.[1] as string)).toEqual({
      version: 1,
      seed: 777,
      player: { x: 0.5, y: 6.25, z: -0.5, yaw: 0, pitch: -0.35 },
      selectedSlot: 0,
      changes: [],
    });
  });

  it('starts only one animation loop', () => {
    const storage = createStorage();
    const { requestFrame } = installBrowser(() => storage);
    const game = createGame();

    game.start();
    game.start();

    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it('does not schedule another frame when a queued callback runs after disposal', () => {
    const storage = createStorage();
    const { requestFrame, cancelFrame } = installBrowser(() => storage);
    const game = createGame();
    game.start();
    const queuedFrame = requestFrame.mock.calls[0]?.[0] as FrameRequestCallback;

    game.dispose();
    queuedFrame(performance.now() + 16);
    game.start();

    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });
});
