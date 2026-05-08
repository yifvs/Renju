// Alpha-Beta 剪枝搜索 + 杀棋模块
const Search = {
    aiPlayer: CONFIG.PLAYER.WHITE,
    searchDepth: 6,
    nodesSearched: 0,
    startTime: 0,
    timeLimit: 5000,
    stopped: false,
    difficulty: 'medium',
    
    // 置换表
    tt: new Map(),
    ttHit: 0,
    
    // 杀手走法表 [depth][index] => {row, col}
    killerMoves: [],

    // 初始化
    init: function() {
        this.tt = new Map();
        this.ttHit = 0;
        this.killerMoves = [];
        for (let d = 0; d <= 30; d++) {
            this.killerMoves[d] = [];
        }
    },

    // 获取AI的最佳走法（主入口）
    getBestMove: function(board, aiPlayer, difficulty, moveHistory) {
        this.aiPlayer = aiPlayer;
        this.difficulty = difficulty;
        const config = CONFIG.DIFFICULTY[difficulty] || CONFIG.DIFFICULTY.medium;
        this.searchDepth = config.searchDepth;
        this.nodesSearched = 0;
        this.started = false;

        // 时间限制从配置读取
        this.timeLimit = CONFIG.SEARCH.TIME_LIMITS[difficulty] || 5000;
        this.startTime = Date.now();
        this.stopped = false;
        this.tt.clear();
        this.ttHit = 0;

        // === 第一步：检查开局库 ===
        if (moveHistory && moveHistory.length > 0) {
            const bookMove = OpeningBook.lookup(moveHistory);
            if (bookMove && bookMove.priority <= 2) {
                return { row: bookMove.row, col: bookMove.col };
            }
        }

        // === 第二步：检查必胜/必防 ===
        const urgent = Evaluate.findUrgentMove(board, aiPlayer);
        if (urgent) {
            return urgent.move;
        }

        // === 第三步：杀棋检测 ===
        // 检查AI是否可以通过连续冲四/活三实现杀棋
        const killMove = this._detectKill(board, aiPlayer);
        if (killMove) {
            return killMove;
        }

        // === 第四步：迭代加深搜索 ===
        const candidates = Evaluate.getCandidateMoves(board, aiPlayer);
        if (candidates.length === 0) return { row: 7, col: 7 };
        if (candidates.length === 1) return candidates[0];

        // 初始化杀手走法表
        this.init();

        let bestMove = candidates[0];
        let bestScore = -Infinity;
        const moveOrder = candidates.slice(0, Math.min(candidates.length, 
            CONFIG.SEARCH.MAX_CANDIDATES[this.searchDepth] || 15));

        for (let depth = 2; depth <= this.searchDepth; depth += 2) {
            if (this._timeUp()) break;

            let alpha = -Infinity;
            const beta = Infinity;
            let localBest = null;
            let localBestScore = -Infinity;

            for (let i = 0; i < moveOrder.length; i++) {
                if (this._timeUp()) break;
                
                const move = moveOrder[i];
                
                // 执行走法
                board[move.row][move.col] = this.aiPlayer;
                this.nodesSearched++;
                
                // 如果这一步赢了
                if (Evaluate.checkWin(board, move.row, move.col, this.aiPlayer)) {
                    board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                    return move;
                }

                // 递归搜索（负极大值形式）
                const score = -this._alphaBeta(
                    board, depth - 1, -beta, -alpha,
                    3 - this.aiPlayer, this.aiPlayer
                );

                // 撤销走法
                board[move.row][move.col] = CONFIG.PLAYER.EMPTY;

                if (score > localBestScore) {
                    localBestScore = score;
                    localBest = move;
                }
                if (score > alpha) {
                    alpha = score;
                }
            }

            if (localBest && !this._timeUp()) {
                bestMove = localBest;
                bestScore = localBestScore;
            }
        }

        return bestMove;
    },

    // ======= 杀棋模块 =======
    // 检测是否存在可通过连续威胁实现的杀棋
    _detectKill: function(board, player) {
        const opponent = 3 - player;
        const size = CONFIG.BOARD_SIZE;

        // 收集所有进攻性走法
        let threats = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                const score = Evaluate.evaluatePosition(board, r, c, player);
                if (score >= CONFIG.SCORES.LIVE_THREE) {
                    threats.push({ row: r, col: c, score: score });
                }
            }
        }

        if (threats.length === 0) return null;

        // 按分数降序排列
        threats.sort((a, b) => b.score - a.score);
        
        // 对每个高度威胁的走法进行杀棋验证
        // 只验证前几个最强的
        const maxCheck = Math.min(threats.length, 5);
        
        for (let i = 0; i < maxCheck; i++) {
            if (this._timeUp()) break;
            
            const move = threats[i];
            
            // 如果这一步就是活四/连五，直接返回
            if (move.score >= CONFIG.SCORES.LIVE_FOUR) {
                return move;
            }
            
            // 执行走法
            board[move.row][move.col] = player;
            
            // 强制搜索确认杀棋
            const result = this._forceKillSearch(
                board, 
                CONFIG.SEARCH.KILL_SEARCH_DEPTH, 
                player, 
                opponent,
                false // 当前是进攻方
            );
            
            // 撤销走法
            board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
            
            if (result > 0) {
                // 杀棋成立！
                return move;
            }
        }

        return null;
    },

    // 强制杀棋搜索 - 专注检测"是否能杀死"
    // 返回正数=杀棋成立，负数/零=杀棋不成立
    _forceKillSearch: function(board, depth, attacker, defender, isDefending) {
        this.nodesSearched++;
        if (this._timeUp()) return 0;

        const size = CONFIG.BOARD_SIZE;
        const currentPlayer = isDefending ? defender : attacker;

        // === 收集当前玩家的威胁走法 ===
        let threats = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                const score = Evaluate.evaluatePosition(board, r, c, currentPlayer);
                if (score >= CONFIG.SCORES.RUSH_FOUR || 
                    (score >= CONFIG.SCORES.LIVE_THREE && !isDefending)) {
                    threats.push({ row: r, col: c, score: score });
                }
            }
        }

        if (threats.length === 0) {
            return isDefending ? 1 : -1; // 防守方无威胁=防守成功，进攻方无威胁=杀棋失败
        }

        // 降序排列
        threats.sort((a, b) => b.score - a.score);

        // 限制候选数量
        const maxCand = 8;
        threats = threats.slice(0, Math.min(threats.length, maxCand));

        if (depth <= 0) {
            // 到达深度上限，看是否有活四以上的威胁
            if (threats[0].score >= CONFIG.SCORES.LIVE_FOUR) {
                return isDefending ? -1 : 1; // 防守方被活四=杀棋成立，进攻方有活四=杀棋成立
            }
            return 0;
        }

        if (isDefending) {
            // === 防守方：必须挡住所有威胁 ===
            // 如果防守方面临多个不可兼得的威胁（如双冲四），则防守失败
            if (threats.length >= 2) {
                const topScore = threats[0].score;
                const secondScore = threats[1].score;
                
                // 两个冲四不能同时防守 → 杀棋成立
                if (topScore >= CONFIG.SCORES.RUSH_FOUR && secondScore >= CONFIG.SCORES.RUSH_FOUR) {
                    return -1;
                }
                // 冲四+活三 → 杀棋成立（典型的VCF战术）
                if (topScore >= CONFIG.SCORES.RUSH_FOUR && secondScore >= CONFIG.SCORES.LIVE_THREE) {
                    return -1;
                }
            }

            // 每个威胁逐一防守（防守方有多个选择的情况）
            for (const threat of threats) {
                if (this._timeUp()) return 0;
                
                // 如果是活三，防守方可以有多个挡点
                if (threat.score >= CONFIG.SCORES.LIVE_THREE && threat.score < CONFIG.SCORES.RUSH_FOUR) {
                    // 找所有能挡住活三的位置
                    const blocks = this._findBlockMoves(board, threat.row, threat.col, attacker);
                    let anyBlockSucceeds = false;
                    
                    for (const block of blocks) {
                        board[block.row][block.col] = defender;
                        const result = this._forceKillSearch(
                            board, depth - 1, attacker, defender, false
                        );
                        board[block.row][block.col] = CONFIG.PLAYER.EMPTY;
                        
                        if (result >= 0) {
                            anyBlockSucceeds = true;
                            break;
                        }
                    }
                    
                    if (!anyBlockSucceeds) return -1; // 挡不住 → 杀棋成立
                } else {
                    // 冲四/活四：只能堵一端（唯一应手）
                    // 找防守位置
                    const blockRow = threat.row;
                    const blockCol = threat.col;
                    // 在threat位置下子就是防守（对手要下的位置我们去占）
                    board[blockRow][blockCol] = defender;
                    const result = this._forceKillSearch(
                        board, depth - 1, attacker, defender, false
                    );
                    board[blockRow][blockCol] = CONFIG.PLAYER.EMPTY;
                    
                    if (result >= 0) return result; // 守住了
                    return -1; // 守不住
                }
            }
            return 1; // 所有威胁都守住了
        } else {
            // === 进攻方：尝试通过威胁取胜 ===
            for (const threat of threats) {
                if (this._timeUp()) return 0;
                
                // 执行进攻走法
                board[threat.row][threat.col] = attacker;
                
                // 检查是否直接获胜
                if (Evaluate.checkWin(board, threat.row, threat.col, attacker)) {
                    board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                    return 1; // 杀棋成立！
                }

                // 切换为防守视角
                const result = this._forceKillSearch(
                    board, depth - 1, attacker, defender, true
                );
                
                board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                
                if (result > 0) return 1; // 杀棋成立
            }
            return -1; // 所有进攻尝试都失败
        }
    },

    // 找活三的挡点
    _findBlockMoves: function(board, row, col, attacker) {
        const size = CONFIG.BOARD_SIZE;
        const blocks = [];
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        // 在threat位置模拟落子后的棋型，找活三的两个端点
        board[row][col] = attacker;
        
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = dirs[d];
            let count = 1;
            let forwardOpen = false, backwardOpen = false;
            
            // 正方向
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === attacker) {
                count++;
                r += dr;
                c += dc;
            }
            if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) {
                forwardOpen = true;
                blocks.push({ row: r, col: c });
            }
            
            // 负方向
            r = row - dr, c = col - dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === attacker) {
                count++;
                r -= dr;
                c -= dc;
            }
            if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) {
                backwardOpen = true;
                blocks.push({ row: r, col: c });
            }
            
            // 如果是活三（count=3+两端开放），两端都是挡点
            // 如果是冲四（count=4+一端开放），开放端是挡点
            if (count >= 3 && forwardOpen && backwardOpen) {
                // 已添加了两端
            } else if (count >= 4 && forwardOpen) {
                // 正方向端已添加
            } else if (count >= 4 && backwardOpen) {
                // 负方向端已添加
            }
        }
        
        board[row][col] = CONFIG.PLAYER.EMPTY;
        return blocks;
    },

    // ======= Alpha-Beta 搜索核心 =======
    _alphaBeta: function(board, depth, alpha, beta, currentPlayer, aiPlayer) {
        this.nodesSearched++;

        // 检查时间限制
        if (this.nodesSearched % 1000 === 0 && this._timeUp()) {
            this.stopped = true;
            return 0;
        }

        // === 置换表查找 ===
        const hash = Zobrist.computeHash(board);
        const ttEntry = this.tt.get(hash);
        if (ttEntry && ttEntry.depth >= depth) {
            this.ttHit++;
            if (ttEntry.flag === 'exact') return ttEntry.score;
            if (ttEntry.flag === 'lower') alpha = Math.max(alpha, ttEntry.score);
            if (ttEntry.flag === 'upper') beta = Math.min(beta, ttEntry.score);
            if (alpha >= beta) return ttEntry.score;
        }

        // === 叶子节点：静止期搜索 ===
        if (depth <= 0) {
            const urgent = Evaluate.findUrgentMove(board, currentPlayer);
            if (urgent && urgent.score >= CONFIG.SCORES.RUSH_FOUR) {
                return this._quiescenceSearch(board, CONFIG.SEARCH.KILL_SEARCH_DEPTH, alpha, beta, currentPlayer, aiPlayer);
            }
            const score = Evaluate.quickEvaluate(board);
            const perspective = (currentPlayer === aiPlayer) ? 1 : -1;
            return score * perspective;
        }

        // === 获取候选走法 ===
        let candidates = Evaluate.getCandidateMoves(board, currentPlayer);
        if (candidates.length === 0) return 0;

        // 动态限制候选项数量
        const maxMoves = CONFIG.SEARCH.MAX_CANDIDATES[this.searchDepth] || 15;
        candidates = candidates.slice(0, Math.min(candidates.length, maxMoves));

        // === 走法排序 ===
        this._sortMoves(candidates, depth, board, currentPlayer);

        // === Alpha-Beta搜索 ===
        let bestScore = -Infinity;
        let bestMove = null;
        const originalAlpha = alpha;

        for (const move of candidates) {
            if (this.stopped) break;

            board[move.row][move.col] = currentPlayer;

            if (Evaluate.checkWin(board, move.row, move.col, currentPlayer)) {
                board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                const score = CONFIG.SCORES.FIVE + depth;
                this._storeHash(hash, depth, score, 'exact');
                return score;
            }

            const score = -this._alphaBeta(
                board, depth - 1, -beta, -alpha,
                3 - currentPlayer, aiPlayer
            );

            board[move.row][move.col] = CONFIG.PLAYER.EMPTY;

            if (this.stopped) return 0;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }

            if (score > alpha) {
                alpha = score;
            }
            if (alpha >= beta) {
                if (move) this._updateKillerMove(depth, move);
                break;
            }
        }

        if (!this.stopped) {
            let flag = 'exact';
            if (bestScore <= originalAlpha) flag = 'upper';
            else if (bestScore >= beta) flag = 'lower';
            this._storeHash(hash, depth, bestScore, flag);
        }

        return bestScore;
    },

    // 静止期搜索
    _quiescenceSearch: function(board, depth, alpha, beta, currentPlayer, aiPlayer) {
        const standPat = Evaluate.quickEvaluate(board);
        const perspective = (currentPlayer === aiPlayer) ? 1 : -1;
        const standPatScore = standPat * perspective;

        if (standPatScore >= beta) return beta;
        if (standPatScore > alpha) alpha = standPatScore;

        if (depth <= 0) return standPatScore;

        const urgent = Evaluate.findUrgentMove(board, currentPlayer);
        if (!urgent || urgent.score < CONFIG.SCORES.RUSH_FOUR) {
            return standPatScore;
        }

        // 使用杀棋模块进行深度扩展
        return this._forceKillSearch(board, depth, currentPlayer, 3 - currentPlayer, false);
    },

    // 走法排序
    _sortMoves: function(candidates, depth, board, player) {
        const killers = this.killerMoves[depth] || [];
        
        candidates.sort((a, b) => {
            const aIsKiller = killers.some(k => k && k.row === a.row && k.col === a.col);
            const bIsKiller = killers.some(k => k && k.row === b.row && k.col === b.col);
            
            if (aIsKiller && !bIsKiller) return -1;
            if (!aIsKiller && bIsKiller) return 1;
            
            return b.score - a.score;
        });
    },

    _updateKillerMove: function(depth, move) {
        if (!this.killerMoves[depth]) {
            this.killerMoves[depth] = [];
        }
        const killers = this.killerMoves[depth];
        const existIdx = killers.findIndex(k => k && k.row === move.row && k.col === move.col);
        if (existIdx >= 0) {
            killers.splice(existIdx, 1);
            killers.unshift(move);
        } else {
            killers.unshift(move);
            if (killers.length > CONFIG.SEARCH.KILLER_MOVES) {
                killers.pop();
            }
        }
    },

    _storeHash: function(hash, depth, score, flag) {
        if (this.tt.size >= CONFIG.SEARCH.TT_SIZE) {
            this.tt.clear();
        }
        this.tt.set(hash, { depth, score, flag });
    },

    _timeUp: function() {
        return Date.now() - this.startTime > this.timeLimit;
    }
};