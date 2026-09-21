import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('project runtime metadata', () => {
  it('documents the Node versions required by Vite', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

    expect(readme).toContain('Node.js 20.19+ 或 22.12+');
    expect(readme).toContain('原生 Pointer Lock');
  });

  it('keeps Three.js runtime and type packages on the r180 line', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies.three).toMatch(/^\^0\.180\./);
    expect(packageJson.devDependencies['@types/three']).toMatch(/^\^0\.180\./);
  });

  it('builds assets for the GitHub Pages project path', () => {
    const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(viteConfig).toContain("base: '/amber-voxel-island/'");
  });
});
