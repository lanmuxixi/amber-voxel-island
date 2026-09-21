import { defineConfig } from 'vite';

export default defineConfig({
  base: '/amber-voxel-island/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
