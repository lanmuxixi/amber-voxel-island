import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('HUD visibility and pointer events', () => {
  const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('keeps hidden overlays out of layout', () => {
    expect(styles).toMatch(
      /\.onboarding\[hidden\],\s*\.pause-menu\[hidden\],\s*\.notice\[hidden\]\s*\{[^}]*display:\s*none;/,
    );
  });

  it('lets visible menus and the reset dialog receive pointer input', () => {
    expect(styles).toMatch(
      /\.onboarding,\s*\.pause-menu,\s*\.reset-dialog\s*\{[^}]*pointer-events:\s*auto;/,
    );
    expect(styles).not.toMatch(
      /\.hotbar-slot(?:\s*,|\s*\{)[^}]*pointer-events:\s*auto;/,
    );
  });
});
