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

    // 走法评估缓存（用于杀棋模块的增量更新）
    _evalGrid: null,       // [15][15][2] - _evalGrid[r][c][0]=黑方评分, [1]=白方评分

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
                    // [修复] 禁手检查：AI执黑时开局库走法也不能是禁手
                    if (this.banEnabled && aiPlayer === CONFIG.PLAYER.BLACK) {
                        board[bookMove.row][bookMove.col] = aiPlayer;
                        const isBan = Referee.checkForbidden(board, bookMove.row, bookMove.col);
                        board[bookMove.row][bookMove.col] = CONFIG.PLAYER.EMPTY;
                        if (!isBan) return { row: bookMove.row, col: bookMove.col };
                        // 是禁手，跳过开局库，继续后续搜索
                    } else {
                        return { row: bookMove.row, col: bookMove.col };
                    }
                }
            }
        }

        // === 第一步B：AI执白专用策略（早期阶段，带随机性）===
        // 设计理念：白棋作为后手不能只被动防守，需要主动制造威胁
        // 每个局面提供多个候选走法，按权重随机选取（每局不同风格）
        if (aiPlayer === CONFIG.PLAYER.WHITE && moveHistory && moveHistory.length >= 1 && moveHistory.length <= 12) {
            const whiteMove = WhiteStrategy.lookupWhite(moveHistory);
            if (whiteMove && board[whiteMove.row] && board[whiteMove.row][whiteMove.col] === CONFIG.PLAYER.EMPTY) {
                // 白棋无禁手限制，无需禁手检查
                return whiteMove;
            }
            // 策略库未命中或位置被占，继续走后续流程
        }

        // === 第二步：检查必胜/必防 ===
        const urgent = Evaluate.findUrgentMove(board, aiPlayer);
        if (urgent) {
            // [修复] 禁手检查：AI执黑时紧急走法也不能是禁手
            if (this.banEnabled && aiPlayer === CONFIG.PLAYER.BLACK) {
                board[urgent.move.row][urgent.move.col] = aiPlayer;
                const isBan = Referee.checkForbidden(board, urgent.move.row, urgent.move.col);
                board[urgent.move.row][urgent.move.col] = CONFIG.PLAYER.EMPTY;
                if (!isBan) {
                    // [新增] 多威胁检测：面对双冲四等无法完全防守的局面，跳过直接进入杀棋/搜索全力反击
                    if (urgent.type !== 'multiThreat') return urgent.move;
                    // 是多威胁(防不住)，不return，继续往下走杀棋和搜索，寻找反击机会
                }
                // 是禁手，跳过，继续杀棋检测
            } else {
                // [同上] 非禁手模式下也检查多威胁
                if (urgent.type !== 'multiThreat') return urgent.move;
                // multiThreat: 防不住，继续搜索反击
            }
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

            // [新增] 收集同分/近分候选，用于随机化选择
            const goodMoves = [];

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

                if (score > localBestScore + 50) { // 明显更优：清空重选
                    localBestScore = score;
                    localBest = move;
                    goodMoves.length = 0;
                    goodMoves.push({ move, score });
                } else if (score > localBestScore - 200 && score >= localBestScore) {
                    // 近似同分（差距<=200）：加入候选池用于随机选择
                    if (score > localBestScore) localBestScore = score;
                    if (score >= localBestScore - 100) {
                        goodMoves.push({ move, score });
                        if (!localBest || score > localBestScore - 50 || Math.random() < 0.3) {
                            localBest = move; // 随机切换到近分走法
                        }
                    } else {
                        localBest = move;
                    }
                }
                if (score > alpha) {
                    alpha = score;
                }
            }

            if (localBest && !this._timeUp()) {
                // [新增] 从候选池中随机选取（仅对非必胜/必败走法）
                if (goodMoves.length > 1 && localBestScore < CONFIG.SCORES.LIVE_FOUR * 0.5
                    && localBestScore > -CONFIG.SCORES.LIVE_FOUR * 0.5) {
                    bestMove = goodMoves[Math.floor(Math.random() * goodMoves.length)].move;
                } else {
                    bestMove = localBest;
                }
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
            // [优化] 使用快速威胁检测替代全盘 findUrgentMove 扫描
            const urgent = this._quickThreatCheck(board, currentPlayer);
            // [增强] 降低阈值：眠三以上都进入静止期（覆盖VCT威胁）
            if (urgent && urgent.score >= CONFIG.SCORES.SLEEP_THREE) {
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
    // [增强版] 支持多威胁处理，增加最大延伸深度到6层
    _quiescenceSearch: function(board, hash, depth, alpha, beta, currentPlayer, aiPlayer) {
        const standPat = Evaluate.quickEvaluate(board);
        const perspective = (currentPlayer === aiPlayer) ? 1 : -1;
        const standPatScore = standPat * perspective;

        if (standPatScore >= beta) return beta;
        if (standPatScore > alpha) alpha = standPatScore;

        if (depth <= 0) return standPatScore;

        // 处理活三及以上威胁（防守活三和冲四同等重要）
        // [优化] 使用快速威胁检测替代全盘 findUrgentMove 扫描
        const urgent = this._quickThreatCheck(board, currentPlayer);
        if (!urgent || urgent.score < CONFIG.SCORES.SLEEP_THREE) {
            return standPatScore;
        }

        // [新增] 收集所有达到眠三级别的威胁走法进行逐一延伸
        const size = CONFIG.BOARD_SIZE;
        const threatMoves = [];
        
        // 如果是 multiThreat 类型，优先处理其 threats 列表
        if (urgent.type === 'multiThreat' && urgent.threats) {
            for (const t of urgent.threats) {
                threatMoves.push({ row: t.row, col: t.col, score: t.score });
            }
        } else {
            threatMoves.push({ row: urgent.move.row, col: urgent.move.col, score: urgent.score });
            
            // [增强] 同时收集其他同级别的威胁点（如另一个眠三/活三）
            // [优化] 只扫描已有2+连续子线段附近的空位，避免全盘扫描
            const opponent = 3 - currentPlayer;
            const nearbyThreats = this._collectNearbyThreats(board, opponent, CONFIG.SCORES.SLEEP_THREE, urgent.move);
            for (const t of nearbyThreats) {
                threatMoves.push(t);
            }
        }

        // 按分数降序排列，优先处理最紧急的威胁
        threatMoves.sort((a, b) => b.score - a.score);

        // 对前几个威胁走法逐一延伸（限制数量防止爆炸）
        const maxThreats = Math.min(threatMoves.length, 4);
        let bestScore = standPatScore;

        for (let i = 0; i < maxThreats; i++) {
            const move = threatMoves[i];
            
            // 禁手检查：静止期搜索中黑棋走法也不能是禁手
            if (this.banEnabled && currentPlayer === CONFIG.PLAYER.BLACK) {
                board[move.row][move.col] = currentPlayer;
                if (Referee.checkForbidden(board, move.row, move.col)) {
                    board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                    continue; // 是禁手，跳过此威胁分支
                }
                board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
            }

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
            if (score > bestScore) bestScore = score;
            if (score > alpha) alpha = score;
        }

        return bestScore;
    },

    // ======= 走法按棋型精确排序 =======
    // 按威胁程度分组：活四>冲四>活三>眠三>活二>其他
    // [优化] 优先使用候选走法上预计算的 attackScore/defendScore，避免重复评估
    _sortMovesByType: function(moves, board, player) {
        const opponent = 3 - player;
        
        // 为每个走法计算进攻等级和防守等级
        const scored = moves.map(m => {
            // 优先使用预计算分数（来自 getCandidateMoves），避免重复调用 evaluatePosition
            const attackScore = (m.attackScore !== undefined) ? m.attackScore 
                              : Evaluate.evaluatePosition(board, m.row, m.col, player);
            const defendScore = (m.defendScore !== undefined) ? m.defendScore 
                              : Evaluate.evaluatePosition(board, m.row, m.col, opponent);
            
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

        // [优化] 构建评估缓存网格，杀棋模块全程复用，增量更新
        this._buildEvalGrid(board);

        let threats = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                const score = this._getEvalScore(r, c, player);
                // [修复] 降低门槛：眠三也纳入杀棋检测，覆盖VCT(连续冲四)序列
                if (score >= CONFIG.SCORES.SLEEP_THREE) {
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
            // [修复] 禁手检查：杀棋模块中AI执黑时跳过禁手走法
            if (this.banEnabled && player === CONFIG.PLAYER.BLACK) {
                board[move.row][move.col] = player;
                if (Referee.checkForbidden(board, move.row, move.col)) {
                    board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
                    continue;
                }
                board[move.row][move.col] = CONFIG.PLAYER.EMPTY;
            }
            if (move.score >= CONFIG.SCORES.LIVE_FOUR) return move;

            board[move.row][move.col] = player;
            // [优化] 增量更新评估网格
            const saved = this._updateEvalGrid(board, move.row, move.col);
            const result = this._forceKillSearch(board, CONFIG.SEARCH.KILL_SEARCH_DEPTH, player, opponent, false);
            // [优化] 恢复评估网格
            this._restoreEvalGrid(saved);
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

        // [优化] 使用评估缓存网格替代全盘 evaluatePosition 扫描
        let threats = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                const score = this._getEvalScore(r, c, currentPlayer);
                // [修复] 进攻方也纳入眠三：支持以眠三为起点的VCT序列
                if (score >= CONFIG.SCORES.RUSH_FOUR || 
                    (score >= CONFIG.SCORES.SLEEP_THREE && !isDefending)) {
                    threats.push({ row: r, col: c, score: score });
                }
            }
        }

        if (threats.length === 0) return -1;
        threats.sort((a, b) => b.score - a.score);
        threats = threats.slice(0, Math.min(threats.length, 8));

        if (depth <= 0) {
            if (threats[0].score >= CONFIG.SCORES.LIVE_FOUR) return isDefending ? -1 : 1;
            return 0;
        }

        if (isDefending) {
            // [修复] 返回值约定：positive = 杀棋确认(进攻方赢), non-positive = 杀棋被阻止(防守方赢)
            // 双威胁检测：如果进攻方同时有两个冲四或冲四+活三 → 防守方无法全堵 → 杀棋确认
            if (threats.length >= 2) {
                const topScore = threats[0].score;
                const secondScore = threats[1].score;
                if (topScore >= CONFIG.SCORES.RUSH_FOUR && secondScore >= CONFIG.SCORES.RUSH_FOUR) return 1;
                if (topScore >= CONFIG.SCORES.RUSH_FOUR && secondScore >= CONFIG.SCORES.LIVE_THREE) return 1;
            }

            for (const threat of threats) {
                if (this._timeUp()) return 0;
                // [修复] 防守方为黑棋时：挡点如果是禁手 -> 无法在此防守 -> 视为此路不通
                if (this.banEnabled && defender === CONFIG.PLAYER.BLACK) {
                    board[threat.row][threat.col] = defender;
                    if (Referee.checkForbidden(board, threat.row, threat.col)) {
                        board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                        continue; // 禁手点无法落子，尝试其他挡法
                    }
                    board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                }
                if (threat.score >= CONFIG.SCORES.LIVE_THREE && threat.score < CONFIG.SCORES.RUSH_FOUR) {
                    const blocks = this._findBlockMoves(board, threat.row, threat.col, attacker);
                    let anyBlockSucceeds = false;
                    for (const block of blocks) {
                        board[block.row][block.col] = defender;
                        const saved = this._updateEvalGrid(board, block.row, block.col);
                        const result = this._forceKillSearch(board, depth - 1, attacker, defender, false);
                        this._restoreEvalGrid(saved);
                        board[block.row][block.col] = CONFIG.PLAYER.EMPTY;
                        // result <= 0 表示进攻方在此挡点分支找不到杀棋 → 此挡有效
                        if (result <= 0) { anyBlockSucceeds = true; break; }
                    }
                    // 所有挡法都无效 → 进攻方能杀 → 杀棋确认
                    if (!anyBlockSucceeds) return 1;
                } else {
                    const blockRow = threat.row, blockCol = threat.col;
                    board[blockRow][blockCol] = defender;
                    const saved = this._updateEvalGrid(board, blockRow, blockCol);
                    const result = this._forceKillSearch(board, depth - 1, attacker, defender, false);
                    this._restoreEvalGrid(saved);
                    board[blockRow][blockCol] = CONFIG.PLAYER.EMPTY;
                    // result > 0: 进攻方仍能找到杀棋 → 此路不通，返回positive确认杀棋
                    if (result > 0) return 1;
                    // result <= 0: 挡成功了，继续处理其他威胁
                }
            }
            // 所有威胁都成功处理完毕 → 杀棋被阻止
            return -1;
        } else {
            for (const threat of threats) {
                if (this._timeUp()) return 0;
                // [修复] 禁手检查：进攻方为黑棋时跳过禁手走法
                if (this.banEnabled && attacker === CONFIG.PLAYER.BLACK) {
                    board[threat.row][threat.col] = attacker;
                    if (Referee.checkForbidden(board, threat.row, threat.col)) {
                        board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                        continue; // 禁手，尝试下一个威胁点
                    }
                    board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                }
                board[threat.row][threat.col] = attacker;
                if (Evaluate.checkWin(board, threat.row, threat.col, attacker)) {
                    board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                    return 1;
                }
                const saved = this._updateEvalGrid(board, threat.row, threat.col);
                const result = this._forceKillSearch(board, depth - 1, attacker, defender, true);
                this._restoreEvalGrid(saved);
                board[threat.row][threat.col] = CONFIG.PLAYER.EMPTY;
                if (result > 0) return 1;
            }
            return -1;
        }
    },

    _findBlockMoves: function(board, row, col, attacker) {
        const size = CONFIG.BOARD_SIZE;
        const blocks = [];
        const seen = new Set();
        const EMPTY = CONFIG.PLAYER.EMPTY;
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];

        const addBlock = (r, c) => {
            if (r < 0 || r >= size || c < 0 || c >= size) return;
            if (board[r][c] !== EMPTY) return;
            const key = r * size + c;
            if (!seen.has(key)) { seen.add(key); blocks.push({ row: r, col: c }); }
        };

        board[row][col] = attacker;
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = dirs[d];

            // 正方向：找连续子端点
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === attacker) {
                r += dr; c += dc;
            }
            // (r,c) 现在是正方向第一个非attacker格子
            if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === EMPTY) {
                addBlock(r, c); // 连续子端点（也是间隔点）

                // [增强] 检查间隔扩展：空位后面是否有更多同色子
                let gr = r + dr, gc = c + dc;
                let gapCount = 0;
                while (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === attacker) {
                    gapCount++; gr += dr; gc += dc;
                }
                if (gapCount > 0) {
                    // 间隔棋型存在，远端空位也是挡点
                    addBlock(gr, gc);
                }
            }

            // 负方向：找连续子端点
            r = row - dr; c = col - dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === attacker) {
                r -= dr; c -= dc;
            }
            if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === EMPTY) {
                addBlock(r, c); // 连续子端点（也是间隔点）

                // [增强] 检查间隔扩展
                let gr = r - dr, gc = c - dc;
                let gapCount = 0;
                while (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === attacker) {
                    gapCount++; gr -= dr; gc -= dc;
                }
                if (gapCount > 0) {
                    addBlock(gr, gc);
                }
            }
        }
        board[row][col] = EMPTY;
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

    // ======= 走法评估缓存（杀棋模块专用增量更新）=======
    // 构建15×15×2全盘评估网格
    _buildEvalGrid: function(board) {
        const size = CONFIG.BOARD_SIZE;
        this._evalGrid = [];
        for (let r = 0; r < size; r++) {
            this._evalGrid[r] = [];
            for (let c = 0; c < size; c++) {
                this._evalGrid[r][c] = [0, 0];
                if (board[r][c] === CONFIG.PLAYER.EMPTY) {
                    this._evalGrid[r][c][0] = Evaluate.evaluatePosition(board, r, c, CONFIG.PLAYER.BLACK);
                    this._evalGrid[r][c][1] = Evaluate.evaluatePosition(board, r, c, CONFIG.PLAYER.WHITE);
                }
            }
        }
    },

    // 落子后增量更新评估网格（只更新受影响范围内的格子）
    // 返回被修改的格子快照，用于撤回
    _updateEvalGrid: function(board, row, col) {
        const size = CONFIG.BOARD_SIZE;
        const radius = 5; // 落子最多影响周围5格内位置的评估
        const saved = [];

        for (let r = Math.max(0, row - radius); r <= Math.min(size - 1, row + radius); r++) {
            for (let c = Math.max(0, col - radius); c <= Math.min(size - 1, col + radius); c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                // 保存旧值
                saved.push({ r, c, v0: this._evalGrid[r][c][0], v1: this._evalGrid[r][c][1] });
                // 重新评估
                this._evalGrid[r][c][0] = Evaluate.evaluatePosition(board, r, c, CONFIG.PLAYER.BLACK);
                this._evalGrid[r][c][1] = Evaluate.evaluatePosition(board, r, c, CONFIG.PLAYER.WHITE);
            }
        }
        return saved;
    },

    // 恢复评估网格到落子前的状态
    _restoreEvalGrid: function(saved) {
        for (const { r, c, v0, v1 } of saved) {
            this._evalGrid[r][c][0] = v0;
            this._evalGrid[r][c][1] = v1;
        }
    },

    // 从评估网格中获取指定位置对指定玩家的评分
    _getEvalScore: function(row, col, player) {
        if (!this._evalGrid || !this._evalGrid[row]) {
            return 0; // 安全兜底
        }
        return this._evalGrid[row][col][player - 1]; // player=1(黑)→index0, player=2(白)→index1
    },

    // ======= 叶子节点快速威胁检测（替代全盘 findUrgentMove 扫描）=======
    // 只扫描已有2+连续子线段附近的空位，大幅减少 evaluatePosition 调用
    _quickThreatCheck: function(board, player) {
        const opponent = 3 - player;
        const size = CONFIG.BOARD_SIZE;
        const EMPTY = CONFIG.PLAYER.EMPTY;

        // 步骤1：收集2+连续子线段附近的关键空位
        const checkSet = new Set();

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === EMPTY) continue;
                const stonePlayer = board[r][c];

                for (let d = 0; d < 4; d++) {
                    const [dr, dc] = Evaluate.DIRECTIONS[d];
                    // 避免重复：只从每条线的起点开始计数
                    const pr = r - dr, pc = c - dc;
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size && board[pr][pc] === stonePlayer) continue;

                    // 计算连续子数
                    let count = 0;
                    let tr = r, tc = c;
                    while (tr >= 0 && tr < size && tc >= 0 && tc < size && board[tr][tc] === stonePlayer) {
                        count++; tr += dr; tc += dc;
                    }

                    if (count >= 2) {
                        // 收集线段两端及间隔延伸的空位
                        // 前端
                        if (pr >= 0 && pr < size && pc >= 0 && pc < size && board[pr][pc] === EMPTY) {
                            checkSet.add(pr * size + pc);
                            // 检查前端间隔扩展（如 X_XX 线段的前方空位后面还有同色子）
                            let fgr = pr - dr, fgc = pc - dc;
                            let fgN = 0;
                            while (fgr >= 0 && fgr < size && fgc >= 0 && fgc < size && board[fgr][fgc] === stonePlayer) {
                                fgN++; fgr -= dr; fgc -= dc;
                            }
                            if (fgN > 0 && fgr >= 0 && fgr < size && fgc >= 0 && fgc < size && board[fgr][fgc] === EMPTY) {
                                checkSet.add(fgr * size + fgc);
                            }
                            // 前端再远一格（非间隔情况）
                            if (fgN === 0) {
                                const br = pr - dr, bc = pc - dc;
                                if (br >= 0 && br < size && bc >= 0 && bc < size && board[br][bc] === EMPTY) {
                                    checkSet.add(br * size + bc);
                                }
                            }
                        }
                        // 后端
                        if (tr >= 0 && tr < size && tc >= 0 && tc < size && board[tr][tc] === EMPTY) {
                            checkSet.add(tr * size + tc);
                            // 检查间隔扩展
                            let gr = tr + dr, gc = tc + dc;
                            let gapN = 0;
                            while (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === stonePlayer) {
                                gapN++; gr += dr; gc += dc;
                            }
                            if (gapN > 0 && gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === EMPTY) {
                                checkSet.add(gr * size + gc);
                            }
                            // 后端再远一格
                            if (gapN === 0) {
                                const ar = tr + dr, ac = tc + dc;
                                if (ar >= 0 && ar < size && ac >= 0 && ac < size && board[ar][ac] === EMPTY) {
                                    checkSet.add(ar * size + ac);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 步骤2：只评估关键空位
        let bestAttackScore = 0, bestAttack = null;
        let bestDefendScore = 0, bestDefend = null;
        const rushFourDefends = [];

        for (const key of checkSet) {
            const cr = Math.floor(key / size);
            const cc = key % size;

            const attackScore = Evaluate.evaluatePosition(board, cr, cc, player);
            const defendScore = Evaluate.evaluatePosition(board, cr, cc, opponent);

            if (attackScore > bestAttackScore) {
                bestAttackScore = attackScore;
                bestAttack = { row: cr, col: cc };
            }
            if (defendScore > bestDefendScore) {
                bestDefendScore = defendScore;
                bestDefend = { row: cr, col: cc };
            }
            if (defendScore >= CONFIG.SCORES.RUSH_FOUR) {
                rushFourDefends.push({ row: cr, col: cc, score: defendScore });
            }

            // 早退：发现致命威胁立即返回
            if (bestAttackScore >= CONFIG.SCORES.LIVE_FOUR || bestDefendScore >= CONFIG.SCORES.LIVE_FOUR) break;
        }

        // 优先级逻辑（与 findUrgentMove 一致）
        if (bestAttackScore >= CONFIG.SCORES.LIVE_FOUR) {
            return { type: 'attack', move: bestAttack, score: bestAttackScore };
        }
        if (bestDefendScore >= CONFIG.SCORES.LIVE_FOUR) {
            return { type: 'defend', move: bestDefend, score: bestDefendScore };
        }
        if (bestAttackScore >= CONFIG.SCORES.RUSH_FOUR) {
            return { type: 'attack', move: bestAttack, score: bestAttackScore };
        }
        if (bestDefendScore >= CONFIG.SCORES.RUSH_FOUR) {
            const uniqueRushFours = Evaluate._deduplicateBlockPoints(rushFourDefends, board, opponent);
            if (uniqueRushFours.length >= 2 && bestAttackScore < CONFIG.SCORES.RUSH_FOUR) {
                return { type: 'multiThreat', move: bestDefend, score: bestDefendScore, threats: uniqueRushFours };
            }
            if (bestAttackScore < CONFIG.SCORES.RUSH_FOUR) {
                return { type: 'defend', move: bestDefend, score: bestDefendScore };
            }
            return { type: 'defend', move: bestDefend, score: bestDefendScore };
        }
        if (bestDefendScore >= CONFIG.SCORES.LIVE_THREE) {
            if (bestAttackScore < CONFIG.SCORES.LIVE_FOUR) {
                return { type: 'defend', move: bestDefend, score: bestDefendScore };
            }
        }

        return null;
    },

    // 收集指定玩家在2+连续子线段附近达到指定分数阈值的所有威胁点
    // exclude: 要排除的位置（如已作为主要威胁的位置）
    _collectNearbyThreats: function(board, player, minScore, exclude) {
        const size = CONFIG.BOARD_SIZE;
        const EMPTY = CONFIG.PLAYER.EMPTY;
        const threats = [];

        // 收集2+连续子线段附近的关键空位
        const checkSet = new Set();
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === EMPTY) continue;
                const sp = board[r][c];
                for (let d = 0; d < 4; d++) {
                    const [dr, dc] = Evaluate.DIRECTIONS[d];
                    const pr = r - dr, pc = c - dc;
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size && board[pr][pc] === sp) continue;
                    let cnt = 0, tr = r, tc = c;
                    while (tr >= 0 && tr < size && tc >= 0 && tc < size && board[tr][tc] === sp) {
                        cnt++; tr += dr; tc += dc;
                    }
                    if (cnt >= 2) {
                        if (pr >= 0 && pr < size && pc >= 0 && pc < size && board[pr][pc] === EMPTY) checkSet.add(pr * size + pc);
                        if (tr >= 0 && tr < size && tc >= 0 && tc < size && board[tr][tc] === EMPTY) checkSet.add(tr * size + tc);
                    }
                }
            }
        }

        for (const key of checkSet) {
            const cr = Math.floor(key / size);
            const cc = key % size;
            if (exclude && cr === exclude.row && cc === exclude.col) continue;
            const s = Evaluate.evaluatePosition(board, cr, cc, player);
            if (s >= minScore) {
                threats.push({ row: cr, col: cc, score: s });
            }
        }
        return threats;
    },

    _timeUp: function() {
        return Date.now() - this.startTime > this.timeLimit;
    }
};