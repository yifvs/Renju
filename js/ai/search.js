// Alpha-Beta 剪枝搜索 + 杀棋模块
const Search = {
    aiPlayer: CONFIG.PLAYER.WHITE,
    searchDepth: 6,
    nodesSearched: 0,
    startTime: 0,
    timeLimit: 5000,
    stopped: false,
    difficulty: 'medium',
    banEnabled: false, // 是否开启禁手
    
    // 置换表 { hash => { depth, score, flag } }
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
        // 读取禁手状态
        const banCheckbox = document.getElementById('banEnable');
        this.banEnabled = banCheckbox ? banCheckbox.checked : false;
        
        const config = CONFIG.DIFFICULTY[difficulty] || CONFIG.DIFFICULTY.medium;
        this.searchDepth = config.searchDepth;
        this.nodesSearched = 0;

        this.timeLimit = CONFIG.SEARCH.TIME_LIMITS[difficulty] || 5000;
        this.startTime = Date.now();
        this.stopped = false;
        this.tt.clear();
        this.ttHit = 0;

        // 初始哈希（只计算一次）
        Zobrist.init();
        let hash = Zobrist.computeHash(board);

        // === 第一步：检查开局库 ===
        if (moveHistory && moveHistory.length > 0) {
            const bookMove = OpeningBook.lookup(moveHistory);
            if (bookMove && bookMove.priority <= 2) {
                // 安全检查：确认棋谱推荐的位置确实是空的
                if (board[bookMove.row] && board[bookMove.row][bookMove.col] === CONFIG.PLAYER.EMPTY) {
                    return { row: bookMove.row, col: bookMove.col };
                }
            }
        }

        // === 第二步：检查必胜/必防 ===
        const urgent = Evaluate.findUrgentMove(board, aiPlayer);
        if (urgent) {
            return urgent.move;
        }

        // === 第三步：杀棋检测 ===
        const killMove = this._detectKill(board, aiPlayer);
        if (killMove) {
            return killMove;
        }

        // === 第四步：迭代加深搜索 ===
        const candidates = Evaluate.getCandidateMoves(board, aiPlayer);
        if (candidates.length === 0) return { row: 7, col: 7 };
        if (candidates.length === 1) return candidates[0];

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

            // 重新排序（按棋型精确分类）
            let sortedMoves = this._sortMovesByType(moveOrder, board, this.aiPlayer);

            for (let i = 0; i < sortedMoves.length; i++) {
                if (this._timeUp()) break;
                
                const move = sortedMoves[i];
                
                // 禁手检查：AI执黑时不允许下禁手位置
                if (this.banEnabled && this.aiPlayer === CONFIG.PLAYER.BLACK) {
                    board[move.row][move.col] = this.aiPlayer;
                    const banResult = Referee.checkForbidden(board, move.row, move.col);
                    board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                    if (banResult) continue; // 跳过禁手走法
                }
                
                // 执行走法
                board[move.row][move.col] = this.aiPlayer;
                hash = Zobrist.updateHash(hash, move.row, move.col, this.aiPlayer);
                this.nodesSearched++;
                
                if (Evaluate.checkWin(board, move.row, move.col, this.aiPlayer)) {
                    board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                    return move;
                }

                const score = -this._alphaBeta(
                    board, hash, depth - 1, -beta, -alpha,
                    3 - this.aiPlayer, this.aiPlayer
                );

                hash = Zobrist.undoHash(hash, move.row, move.col, this.aiPlayer);
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

    // Alpha-Beta 搜索核心（负极大值形式，带增量哈希）
    _alphaBeta: function(board, hash, depth, alpha, beta, currentPlayer, aiPlayer) {
        this.nodesSearched++;

        if (this.nodesSearched % 2000 === 0 && this._timeUp()) {
            this.stopped = true;
            return 0;
        }

        // === 置换表查找（使用传入的增量hash）===
        const ttEntry = this.tt.get(hash);
        if (ttEntry && ttEntry.depth >= depth) {
            this.ttHit++;
            if (ttEntry.flag === 'exact') return ttEntry.score;
            if (ttEntry.flag === 'lower') alpha = Math.max(alpha, ttEntry.score);
            if (ttEntry.flag === 'upper') beta = Math.min(beta, ttEntry.score);
            if (alpha >= beta) return ttEntry.score;
        }

        // === 叶子节点：静态评估 ===
        if (depth <= 0) {
            const urgent = Evaluate.findUrgentMove(board, currentPlayer);
            if (urgent && urgent.score >= CONFIG.SCORES.LIVE_THREE) {
                // 静止期搜索：处理活三/冲四威胁
                return this._quiescenceSearch(board, hash, 3, alpha, beta, currentPlayer, aiPlayer);
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
        if (candidates.length > maxMoves) {
            candidates.length = maxMoves;
        }

        // === 走法排序（按棋型级别精确分类） ===
        const ordered = this._sortMovesByType(candidates, board, currentPlayer);

        // === Alpha-Beta搜索 ===
        let bestScore = -Infinity;
        let bestMove = null;
        const originalAlpha = alpha;

        for (const move of ordered) {
            if (this.stopped) break;

            // 禁手检查：当前走棋是黑棋时
            if (this.banEnabled && currentPlayer === CONFIG.PLAYER.BLACK) {
                // 快速检查此位置是否会导致禁手
                board[move.row][move.col] = currentPlayer;
                if (Referee.checkForbidden(board, move.row, move.col)) {
                    board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                    continue;
                }
                board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
            }

            // 执行走法
            board[move.row][move.col] = currentPlayer;
            const newHash = Zobrist.updateHash(hash, move.row, move.col, currentPlayer);

            if (Evaluate.checkWin(board, move.row, move.col, currentPlayer)) {
                board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                const score = CONFIG.SCORES.FIVE + depth;
                this._storeHash(hash, depth, score, 'exact');
                return score;
            }

            const score = -this._alphaBeta(
                board, newHash, depth - 1, -beta, -alpha,
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

    // 静止期搜索：到达搜索深度后，如果仍有冲四/活三威胁，再延伸几层
    // 只关注当前最紧急的一个威胁走法（不走全盘杀棋搜索，避免耗时）
    _quiescenceSearch: function(board, hash, depth, alpha, beta, currentPlayer, aiPlayer) {
        const standPat = Evaluate.quickEvaluate(board);
        const perspective = (currentPlayer === aiPlayer) ? 1 : -1;
        const standPatScore = standPat * perspective;

        if (standPatScore >= beta) return beta;
        if (standPatScore > alpha) alpha = standPatScore;

        if (depth <= 0) return standPatScore;

        // 处理活三及以上威胁（防守活三和冲四同等重要）
        const urgent = Evaluate.findUrgentMove(board, currentPlayer);
        if (!urgent || urgent.score < CONFIG.SCORES.LIVE_THREE) {
            return standPatScore;
        }

        // 只对这个最紧急的威胁走法做一步延伸
        const move = urgent.move;
        board[move.row][move.col] = currentPlayer;

        if (Evaluate.checkWin(board, move.row, move.col, currentPlayer)) {
            board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
            return CONFIG.SCORES.FIVE + depth;
        }

        const score = -this._quiescenceSearch(
            board, hash, depth - 1, -beta, -alpha,
            3 - currentPlayer, aiPlayer
        );

        board[move.row][move.col] = CONFIG.PLAYER.EMPTY;

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;

        return alpha;
    },

    // ======= 走法按棋型精确排序 =======
    // 按威胁程度分组：活四>冲四>活三>眠三>活二>其他
    _sortMovesByType: function(moves, board, player) {
        const opponent = 3 - player;
        
        // 为每个走法计算进攻等级和防守等级
        const scored = moves.map(m => {
            const attackScore = Evaluate.evaluatePosition(board, m.row, m.col, player);
            const defendScore = Evaluate.evaluatePosition(board, m.row, m.col, opponent);
            
            // 进攻等级：0-5，5最高
            let attackLevel = 0;
            if (attackScore >= CONFIG.SCORES.FIVE) attackLevel = 6;
            else if (attackScore >= CONFIG.SCORES.LIVE_FOUR) attackLevel = 5;
            else if (attackScore >= CONFIG.SCORES.RUSH_FOUR) attackLevel = 4;
            else if (attackScore >= CONFIG.SCORES.LIVE_THREE) attackLevel = 3;
            else if (attackScore >= CONFIG.SCORES.SLEEP_THREE) attackLevel = 2;
            else if (attackScore >= CONFIG.SCORES.LIVE_TWO) attackLevel = 1;
            
            // 防守等级
            let defendLevel = 0;
            if (defendScore >= CONFIG.SCORES.LIVE_FOUR) defendLevel = 5;
            else if (defendScore >= CONFIG.SCORES.RUSH_FOUR) defendLevel = 4;
            else if (defendScore >= CONFIG.SCORES.LIVE_THREE) defendLevel = 3;
            else if (defendScore >= CONFIG.SCORES.SLEEP_THREE) defendLevel = 2;
            else if (defendScore >= CONFIG.SCORES.LIVE_TWO) defendLevel = 1;
            
            // 综合优先级：进攻优先，防守兼顾
            // 活四 > 冲四 > 需防守的活三 > 活三 > 冲四防守 > 其他
            const priority = Math.max(attackLevel, defendLevel) * 10 + 
                           (attackLevel >= defendLevel ? attackLevel : defendLevel * 0.5);
            
            return { ...m, attackLevel, defendLevel, priority };
        });
        
        // 按优先级降序排列
        scored.sort((a, b) => {
            // 先按进攻等级降序
            if (b.attackLevel !== a.attackLevel) return b.attackLevel - a.attackLevel;
            // 再按防守等级降序
            if (b.defendLevel !== a.defendLevel) return b.defendLevel - a.defendLevel;
            // 最后按原始评分降序
            return b.score - a.score;
        });
        
        return scored;
    },

    // ======= 杀棋模块 =======
    _detectKill: function(board, player) {
        const opponent = 3 - player;
        const size = CONFIG.BOARD_SIZE;

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
        threats.sort((a, b) => b.score - a.score);

        const maxCheck = Math.min(threats.length, 5);
        for (let i = 0; i < maxCheck; i++) {
            if (this._timeUp()) break;
            const move = threats[i];
            if (move.score >= CONFIG.SCORES.LIVE_FOUR) return move;

            board[move.row][move.col] = player;
            const result = this._forceKillSearch(board, CONFIG.SEARCH.KILL_SEARCH_DEPTH, player, opponent, false);
            board[move.row][move.col] = CONFIG.PLAYER.EMPTY;

            if (result > 0) return move;
        }
        return null;
    },

    _forceKillSearch: function(board, depth, attacker, defender, isDefending) {
        this.nodesSearched++;
        if (this._timeUp()) return 0;

        const size = CONFIG.BOARD_SIZE;
        const currentPlayer = isDefending ? defender : attacker;

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

        if (threats.length === 0) return isDefending ? 1 : -1;
        threats.sort((a, b) => b.score - a.score);
        threats = threats.slice(0, Math.min(threats.length, 8));

        if (depth <= 0) {
            if (threats[0].score >= CONFIG.SCORES.LIVE_FOUR) return isDefending ? -1 : 1;
            return 0;
        }

        if (isDefending) {
            if (threats.length >= 2) {
                const topScore = threats[0].score;
                const secondScore = threats[1].score;
                if (topScore >= CONFIG.SCORES.RUSH_FOUR && secondScore >= CONFIG.SCORES.RUSH_FOUR) return -1;
                if (topScore >= CONFIG.SCORES.RUSH_FOUR && secondScore >= CONFIG.SCORES.LIVE_THREE) return -1;
            }

            for (const threat of threats) {
                if (this._timeUp()) return 0;
                if (threat.score >= CONFIG.SCORES.LIVE_THREE && threat.score < CONFIG.SCORES.RUSH_FOUR) {
                    const blocks = this._findBlockMoves(board, threat.row, threat.col, attacker);
                    let anyBlockSucceeds = false;
                    for (const block of blocks) {
                        board[block.row][block.col] = defender;
                        const result = this._forceKillSearch(board, depth - 1, attacker, defender, false);
                        board[block.row][block.col] = CONFIG.PLAYER.EMPTY;
                        if (result >= 0) { anyBlockSucceeds = true; break; }
                    }
                    if (!anyBlockSucceeds) return -1;
                } else {
                    const blockRow = threat.row, blockCol = threat.col;
                    board[blockRow][blockCol] = defender;
                    const result = this._forceKillSearch(board, depth - 1, attacker, defender, false);
                    board[blockRow][blockCol] = CONFIG.PLAYER.EMPTY;
                    if (result >= 0) return result;
                    return -1;
                }
            }
            return 1;
        } else {
            for (const threat of threats) {
                if (this._timeUp()) return 0;
                board[threat.row][threat.col] = attacker;
                if (Evaluate.checkWin(board, threat.row, threat.col, attacker)) {
                    board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                    return 1;
                }
                const result = this._forceKillSearch(board, depth - 1, attacker, defender, true);
                board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                if (result > 0) return 1;
            }
            return -1;
        }
    },

    _findBlockMoves: function(board, row, col, attacker) {
        const size = CONFIG.BOARD_SIZE;
        const blocks = [];
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        board[row][col] = attacker;
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = dirs[d];
            let count = 1;
            let forwardOpen = false, backwardOpen = false;
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === attacker) { count++; r += dr; c += dc; }
            if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) { forwardOpen = true; blocks.push({ row: r, col: c }); }
            r = row - dr; c = col - dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === attacker) { count++; r -= dr; c -= dc; }
            if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) { backwardOpen = true; blocks.push({ row: r, col: c }); }
        }
        board[row][col] = CONFIG.PLAYER.EMPTY;
        return blocks;
    },

    // 走法排序（兼容旧版调用）
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
        if (!this.killerMoves[depth]) this.killerMoves[depth] = [];
        const killers = this.killerMoves[depth];
        const existIdx = killers.findIndex(k => k && k.row === move.row && k.col === move.col);
        if (existIdx >= 0) { killers.splice(existIdx, 1); killers.unshift(move); }
        else { killers.unshift(move); if (killers.length > CONFIG.SEARCH.KILLER_MOVES) killers.pop(); }
    },

    _storeHash: function(hash, depth, score, flag) {
        if (this.tt.size >= CONFIG.SEARCH.TT_SIZE) this.tt.clear();
        this.tt.set(hash, { depth, score, flag });
    },

    _timeUp: function() {
        return Date.now() - this.startTime > this.timeLimit;
    }
};