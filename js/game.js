// 游戏主逻辑
const Game = {
    board: [],
    currentPlayer: CONFIG.PLAYER.BLACK,
    gameOver: false,
    moveHistory: [],
    mode: 'pva', // pva: 人vsAI, pvp: 双人对战
    difficulty: 'medium',
    isAIThinking: false,
    aiPlayer: CONFIG.PLAYER.WHITE,
    banEnabled: true,
    undoCount: 0,

    // 初始化游戏
    init: function() {
        this.board = this._createEmptyBoard();
        this.currentPlayer = CONFIG.PLAYER.BLACK;
        this.gameOver = false;
        this.moveHistory = [];
        this.isAIThinking = false;
        this.undoCount = 0;

        // 初始化开局库
        OpeningBook.init();
        // 初始化AI执白专用策略库
        WhiteStrategy.init();

        // 更新UI
        Board.draw(this.board);
        this._updateStatus();
        document.getElementById('moveInfo').textContent = '步数：0';

        // 根据先手选择设置AI角色
        const firstMoveSelect = document.getElementById('firstMove');
        if (firstMoveSelect.value === 'black') {
            this.aiPlayer = CONFIG.PLAYER.WHITE; // AI执白后手
        } else {
            this.aiPlayer = CONFIG.PLAYER.BLACK; // AI执黑先手
        }

        // AI先手
        if (this.mode === 'pva' && this.aiPlayer === CONFIG.PLAYER.BLACK) {
            this._aiMove();
        }
    },

    // 创建空棋盘
    _createEmptyBoard: function() {
        const size = CONFIG.BOARD_SIZE;
        const board = [];
        for (let i = 0; i < size; i++) {
            board[i] = [];
            for (let j = 0; j < size; j++) {
                board[i][j] = CONFIG.PLAYER.EMPTY;
            }
        }
        return board;
    },

    // 玩家落子
    playerMove: function(row, col) {
        if (this.gameOver || this.isAIThinking) return false;
        if (this.board[row][col] !== CONFIG.PLAYER.EMPTY) return false;
        
        // 双人模式，任何人都可以下
        // AI模式，只有轮到玩家下的时候才能下
        if (this.mode === 'pva') {
            if (this.currentPlayer === this.aiPlayer) return false;
        }

        return this._placeStone(row, col);
    },

    // 落子
    _placeStone: function(row, col) {
        // 第一手只能下天元
        if (this.moveHistory.length === 0) {
            const center = Math.floor(CONFIG.BOARD_SIZE / 2);
            if (row !== center || col !== center) return false;
        }

        this.board[row][col] = this.currentPlayer;
        this.moveHistory.push({ row: row, col: col, player: this.currentPlayer });

        // 更新UI
        Board.draw(this.board);
        Board.drawLastMove(row, col);
        document.getElementById('moveInfo').textContent = `步数：${this.moveHistory.length}`;

        // 落子音效
        Sound.playStone();

        // === 禁手检测（仅对黑棋有效）===
        this.banEnabled = document.getElementById('banEnable').checked;
        if (this.banEnabled && this.currentPlayer === CONFIG.PLAYER.BLACK) {
            const banResult = Referee.checkForbidden(this.board, row, col);
            if (banResult) {
                this.gameOver = true;
                this._showBanResult(banResult);
                this._updateStatus(`黑棋${banResult.name}，白方获胜！`);
                return true;
            }
        }

        // 检查胜负（禁手下用增强版检测）
        let winResult;
        if (this.banEnabled) {
            winResult = Referee.checkWinWithBan(this.board, row, col, this.currentPlayer);
            if (winResult.ban) {
                this.gameOver = true;
                this._showBanResult(winResult.ban);
                this._updateStatus(`黑棋${winResult.ban.name}，白方获胜！`);
                return true;
            }
            if (winResult.win) {
                this.gameOver = true;
                this._handleWin();
                return true;
            }
        } else {
            if (Evaluate.checkWin(this.board, row, col, this.currentPlayer)) {
                this.gameOver = true;
                this._handleWin();
                return true;
            }
        }

        // 检查平局
        if (this.moveHistory.length >= CONFIG.BOARD_SIZE * CONFIG.BOARD_SIZE) {
            this.gameOver = true;
            this._showWinner(null);
            this._updateStatus('平局！');
            return true;
        }

        // 切换玩家
        this.currentPlayer = 3 - this.currentPlayer;
        this._updateStatus();

        // 如果是AI模式且轮到AI了
        if (this.mode === 'pva' && !this.gameOver && this.currentPlayer === this.aiPlayer) {
            this._aiMove();
        }

        return true;
    },

    // 处理胜利（包含评级）
    _handleWin: function() {
        const winner = this.currentPlayer === CONFIG.PLAYER.BLACK ? '黑棋' : '白棋';
        this._updateStatus(`${winner} 获胜！`);

        // 评级（仅对AI模式下的人类玩家评价）
        let rating = null;
        if (this.mode === 'pva') {
            const playerWon = this.currentPlayer !== this.aiPlayer;
            rating = Referee.ratePlayer({
                winner: playerWon,
                moveCount: this.moveHistory.length,
                difficulty: this.difficulty,
                usedUndo: this.undoCount,
                mode: this.mode
            });
        }

        // 胜利音效
        if (winner === '黑棋' || winner === '白棋') {
            if (this.mode === 'pva') {
                // 玩家赢放胜利音效，输放失败音效
                const playerWon = this.currentPlayer !== this.aiPlayer;
                if (playerWon) Sound.playWin();
                else Sound.playLose();
            } else {
                Sound.playWin();
            }
        }
        this._showWinner(winner, rating);
    },

    // AI走棋
    _aiMove: function() {
        this.isAIThinking = true;
        document.getElementById('aiThinking').classList.remove('hidden');
        this._updateStatus('AI 思考中...');

        // 使用 setTimeout 让UI先更新
        setTimeout(() => {
            const startTime = Date.now();
            const move = Search.getBestMove(this.board, this.aiPlayer, this.difficulty, this.moveHistory);
            const elapsed = Date.now() - startTime;

            // 确保至少显示一会儿思考提示
            const delay = Math.max(100, 300 - elapsed);
            setTimeout(() => {
                document.getElementById('aiThinking').classList.add('hidden');
                this.isAIThinking = false;
                
                if (move) {
                    this._placeStone(move.row, move.col);
                }
            }, delay);
        }, 50);
    },

    // 悔棋
    undo: function() {
        if (this.gameOver) return;
        if (this.isAIThinking) return;
        if (this.moveHistory.length === 0) return;

        this.undoCount++;

        // AI模式：撤回两步（玩家+AI各一步）
        if (this.mode === 'pva') {
            if (this.moveHistory.length >= 2 && this.currentPlayer !== this.aiPlayer) {
                const aiMove = this.moveHistory.pop();
                this.board[aiMove.row][aiMove.col] = CONFIG.PLAYER.EMPTY;
                const playerMove = this.moveHistory.pop();
                this.board[playerMove.row][playerMove.col] = CONFIG.PLAYER.EMPTY;
                // [修复] 悔棋后确保轮到人类玩家
                this.currentPlayer = this.aiPlayer === CONFIG.PLAYER.BLACK ? CONFIG.PLAYER.WHITE : CONFIG.PLAYER.BLACK;
            } else if (this.moveHistory.length >= 1) {
                const move = this.moveHistory.pop();
                this.board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                this.currentPlayer = move.player;
            }
        } else {
            // 双人模式：撤回一步
            const move = this.moveHistory.pop();
            this.board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
            this.currentPlayer = move.player;
        }

        Board.draw(this.board);
        if (this.moveHistory.length > 0) {
            const last = this.moveHistory[this.moveHistory.length - 1];
            Board.drawLastMove(last.row, last.col);
        }
        document.getElementById('moveInfo').textContent = `步数：${this.moveHistory.length}`;
        this._updateStatus();
    },

    // 更新状态文字
    _updateStatus: function(override) {
        const statusEl = document.getElementById('status');
        if (override) {
            statusEl.textContent = override;
            return;
        }

        if (this.gameOver) return;

        const playerName = this.currentPlayer === CONFIG.PLAYER.BLACK ? '黑棋' : '白棋';
        
        if (this.mode === 'pva') {
            if (this.currentPlayer === this.aiPlayer) {
                statusEl.textContent = 'AI 思考中...';
            } else {
                statusEl.textContent = `你的回合（${playerName}）`;
            }
        } else {
            statusEl.textContent = `${playerName} 的回合`;
        }
    },

    // 显示禁手判负
    _showBanResult: function(ban) {
        const existing = document.querySelector('.winner-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'winner-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'winner-dialog ban-dialog';
        dialog.innerHTML = `
            <h2 style="color: #e74c3c;">🚫 禁手判负</h2>
            <p style="color: #e74c3c; font-size: 1.3em;">黑棋 ${ban.name}</p>
            <p>白方获胜！</p>
            <p style="font-size: 0.9em; color: #bbb; margin-top: 5px;">（落子于 ${this.moveHistory[this.moveHistory.length-1].row},${this.moveHistory[this.moveHistory.length-1].col}）</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                <button onclick="Game._closeWinner();" style="background: rgba(255,255,255,0.2); color: #ecf0f1;">查看棋盘</button>
                <button onclick="Game._closeWinner(); Game.init();">再来一局</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    },

    // 显示赢家弹窗（含评级）
    _showWinner: function(winner, rating) {
        const existing = document.querySelector('.winner-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'winner-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'winner-dialog';
        
        let html = '';
        if (winner) {
            html = `
                <h2>🏆 ${winner} 获胜！</h2>
                <p>共 ${this.moveHistory.length} 步</p>
            `;
        } else {
            html = `
                <h2>🤝 平局</h2>
                <p>势均力敌！共 ${this.moveHistory.length} 步</p>
            `;
        }

        // 显示你的棋力评级（仅AI模式）
        if (rating) {
            html += `
                <div class="rating-section" style="margin: 15px 0; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                    <div style="font-size: 0.8em; color: #aaa; margin-bottom: 8px;">━ 你的棋力评级 ━</div>
                    <div style="font-size: 2.5em; margin-bottom: 5px;">${rating.rank}</div>
                    <div style="font-size: 1.2em; color: ${rating.color}; font-weight: bold;">${rating.title}</div>
                    <div style="font-size: 0.9em; color: #bbb; margin-top: 5px;">${rating.desc}</div>
                    <div style="font-size: 0.8em; color: #888; margin-top: 3px;">评分: ${rating.score}</div>
                </div>
            `;
        }

        html += `<button onclick="Game._closeWinner(); Game.init();">再来一局</button>`;
        
        dialog.innerHTML = html;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    },

    _closeWinner: function() {
        const overlay = document.querySelector('.winner-overlay');
        if (overlay) overlay.remove();
    },

    // 切换模式
    setMode: function(mode) {
        this.mode = mode;
        this.init();
    },

    // 切换难度
    setDifficulty: function(difficulty) {
        this.difficulty = difficulty;
    }
};