import { BLOCKS, HOTBAR_BLOCKS } from '../world/blocks';

interface HudActions {
  onResume(): void;
  onReset(): void;
}

export class Hud {
  private readonly crosshair: HTMLDivElement;

  private readonly hotbar: HTMLOListElement;

  private readonly hotbarSlots: HTMLLIElement[];

  private readonly onboarding: HTMLDivElement;

  private readonly enterButton: HTMLButtonElement;

  private readonly pauseMenu: HTMLDivElement;

  private readonly resumeButton: HTMLButtonElement;

  private readonly resetButton: HTMLButtonElement;

  private readonly controlsButton: HTMLButtonElement;

  private readonly controlsHelp: HTMLDivElement;

  private readonly noticeElement: HTMLDivElement;

  private readonly persistentNoticeElement: HTMLDivElement;

  private readonly dialog: HTMLDialogElement;

  private readonly confirmButton: HTMLButtonElement;

  private readonly cancelButton: HTMLButtonElement;

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  private onboardingDismissed = false;

  private readonly onToggleControls = (): void => {
    const expanded = this.controlsHelp.hidden;
    this.controlsHelp.hidden = !expanded;
    this.controlsButton.setAttribute('aria-expanded', String(expanded));
  };

  constructor(private readonly root: HTMLElement, private readonly actions: HudActions) {
    this.root.replaceChildren();
    this.root.classList.add('hud');

    this.crosshair = document.createElement('div');
    this.crosshair.className = 'crosshair';

    this.hotbar = document.createElement('ol');
    this.hotbar.className = 'hotbar';
    this.hotbar.setAttribute('aria-label', '快捷栏');
    this.hotbarSlots = HOTBAR_BLOCKS.map((block, index) => {
      const slot = document.createElement('li');
      slot.className = block === null ? 'hotbar-slot is-empty' : 'hotbar-slot';
      slot.setAttribute(
        'aria-label',
        `物品栏槽位 ${index + 1}${block === null ? '，空' : `，${BLOCKS[block].label}`}`,
      );
      const shortcut = document.createElement('span');
      shortcut.className = 'hotbar-shortcut';
      shortcut.textContent = String(index + 1);
      const label = document.createElement('span');
      label.className = 'hotbar-label';
      label.textContent = block === null ? '空' : BLOCKS[block].label;
      slot.append(shortcut, label);
      this.hotbar.append(slot);
      return slot;
    });

    this.onboarding = document.createElement('div');
    this.onboarding.className = 'onboarding panel';
    this.onboarding.innerHTML = `
      <h1>琥珀群岛</h1>
      <p>WASD 移动，Space 跳跃，鼠标查看，左键移除，右键放置，滚轮或数字键切换方块，Esc 暂停。</p>
    `;
    this.enterButton = document.createElement('button');
    this.enterButton.type = 'button';
    this.enterButton.className = 'primary-button';
    this.enterButton.textContent = '点击进入琥珀群岛';
    this.enterButton.setAttribute('aria-label', '点击进入琥珀群岛');
    this.enterButton.addEventListener('click', this.actions.onResume);
    this.onboarding.append(this.enterButton);

    this.pauseMenu = document.createElement('div');
    this.pauseMenu.className = 'pause-menu panel';
    this.pauseMenu.hidden = true;
    const pauseTitle = document.createElement('h2');
    pauseTitle.textContent = '暂停';
    const pauseCopy = document.createElement('p');
    pauseCopy.textContent = '继续探索、查看操作说明或重置世界。';
    this.resumeButton = document.createElement('button');
    this.resumeButton.type = 'button';
    this.resumeButton.className = 'primary-button';
    this.resumeButton.textContent = '继续';
    this.resumeButton.setAttribute('aria-label', '继续');
    this.resumeButton.addEventListener('click', this.actions.onResume);
    this.controlsButton = document.createElement('button');
    this.controlsButton.type = 'button';
    this.controlsButton.className = 'secondary-button';
    this.controlsButton.textContent = '操作说明';
    this.controlsButton.setAttribute('aria-expanded', 'false');
    this.controlsButton.setAttribute('aria-controls', 'pause-controls-help');
    this.controlsButton.addEventListener('click', this.onToggleControls);
    this.controlsHelp = document.createElement('div');
    this.controlsHelp.id = 'pause-controls-help';
    this.controlsHelp.className = 'controls-help';
    this.controlsHelp.hidden = true;
    this.controlsHelp.textContent = 'WASD 移动，Space 跳跃，鼠标查看，左键移除，右键放置，滚轮或数字键切换方块。';
    this.resetButton = document.createElement('button');
    this.resetButton.type = 'button';
    this.resetButton.className = 'secondary-button';
    this.resetButton.textContent = '重置世界';
    this.resetButton.setAttribute('aria-label', '重置世界');
    this.resetButton.addEventListener('click', this.actions.onReset);
    this.pauseMenu.append(pauseTitle, pauseCopy, this.resumeButton, this.controlsButton, this.controlsHelp, this.resetButton);

    this.noticeElement = document.createElement('div');
    this.noticeElement.className = 'notice panel';
    this.noticeElement.hidden = true;
    this.noticeElement.setAttribute('role', 'status');
    this.noticeElement.setAttribute('aria-live', 'polite');

    this.persistentNoticeElement = document.createElement('div');
    this.persistentNoticeElement.className = 'persistent-notice panel';
    this.persistentNoticeElement.hidden = true;
    this.persistentNoticeElement.setAttribute('role', 'alert');
    this.persistentNoticeElement.setAttribute('aria-live', 'assertive');

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'reset-dialog panel';
    this.dialog.innerHTML = `
      <h2>确认重置</h2>
      <p>这会清空已放置和移除的方块，并把你送回出生点。</p>
    `;
    const dialogActions = document.createElement('div');
    dialogActions.className = 'dialog-actions';
    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'secondary-button';
    this.cancelButton.textContent = '取消';
    this.cancelButton.setAttribute('aria-label', '取消');
    this.confirmButton = document.createElement('button');
    this.confirmButton.type = 'button';
    this.confirmButton.className = 'primary-button';
    this.confirmButton.textContent = '确认重置';
    this.confirmButton.setAttribute('aria-label', '确认重置');
    dialogActions.append(this.cancelButton, this.confirmButton);
    this.dialog.append(dialogActions);

    this.root.append(
      this.crosshair,
      this.hotbar,
      this.onboarding,
      this.pauseMenu,
      this.persistentNoticeElement,
      this.noticeElement,
      this.dialog,
    );
  }

