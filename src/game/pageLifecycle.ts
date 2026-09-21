export interface PageLifecycleGame {
  dispose(): void;
  flushSave(): void;
  start(): void;
}

export function handlePageHide(game: PageLifecycleGame, event: Pick<PageTransitionEvent, 'persisted'>): void {
  if (event.persisted) {
    game.flushSave();
    return;
  }
  game.dispose();
}

export function handlePageShow(game: PageLifecycleGame, event: Pick<PageTransitionEvent, 'persisted'>): void {
  if (event.persisted) {
    game.start();
  }
}
