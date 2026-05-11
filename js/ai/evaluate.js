// 棋型评估引擎 - 增强版
const Evaluate = {
    // 四个方向向量：水平、垂直、对角线（/）、对角线（\）
    DIRECTIONS: [[0, 1], [1, 0], [1, 1], [1, -1]],

    // 获取候选落子位置（周围有棋子的空位）
    getCandidateMoves: function(board, player) {
        const size = CONFIG.BOARD_SIZE;
        const candidates = [];
        const radius = 2; // 看距离已有棋子2格内的位置（确保覆盖跳活三、跳活二等棋型）

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
                    
                    candidates.push({ 
                        row: r, col: c, score: totalScore + posBonus,
                        attackScore: attackScore,
                        defendScore: defendScore
                    });
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
    // [增强] 支持间隔棋型识别：跳活三、跳冲四、跳活二等
    evaluatePosition: function(board, row, col, player) {
        let totalScore = 0;
        const size = CONFIG.BOARD_SIZE;
        const EMPTY = CONFIG.PLAYER.EMPTY;

        // [增强] 分别记录各方向的棋型，用于组合加成
        const patternScores = [];
        
        for (let d = 0; d < 4; d++) {
            const [dr, dc] = this.DIRECTIONS[d];
            
            // === 正方向扫描：连续子 ===
            let posCount = 0;
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                posCount++; r += dr; c += dc;
            }
            // (r,c) 现在是正方向第一个非player格子
            let posEndEmpty = (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === EMPTY);
            // 正方向间隔扩展：空位后面是否还有同色子？
            let posGapCount = 0;
            let posGapEndEmpty = false;
            if (posEndEmpty) {
                let gr = r + dr, gc = c + dc;
                while (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === player) {
                    posGapCount++; gr += dr; gc += dc;
                }
                if (posGapCount > 0) {
                    posGapEndEmpty = (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === EMPTY);
                }
            }

            // === 负方向扫描：连续子 ===
            let negCount = 0;
            r = row - dr; c = col - dc;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                negCount++; r -= dr; c -= dc;
            }
            let negEndEmpty = (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === EMPTY);
            // 负方向间隔扩展
            let negGapCount = 0;
            let negGapEndEmpty = false;
            if (negEndEmpty) {
                let gr = r - dr, gc = c - dc;
                while (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === player) {
                    negGapCount++; gr -= dr; gc -= dc;
                }
                if (negGapCount > 0) {
                    negGapEndEmpty = (gr >= 0 && gr < size && gc >= 0 && gc < size && board[gr][gc] === EMPTY);
                }
            }

            // 连续子总数（含假设落子）
            const totalCount = 1 + posCount + negCount;
            const totalOpenEnds = (posEndEmpty ? 1 : 0) + (negEndEmpty ? 1 : 0);
            const totalBlockEnds = 2 - totalOpenEnds;

            // 连续棋型评分
            let score = this._scorePatternEx(totalCount, totalOpenEnds, totalBlockEnds);

            // === 间隔棋型评分 ===
            // 正方向间隔（如 XXX_X）：填间隔=连五，等效冲四
            if (posGapCount > 0) {
                const gapTotal = totalCount + posGapCount;
                const gapOpenEnds = (negEndEmpty ? 1 : 0) + (posGapEndEmpty ? 1 : 0);
                score = Math.max(score, this._scoreGapPattern(gapTotal, gapOpenEnds));
            }
            // 负方向间隔（如 X_XXX）
            if (negGapCount > 0) {
                const gapTotal = totalCount + negGapCount;
                const gapOpenEnds = (posEndEmpty ? 1 : 0) + (negGapEndEmpty ? 1 : 0);
                score = Math.max(score, this._scoreGapPattern(gapTotal, gapOpenEnds));
            }
            // 双向间隔（如 X_P_X，两侧都有间隔扩展）
            if (posGapCount > 0 && negGapCount > 0) {
                const dualTotal = totalCount + posGapCount + negGapCount;
                const dualOpenEnds = (posGapEndEmpty ? 1 : 0) + (negGapEndEmpty ? 1 : 0);
                score = Math.max(score, this._scoreDualGapPattern(dualTotal, dualOpenEnds));
            }

            totalScore += score;
            patternScores.push(score);
        }

        // [新增] 组合棋型加成：同时形成多个活形的位置额外加分
        totalScore += this._combinationBonus(patternScores);

        return totalScore;
    },

    // 组合棋型加成：检测一个落子是否同时形成多个有威胁的棋型
    _combinationBonus: function(patternScores) {
        let liveTwoCount = 0;   // 活二数量
        let sleepThreeCount = 0; // 眠三数量
        let liveThreePlus = 0;   // 活三及以上

        for (const s of patternScores) {
            if (s >= CONFIG.SCORES.LIVE_THREE) liveThreePlus++;
            else if (s >= CONFIG.SCORES.SLEEP_THREE) sleepThreeCount++;
            else if (s >= CONFIG.SCORES.LIVE_TWO) liveTwoCount++;
        }

        let bonus = 0;
        // 双活二 -> 下一步可能成双活三，非常危险
        if (liveTwoCount >= 2) bonus += 3000;
        // 三活二
        if (liveTwoCount >= 3) bonus += 5000;
        // 活二+眠三组合
        if (liveTwoCount >= 1 && sleepThreeCount >= 1) bonus += 2000;
        // 双眠三
        if (sleepThreeCount >= 2) bonus += 4000;
        // 多方向活形（2个及以上方向有活二以上）
        const activeDirs = patternScores.filter(s => s >= CONFIG.SCORES.LIVE_TWO).length;
        if (activeDirs >= 3) bonus += 2000; // 三向发展潜力

        return bonus;
    },

    // 评估整个棋盘对某玩家的总分数（用于局面评估）
    evaluateBoard: function(board, player) {
        let score = 0;
        const size = CONFIG.BOARD_SIZE;

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

    // 快速评估（用于Alpha-Beta叶子节点）
    quickEvaluate: function(board) {
        return this.evaluateTotal(board);
    },

    // 检查是否有人赢了（从落子位置延伸检查，O(1)）
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
            return 0; // 两端都被堵的冲四没意义
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

    // 间隔棋型评分：N子+1间隔（跳活三、跳冲四、跳活二等）
    // 间隔棋型的威胁在于：填间隔可使两组子连通，形成更强的棋型
    _scoreGapPattern: function(totalStones, openEnds) {
        const S = CONFIG.SCORES;

        if (totalStones >= 5) {
            // 5子+间隔：填间隔=连五，等效冲四
            return S.RUSH_FOUR;
        }
        if (totalStones === 4) {
            // 跳冲四：4子+1间隔，填间隔=连五，对手必须堵间隔
            return S.RUSH_FOUR;
        }
        if (totalStones === 3) {
            // 跳活三/跳眠三：填间隔=四子连
            if (openEnds >= 2) return S.LIVE_THREE;   // 跳活三
            if (openEnds === 1) return S.SLEEP_THREE;  // 跳眠三
            return 0; // 两端皆封
        }
        if (totalStones === 2) {
            if (openEnds >= 2) return S.LIVE_TWO;     // 跳活二
            if (openEnds === 1) return S.SLEEP_TWO;    // 跳眠二
            return 0;
        }
        return 0;
    },

    // 双向间隔棋型评分：两侧都有间隔扩展（如 X_P_X）
    // 填任一侧间隔都能形成更强棋型，威胁极大
    _scoreDualGapPattern: function(totalStones, openEnds) {
        const S = CONFIG.SCORES;

        if (totalStones >= 5) {
            return S.LIVE_FOUR;  // 近乎必胜
        }
        if (totalStones === 4) {
            if (openEnds >= 1) return Math.floor(S.LIVE_FOUR * 0.9);  // 非常强
            return S.RUSH_FOUR;
        }
        if (totalStones === 3) {
            if (openEnds >= 2) return S.LIVE_THREE;
            if (openEnds >= 1) return S.SLEEP_THREE;
            return 0;
        }
        return 0;
    },

    // 棋型分数映射（向后兼容）
    _scorePattern: function(count, openEnds) {
        return this._scorePatternEx(count, openEnds, 2 - openEnds);
    },

    // 检查是否有急需处理的威胁（必胜/必防）
    // 返回: { type: 'attack'|'defend'|'multiThreat', move: {row, col}, score, threats[] }
    // 增强版：检测多个同时存在的冲四威胁，避免漏防
    findUrgentMove: function(board, player) {
        const opponent = 3 - player;
        const size = CONFIG.BOARD_SIZE;
        let bestAttack = null, bestAttackScore = 0;
        let bestDefend = null, bestDefendScore = 0;

        // 收集所有达到冲四级别的防守点（用于多威胁检测）
        const rushFourDefends = [];

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

                // 记录所有冲四级别的防守点
                if (defendScore >= CONFIG.SCORES.RUSH_FOUR) {
                    rushFourDefends.push({ row: r, col: c, score: defendScore });
                }
            }
        }

        // 优先级：
        // 1. 自己能连五/活四 → 进攻
        if (bestAttackScore >= CONFIG.SCORES.LIVE_FOUR) {
            return { type: 'attack', move: bestAttack, score: bestAttackScore };
        }
        // 2. 对手能连五/活四 → 必须防
        if (bestDefendScore >= CONFIG.SCORES.LIVE_FOUR) {
            return { type: 'defend', move: bestDefend, score: bestDefendScore };
        }
        // 3. 自己能冲四 → 进攻（后续可能连杀）
        if (bestAttackScore >= CONFIG.SCORES.RUSH_FOUR) {
            return { type: 'attack', move: bestAttack, score: bestAttackScore };
        }
        // 4. 对手能冲四 → 必须防（增强：检测多重冲四威胁）
        if (bestDefendScore >= CONFIG.SCORES.RUSH_FOUR) {
            // [新增] 检查是否有多个独立的冲四威胁点
            // 如果有>=2个不同位置的冲四，说明对手形成双冲四，无法全部堵住
            const uniqueRushFours = this._deduplicateBlockPoints(rushFourDefends, board, opponent);

            if (uniqueRushFours.length >= 2 && bestAttackScore < CONFIG.SCORES.RUSH_FOUR) {
                // 双冲四以上且我无冲四反击 → 防不住，标记为多威胁
                return { type: 'multiThreat', move: bestDefend, score: bestDefendScore, threats: uniqueRushFours };
            }

            if (bestAttackScore < CONFIG.SCORES.RUSH_FOUR) {
                return { type: 'defend', move: bestDefend, score: bestDefendScore };
            }
            // 双方都有冲四，进攻方先走有利，但还是优先防守
            return { type: 'defend', move: bestDefend, score: bestDefendScore };
        }
        // 5. 对手有活三 → 必须防！
        if (bestDefendScore >= CONFIG.SCORES.LIVE_THREE) {
            if (bestAttackScore < CONFIG.SCORES.LIVE_FOUR) {
                return { type: 'defend', move: bestDefend, score: bestDefendScore };
            }
        }

        return null;
    },

    // 去重：将挡在同一个冲四线上的多个位置合并为一个独立威胁
    // 返回去重后的独立威胁列表（每个代表一个必须单独应对的冲四）
    _deduplicateBlockPoints: function(rushFourList, board, opponent) {
        // 对于每个冲四级别的落子点，找出它堵的是哪条线
        // 如果两个点的堵线方向+位置相同（即堵同一个冲四），则只算一个
        const uniqueGroups = [];
        const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const pt of rushFourList) {
            const { row, col } = pt;
            let isNewThreat = true;

            // 检查这个点和已有的哪个威胁属于同一条冲四线
            for (const group of uniqueGroups) {
                const existing = group[0];
                // 判断两个点是否在同一条线上（通过检查是否共享同一串连续棋子）
                if (this._sameRushFourLine(board, existing.row, existing.col, row, col, opponent)) {
                    group.push(pt); // 同一线的归入同一组
                    isNewThreat = false;
                    break;
                }
            }

            if (isNewThreat) {
                uniqueGroups.push([pt]);
            }
        }

        // 返回每组的一个代表（组数=独立威胁数）
        return uniqueGroups.map(g => g[0]);
    },

    // 判断两个落子点是否在阻挡同一条冲四线上
    _sameRushFourLine: function(board, r1, c1, r2, c2, player) {
        const size = CONFIG.BOARD_SIZE;
        const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

        // 找出(r1,c1)所阻挡的冲四线的方向和范围
        for (const [dr, dc] of DIRECTIONS) {
            // 从r1,c1沿dr,dc方向找连续的同色子序列
            let count1 = 0;
            let sr = r1 + dr, sc = c1 + dc;
            while (sr >= 0 && sr < size && sc >= 0 && sc < size && board[sr][sc] === player) {
                count1++; sr += dr; sc += dc;
            }
            sr = r1 - dr; sc = c1 - dc;
            while (sr >= 0 && sr < size && sc >= 0 && sc < size && board[sr][sc] === player) {
                count1++; sr -= dr; sc -= dc;
            }

            // 同样计算r2,c2
            let count2 = 0;
            sr = r2 + dr; sc = c2 + dc;
            while (sr >= 0 && sr < size && sc >= 0 && sc < size && board[sr][sc] === player) {
                count2++; sr += dr; sc += dc;
            }
            sr = r2 - dr; sc = c2 - dc;
            while (sr >= 0 && sr < size && sc >= 0 && sc < size && board[sr][sc] === player) {
                count2++; sr -= dr; sc -= dc;
            }

            // 如果两个点在这个方向上都形成了冲四(count>=3, 因为加上落子=4)，可能是同一线
            if (count1 >= 3 && count2 >= 3) {
                // 进一步验证：检查两点是否在同一直线上且中间只有连续同色子
                if ((r1 - r2) * dc === (c1 - c2) * dr) { // 共线
                    return true;
                }
            }
        }
        return false;
    },

    // 统计棋盘上具备某级别及以上威胁的位置数量
    _countThreatsOfLevel: function(board, player, minScore) {
        const size = CONFIG.BOARD_SIZE;
        let count = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;
                const score = this.evaluatePosition(board, r, c, player);
                if (score >= minScore) count++;
            }
        }
        return count;
    }
};