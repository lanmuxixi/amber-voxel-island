import type { Vec3i } from '../world/coords';

export function hitToEditCoordinates(
  point: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  mode: 'place' | 'remove',
): Vec3i {
  const epsilon = 0.001;
  const sign = mode === 'place' ? 1 : -1;
  return {
    x: Math.floor(point.x + normal.x * epsilon * sign),
    y: Math.floor(point.y + normal.y * epsilon * sign),
    z: Math.floor(point.z + normal.z * epsilon * sign),
  };
}
