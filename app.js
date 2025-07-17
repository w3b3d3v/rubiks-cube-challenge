import { TwistyPlayer } from "https://cdn.cubing.net/js/cubing/twisty";

class RubiksCubeApp {
  constructor() {
    this.player = null;
    this.moveCount = 0;
    this.currentAlgorithm = "";
    this.isAnimating = false;

    // Current puzzle type: "3x3x3" (Rubik's Cube) or "megaminx" (12x12 Dodecahedron)
    this.puzzleType = "3x3x3"; // default principal puzzle

    // Scramble move sets for both puzzles
    this.scrambleMovesCube = [
      "R",
      "R'",
      "R2",
      "U",
      "U'",
      "U2",
      "F",
      "F'",
      "F2",
      "L",
      "L'",
      "L2",
      "B",
      "B'",
      "B2",
      "D",
      "D'",
      "D2",
    ];

    // Moves for megaminx (dodecahedron)
    this.scrambleMovesMegaminx = [
      // Primary face turns
      "R",
      "R'",
      "R2", // Right
      "U",
      "U'",
      "U2", // Up
      "F",
      "F'",
      "F2", // Front
      "L",
      "L'",
      "L2", // Left
      "BL",
      "BL'",
      "BL2", // Back Left
      "BR",
      "BR'",
      "BR2", // Back Right
      "DR",
      "DR'",
      "DR2", // Down Right
      "D",
      "D'",
      "D2", // Down
      "DL",
      "DL'",
      "DL2", // Down Left
      "B",
      "B'",
      "B2", // Back
      // Puzzle rotations for variety
      "y",
      "y'",
      "y2", // Y-axis rotation
      "z",
      "z'",
      "z2", // Z-axis rotation
    ];

    // Start with cube moves
    this.scrambleMoves = this.scrambleMovesCube;

    this.init();
  }

