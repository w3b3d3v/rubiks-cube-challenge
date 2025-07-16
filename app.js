import { TwistyPlayer } from "https://cdn.cubing.net/js/cubing/twisty";

class RubiksCubeApp {
  constructor() {
    this.player = null;
    this.moveCount = 0;
    this.currentAlgorithm = "";
    this.isAnimating = false;

    // Define available moves for 7x7x7 cube
    this.scrambleMoves = [
      "R",
      "R'",
      "R2",
      "L",
      "L'",
      "L2",
      "U",
      "U'",
      "U2",
      "D",
      "D'",
      "D2",
      "F",
      "F'",
      "F2",
      "B",
      "B'",
      "B2",
      // Wide moves for 7x7
      "Rw",
      "Rw'",
      "Rw2",
      "Lw",
      "Lw'",
      "Lw2",
      "Uw",
      "Uw'",
      "Uw2",
      "Dw",
      "Dw'",
      "Dw2",
      "Fw",
      "Fw'",
      "Fw2",
      "Bw",
      "Bw'",
      "Bw2",
      // 3-layer moves
      "3Rw",
      "3Rw'",
      "3Rw2",
      "3Lw",
      "3Lw'",
      "3Lw2",
      "3Uw",
      "3Uw'",
      "3Uw2",
      "3Dw",
      "3Dw'",
      "3Dw2",
    ];

    this.init();
  }

  async init() {
    console.log("🎲 Initializing 12x12 Rubik's Cube with Twizzle...");

    try {
      await this.initializeCube();
      this.setupEventListeners();
      await this.initialScramble();
      console.log("✅ Cube initialized successfully!");
    } catch (error) {
      console.error("❌ Error initializing cube:", error);
      this.showError("Failed to load cube. Please refresh the page.");
    }
  }

  async initializeCube() {
    const container = document.getElementById("cube-container");

    // Show loading
    container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading 7x7x7 Cube...</p>
            </div>
        `;

    // Create the Twisty player - using 7x7x7 (max supported by Twizzle)
    this.player = new TwistyPlayer({
      puzzle: "7x7x7",
      alg: "",
      hintFacelets: "none",
      controlPanel: "none",
      background: "none",
      visualization: "3D",
    });

    // Wait for the player to be ready
    await new Promise((resolve) => {
      const checkReady = () => {
        if (this.player.experimentalModel?.currentPattern) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });

    // Replace loading with the cube
    container.innerHTML = "";
    container.appendChild(this.player);
  }

  setupEventListeners() {
    // Scramble button
    document.getElementById("scrambleBtn").addEventListener("click", () => {
      this.scrambleCube();
    });

    // Solve button
    document.getElementById("solveBtn").addEventListener("click", () => {
      this.solveCube();
    });

    // Update move counter when algorithm changes
    if (this.player) {
      this.player.experimentalModel?.detailedTimelineInfo.addFreshListener(
        () => {
          this.updateStatus();
        }
      );
    }
  }

  async scrambleCube() {
    if (this.isAnimating) return;

    try {
      this.isAnimating = true;
      this.updateButtonStates(true);

      // Generate a proper 7x7 scramble (80 moves for big cubes)
      const scramble = this.generateRandomScramble(80);

      this.player.alg = scramble;
      this.currentAlgorithm = scramble;
      this.moveCount = this.countMoves(this.currentAlgorithm);

      this.updateStatus();

      // Auto-play the scramble
      await this.player.experimentalModel.jumpToEnd();

      setTimeout(() => {
        this.isAnimating = false;
        this.updateButtonStates(false);
      }, 1000);
    } catch (error) {
      console.error("Error scrambling cube:", error);
      this.showError("Failed to scramble cube");
      this.isAnimating = false;
      this.updateButtonStates(false);
    }
  }

  async solveCube() {
    if (this.isAnimating) return;

    try {
      this.isAnimating = true;
      this.updateButtonStates(true);

      this.player.alg = "";
      this.currentAlgorithm = "";
      this.moveCount = 0;

      this.updateStatus();

      setTimeout(() => {
        this.isAnimating = false;
        this.updateButtonStates(false);
      }, 500);
    } catch (error) {
      console.error("Error solving cube:", error);
      this.showError("Failed to solve cube");
      this.isAnimating = false;
      this.updateButtonStates(false);
    }
  }

  generateRandomScramble(numMoves) {
    const moves = [];
    let lastMove = "";
    let lastAxis = "";

    for (let i = 0; i < numMoves; i++) {
      let move;
      let axis;
      let attempts = 0;

      do {
        move =
          this.scrambleMoves[
            Math.floor(Math.random() * this.scrambleMoves.length)
          ];
        axis = move.charAt(0); // R, L, U, D, F, B
        attempts++;

        // Prevent consecutive moves on same face or opposing faces
        if (attempts > 10) break; // Safety valve
      } while (
        move === lastMove ||
        axis === lastAxis ||
        (axis === "R" && lastAxis === "L") ||
        (axis === "L" && lastAxis === "R") ||
        (axis === "U" && lastAxis === "D") ||
        (axis === "D" && lastAxis === "U") ||
        (axis === "F" && lastAxis === "B") ||
        (axis === "B" && lastAxis === "F")
      );

      moves.push(move);
      lastMove = move;
      lastAxis = axis;
    }

    return moves.join(" ");
  }

  countMoves(algorithm) {
    if (!algorithm) return 0;
    // Split by spaces and filter out empty strings
    return algorithm.split(/\s+/).filter((move) => move.length > 0).length;
  }

  updateStatus() {
    const moveCounter = document.getElementById("moveCounter");
    const currentAlg = document.getElementById("currentAlg");

    moveCounter.textContent = `Moves: ${this.moveCount}`;
    currentAlg.textContent = `Current Algorithm: ${
      this.currentAlgorithm || "None"
    }`;
  }

  updateButtonStates(disabled) {
    const buttons = document.querySelectorAll(".btn");
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.style.opacity = disabled ? "0.6" : "1";
      button.style.cursor = disabled ? "not-allowed" : "pointer";
    });
  }

  showError(message) {
    const container = document.getElementById("cube-container");
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 107, 107, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1000;
            backdrop-filter: blur(10px);
        `;
    errorDiv.textContent = message;

    container.style.position = "relative";
    container.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  async initialScramble() {
    // Wait a bit then do initial scramble
    setTimeout(() => {
      this.scrambleCube();
    }, 1500);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new RubiksCubeApp();
});

// Export for potential external use
window.RubiksCubeApp = RubiksCubeApp;
