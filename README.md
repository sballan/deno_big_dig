# Deno Big Dig - 3D Voxel World Engine

A Minecraft-inspired 3D voxel world engine built with Deno, Fresh framework, and WebGL2. This project demonstrates 3D graphics programming, procedural world generation, and real-time rendering techniques.

## 🎮 What This Project Does

This is a browser-based 3D voxel world where players can:
- **Explore**: Navigate through a procedurally generated 3D world
- **Mine**: Break blocks by left-clicking 
- **Build**: Place blocks by right-clicking
- **Fly**: Move freely in 3D space with WASD + Space/Shift controls

The world features realistic terrain generation with hills, trees, and different block types (stone, dirt, grass, wood, leaves).

## 🏗️ Architecture Overview

### Core Components

The project is organized into several key systems:

```
lib/
├── game.ts          - Main game engine coordination
├── world.ts         - World generation and block storage
├── player.ts        - Player movement and physics
├── controls.ts      - Input handling (keyboard/mouse)
├── raycaster.ts     - Ray casting for block selection
├── webgl/           - WebGL rendering system
│   ├── renderer.ts  - Main rendering logic
│   ├── shaders.ts   - GPU shader programs
│   └── mesh.ts      - Mesh data management
├── math.ts          - 3D mathematics utilities
└── types.ts         - Type definitions
```

### Fresh Framework Integration

```
routes/api/joke.ts   - Example API endpoint
main.ts              - Server entry point
dev.ts               - Development server
fresh.config.ts      - Fresh configuration
```

## 🧩 Detailed Component Breakdown

### 1. Game Engine (`lib/game.ts`)

The central orchestrator that ties all systems together:

- **Initialization**: Sets up renderer, world, player, and input systems
- **Game Loop**: Runs at 60fps, handling updates and rendering
- **Event Handling**: Manages mouse clicks for block breaking/placing
- **Camera Management**: Links player position to rendering camera

**Key Methods:**
- `start()`: Begins the game loop and generates initial world
- `update()`: Updates player, world generation, and block selection
- `render()`: Draws the current frame to the canvas

### 2. World System (`lib/world.ts`)

Manages the infinite 3D world using a chunk-based approach:

**Chunk System:**
- World is divided into 16×16×16 block chunks
- Only loads chunks within render distance
- Uses efficient Uint8Array storage for block data

**Terrain Generation:**
- **Noise Functions**: Creates natural-looking terrain using 2D noise
- **Multiple Octaves**: Combines different scales for varied terrain
- **Height Maps**: Generates rolling hills and valleys
- **Block Types**: Places appropriate blocks based on height (stone, dirt, grass)

**Tree Generation:**
- Randomly places trees in chunks
- Creates realistic trunk and leaf structures
- Uses seeded randomness for consistent world generation

### 3. Player System (`lib/player.ts`)

Handles all player-related functionality:

**Movement Physics:**
- **First-Person Camera**: Mouse look with pitch/yaw rotation
- **WASD Movement**: Smooth directional movement
- **Jumping**: Space bar for jumping with gravity
- **Collision Detection**: Prevents walking through blocks

**Inventory Management:**
- **Block Selection**: Manages currently selected block type
- **Tool System**: Framework for different tools (currently basic)

### 4. Input System (`lib/controls.ts`)

Captures and processes user input:

**Keyboard Input:**
- Tracks all pressed keys in a Set for efficient lookup
- Provides normalized movement vectors
- Handles window focus events to prevent stuck keys

**Mouse Input:**
- **Pointer Lock**: Captures mouse for camera control
- **Click Detection**: Left/right click for block interaction
- **Movement Tracking**: Accumulates mouse deltas for smooth camera

### 5. Ray Casting (`lib/raycaster.ts`)

Determines which block the player is looking at:

**Algorithm:**
- Steps along a ray from camera in small increments
- Tests each position for solid blocks
- Returns hit position, surface normal, and distance

**Usage:**
- **Block Breaking**: Identifies target block for removal
- **Block Placement**: Calculates adjacent position using surface normal
- **UI Highlighting**: Shows which block is selected

### 6. WebGL Rendering (`lib/webgl/`)

Handles all 3D graphics rendering:

#### Renderer (`renderer.ts`)
- **Mesh Building**: Converts chunk data into renderable geometry
- **Face Culling**: Only renders visible block faces (performance optimization)
- **Camera Setup**: Creates projection and view matrices
- **Rendering Pipeline**: Draws all visible chunks each frame

#### Shaders (`shaders.ts`)
The GPU programs that control how blocks are rendered:

**Vertex Shader:**
- Transforms block vertices from world space to screen space
- Applies camera projection and view transformations
- Calculates fog distance for atmospheric perspective
- Passes data to fragment shader (position, normals, texture coordinates)