  async init() {
    console.log(
      `🎲 Initializing ${
        this.puzzleType === "3x3x3" ? "3x3 Rubik's Cube" : "12x12 Dodecahedron"
      } with Twizzle...`
    );

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

    const loadingText =
      this.puzzleType === "3x3x3"
        ? "Loading 3x3 Cube..."
        : "Loading 12x12 Dodecahedron...";
    container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${loadingText}</p>
            </div>
        `;

    // Create the Twisty player - using megaminx (dodecahedron-based)
    this.player = new TwistyPlayer({
      puzzle: this.puzzleType,
      alg: "",
      hintFacelets: "none",
      controlPanel: "none",
      background: "none",
      visualization: "3D",
    });

    // Wait for the player to be ready with more comprehensive checks
    await new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max

      const checkReady = () => {
        attempts++;

        // Check multiple indicators that the player is ready
        const hasModel = this.player.experimentalModel;
        const hasPattern = hasModel?.currentPattern;
        const hasKPuzzle = hasModel?.kpuzzle;
        const hasTimeline = this.player.timeline || hasModel?.timeline;

        if ((hasPattern || hasKPuzzle) && hasTimeline) {
          console.log("✅ Twizzle player fully initialized");
          resolve();
        } else if (attempts >= maxAttempts) {
          console.log("⚠️ Twizzle player timeout, proceeding anyway");
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

    // Update heading text and switch button label based on puzzle
    const heading = document.getElementById("mainHeading");
    if (heading) {
      heading.textContent =
        this.puzzleType === "3x3x3"
          ? "🎲 3x3 Rubik's Cube Simulator"
          : "🌟 12x12 Dodecahedron Simulator";
    }
    const switchBtn = document.getElementById("switchPuzzleBtn");
    if (switchBtn) {
      switchBtn.textContent =
        this.puzzleType === "3x3x3" ? "Switch to 12x12" : "Switch to 3x3";
    }

    // Update info note
    const infoNote = document.getElementById("infoNote");
    if (infoNote) {
      infoNote.innerHTML = `<strong>Note:</strong> ${
        this.puzzleType === "3x3x3"
          ? "3x3 Rubik's Cube selected"
          : "12-faced dodecahedron (megaminx) selected"
      }`;
    }
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

    // Switch puzzle button
    const switchBtn = document.getElementById("switchPuzzleBtn");
    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        this.switchPuzzle();
      });
    }

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

      const numMoves = this.puzzleType === "3x3x3" ? 20 : 70; // typical lengths
      const scramble = this.generateRandomScramble(numMoves);

      this.currentAlgorithm = scramble;
      this.moveCount = this.countMoves(this.currentAlgorithm);

      console.log(`🎲 Applying scramble: ${scramble.substring(0, 50)}...`);

      // Strategy: Replace the player with a new one that has the scramble applied
      const container = document.getElementById("cube-container");

      // Create a new player with the scramble
      const newPlayer = new TwistyPlayer({
        puzzle: this.puzzleType,
        alg: scramble,
        hintFacelets: "none",
        controlPanel: "none",
        background: "none",
        visualization: "3D",
      });

      // Replace the old player
      container.innerHTML = "";
      container.appendChild(newPlayer);

      // Update the reference
      this.player = newPlayer;

      this.updateStatus();

      // Wait for the new player to initialize, then jump to scrambled state
      setTimeout(async () => {
        try {
          // Method 1: Try via controller's timeline
          if (newPlayer.controller?.timeline) {
            await newPlayer.controller.timeline.jumpToEnd();
            console.log("🎲 Applied scramble via controller timeline");
          }
          // Method 2: Try via experimentalModel
          else if (newPlayer.experimentalModel?.timeline) {
            await newPlayer.experimentalModel.timeline.jumpToEnd();
            console.log("🎲 Applied scramble via experimental timeline");
          }
          // Method 3: Try direct timeline access
          else if (newPlayer.timeline) {
            await newPlayer.timeline.jumpToEnd();
            console.log("🎲 Applied scramble via direct timeline");
          } else {
            console.log(
              "🎲 No timeline control available - scramble algorithm set but visual state may not change"
            );
          }
        } catch (e) {
          console.log("Timeline control failed:", e.message);
          console.log(
            "🎲 Scramble algorithm is set, but visual state might not reflect scrambled position"
          );
        }

        this.isAnimating = false;
        this.updateButtonStates(false);
        console.log("🎲 Scramble operation completed");
      }, 2000);
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

      this.currentAlgorithm = "";
      this.moveCount = 0;

      console.log("🎲 Solving dodecahedron...");

      // Create a new player in solved state
      const container = document.getElementById("cube-container");

      const newPlayer = new TwistyPlayer({
        puzzle: this.puzzleType,
        alg: "",
        hintFacelets: "none",
        controlPanel: "none",
        background: "none",
        visualization: "3D",
      });

      // Replace the old player
      container.innerHTML = "";
      container.appendChild(newPlayer);

      // Update the reference
      this.player = newPlayer;

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

    // Choose appropriate move set based on current puzzle
    const moveSet =
      this.puzzleType === "3x3x3"
        ? this.scrambleMovesCube
        : this.scrambleMovesMegaminx;

    for (let i = 0; i < numMoves; i++) {
      let move;
      let faceId;
      let attempts = 0;

      do {
        move = moveSet[Math.floor(Math.random() * moveSet.length)];
        // For dodecahedron, face identification is more complex
        faceId = move.replace(/['2]/g, ""); // Remove ', 2 to get face name
        attempts++;

        // Prevent consecutive moves on same face or rotations
        if (attempts > 10) break; // Safety valve
      } while (
        move === lastMove ||
        faceId === lastMove.replace(/['2]/g, "") ||
        ((faceId === "y" || faceId === "z") && lastMove.startsWith(faceId))
      );

      moves.push(move);
      lastMove = move;
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

  // Switch between cube and megaminx puzzles
  switchPuzzle() {
    if (this.isAnimating) return;

    // Toggle puzzle type
    this.puzzleType = this.puzzleType === "3x3x3" ? "megaminx" : "3x3x3";

    // Update scramble move reference
    this.scrambleMoves =
      this.puzzleType === "3x3x3"
        ? this.scrambleMovesCube
        : this.scrambleMovesMegaminx;

    // Re-initialize the cube with new puzzle type
    this.initializeCube();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const htmlEl = document.documentElement;
  // Set dark theme as default
  htmlEl.setAttribute(
    "data-theme",
    htmlEl.getAttribute("data-theme") || "dark"
  );

  const themeToggleBtn = document.getElementById("themeToggle");
  if (themeToggleBtn) {
    // Set initial icon according theme
    themeToggleBtn.textContent =
      htmlEl.getAttribute("data-theme") === "dark" ? "🌙" : "⭐";
    themeToggleBtn.addEventListener("click", () => {
      const current = htmlEl.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      htmlEl.setAttribute("data-theme", next);
      // Update icon
      themeToggleBtn.textContent = next === "dark" ? "🌙" : "⭐";
    });
  }

  new RubiksCubeApp();
});

// Export for potential external use
window.RubiksCubeApp = RubiksCubeApp;
