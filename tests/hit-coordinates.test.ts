import { describe, expect, it } from 'vitest';

import { hitToEditCoordinates } from '../src/interaction/hitCoordinates';

describe('hitToEditCoordinates', () => {
  it('maps a ray hit to remove and place coordinates along the hit normal', () => {
    const point = { x: 2, y: 3.4, z: 4.8 };
    const normal = { x: 1, y: 0, z: 0 };

    expect(hitToEditCoordinates(point, normal, 'remove')).toEqual({ x: 1, y: 3, z: 4 });
    expect(hitToEditCoordinates(point, normal, 'place')).toEqual({ x: 2, y: 3, z: 4 });
  });
});
