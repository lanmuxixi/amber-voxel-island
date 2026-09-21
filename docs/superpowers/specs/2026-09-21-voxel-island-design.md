# Voxel Island Game Design

## Summary

Build a single-player, desktop-browser creative sandbox inspired by voxel building games. The first release focuses on a polished core loop: explore a finite generated island, select blocks from a hotbar, and place or remove blocks. It uses original names, colors, and generated textures rather than copying Minecraft assets.

## Product Goals

- Deliver a playable first-person voxel sandbox that starts quickly in a browser.
- Make movement, collision, targeting, block removal, and block placement feel reliable.
- Give the project a distinct visual identity through an amber-dusk palette and original procedural textures.
- Preserve player changes automatically between browser sessions.
- Keep the first version small enough to implement and verify as one coherent milestone.

## First-Release Scope

The player enters a finite procedurally generated island containing grass, dirt, stone, sand, wood, and leaves. The terrain has visible elevation changes and generated trees. The player can walk, look around, jump, collide with terrain, remove blocks, place blocks, and change the active block using a nine-slot hotbar.

Controls:

- `W`, `A`, `S`, `D`: move.
- Mouse: look around while pointer lock is active.
- `Space`: jump.
- Left mouse button: remove the targeted block.
- Right mouse button: place the selected block on the targeted face.
- Number keys `1` through `9` or mouse wheel: change the selected hotbar slot.
- `Escape`: release pointer lock and open the pause menu.

The pause menu contains resume, controls, and reset-world actions. Reset requires explicit confirmation.

## Out of Scope

- Survival mechanics, health, hunger, crafting, tools, enemies, and combat.
- Multiplayer or server-side persistence.
- Infinite terrain streaming.
- Mobile or gamepad controls.
- Direct reuse of Minecraft textures, sounds, branding, or names.
- Dynamic day-night cycles in the first release.

## Technical Approach

Use Vite, TypeScript, and Three.js. The game runs as a client-only application and stores its save in the browser. Real-time simulation is independent from DOM interface rendering.

### Modules

#### Game

Owns startup, dependency construction, the animation loop, pause state, and module lifecycle. It is the only module that schedules frames.

#### World

Owns block data and deterministic terrain generation. The finite island is divided into fixed-size chunks so rendering and updates remain local. World queries expose block reads and validated block writes without exposing storage internals.

#### ChunkMesher

Builds one renderable mesh per chunk from visible block faces. Faces adjacent to opaque blocks are omitted. A block edit marks its chunk dirty; an edit on a chunk boundary also marks the neighboring chunk dirty. Dirty meshes are rebuilt outside input event handlers.

#### PlayerController

Owns pointer-lock input, camera orientation, velocity, gravity, jumping, and axis-aligned collision resolution. Player movement uses a fixed or capped simulation timestep so tab stalls do not cause tunneling.

#### BlockInteraction

Casts a ray from the screen center, limits interaction distance, displays the target outline, and turns mouse actions into validated world edits. Placement is rejected if the new block would overlap the player's collision volume.

#### Inventory

Defines the nine hotbar slots and selected slot. The creative inventory supplies unlimited blocks; block counts are not tracked.

#### SaveStore

Persists a versioned save containing the world seed, player transform, selected slot, and block changes relative to the generated base world. It never stores the full generated world. Writes are debounced and flushed when the page becomes hidden.

#### HUD

Owns the crosshair, hotbar, onboarding card, pause menu, transient notices, and reset confirmation. It receives state snapshots and commands through explicit interfaces rather than reading game internals.

## Data Flow

Startup follows this sequence:

1. Load and validate a versioned save from `localStorage`.
2. Use the saved seed, or create and immediately retain a new seed.
3. Generate the deterministic base island.
4. Apply saved block changes in stable coordinate order.
5. Build initial chunk meshes.
6. Restore a safe player position and selected hotbar slot.
7. Enter the paused onboarding state until the player clicks to capture the pointer.

During play, input updates controller intent. The simulation moves the player and resolves collisions. The interaction system queries the world and submits edits. Accepted edits update in-memory block data, mark affected chunks dirty, append to the save delta, and notify the HUD. The render loop rebuilds a bounded number of dirty chunks before drawing the frame.

Block changes use integer world coordinates and a block identifier. Returning a coordinate to its generated block removes that coordinate from the saved delta, preventing unnecessary save growth.

## Visual Direction

The selected direction is **Amber Dusk**. The sky transitions from warm orange near the horizon to muted gray-purple overhead. Terrain uses ochre soil, dark slate stone, dusty sand, and restrained green vegetation. A fixed low-angle sun creates long shadows; soft ambient light and restrained distance fog keep shaded blocks readable.

Block textures are original, low-resolution procedural patterns. Each block type has a limited palette and subtle noise rather than copied pixel art. Texture filtering preserves crisp texels.

The HUD is intentionally minimal:

- A thin, high-contrast crosshair at the screen center.
- A compact, translucent nine-slot hotbar at the bottom center.
- A pale-gold outline around the targeted block.
- A translucent controls card that fades after the player begins moving.
- A dark, lightly blurred pause overlay that clearly indicates pointer release.

Removing a block emits a short-lived burst of block-colored particles. Placing a block uses a subtle scale-in effect. Feedback animations must not delay world edits.

## Persistence and Failure Handling

The save format includes a schema version. Invalid JSON, invalid coordinates, unknown block identifiers, or incompatible versions are rejected without preventing the game from starting. The game falls back to a new world and presents a non-blocking notice explaining that the previous save could not be loaded.

If a storage write fails, the in-memory session continues and a persistent warning explains that new progress may not survive a refresh. Repeated failures do not repeatedly interrupt play. Reset deletes the saved delta only after confirmation and regenerates the island from the same seed; starting a different island is not part of the first release.

Player restoration validates that the saved position is finite and not embedded in solid terrain. Invalid or obstructed positions fall back to the generated spawn point.

## Performance Constraints

- Use chunk meshes rather than one Three.js mesh per block.
- Generate only exposed faces and reuse block materials through a texture atlas.
- Rebuild only dirty chunks and limit rebuild work per frame.
- Reuse temporary vectors and particle objects in hot paths.
- Clamp frame deltas and avoid synchronous persistence inside the render loop.
- Target smooth play on a current desktop browser at a typical 1440 x 900 viewport.

## Testing and Acceptance

Automated unit tests cover:

- Deterministic terrain generation for a known seed.
- World-coordinate and chunk-coordinate conversion, including negative and boundary coordinates.
- Visible-face decisions at chunk boundaries.
- Valid and invalid placement, including player-overlap rejection.
- Save serialization, validation, delta compaction, and corrupt-save fallback.

Browser-level tests cover:

- Loading the game and entering pointer-lock onboarding.
- Movement, jumping, collision, and pause behavior.
- Selecting a hotbar slot and placing and removing blocks.
- Refreshing and restoring edits and player state.
- Reset confirmation and restoration of the original island.
- HUD layout at representative desktop viewport sizes.

Manual performance verification includes sustained movement across the island and rapid edits near chunk boundaries. The game must remain responsive, avoid visible missing faces after edits, and show no continuing memory growth after temporary particles expire.

## Delivery Definition

The first release is complete when it can be installed, started, and played locally with one documented command; all automated tests pass; the complete browser play path works; persistence survives refresh; and the game presents the approved Amber Dusk visual direction without external copyrighted game assets.
