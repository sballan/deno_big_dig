import { useEffect, useRef } from "preact/hooks";
import { Game } from "../lib/game.ts";

export default function GameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current);
    gameRef.current = game;
    game.start();

    return () => {
      game.dispose();
    };
  }, []);

  return (
    <div class="game-container">
      <canvas ref={canvasRef} class="game-canvas" />
      <div class="game-ui">
        <div class="controls-help">
          <h3>Controls</h3>
          <ul>
            <li><strong>Click canvas</strong> - Lock pointer</li>
            <li><strong>WASD</strong> - Move</li>
            <li><strong>Space</strong> - Jump</li>
            <li><strong>Shift</strong> - Descend</li>
            <li><strong>Mouse</strong> - Look around</li>
            <li><strong>Left Click</strong> - Break block</li>
            <li><strong>Right Click</strong> - Place block</li>
            <li><strong>ESC</strong> - Release pointer</li>
          </ul>
        </div>
        <div class="inventory">
          <h3>Inventory</h3>
          <div class="inventory-slots">
            <div class="slot active">Stone</div>
            <div class="slot">Dirt</div>
            <div class="slot">Grass</div>
            <div class="slot">Wood</div>
            <div class="slot">Planks</div>
          </div>
        </div>
      </div>
      <style>{`
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
          width: 50px;
          height: 50px;
          background: rgba(100, 100, 100, 0.5);
          border: 2px solid #444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          cursor: pointer;
        }
        
        .slot.active {
          border-color: #0f0;
          background: rgba(0, 255, 0, 0.1);
        }
        
        .slot:hover {
          background: rgba(150, 150, 150, 0.5);
        }
      `}</style>
    </div>
  );
}