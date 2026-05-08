// 棋型评估引擎 - 增强版
const Evaluate = {
    // 四个方向向量：水平、垂直、对角线（/）、对角线（\）
    DIRECTIONS: [[0, 1], [1, 0], [1, 1], [1, -1]],

    // 获取候选落子位置（周围有棋子的空位）
    getCandidateMoves: function(board, player) {
        const size = CONFIG.BOARD_SIZE;
        const candidates = [];
        const radius = 1; // 只看距离已有棋子1格内的位置（加速搜索）

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                
                // 看周围是否有棋子
                let hasNeighbor = false;
                for (let dr = -radius; dr <= radius && !hasNeighbor; dr++) {
                    for (let dc = -radius; dc <= radius && !hasNeighbor; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                            if (board[nr][nc] !== CONFIG.PLAYER.EMPTY) {
                                hasNeighbor = true;
                            }
                        }
                    }
                }

                if (hasNeighbor) {
                    // 计算这个位置的分数（进攻+防守）
                    const attackScore = this.evaluatePosition(board, r, c, player);
                    const defendScore = this.evaluatePosition(board, r, c, 3 - player);
                    const totalScore = attackScore * CONFIG.SEARCH.ATTACK_WEIGHT 
                                    + defendScore * CONFIG.SEARCH.DEFEND_WEIGHT;
                    
                    // 加位置权重（偏向中心）
                    const center = Math.floor(size / 2);
                    const dist = Math.abs(r - center) + Math.abs(c - center);
                    const posBonus = (size - dist) * CONFIG.SEARCH.CENTER_BONUS;
                    
                    candidates.push({ row: r, col: c, score: totalScore + posBonus });
                }
            }
        }

        // 如果是空棋盘，返回天元
        if (candidates.length === 0) {
            const center = Math.floor(size / 2);
            return [{ row: center, col: center, score: 0 }];
        }

        // 按分数降序排列（重要！好的排序能大幅提升Alpha-Beta剪枝效率）
        candidates.sort((a, b) => b.score - a.score);
        return candidates;
    },

    // 评估在(row, col)落子后对该玩家的价值（假设已落子）
    evaluatePosition: function(board, row, col, player) {
        let totalScore = 0;
        const size = CONFIG.BOARD_SIZE;
        
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = this.DIRECTIONS[d];
            
            // 统计该方向上的连续棋子
            let count = 1; // 假设已落子
            let openEnds = 0;
            let blockEnds = 0; // 被对手挡住的端点数
            
            // 正方向
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                count++;
                r += dr;
                c += dc;
            }
            if (r >= 0 && r < size && c >= 0 && c < size) {
                if (board[r][c] === CONFIG.PLAYER.EMPTY) openEnds++;
                else blockEnds++;
            } else blockEnds++;

            // 负方向
            r = row - dr;
            c = col - dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                count++;
                r -= dr;
                c -= dc;
            }
            if (r >= 0 && r < size && c >= 0 && c < size) {
                if (board[r][c] === CONFIG.PLAYER.EMPTY) openEnds++;
                else blockEnds++;
            } else blockEnds++;

            // 根据棋型评分（增强版）
            totalScore += this._scorePatternEx(count, openEnds, blockEnds);
        }

        return totalScore;
    },

    // 评估整个棋盘对某玩家的总分数（用于局面评估）
    evaluateBoard: function(board, player) {
        let score = 0;
        const size = CONFIG.BOARD_SIZE;
        const opponent = 3 - player;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== player) continue;
                
                for (let d = 0; d < 4; d++) {
                    const [dr, dc] = this.DIRECTIONS[d];
                    
                    // 只计算每个方向一次（避免重复计算同一条线）
                    const pr = r - dr;
                    const pc = c - dc;
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size && board[pr][pc] === player) {
                        continue;
                    }

                    // 统计该方向连续棋子
                    let count = 0;
                    let openEnds = 0;
                    let blockEnds = 0;
                    let tr = r, tc = c;

                    while (tr >= 0 && tr < size && tc >= 0 && tc < size && board[tr][tc] === player) {
                        count++;
                        tr += dr;
                        tc += dc;
                    }
                    if (tr >= 0 && tr < size && tc >= 0 && tc < size) {
                        if (board[tr][tc] === CONFIG.PLAYER.EMPTY) openEnds++;
                        else blockEnds++;
                    } else blockEnds++;

                    // 负方向端点
                    tr = r - dr;
                    tc = c - dc;
                    if (tr >= 0 && tr < size && tc >= 0 && tc < size) {
                        if (board[tr][tc] === CONFIG.PLAYER.EMPTY) openEnds++;
                        else blockEnds++;
                    } else blockEnds++;

                    score += this._scorePatternEx(count, openEnds, blockEnds);
                }
            }
        }

        return score;
    },

    // 评估局面：返回黑方总分 - 白方总分（正值黑优，负值白优）
    evaluateTotal: function(board) {
        const blackScore = this.evaluateBoard(board, CONFIG.PLAYER.BLACK);
        const whiteScore = this.evaluateBoard(board, CONFIG.PLAYER.WHITE);
        return blackScore - whiteScore;
    },

    // 快速评估（只评估盘面差，用于Alpha-Beta叶子节点）
    quickEvaluate: function(board) {
        return this.evaluateTotal(board);
    },

    // 检查是否有人赢了
    checkWin: function(board, row, col, player) {
        const size = CONFIG.BOARD_SIZE;
        
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = this.DIRECTIONS[d];
            let count = 1;
            
            // 正方向
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                count++;
                r += dr;
                c += dc;
            }
            
            // 负方向
            r = row - dr;
            c = col - dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                count++;
                r -= dr;
                c -= dc;
            }
            
            if (count >= 5) return true;
        }
        
        return false;
    },

    // 检查某个玩家是否全局胜利
    checkGlobalWin: function(board, player) {
        const size = CONFIG.BOARD_SIZE;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === player) {
                    if (this.checkWin(board, r, c, player)) return true;
                }
            }
        }
        return false;
    },

    // 增强棋型分数映射（含blocked端点）
    _scorePatternEx: function(count, openEnds, blockEnds) {
        const S = CONFIG.SCORES;
        
        if (count >= 5) return S.FIVE;
        
        if (count === 4) {
            if (openEnds === 2) return S.LIVE_FOUR;
            if (openEnds === 1) return S.RUSH_FOUR;
            if (blockEnds === 2) return 0;
            return S.RUSH_FOUR * 0.5; // 一边被堵的冲四
        }
        
        if (count === 3) {
            if (openEnds === 2) return S.LIVE_THREE;
            if (openEnds === 1) return S.SLEEP_THREE;
            return 0;
        }
        
        if (count === 2) {
            if (openEnds === 2) return S.LIVE_TWO;
            if (openEnds === 1) return S.SLEEP_TWO;
            return 0;
        }
        
        if (count === 1) {
            if (openEnds === 2) return S.LIVE_ONE;
            return 0;
        }
        
        return 0;
    },

    // 棋型分数映射（向后兼容）
    _scorePattern: function(count, openEnds) {
        return this._scorePatternEx(count, openEnds, 2 - openEnds);
    },

    // 检查是否有必胜/必防的威胁
    // 返回: { type: 'attack'|'defend', move: {row, col}, score }
    findUrgentMove: function(board, player) {
        const opponent = 3 - player;
        const size = CONFIG.BOARD_SIZE;
        let bestAttack = null, bestAttackScore = 0;
        let bestDefend = null, bestDefendScore = 0;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;

                // 攻击价值
                const attackScore = this.evaluatePosition(board, r, c, player);
                if (attackScore > bestAttackScore) {
                    bestAttackScore = attackScore;
                    bestAttack = { row: r, col: c };
                }

                // 防守价值
                const defendScore = this.evaluatePosition(board, r, c, opponent);
                if (defendScore > bestDefendScore) {
                    bestDefendScore = defendScore;
                    bestDefend = { row: r, col: c };
                }
            }
        }

        // 优先走必胜
        if (bestAttackScore >= CONFIG.SCORES.FIVE) {
            return { type: 'attack', move: bestAttack, score: bestAttackScore };
        }
        // 然后是活四进攻
        if (bestAttackScore >= CONFIG.SCORES.LIVE_FOUR) {
            return { type: 'attack', move: bestAttack, score: bestAttackScore };
        }
        // 对手能活四必须防
        if (bestDefendScore >= CONFIG.SCORES.LIVE_FOUR) {
            return { type: 'defend', move: bestDefend, score: bestDefendScore };
        }
        // 对手能冲四而我不能冲四反击，必须防
        if (bestDefendScore >= CONFIG.SCORES.RUSH_FOUR && bestAttackScore < CONFIG.SCORES.RUSH_FOUR) {
            return { type: 'defend', move: bestDefend, score: bestDefendScore };
        }

        return null;
    }
};