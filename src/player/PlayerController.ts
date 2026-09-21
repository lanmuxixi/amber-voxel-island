import * as THREE from 'three';

import { GAME_CONFIG } from '../game/config';
import type { WorldReader } from '../world/World';

import { stepPlayer, type PlayerInput, type PlayerState } from './physics';

export class PlayerController {
  private state: PlayerState;

  private readonly keys = new Set<string>();

  private world: WorldReader;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.isLocked()) {
      return;
    }
    this.state.yaw -= event.movementX * 0.0022;
    const pitchLimit = Math.PI / 2 - 0.001;
    this.state.pitch = THREE.MathUtils.clamp(this.state.pitch - event.movementY * 0.0022, -pitchLimit, pitchLimit);
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.PerspectiveCamera,
    world: WorldReader,
    initial: PlayerState,
  ) {
    this.world = world;
    this.state = {
      position: { ...initial.position },
      velocity: { ...initial.velocity },
      yaw: initial.yaw,
      pitch: initial.pitch,
      grounded: initial.grounded,
    };
    this.camera.rotation.order = 'YXZ';
    this.applyCamera();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  update(deltaSeconds: number): void {
    const input: PlayerInput = {
      forward: Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')),
      right: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      jump: this.keys.has('Space'),
    };
    this.state = stepPlayer(this.world, this.state, input, deltaSeconds);
    this.applyCamera();
  }

  replaceWorld(world: WorldReader): void {
    this.world = world;
  }

  getState(): PlayerState {
    return {
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      grounded: this.state.grounded,
    };
  }

  setState(state: PlayerState): void {
    this.state = {
      position: { ...state.position },
      velocity: { ...state.velocity },
      yaw: state.yaw,
      pitch: state.pitch,
      grounded: state.grounded,
    };
    this.applyCamera();
  }

  isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    this.canvas.requestPointerLock();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  private applyCamera(): void {
    this.camera.position.set(
      this.state.position.x,
      this.state.position.y + GAME_CONFIG.eyeHeight,
      this.state.position.z,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.state.yaw;
    this.camera.rotation.x = this.state.pitch;
  }
}
