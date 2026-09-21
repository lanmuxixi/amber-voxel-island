import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlayerController } from '../src/player/PlayerController';
import type { PlayerState } from '../src/player/physics';
import { BlockId } from '../src/world/blocks';
import type { WorldReader } from '../src/world/World';

class FlatWorld implements WorldReader {
  getBlock(position: { x: number; y: number; z: number }): BlockId {
    return position.y === 0 ? BlockId.Foundation : BlockId.Air;
  }
}

const initial: PlayerState = {
  position: { x: 0.5, y: 1.001, z: 0.5 },
  velocity: { x: 0, y: 0, z: 0 },
  yaw: 0,
  pitch: 0,
  grounded: true,
};

function keyboardEvent(type: string, code: string): KeyboardEvent {
  return Object.assign(new Event(type), { code }) as KeyboardEvent;
}

let pointerLockElement: Element | null;

beforeEach(() => {
  pointerLockElement = null;
  const browserWindow = new EventTarget() as Window;
  const browserDocument = new EventTarget() as Document;
  Object.defineProperty(browserDocument, 'pointerLockElement', {
    configurable: true,
    get: () => pointerLockElement,
  });
  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('document', browserDocument);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createController(): { controller: PlayerController; canvas: HTMLCanvasElement } {
  const canvas = Object.assign(new EventTarget(), {
    requestPointerLock: vi.fn(),
  }) as unknown as HTMLCanvasElement;
  pointerLockElement = canvas;
  return {
    canvas,
    controller: new PlayerController(canvas, new THREE.PerspectiveCamera(), new FlatWorld(), initial),
  };
}

describe('PlayerController input lifecycle', () => {
  it('clears held movement keys when the window loses focus', () => {
    const { controller } = createController();
    window.dispatchEvent(keyboardEvent('keydown', 'KeyW'));
    controller.update(1 / 60);
    const movedZ = controller.getState().position.z;

    window.dispatchEvent(new Event('blur'));
    controller.update(1 / 60);

    expect(controller.getState().position.z).toBeCloseTo(movedZ);
    controller.dispose();
  });

  it('clears held movement keys when pointer lock is lost', () => {
    const { controller } = createController();
    window.dispatchEvent(keyboardEvent('keydown', 'KeyD'));
    controller.update(1 / 60);
    const movedX = controller.getState().position.x;

    pointerLockElement = null;
    document.dispatchEvent(new Event('pointerlockchange'));
    controller.update(1 / 60);

    expect(controller.getState().position.x).toBeCloseTo(movedX);
    controller.dispose();
  });
});
