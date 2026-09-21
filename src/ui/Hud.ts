import { BLOCKS, HOTBAR_BLOCKS } from '../world/blocks';

interface HudActions {
  onResume(): void;
  onReset(): void;
}

export class Hud {
  private readonly crosshair: HTMLDivElement;

  private readonly hotbar: HTMLDivElement;

  private readonly hotbarSlots: HTMLButtonElement[];

  private readonly onboarding: HTMLDivElement;

  private readonly enterButton: HTMLButtonElement;

  private readonly pauseMenu: HTMLDivElement;

  private readonly resumeButton: HTMLButtonElement;

  private readonly resetButton: HTMLButtonElement;

  private readonly noticeElement: HTMLDivElement;

  private readonly dialog: HTMLDialogElement;

  private readonly confirmButton: HTMLButtonElement;

  private readonly cancelButton: HTMLButtonElement;

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  private onboardingDismissed = false;

  constructor(private readonly root: HTMLElement, private readonly actions: HudActions) {
    this.root.replaceChildren();
    this.root.classList.add('hud');

    this.crosshair = document.createElement('div');
    this.crosshair.className = 'crosshair';

    this.hotbar = document.createElement('div');
    this.hotbar.className = 'hotbar';
    this.hotbarSlots = HOTBAR_BLOCKS.map((block, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotbar-slot';
      button.disabled = block === null;
      button.setAttribute('aria-label', `物品栏槽位 ${index + 1}`);
      const shortcut = document.createElement('span');
      shortcut.className = 'hotbar-shortcut';
      shortcut.textContent = String(index + 1);
      const label = document.createElement('span');
      label.className = 'hotbar-label';
      label.textContent = block === null ? '空' : BLOCKS[block].label;
      button.append(shortcut, label);
      this.hotbar.append(button);
      return button;
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
    pauseCopy.textContent = '继续探索或重置世界。';
    this.resumeButton = document.createElement('button');
    this.resumeButton.type = 'button';
    this.resumeButton.className = 'primary-button';
    this.resumeButton.textContent = '继续';
    this.resumeButton.setAttribute('aria-label', '继续');
    this.resumeButton.addEventListener('click', this.actions.onResume);
    this.resetButton = document.createElement('button');
    this.resetButton.type = 'button';
    this.resetButton.className = 'secondary-button';
    this.resetButton.textContent = '重置世界';
    this.resetButton.setAttribute('aria-label', '重置世界');
    this.resetButton.addEventListener('click', this.actions.onReset);
    this.pauseMenu.append(pauseTitle, pauseCopy, this.resumeButton, this.resetButton);

    this.noticeElement = document.createElement('div');
    this.noticeElement.className = 'notice panel';
    this.noticeElement.hidden = true;

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
      this.noticeElement,
      this.dialog,
    );
  }

  renderHotbar(selectedIndex: number): void {
    for (const [index, slot] of this.hotbarSlots.entries()) {
      slot.classList.toggle('is-selected', index === selectedIndex);
      slot.setAttribute('aria-pressed', String(index === selectedIndex));
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

  notice(message: string, persistent = false): void {
    this.noticeElement.textContent = message;
    this.noticeElement.hidden = false;
    this.noticeElement.classList.toggle('is-persistent', persistent);
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
    if (!persistent) {
      this.noticeTimer = setTimeout(() => {
        this.noticeElement.hidden = true;
      }, 2200);
    }
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
    this.resetButton.removeEventListener('click', this.actions.onReset);
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }
    this.root.replaceChildren();
  }
}
