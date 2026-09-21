import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetRandomValues = Crypto.prototype.getRandomValues;
    let suppliedWorldSeed = false;
    let pointerLockElement: Element | null = null;

    Crypto.prototype.getRandomValues = function getRandomValues<T extends ArrayBufferView>(array: T): T {
      if (!suppliedWorldSeed && array instanceof Uint32Array && array.length === 1) {
        array[0] = 1_945_533_262;
        suppliedWorldSeed = true;
        return array;
      }
      return nativeGetRandomValues.call(this, array) as T;
    };

    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      configurable: true,
      get: () => pointerLockElement,
    });

    HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock(): Promise<void> {
      pointerLockElement = this;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };

    Document.prototype.exitPointerLock = function exitPointerLock(): Promise<void> {
      pointerLockElement = null;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };

    window.addEventListener(
      'keydown',
      (event) => {
        if (event.code === 'Escape' && pointerLockElement) {
          void document.exitPointerLock();
        }
      },
      { capture: true },
    );
  });
});

async function enterWorld(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /点击进入琥珀群岛|继续/ }).click();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__?.snapshot().locked)).toBe(true);
}

interface BrowserSave {
  version: 1;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  selectedSlot: number;
  changes: [number, number, number, number][];
}

async function preloadSave(page: import('@playwright/test').Page, save: BrowserSave): Promise<void> {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('amber-voxel-island:e2e-preloaded') !== null) {
      return;
    }
    localStorage.setItem('amber-voxel-island:v1', JSON.stringify(value));
    sessionStorage.setItem('amber-voxel-island:e2e-preloaded', '1');
  }, save);
}

async function replaceSaveOnNextLoad(page: import('@playwright/test').Page, save: BrowserSave): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('amber-voxel-island:v1', JSON.stringify(value));
  }, save);
}

test('persists edits across reload and resets without changing the seed', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(page.getByText('点击进入琥珀群岛')).toBeVisible();
  await enterWorld(page);

  const before = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.2);

  await page.mouse.move(720, 650);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().target)).not.toBeNull();
  await page.mouse.click(720, 450);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBeGreaterThan(0);

  const saved = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot());
  await page.waitForTimeout(350);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBe(saved.deltaLength);

  await enterWorld(page);
  await page.mouse.move(720, 650);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().target)).not.toBeNull();
  const beforePlaceDeltaLength = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength);
  await page.mouse.click(720, 450, { button: 'right' });
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).not.toBe(beforePlaceDeltaLength);
  await page.keyboard.press('Digit2');
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().selectedSlot)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '重置世界' })).toBeVisible();
  await page.getByRole('button', { name: '重置世界' }).click();
  await page.getByRole('button', { name: '确认重置' }).click();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().selectedSlot)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().seed)).toBe(saved.seed);
});

test('keeps the hotbar and pause menu inside a 1024x768 viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/?e2e=1');
  await enterWorld(page);
  await page.keyboard.press('Escape');

  const hotbar = page.locator('.hotbar');
  const pauseMenu = page.locator('.pause-menu');
  await expect(hotbar).toBeVisible();
  await expect(pauseMenu).toBeVisible();

  const viewport = page.viewportSize();
  const hotbarBox = await hotbar.boundingBox();
  const pauseBox = await pauseMenu.boundingBox();
  expect(viewport).not.toBeNull();
  expect(hotbarBox).not.toBeNull();
  expect(pauseBox).not.toBeNull();
  expect((hotbarBox?.x ?? 0) >= 0).toBe(true);
  expect((hotbarBox?.y ?? 0) >= 0).toBe(true);
  expect((hotbarBox?.x ?? 0) + (hotbarBox?.width ?? 0) <= (viewport?.width ?? 0)).toBe(true);
  expect((hotbarBox?.y ?? 0) + (hotbarBox?.height ?? 0) <= (viewport?.height ?? 0)).toBe(true);
  expect((pauseBox?.x ?? 0) >= 0).toBe(true);
  expect((pauseBox?.y ?? 0) >= 0).toBe(true);
  expect((pauseBox?.x ?? 0) + (pauseBox?.width ?? 0) <= (viewport?.width ?? 0)).toBe(true);
  expect((pauseBox?.y ?? 0) + (pauseBox?.height ?? 0) <= (viewport?.height ?? 0)).toBe(true);

  await page.getByRole('button', { name: '操作说明' }).click();
  await expect(page.locator('.controls-help')).toContainText('WASD 移动，Space 跳跃');
});

test('jumps and collides with a deterministic wall', async ({ page }) => {
  const changes: BrowserSave['changes'] = [];
  for (let x = 9; x <= 11; x += 1) {
    for (let z = 9; z <= 11; z += 1) {
      changes.push([x, 25, z, 3]);
    }
  }
  changes.push([10, 26, 9, 3], [10, 27, 9, 3]);
  await preloadSave(page, {
    version: 1,
    seed: 1_945_533_262,
    player: { x: 10.5, y: 26.01, z: 10.5, yaw: 0, pitch: 0 },
    selectedSlot: 0,
    changes,
  });
  await page.goto('/?e2e=1');
  await enterWorld(page);
  await page.waitForTimeout(150);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const atWall = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);
  expect(atWall.z).toBeGreaterThan(10.3);
  expect(atWall.z).toBeLessThan(10.5);

  const beforeJumpY = atWall.y;
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player.y)).toBeGreaterThan(beforeJumpY + 0.2);
  await page.keyboard.up('Space');
});

test('flushes the latest player coordinates before an immediate reload', async ({ page }) => {
  await page.goto('/?e2e=1');
  await enterWorld(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(140);
  await page.keyboard.up('KeyD');
  const beforeReload = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);

  await page.reload();

  const restored = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);
  expect(restored.x).toBeCloseTo(beforeReload.x, 3);
  expect(restored.y).toBeCloseTo(beforeReload.y, 3);
  expect(restored.z).toBeCloseTo(beforeReload.z, 3);
});

test('rejects edits beyond the finite edge and restores an in-bounds edge edit', async ({ page }) => {
  const edgeSave: BrowserSave = {
    version: 1,
    seed: 1_945_533_262,
    player: { x: 26.5, y: 24.01, z: 0.5, yaw: -Math.PI / 2, pitch: 0 },
    selectedSlot: 0,
    changes: [
      [26, 23, 0, 3],
      [31, 25, 0, 3],
    ],
  };
  await preloadSave(page, edgeSave);
  await page.goto('/?e2e=1');
  await enterWorld(page);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().target)).toEqual({ x: 31, y: 25, z: 0 });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBe(2);
  await enterWorld(page);
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().target)).toEqual({ x: 31, y: 25, z: 0 });

  await replaceSaveOnNextLoad(page, {
    ...edgeSave,
    changes: [[32, 25, 0, 3]],
  });
  await page.reload();
  await expect(page.getByText('旧存档无法读取，已创建新岛屿。')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBe(0);
});
