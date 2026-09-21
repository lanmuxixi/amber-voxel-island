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

test('persists edits across reload and resets without changing the seed', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(page.getByText('点击进入琥珀群岛')).toBeVisible();
  await page.getByText('点击进入琥珀群岛').click();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__?.snapshot().locked)).toBe(true);

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

  await page.getByRole('button', { name: '继续' }).click();
  await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__?.snapshot().locked)).toBe(true);
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
  await page.getByRole('button', { name: '点击进入琥珀群岛' }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
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
});
