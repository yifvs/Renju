// 五子棋裁判 - 禁手检测 + 棋手评级
const Referee = {

    // ======= 禁手检测 =======

    // 检查黑棋在(row, col)落子是否形成禁手
    // 禁手规则（仅对黑棋有效）：
    // 1. 双活三禁手：同时形成两个或以上的活三
    // 2. 双四禁手：同时形成两个或以上的活四/冲四
    // 3. 长连禁手：形成6颗或以上连珠
    checkForbidden: function(board, row, col) {
        const size = CONFIG.BOARD_SIZE;
        const player = board[row][col]; // 假设已经落子

        // 禁手只对黑棋有效
        if (player !== CONFIG.PLAYER.BLACK) return false;

        // 1. 长连禁手
        if (this._checkLongConnection(board, row, col, player)) {
            return { type: 'long', name: '长连禁手' };
        }

        // 2. 统计各个方向的活三和四的数量
        let threeCount = 0; // 活三数量
        let fourCount = 0;  // 冲四+活四数量

        const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (let d = 0; d < 4; d++) {
            const [dr, dc] = DIRECTIONS[d];
            const info = this._analyzeDirection(board, row, col, player, dr, dc);

            if (info.isLiveThree) threeCount++;
            if (info.isFour) fourCount++;
        }

        // 3. 双活三禁手
        if (threeCount >= 2) {
            return { type: 'doubleThree', name: '双活三禁手' };
        }

        // 4. 双四禁手
        if (fourCount >= 2) {
            return { type: 'doubleFour', name: '双四禁手' };
        }

        return false;
    },

    // 检查长连（6颗或以上连续同色棋）
    _checkLongConnection: function(board, row, col, player) {
        const size = CONFIG.BOARD_SIZE;
        const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (let d = 0; d < 4; d++) {
            const [dr, dc] = DIRECTIONS[d];
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

            if (count > 5) return true;
        }

        return false;
    },

    // 详细分析某个方向上的棋型（落子后）
    // 返回: { count, isLiveThree, isFour }
    // count: 该方向上连子总数（含跳连）
    // isLiveThree: 是否为活三（3子连续，两端皆空）
    // isFour: 是否为冲四或活四（4子及以上，至少一端可延伸）
    // 注意：跳三不算活三（只能成冲四）；隔空四算冲四
    _analyzeDirection: function(board, row, col, player, dr, dc) {
        const size = CONFIG.BOARD_SIZE;
        
        // == 第一步：朝正反两个方向统计连续棋子 ==
        // 先朝正方向数
        let count = 1;
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }
        // 记录正方向末端状态
        let fEndOpen = (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY);

        // 再朝负方向数
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }
        let bEndOpen = (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY);
        
        const openEnds = (fEndOpen ? 1 : 0) + (bEndOpen ? 1 : 0);
        const result = { count, isLiveThree: false, isFour: false };

        // == 第二步：判断活三 ==
        // 活三定义：连续3子且两端皆开放
        // 这样下一步就能形成活四（两端都能连成五）
        // 眠三（一端被堵）不算活三，跳三也不算活三
        if (count === 3 && openEnds === 2) {
            result.isLiveThree = true;
        }

        // == 第三步：判断四 ==
        // 四定义：4子及以上连续，至少一端开放可以再下子形成五连
        // 包括活四（两端空）和冲四（一端空）
        // count>=5时一定是连五以上，可以成五连，算四禁手
        // 注意：这里仅统计落子位置形成的"四"，用于双四禁手检测
        if (count >= 4 && openEnds >= 1) {
            result.isFour = true;
        }

        return result;
    },

    // 检查是否有五子连珠（用于禁手下的胜利判定）
    checkWinWithBan: function(board, row, col, player) {
        // 如果是黑棋，先检查是否禁手
        if (player === CONFIG.PLAYER.BLACK) {
            const ban = this.checkForbidden(board, row, col);
            if (ban) return { win: false, ban: ban };
        }
        
        // 检查五子连珠
        const isWin = Evaluate.checkWin(board, row, col, player);
        return { win: isWin, ban: false };
    },

    // ======= 棋手评级系统 =======

    // 对局结束后评级 - 仅评价人类玩家棋力
    // params: { winner: boolean, moveCount, difficulty, usedUndo, mode }
    // winner = true 表示人类玩家赢了，false 表示人类玩家输了
    ratePlayer: function(params) {
        const { winner, moveCount, difficulty, usedUndo, mode } = params;
        
        // 基础分取决于输赢
        let score = winner ? 600 : 300;

        // 1. 胜利加分 + 效率奖励
        if (winner) {
            score += 400; // 胜利额外加分
            // 步数越少说明棋力越强
            if (moveCount <= 15) score += 300;  // 速胜
            else if (moveCount <= 25) score += 200;
            else if (moveCount <= 40) score += 100;
        } else {
            // 虽然输了，但撑得久说明有一定防守能力
            if (moveCount >= 50) score += 150;  // 鏖战惜败
            else if (moveCount >= 35) score += 80;
            else if (moveCount >= 20) score += 30;
            // 20步以内就输→不加分（基础分已定）
        }

        // 2. 难度加成（赢了才有明显加成，输了微调）
        if (mode === 'pva') {
            const diffBonus = winner ? 1.0 : 0.3; // 输了只拿30%的难度加成
            if (difficulty === 'hell') score += Math.round(400 * diffBonus);
            else if (difficulty === 'hard') score += Math.round(250 * diffBonus);
            else if (difficulty === 'medium') score += Math.round(120 * diffBonus);
        }

        // 3. 悔棋扣分
        if (usedUndo > 0) {
            score = Math.max(0, score - usedUndo * 60);
        }

        // 4. 步数多且有来有回 → 额外加分（无论输赢）
        if (moveCount >= 40) score += 50;

        // 确保在合理范围
        score = Math.max(0, Math.min(2000, score));

        return this._getRank(score, winner);
    },

    // winner参数用于显示合适的描述文字
    _getRank: function(score, winner) {
        let rank, title, color, desc;
        
        if (winner) {
            if (score >= 1700) {
                rank = 'S'; title = '🏆 五子棋王者'; color = '#FFD700'; desc = '棋力超凡，已臻化境！';
            } else if (score >= 1400) {
                rank = 'A'; title = '💎 钻石棋手'; color = '#00BFFF'; desc = '思路清晰，棋风犀利！';
            } else if (score >= 1100) {
                rank = 'B'; title = '🥇 黄金棋手'; color = '#FFD700'; desc = '初具棋力，继续精进！';
            } else if (score >= 800) {
                rank = 'C'; title = '🥈 白银棋手'; color = '#C0C0C0'; desc = '基本功尚可，仍需磨练！';
            } else {
                rank = 'D'; title = '🥉 青铜棋手'; color = '#CD7F32'; desc = '再接再厉，多多练习！';
            }
        } else {
            // 输了的描述更委婉
            if (score >= 1000) {
                rank = 'A'; title = '💎 潜力新星'; color = '#00BFFF'; desc = '虽败犹荣，与强手鏖战！';
            } else if (score >= 700) {
                rank = 'B'; title = '🥇 进阶棋手'; color = '#FFD700'; desc = '有一定功底，继续加油！';
            } else if (score >= 400) {
                rank = 'C'; title = '🥈 入门棋手'; color = '#C0C0C0'; desc = '还需熟悉基本棋型套路！';
            } else {
                rank = 'D'; title = '🥉 新手'; color = '#CD7F32'; desc = '先了解下五子棋规则吧！';
            }
        }

        return { rank, title, color, desc, score };
    }
};