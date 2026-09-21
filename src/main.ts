import './styles.css';
import { Game } from './game/Game';
import { handlePageHide, handlePageShow } from './game/pageLifecycle';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const hudRoot = document.querySelector<HTMLElement>('#hud-root');

if (!canvas || !hudRoot) {
  throw new Error('Game shell is missing required DOM elements.');
}

const game = new Game(canvas, hudRoot);
game.start();
window.addEventListener('pagehide', (event) => handlePageHide(game, event));
window.addEventListener('pageshow', (event) => handlePageShow(game, event));
