import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Hud } from '../src/ui/Hud';

class FakeClassList {
  private readonly values = new Set<string>();

  set(value: string): void {
    this.values.clear();
    for (const name of value.split(/\s+/).filter(Boolean)) {
      this.values.add(name);
    }
  }

  add(...names: string[]): void {
    names.forEach((name) => this.values.add(name));
  }

  contains(name: string): boolean {
    return this.values.has(name);
  }

  toggle(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(name);
    if (enabled) {
      this.values.add(name);
    } else {
      this.values.delete(name);
    }
    return enabled;
  }

  toString(): string {
    return [...this.values].join(' ');
  }
}

class FakeElement extends EventTarget {
  readonly classList = new FakeClassList();

  readonly attributes = new Map<string, string>();

  children: FakeElement[] = [];

  hidden = false;

  textContent = '';

  innerHTML = '';

  type = '';

  disabled = false;

  open = false;

  constructor(readonly tagName: string) {
    super();
  }

  get className(): string {
    return this.classList.toString();
  }

  set className(value: string) {
    this.classList.set(value);
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = [...children];
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  showModal(): void {
    this.open = true;
  }

  close(): void {
    this.open = false;
  }
}

function findByClass(root: FakeElement, className: string): FakeElement {
  if (root.classList.contains(className)) {
    return root;
  }
  for (const child of root.children) {
    try {
      return findByClass(child, className);
    } catch {
      // Continue through the small fake tree.
    }
  }
  throw new Error(`Missing .${className}`);
}

function findByText(root: FakeElement, text: string): FakeElement {
  if (root.textContent === text) {
    return root;
  }
  for (const child of root.children) {
    try {
      return findByText(child, text);
    } catch {
      // Continue through the small fake tree.
    }
  }
  throw new Error(`Missing text ${text}`);
}

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: (tagName: string) => new FakeElement(tagName.toUpperCase()),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Hud', () => {
  it('keeps persistent storage warnings visible while transient notices expire', () => {
    vi.useFakeTimers();
    const root = new FakeElement('DIV');
    const hud = new Hud(root as unknown as HTMLElement, { onResume: vi.fn(), onReset: vi.fn() });

    hud.persistentNotice('存储失败');
    hud.notice('这里会挡住你');
    vi.advanceTimersByTime(2200);

    const persistent = findByClass(root, 'persistent-notice');
    const transient = findByClass(root, 'notice');
    expect(persistent.textContent).toBe('存储失败');
    expect(persistent.hidden).toBe(false);
    expect(transient.hidden).toBe(true);
  });

  it('uses non-interactive hotbar items and live notice regions', () => {
    const root = new FakeElement('DIV');
    new Hud(root as unknown as HTMLElement, { onResume: vi.fn(), onReset: vi.fn() });

    const hotbar = findByClass(root, 'hotbar');
    expect(hotbar.tagName).toBe('OL');
    expect(hotbar.children).toHaveLength(9);
    expect(hotbar.children.every((slot) => slot.tagName === 'LI')).toBe(true);
    expect(findByClass(root, 'notice').getAttribute('aria-live')).toBe('polite');
    expect(findByClass(root, 'persistent-notice').getAttribute('aria-live')).toBe('assertive');
  });

  it('offers controls from the pause menu', () => {
    const root = new FakeElement('DIV');
    const hud = new Hud(root as unknown as HTMLElement, { onResume: vi.fn(), onReset: vi.fn() });
    hud.dismissOnboarding();
    hud.setPaused(true, true);

    const controlsButton = findByText(root, '操作说明');
    const controls = findByClass(root, 'controls-help');
    expect(controls.hidden).toBe(true);
    controlsButton.dispatchEvent(new Event('click'));
    expect(controls.hidden).toBe(false);
    expect(controlsButton.getAttribute('aria-expanded')).toBe('true');
  });
});