**Fragment Shader:**
- Calculates lighting using directional light and ambient lighting
- Applies different colors based on block height (simple height-based coloring)
- Blends fog color for distant objects
- Outputs final pixel color

#### Mathematical Operations (`math.ts`)
Essential 3D math functions:

**Matrix Operations:**
- **Mat4 Class**: 4×4 matrices for 3D transformations
- **Perspective Projection**: Creates 3D depth perception
- **Look-At Matrix**: Positions camera in 3D space
- **Transformations**: Translation, rotation, scaling

**Vector Operations:**
- **Normalization**: Converts vectors to unit length
- **Cross Product**: Calculates perpendicular vectors (for surface normals)
- **Dot Product**: Measures vector similarity (for lighting)

## 🎨 Shader Programming Explained

This project demonstrates practical shader usage:

### What Runs on the GPU (Shaders):
- **Vertex transformations** (world → screen coordinates)
- **Lighting calculations** (directional + ambient lighting)
- **Fog effects** (distance-based atmospheric perspective)
- **Per-pixel color computation**

### What Runs on the CPU:
- **World generation** (chunk creation, block placement)
- **Physics simulation** (player movement, collision detection)
- **Game logic** (block breaking/placing, inventory management)
- **Input handling** (keyboard/mouse processing)

## 🚀 Getting Started

### Prerequisites
- [Deno](https://deno.land/) installed on your system

### Running the Project
```bash
# Start development server
deno task start

# Or run directly
deno run -A --watch=static/,routes/ dev.ts
```

Visit `http://localhost:8000` in your browser.

### Controls
- **Mouse**: Look around (click to capture pointer)
- **WASD**: Move horizontally
- **Space**: Jump/fly up
- **Shift**: Fly down
- **Left Click**: Break blocks
- **Right Click**: Place blocks

## 🛠️ Technical Features

### Performance Optimizations
- **Chunk-based Loading**: Only renders nearby world sections
- **Face Culling**: Hidden block faces aren't rendered
- **Efficient Mesh Building**: Combines blocks into single draw calls
- **WebGL2**: Hardware-accelerated 3D graphics

### World Generation Features
- **Infinite World**: Generates chunks as needed
- **Seeded Randomness**: Consistent world generation
- **Natural Terrain**: Height-based block placement
- **Tree Generation**: Procedural forest placement

### Graphics Features
- **3D Perspective**: Proper camera projection
- **Lighting System**: Directional and ambient lighting
- **Fog Effects**: Atmospheric distance rendering
- **Smooth Performance**: 60fps target with efficient rendering

## 📁 Project Structure

```
deno_big_dig/
├── lib/                    # Core game engine
│   ├── game.ts            # Main game coordination
│   ├── world.ts           # World generation & chunks
│   ├── player.ts          # Player physics & controls
│   ├── controls.ts        # Input handling
│   ├── raycaster.ts       # Block selection
│   ├── types.ts           # TypeScript definitions
│   ├── math.ts            # 3D mathematics
│   └── webgl/             # Rendering system
│       ├── renderer.ts    # WebGL rendering logic
│       ├── shaders.ts     # GPU shader programs
│       └── mesh.ts        # Mesh management
├── routes/                # Fresh framework routes
├── static/                # Static assets
├── main.ts               # Server entry point
├── dev.ts                # Development server
├── deno.json             # Deno configuration
└── fresh.config.ts       # Fresh framework config
```

## 🧠 Learning Opportunities

This project is excellent for understanding:

### 3D Graphics Programming
- WebGL2 API usage
- Shader programming (GLSL)
- Matrix transformations
- 3D mathematics

### Game Engine Architecture
- Component-based design
- Game loop implementation
- Physics simulation
- Input handling

### Procedural Generation
- Noise-based terrain generation
- Chunk-based world management
- Seeded randomness

### Performance Optimization
- Frustum culling concepts
- Mesh optimization
- GPU vs CPU workload distribution

## 🔧 Potential Enhancements

The codebase is structured to support many improvements:

- **Textures**: Add actual block textures instead of solid colors
- **Lighting**: Implement shadow mapping or more complex lighting
- **Multiplayer**: Add networking for shared worlds
- **Physics**: More realistic physics simulation
- **UI**: Add inventory, crafting, or menu systems
- **World Features**: Caves, structures, more biomes
- **Performance**: Implement level-of-detail (LOD) systems

## 🎯 Summary

This project demonstrates a complete 3D rendering pipeline from world generation to final pixel rendering. It shows how modern web technologies can create engaging 3D experiences directly in the browser, combining TypeScript for game logic with WebGL shaders for high-performance graphics rendering.

The clean architecture makes it easy to understand how each component contributes to the final experience, making it an excellent educational resource for 3D programming concepts.
