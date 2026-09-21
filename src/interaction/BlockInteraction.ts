import * as THREE from 'three';

import { GAME_CONFIG } from '../game/config';
import type { Vec3i } from '../world/coords';

import { hitToEditCoordinates } from './hitCoordinates';

export interface BlockInteractionCallbacks {
  remove(position: Vec3i): void;
  place(position: Vec3i): void;
}

export class BlockInteraction {
  private readonly raycaster = new THREE.Raycaster();

  private readonly pointer = new THREE.Vector2(0, 0);

  private readonly outline: THREE.LineSegments;

  private targetRemove: Vec3i | null = null;

  private targetPlace: Vec3i | null = null;

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (!this.isLocked()) {
      return;
    }
    if (event.button === 0 && this.targetRemove) {
      this.callbacks.remove({ ...this.targetRemove });
    }
    if (event.button === 2 && this.targetPlace) {
      this.callbacks.place({ ...this.targetPlace });
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  constructor(
    private readonly camera: THREE.Camera,
    scene: THREE.Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: BlockInteractionCallbacks,
  ) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const material = new THREE.LineBasicMaterial({ color: '#ffe3a3' });
    this.outline = new THREE.LineSegments(edges, material);
    this.outline.visible = false;
    scene.add(this.outline);

    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  update(meshes: readonly THREE.Mesh[]): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.far = GAME_CONFIG.interactionDistance;
    const [hit] = this.raycaster.intersectObjects([...meshes], false);
    if (!hit || !hit.face) {
      this.targetRemove = null;
      this.targetPlace = null;
      this.outline.visible = false;
      return;
    }

    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    this.targetRemove = hitToEditCoordinates(hit.point, normal, 'remove');
    this.targetPlace = hitToEditCoordinates(hit.point, normal, 'place');
    this.outline.visible = true;
    this.outline.position.set(
      this.targetRemove.x + 0.5,
      this.targetRemove.y + 0.5,
      this.targetRemove.z + 0.5,
    );
  }

  getTarget(): Vec3i | null {
    return this.targetRemove ? { ...this.targetRemove } : null;
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.outline.geometry.dispose();
    const material = this.outline.material;
    if (material instanceof THREE.Material) {
      material.dispose();
    }
    this.outline.removeFromParent();
  }

  private isLocked(): boolean {
    return this.canvas.ownerDocument.pointerLockElement === this.canvas;
  }
}
