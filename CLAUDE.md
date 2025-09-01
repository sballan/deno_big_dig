# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Core Development

- `deno task start` - Start development server with hot reload
- `deno task check` - Run full check: format, lint, and type checking
- `deno task build` - Build for production
- `deno task preview` - Preview production build

### Code Quality

- `deno fmt` - Format code
- `deno lint` - Lint code
- `deno check **/*.ts` - Type check TypeScript files

## Architecture Overview

This is a 3D voxel world engine (Minecraft-like) built with Deno, Fresh
framework, and WebGL2. The architecture separates concerns into distinct layers:

### Game Engine Core (`lib/`)

The heart of the application lives in `lib/` with a component-based
architecture:

- **Game (`game.ts`)** - Central orchestrator that manages the game loop,
  coordinates all systems, and handles user interactions (mouse clicks for block
  breaking/placing)
- **World (`world.ts`)** - Chunk-based infinite world system with procedural
  terrain generation using noise functions and tree placement
- **Player (`player.ts`)** - First-person physics including movement, jumping,
  gravity, and collision detection
- **Controls (`controls.ts`)** - Input handling with pointer lock for mouse look
  and WASD movement
- **Raycaster (`raycaster.ts`)** - Ray casting for determining which block the
  player is looking at

### WebGL Rendering (`lib/webgl/`)

Custom 3D graphics pipeline:

- **Renderer (`renderer.ts`)** - Converts chunk data to optimized meshes,
  handles face culling, manages camera matrices
- **Shaders (`shaders.ts`)** - GLSL vertex/fragment shaders for 3D
  transformations, lighting, and fog effects
- **Math (`math.ts`)** - 3D mathematics utilities (Mat4 operations, vector math)

### Fresh Integration

- **Game Island (`islands/Game.tsx`)** - Preact component that initializes the
  game engine and provides UI overlay
- **Routes (`routes/index.tsx`)** - Simple routing that renders the Game island

## Key System Interactions

### World Generation Flow

1. `World.generateAroundPosition()` creates chunks in a radius around the player
2. Each chunk uses noise functions in `getTerrainHeight()` to create natural
   terrain
3. `generateTrees()` randomly places trees within chunks
4. Chunks are marked dirty when blocks change, triggering mesh rebuilds

### Rendering Pipeline

1. `Game.render()` calls `Renderer.buildChunkMesh()` for dirty chunks
2. `buildChunkMesh()` iterates through blocks, calling `addBlockToMesh()` for
   visible faces only
3. `shouldRenderFace()` culls hidden faces (performance optimization)
4. `renderChunks()` draws all meshes with current camera matrices

### Player Interaction

1. `Controls` captures mouse/keyboard input
2. `Player.update()` applies physics and collision detection
3. `Raycaster.cast()` determines target block for interaction
4. Game handles mouse clicks to break/place blocks via `World.setBlock()`

## WebGL Shader Responsibilities

**GPU (Shaders):**

- Vertex transformations (world → screen coordinates)
- Per-pixel lighting calculations
- Fog/atmosphere effects

**CPU (TypeScript):**

- World generation and chunk management
- Physics simulation and collision detection
- Game logic and state management
- Input processing and UI

## Development Workflow

### After Making Changes

1. **Test the web server** - Always curl the server to ensure no runtime errors:
   ```bash
   # Start the server
   deno task start

   # In another terminal, test the endpoint
   curl http://localhost:8000
   ```

2. **Update documentation** - After any change, ensure these files reflect the
   new state:
   - Code comments in affected files
   - README.md if architecture or features changed
   - This CLAUDE.md file if development process changed

## Development Notes

- The game uses a chunk-based system (16×16×16 blocks) for performance
- Face culling is critical - only visible block faces are rendered
- World generation is seeded for consistency
- Fresh's island architecture keeps the game engine separate from SSR components
- WebGL2 is required - the renderer will throw if not supported
