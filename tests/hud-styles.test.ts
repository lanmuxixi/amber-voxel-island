import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('HUD pointer events', () => {
  it('lets only menus and the reset dialog receive pointer input', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(styles).toMatch(
      /\.onboarding,\s*\.pause-menu,\s*\.reset-dialog\s*\{[^}]*pointer-events:\s*auto;/,
    );
    expect(styles).not.toMatch(
      /\.hotbar-slot(?:\s*,|\s*\{)[^}]*pointer-events:\s*auto;/,
    );
  });
});
