import './styles.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const hud = document.querySelector<HTMLDivElement>('#hud-root');

if (!canvas) {
  throw new Error('Missing #game-canvas element');
}

if (!hud) {
  throw new Error('Missing #hud-root element');
}

hud.innerHTML = `
  <div class="boot-card">
    <h1>琥珀群岛</h1>
    <p>正在生成琥珀群岛...</p>
  </div>
`;

canvas.setAttribute('aria-label', 'Voxel island viewport');
