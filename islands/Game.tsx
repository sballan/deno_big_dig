import { useEffect, useRef, useState } from "preact/hooks";
import { Game, GameConfig } from "../lib/game.ts";
import { BlockType } from "../lib/types.ts";

export default function GameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [isPaused, setIsPaused] = useState(true); // Start paused
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<GameConfig>({
    flatness: 1.0,
    treeFrequency: 0.02,
  });
  const [tempConfig, setTempConfig] = useState<GameConfig>({
    flatness: 1.0,
    treeFrequency: 0.02,
  });

  const inventory = [
    { name: "Stone", type: BlockType.STONE },
    { name: "Dirt", type: BlockType.DIRT },
    { name: "Grass", type: BlockType.GRASS },
    { name: "Wood", type: BlockType.WOOD },
    { name: "Planks", type: BlockType.PLANKS },
  ];

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current, config);
    gameRef.current = game;

    // Set up pause callback
    game.setOnPauseChange((paused) => {
      setIsPaused(paused);
    });

    game.start();
    // Start the game in paused state
    game.setPaused(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        const slot = num - 1;
        setSelectedSlot(slot);
        game.setSelectedBlock(inventory[slot].type);
      }
    };

    // Remove pointer lock monitoring since we don't need click-to-start anymore

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      game.dispose();
    };
  }, []);

  const handleResume = () => {
    if (gameRef.current) {
      gameRef.current.resume();
    }
    setShowConfig(false);
  };

  const handleNewGame = () => {
    setTempConfig({ ...config });
    setShowConfig(true);
  };

  const handleCreateNewGame = () => {
    setConfig(tempConfig);
    if (gameRef.current) {
      gameRef.current.resetWithConfig(tempConfig);
    }
    setShowConfig(false);
    setIsPaused(false);
  };

  const handleCancelConfig = () => {
    setShowConfig(false);
  };

  return (
    <div class="game-container">
      <canvas ref={canvasRef} class="game-canvas" />

      {/* Game UI (hidden when paused) */}
      <div class={`game-ui ${isPaused ? "hidden" : ""}`}>
        {/* Crosshairs in center of screen */}
        <div class="crosshairs">
          <div class="crosshair-horizontal"></div>
          <div class="crosshair-vertical"></div>
        </div>
        
        <div class="controls-help">
          <h3>Controls</h3>
          <ul>
            <li>
              <strong>WASD</strong> - Move
            </li>
            <li>
              <strong>Space</strong> - Jump
            </li>
            <li>
              <strong>Shift</strong> - Descend
            </li>
            <li>
              <strong>Mouse</strong> - Look around
            </li>
            <li>
              <strong>Left Click</strong> - Break block
            </li>
            <li>
              <strong>Right Click</strong> - Place block
            </li>
            <li>
              <strong>ESC</strong> - Pause
            </li>
          </ul>
        </div>
        <div class="inventory">
          <h3>Inventory (Press 1-5 to select)</h3>
          <div class="inventory-slots">
            {inventory.map((item, index) => (
              <div
                key={index}
                class={`slot ${selectedSlot === index ? "active" : ""}`}
                onClick={() => {
                  setSelectedSlot(index);
                  if (gameRef.current) {
                    gameRef.current.setSelectedBlock(item.type);
                  }
                }}
              >
                <div class="slot-number">{index + 1}</div>
                <div class="slot-name">{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pause Screen */}
      {isPaused && !showConfig && (
        <div class="pause-screen">
          <div class="pause-content">
            <h1>PAUSED</h1>
            <button type="button" class="pause-button" onClick={handleResume}>
              Resume
            </button>
            <button type="button" class="pause-button" onClick={handleNewGame}>
              Create New Game
            </button>
          </div>
        </div>
      )}

      {/* Configuration Dialog */}
      {showConfig && (
        <div class="config-screen">
          <div class="config-content">
            <h2>New Game Configuration</h2>

            <div class="config-option">
              <label>
                <span class="config-label">Terrain Flatness</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={tempConfig.flatness}
                  onInput={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      flatness: parseFloat(
                        (e.target as HTMLInputElement).value,
                      ),
                    })}
                />
                <span class="config-value">
                  {tempConfig.flatness === 1
                    ? "Perfectly Flat"
                    : tempConfig.flatness === 0
                    ? "Maximum Variation"
                    : `${Math.round(tempConfig.flatness * 100)}% Flat`}
                </span>
              </label>
              <div class="config-help">
                1 = perfectly flat terrain, 0 = maximum hills and valleys
              </div>
            </div>

            <div class="config-option">
              <label>
                <span class="config-label">Tree Frequency</span>
                <input
                  type="range"
                  min="0"
                  max="0.2"
                  step="0.01"
                  value={tempConfig.treeFrequency}
                  onInput={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      treeFrequency: parseFloat(
                        (e.target as HTMLInputElement).value,
                      ),
                    })}
                />
                <span class="config-value">
                  {tempConfig.treeFrequency === 0
                    ? "No Trees"
                    : tempConfig.treeFrequency >= 0.2
                    ? "Dense Forest"
                    : `${Math.round(tempConfig.treeFrequency * 500)}% Chance`}
                </span>
              </label>
              <div class="config-help">
                0 = no trees, higher values = more trees
              </div>
            </div>

            <div class="config-buttons">
              <button
                type="button"
                class="config-button primary"
                onClick={handleCreateNewGame}
              >
                Create World
              </button>
              <button
                type="button"
                class="config-button"
                onClick={handleCancelConfig}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
        .game-container {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: monospace;
        }
        
        .game-canvas {
          width: 100%;
          height: 100%;
          display: block;
          cursor: crosshair;
        }
        
        .game-ui {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        
        .game-ui.hidden {
          opacity: 0;
        }
        
        /* Crosshairs in center of screen */
        .crosshairs {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        
        .crosshair-horizontal {
          width: 20px;
          height: 2px;
          background: rgba(255, 255, 255, 0.8);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        .crosshair-vertical {
          width: 2px;
          height: 20px;
          background: rgba(255, 255, 255, 0.8);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        .controls-help {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 15px;
          border-radius: 5px;
          pointer-events: auto;
        }
        
        .controls-help h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
        }
        
        .controls-help ul {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 12px;
        }
        
        .controls-help li {
          margin: 5px 0;
        }
        
        .inventory {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px;
          border-radius: 5px;
          pointer-events: auto;
        }
        
        .inventory h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          text-align: center;
        }
        
        .inventory-slots {
          display: flex;
          gap: 5px;
        }
        
        .slot {
          width: 60px;
          height: 60px;
          background: rgba(100, 100, 100, 0.5);
          border: 2px solid #444;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          cursor: pointer;
          position: relative;
        }
        
        .slot.active {
          border-color: #0f0;
          background: rgba(0, 255, 0, 0.1);
        }
        
        .slot:hover {
          background: rgba(150, 150, 150, 0.5);
        }
        
        .slot-number {
          position: absolute;
          top: 2px;
          left: 4px;
          font-size: 8px;
          color: #aaa;
        }
        
        .slot-name {
          font-size: 11px;
        }

        /* Pause Screen Styles */
        .pause-screen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .pause-content {
          background: rgba(20, 20, 20, 0.95);
          padding: 40px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .pause-content h1 {
          color: white;
          margin: 0 0 30px 0;
          font-size: 48px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }

        .pause-button {
          display: block;
          width: 200px;
          margin: 10px auto;
          padding: 15px 30px;
          background: rgba(50, 50, 50, 0.9);
          color: white;
          border: 2px solid #666;
          border-radius: 5px;
          font-size: 18px;
          font-family: monospace;
          cursor: pointer;
          transition: all 0.3s;
        }

        .pause-button:hover {
          background: rgba(70, 70, 70, 0.9);
          border-color: #0f0;
          transform: scale(1.05);
        }

        /* Configuration Screen Styles */
        .config-screen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }

        .config-content {
          background: rgba(30, 30, 30, 0.98);
          padding: 40px;
          border-radius: 10px;
          width: 500px;
          max-width: 90vw;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .config-content h2 {
          color: white;
          margin: 0 0 30px 0;
          font-size: 32px;
          text-align: center;
        }

        .config-option {
          margin: 25px 0;
        }

        .config-option label {
          display: block;
          color: white;
        }

        .config-label {
          display: block;
          margin-bottom: 10px;
          font-size: 18px;
          font-weight: bold;
        }

        .config-option input[type="range"] {
          width: 100%;
          margin: 10px 0;
          height: 8px;
          background: rgba(100, 100, 100, 0.5);
          border-radius: 4px;
          outline: none;
          -webkit-appearance: none;
        }

        .config-option input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #0f0;
          border-radius: 50%;
          cursor: pointer;
        }

        .config-option input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #0f0;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }

        .config-value {
          display: block;
          text-align: center;
          color: #0f0;
          font-size: 14px;
          margin-top: 5px;
        }

        .config-help {
          color: #888;
          font-size: 12px;
          margin-top: 5px;
          text-align: center;
        }

        .config-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 30px;
        }

        .config-button {
          padding: 12px 24px;
          background: rgba(50, 50, 50, 0.9);
          color: white;
          border: 2px solid #666;
          border-radius: 5px;
          font-size: 16px;
          font-family: monospace;
          cursor: pointer;
          transition: all 0.3s;
        }

        .config-button.primary {
          background: rgba(0, 100, 0, 0.7);
          border-color: #0f0;
        }

        .config-button:hover {
          transform: scale(1.05);
          background: rgba(70, 70, 70, 0.9);
        }

        .config-button.primary:hover {
          background: rgba(0, 150, 0, 0.7);
        }

      `}
      </style>
    </div>
  );
}
