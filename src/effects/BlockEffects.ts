import * as THREE from 'three';

import { BLOCKS, type BlockId } from '../world/blocks';
import type { Vec3i } from '../world/coords';

interface ParticleEntry {
  index: number;
  active: boolean;
  age: number;
  duration: number;
}

interface ParticleState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
}

interface PlaceAnimation {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
}

export class ParticlePool {
  readonly entries: ParticleEntry[];

  private nextIndex = 0;

  constructor(capacity: number) {
    this.entries = Array.from({ length: capacity }, (_, index) => ({
      index,
      active: false,
      age: 0,
      duration: 0,
    }));
  }

  acquire(duration: number): ParticleEntry {
    const released = this.entries.find((entry) => !entry.active);
    const entry = released ?? this.entries[this.nextIndex]!;
    entry.active = true;
    entry.age = 0;
    entry.duration = duration;
    if (!released) {
      this.nextIndex = (this.nextIndex + 1) % this.entries.length;
    }
    return entry;
  }

  release(index: number): void {
    const entry = this.entries[index];
    if (!entry) {
      return;
    }
    entry.active = false;
    entry.age = 0;
  }

  update(dt: number): void {
    for (const entry of this.entries) {
      if (!entry.active) {
        continue;
      }
      entry.age += dt;
      if (entry.age >= entry.duration) {
        entry.active = false;
      }
    }
  }
}

export class BlockEffects {
  private readonly pool = new ParticlePool(24);

  private readonly particles: ParticleState[] = Array.from({ length: 24 }, () => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    color: new THREE.Color('#ffffff'),
  }));

  private readonly particleMesh: THREE.InstancedMesh;

  private readonly particleDummy = new THREE.Object3D();

  private readonly placeGeometry = new THREE.BoxGeometry(1, 1, 1);

  private readonly placeMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.45,
  });

  private readonly placeAnimations: PlaceAnimation[] = [];

  private audioContext: AudioContext | null = null;

  constructor(private readonly scene: THREE.Scene) {
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshBasicMaterial({ vertexColors: true }),
      24,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particleMesh);
    this.syncParticles();
  }

  remove(position: Vec3i, block: BlockId): void {
    const center = new THREE.Vector3(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    for (let index = 0; index < 6; index += 1) {
      const entry = this.pool.acquire(0.45);
      const particle = this.particles[entry.index]!;
      const angle = ((entry.index + index) / 6) * Math.PI * 2;
      particle.position.copy(center);
      particle.velocity.set(Math.cos(angle) * 1.3, 1.5 + (entry.index % 3) * 0.18, Math.sin(angle) * 1.3);
      particle.color.set(BLOCKS[block].color);
    }
    this.playTone('sine', 130, 75, 0.08, 0.035);
  }

  place(position: Vec3i, block: BlockId): void {
    let animation = this.placeAnimations.find((item) => item.age >= item.duration);
    if (!animation && this.placeAnimations.length >= 4) {
      animation = this.placeAnimations.reduce((oldest, current) => (current.age > oldest.age ? current : oldest));
      animation.mesh.removeFromParent();
    }
    if (!animation) {
      const mesh = new THREE.Mesh(this.placeGeometry, this.placeMaterial.clone());
      this.scene.add(mesh);
      animation = { mesh, age: 0, duration: 0.12 };
      this.placeAnimations.push(animation);
    }

    animation.age = 0;
    animation.duration = 0.12;
    animation.mesh.visible = true;
    animation.mesh.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    (animation.mesh.material as THREE.MeshBasicMaterial).color.set(BLOCKS[block].color);
    animation.mesh.scale.setScalar(0.72);
    this.playTone('triangle', 180, 120, 0.055, 0.03);
  }

  update(dt: number): void {
    this.pool.update(dt);
    for (const entry of this.pool.entries) {
      const particle = this.particles[entry.index]!;
      if (entry.active) {
        particle.velocity.y -= 12 * dt;
        particle.position.addScaledVector(particle.velocity, dt);
      }
      this.particleDummy.position.copy(particle.position);
      this.particleDummy.scale.setScalar(entry.active ? 1 : 0);
      this.particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(entry.index, this.particleDummy.matrix);
      this.particleMesh.setColorAt(entry.index, particle.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }

    for (const animation of this.placeAnimations) {
      animation.age += dt;
      const progress = Math.min(animation.age / animation.duration, 1);
      const scale = 0.72 + (1 - 0.72) * progress;
      animation.mesh.scale.setScalar(scale);
      (animation.mesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - progress * 0.4);
      if (progress >= 1) {
        animation.mesh.visible = false;
      }
    }
  }

  dispose(): void {
    this.particleMesh.removeFromParent();
    this.particleMesh.geometry.dispose();
    if (this.particleMesh.material instanceof THREE.Material) {
      this.particleMesh.material.dispose();
    }
    for (const animation of this.placeAnimations) {
      animation.mesh.removeFromParent();
      animation.mesh.geometry.dispose();
      if (animation.mesh.material instanceof THREE.Material) {
        animation.mesh.material.dispose();
      }
    }
    this.placeGeometry.dispose();
    this.placeMaterial.dispose();
  }

  private syncParticles(): void {
    for (const entry of this.pool.entries) {
      this.particleDummy.position.set(0, 0, 0);
      this.particleDummy.scale.setScalar(0);
      this.particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(entry.index, this.particleDummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) {
      return null;
    }
    if (!this.audioContext) {
      this.audioContext = new window.AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private playTone(
    type: OscillatorType,
    startFrequency: number,
    endFrequency: number,
    duration: number,
    maxGain: number,
  ): void {
    const audio = this.ensureAudioContext();
    if (!audio) {
      return;
    }
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(maxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
