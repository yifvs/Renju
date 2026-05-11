// 快速走子策略 - 用于MCTS模拟阶段的快速随机对局
const Playout = {

    // 执行快速随机模拟，返回胜负结果
    // 返回: 1 (AI赢), -1 (AI输), 0 (平局)
    simulate: function(board, aiPlayer) {
        const size = CONFIG.BOARD_SIZE;
        const opponent = 3 - aiPlayer;
        let currentPlayer = opponent; // 轮到对手下（模拟从AI下完后的局面开始）
        
        // 深拷贝棋盘
        const simBoard = board.map(row => [...row]);
        
        // 统计已下子数
        let moveCount = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (simBoard[r][c] !== CONFIG.PLAYER.EMPTY) moveCount++;
            }
        }

        // 限制最大模拟步数（避免死循环）
        const maxMoves = size * size - moveCount;
        let movesPlayed = 0;

        while (movesPlayed < maxMoves) {
            // 获取候选位置并随机选择一个（加权）
            const candidates = this._getPlayoutMoves(simBoard, currentPlayer);
            
            if (candidates.length === 0) break;

            // 按分数加权随机选择
            const move = this._weightedRandom(candidates);
            simBoard[move.row][move.col] = currentPlayer;
            movesPlayed++;

            // 检查是否赢了
            if (Evaluate.checkWin(simBoard, move.row, move.col, currentPlayer)) {
                if (currentPlayer === aiPlayer) return 1;
                else return -1;
            }

            // 切换玩家
            currentPlayer = 3 - currentPlayer;
        }

        return 0; // 平局
    },

    // 快速走子获取候选位置（比正式评估更简化）
    _getPlayoutMoves: function(board, player) {
        const size = CONFIG.BOARD_SIZE;
        const candidates = [];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;

                // 只考虑距离已有棋子1格内的位置（加速模拟）
                let hasNeighbor = false;
                for (let dr = -1; dr <= 1 && !hasNeighbor; dr++) {
                    for (let dc = -1; dc <= 1 && !hasNeighbor; dc++) {
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
                    // 极简评分（只评估该位置的价值，用于加权随机）
                    let score = Math.random() * 100; // 基础随机
                    
                    // 稍微偏向中心
                    const center = Math.floor(size / 2);
                    const dist = Math.abs(r - center) + Math.abs(c - center);
                    score += (size - dist) * 2;

                    // 如果能在该位置形成四子，大幅加分
                    const attackScore = Evaluate.evaluatePosition(board, r, c, player);
                    const defendScore = Evaluate.evaluatePosition(board, r, c, 3 - player);
                    score += attackScore * 0.001 + defendScore * 0.0005;

                    candidates.push({ row: r, col: c, score: Math.max(score, 1) });
                }
            }
        }

        // 如果没有候选位置（棋盘为空），返回天元
        if (candidates.length === 0) {
            const center = Math.floor(size / 2);
            return [{ row: center, col: center, score: 100 }];
        }

        return candidates;
    },

    // 加权随机选择
    _weightedRandom: function(candidates) {
        const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
        let r = Math.random() * totalScore;
        
        for (const candidate of candidates) {
            r -= candidate.score;
            if (r <= 0) return candidate;
        }

        return candidates[candidates.length - 1];
    }
};