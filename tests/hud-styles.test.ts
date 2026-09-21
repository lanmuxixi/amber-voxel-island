import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('HUD visibility and pointer events', () => {
  const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('keeps hidden overlays out of layout', () => {
    expect(styles).toMatch(
      /\.onboarding\[hidden\],\s*\.pause-menu\[hidden\],\s*\.notice\[hidden\],\s*\.persistent-notice\[hidden\],\s*\.controls-help\[hidden\]\s*\{[^}]*display:\s*none;/,
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

  it('keeps the selected slot lift independent from its entrance animation', () => {
    expect(styles).toMatch(
      /@keyframes rise-in[\s\S]*?translate:\s*0 14px;[\s\S]*?translate:\s*0 0;/,
    );
    expect(styles).toMatch(
      /\.hotbar-slot\.is-selected\s*\{[^}]*transform:\s*translateY\(-4px\);/,
    );
  });
});