  renderHotbar(selectedIndex: number): void {
    for (const [index, slot] of this.hotbarSlots.entries()) {
      slot.classList.toggle('is-selected', index === selectedIndex);
      if (index === selectedIndex) {
        slot.setAttribute('aria-current', 'true');
      } else {
        slot.removeAttribute('aria-current');
      }
    }
  }

  setPaused(paused: boolean, firstVisit: boolean): void {
    const showOnboarding = paused && firstVisit && !this.onboardingDismissed;
    this.onboarding.hidden = !showOnboarding;
    this.pauseMenu.hidden = !paused || showOnboarding;
    this.crosshair.classList.toggle('is-hidden', paused);
  }

  dismissOnboarding(): void {
    this.onboardingDismissed = true;
    this.onboarding.hidden = true;
  }

  notice(message: string): void {
    this.noticeElement.textContent = message;
    this.noticeElement.hidden = false;
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
    this.noticeTimer = setTimeout(() => {
      this.noticeElement.hidden = true;
    }, 2200);
  }

  persistentNotice(message: string): void {
    this.persistentNoticeElement.textContent = message;
    this.persistentNoticeElement.hidden = false;
  }

  confirmReset(): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (result: boolean): void => {
        this.confirmButton.removeEventListener('click', onConfirm);
        this.cancelButton.removeEventListener('click', onCancel);
        this.dialog.removeEventListener('cancel', onCancelEvent);
        this.dialog.close();
        resolve(result);
      };
      const onConfirm = (): void => finish(true);
      const onCancel = (): void => finish(false);
      const onCancelEvent = (event: Event): void => {
        event.preventDefault();
        finish(false);
      };
      this.confirmButton.addEventListener('click', onConfirm, { once: true });
      this.cancelButton.addEventListener('click', onCancel, { once: true });
      this.dialog.addEventListener('cancel', onCancelEvent, { once: true });
      this.dialog.showModal();
    });
  }

  dispose(): void {
    this.enterButton.removeEventListener('click', this.actions.onResume);
    this.resumeButton.removeEventListener('click', this.actions.onResume);
    this.controlsButton.removeEventListener('click', this.onToggleControls);
    this.resetButton.removeEventListener('click', this.actions.onReset);
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }
    this.root.replaceChildren();
  }
}
