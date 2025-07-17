// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract TicTacToe is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    
    uint256 public MOVE_FEE = 0.1 ether;
    uint256 public constant MIN_START_AMOUNT = 1 wei; 
    
    enum GameState { WaitingForOpponent, InProgress, Finished }
    
    struct Game {
        address playerX;
        address playerO;
        uint8[9] board;
        address nextPlayer;
        GameState state;
        address winner;
        uint256 prizePool;
        address[] queue;           // FIFO queue for equal bids
        address[] feeQueue;        // FIFO queue when bids are equal
    }
    
    Game public currentGame;
    
    event GameStarted(address indexed starter, bool starterIsX);
    event MoveMade(address indexed player, uint8 indexed index, uint8 mark);
    event GameWon(address indexed winner, uint8[3] winningLine);
    event GameDraw();
    event Deposit(address indexed from, uint256 amount);
    event PrizePaid(address indexed winner, uint256 amount);
    event WaitingForOpponent(uint256 prizePool);
    event InvalidMove(uint8 index);
    event MoveFeeUpdated(uint256 oldFee, uint256 newFee);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    // For local tests (non-proxy deployments) we expose initialize() publicly, so tests can call it directly.
    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
    }
    
    // Simple helper to set the owner when deploying without a proxy (tests).
    function initializeForTesting() external {
        _transferOwnership(msg.sender);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @notice Update the move fee (only owner can call this)
     * @param newMoveFee The new move fee amount
     */
    function updateMoveFee(uint256 newMoveFee) external onlyOwner {
        require(newMoveFee >= 1 wei, "Move fee must be at least 1 wei");
        uint256 oldFee = MOVE_FEE;
        MOVE_FEE = newMoveFee;
        emit MoveFeeUpdated(oldFee, newMoveFee);
    }
    
    /// @notice Start a new game. Any address can call this to initialize a fresh game.
    function startGame() external payable {
        // Disallow starting if a game is currently in progress
        require(currentGame.state != GameState.InProgress, "Game already in progress");
        require(msg.value >= MIN_START_AMOUNT, "Must send at least 1 wei to start game");

        // Reset game state
        delete currentGame;
        currentGame.prizePool = msg.value;
        currentGame.state = GameState.WaitingForOpponent;
        currentGame.queue = new address[](0);
        currentGame.feeQueue = new address[](0);
        currentGame.winner = address(0);
        currentGame.board = [0,0,0,0,0,0,0,0,0];

        // Starter is always X
        bool starterIsX = true;
        currentGame.playerX = msg.sender;
        emit GameStarted(msg.sender, starterIsX);
        emit Deposit(msg.sender, msg.value);
        emit WaitingForOpponent(currentGame.prizePool);
    }

    /// @notice Join an existing game as the second player.
    function joinGame() external payable {
        require(currentGame.state == GameState.WaitingForOpponent, "No game waiting for opponent");
        require(msg.value >= MIN_START_AMOUNT, "Must send at least 1 wei to join game");
        require(currentGame.playerX == address(0) || currentGame.playerO == address(0), "Both players already assigned");
        require(msg.sender != currentGame.playerX && msg.sender != currentGame.playerO, "Already joined");

        if (currentGame.playerX == address(0)) {
            currentGame.playerX = msg.sender;
        } else {
            currentGame.playerO = msg.sender;
        }
        currentGame.prizePool += msg.value;
        currentGame.state = GameState.InProgress;
        // X always starts
        currentGame.nextPlayer = currentGame.playerX;
        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Make a move on the board. Any address can make the next required move by paying the move fee.
    function makeMove(uint8 index) external payable {
        require(currentGame.state == GameState.InProgress, "Game not in progress");
        require(msg.value >= MOVE_FEE, "Insufficient move fee");
        require(index < 9, "Invalid board position");
        require(currentGame.board[index] == 0, "Position already occupied");
        require(currentGame.winner == address(0), "Game already finished");

        // Determine whose turn it should be based on board state
        uint8 moveCount = 0;
        for (uint8 i = 0; i < 9; i++) {
            if (currentGame.board[i] != 0) {
                moveCount++;
            }
        }
        
        // X always goes first, then alternating
        bool isXTurn = (moveCount % 2 == 0);
        uint8 mark = isXTurn ? 1 : 2;
        
        // Make the move
        currentGame.board[index] = mark;
        currentGame.prizePool += msg.value; // Add the full payment to prize pool

        emit MoveMade(msg.sender, index, mark);

        // Check for win
        if (_checkWin(index, mark)) {
            currentGame.state = GameState.Finished;
            currentGame.winner = isXTurn ? currentGame.playerX : currentGame.playerO;
            _payPrize(currentGame.winner);
            emit GameWon(currentGame.winner, _getWinningLine(index, mark));
        } else if (_checkDraw()) {
            currentGame.state = GameState.Finished;
            emit GameDraw();
        }
        // No need to switch players since any address can make the next move
    }

    /// @notice Deposit ETH to the prize pool
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH to deposit");
        currentGame.prizePool += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // Internal helper functions
    function _checkWin(uint8 index, uint8 mark) internal view returns (bool) {
        // Check horizontal
        if (index % 3 == 0 && currentGame.board[index] == mark && currentGame.board[index + 1] == mark && currentGame.board[index + 2] == mark) {
            return true;
        }
        if (index % 3 == 1 && currentGame.board[index - 1] == mark && currentGame.board[index] == mark && currentGame.board[index + 1] == mark) {
            return true;
        }
        if (index % 3 == 2 && currentGame.board[index - 2] == mark && currentGame.board[index - 1] == mark && currentGame.board[index] == mark) {
            return true;
        }

        // Check vertical
        if (index < 3 && currentGame.board[index] == mark && currentGame.board[index + 3] == mark && currentGame.board[index + 6] == mark) {
            return true;
        }
        if (index >= 3 && index < 6 && currentGame.board[index - 3] == mark && currentGame.board[index] == mark && currentGame.board[index + 3] == mark) {
            return true;
        }
        if (index >= 6 && currentGame.board[index - 6] == mark && currentGame.board[index - 3] == mark && currentGame.board[index] == mark) {
            return true;
        }

        // Check diagonals
        if (index == 0 && currentGame.board[0] == mark && currentGame.board[4] == mark && currentGame.board[8] == mark) {
            return true;
        }
        if (index == 2 && currentGame.board[2] == mark && currentGame.board[4] == mark && currentGame.board[6] == mark) {
            return true;
        }
        if (index == 4 && ((currentGame.board[0] == mark && currentGame.board[4] == mark && currentGame.board[8] == mark) ||
                           (currentGame.board[2] == mark && currentGame.board[4] == mark && currentGame.board[6] == mark))) {
            return true;
        }
        if (index == 6 && currentGame.board[2] == mark && currentGame.board[4] == mark && currentGame.board[6] == mark) {
            return true;
        }
        if (index == 8 && currentGame.board[0] == mark && currentGame.board[4] == mark && currentGame.board[8] == mark) {
            return true;
        }

        return false;
    }

    function _checkDraw() internal view returns (bool) {
        for (uint8 i = 0; i < 9; i++) {
            if (currentGame.board[i] == 0) {
                return false;
            }
        }
        return true;
    }

    function _getWinningLine(uint8 index, uint8 mark) internal view returns (uint8[3] memory) {
        // This is a simplified implementation - in practice you'd want to return the actual winning line
        return [index, index, index];
    }

    function _payPrize(address winner) internal {
        uint256 prize = currentGame.prizePool;
        currentGame.prizePool = 0;
        payable(winner).transfer(prize);
        emit PrizePaid(winner, prize);
    }

    function _switchToNextPlayer() internal {
        if (currentGame.nextPlayer == currentGame.playerX) {
            currentGame.nextPlayer = currentGame.playerO;
        } else {
            currentGame.nextPlayer = currentGame.playerX;
        }
    }

    function _clearQueue() internal {
        delete currentGame.queue;
        delete currentGame.feeQueue;
    }

    function getGameState() external view returns (GameState) {
        return currentGame.state;
    }

    function getPrizePool() external view returns (uint256) {
        return currentGame.prizePool;
    }

    function getWinner() external view returns (address) {
        return currentGame.winner;
    }

    function getNextPlayer() external view returns (address) {
        return currentGame.nextPlayer;
    }

    function getPlayerX() external view returns (address) {
        return currentGame.playerX;
    }

    function getPlayerO() external view returns (address) {
        return currentGame.playerO;
    }

    function getBoard() external view returns (uint8[9] memory) {
        return currentGame.board;
    }

    function getQueueLength() external view returns (uint256) {
        return currentGame.queue.length;
    }

    function getMinStartAmount() external pure returns (uint256) {
        return MIN_START_AMOUNT;
    }

    function getMoveFee() external view returns (uint256) {
        return MOVE_FEE;
    }
}
