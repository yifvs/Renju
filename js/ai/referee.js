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

    // 详细分析某个方向上的棋型
    // 返回: { isLiveThree, isFour, count }
    _analyzeDirection: function(board, row, col, player, dr, dc) {
        const size = CONFIG.BOARD_SIZE;
        
        // 统计连续棋子
        let count = 1;
        let gaps = []; // 记录间隔中的空位

        // 先找两端
        let forwardSpace = 0, backwardSpace = 0;
        
        // 正方向
        let r = row + dr, c = col + dc;
        let gapFound = false;
        while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] !== 3 - player) {
            if (board[r][c] === player) {
                count++;
                r += dr;
                c += dc;
            } else if (board[r][c] === CONFIG.PLAYER.EMPTY && !gapFound) {
                // 有一个间隔（跳活）
                forwardSpace = 1;
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === player) {
                    count++;
                    gapFound = true;
                    gaps.push({ r: r, c: c });
                    r = nr + dr;
                    c = nc + dc;
                    // 继续往后
                    while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                        count++;
                        r += dr;
                        c += dc;
                    }
                    if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) {
                        forwardSpace++;
                    }
                }
                break;
            } else break;
        }
        if (!gapFound && r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) {
            forwardSpace++;
        }

        // 负方向
        r = row - dr;
        c = col - dc;
        gapFound = false;
        while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] !== 3 - player) {
            if (board[r][c] === player) {
                count++;
                r -= dr;
                c -= dc;
            } else if (board[r][c] === CONFIG.PLAYER.EMPTY && !gapFound) {
                backwardSpace = 1;
                let nr = r - dr, nc = c - dc;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === player) {
                    count++;
                    gapFound = true;
                    r = nr - dr;
                    c = nc - dc;
                    while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
                        count++;
                        r -= dr;
                        c -= dc;
                    }
                    if (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) {
                        backwardSpace++;
                    }
                }
                break;
            } else break;
        }
        if (!gapFound && r >= 0 && r < size && c >= 0 && c < size && board[r][c] === CONFIG.PLAYER.EMPTY) {
            backwardSpace++;
        }

        const openEnds = forwardSpace + backwardSpace;
        const result = { count: count, isLiveThree: false, isFour: false };

        // 判断活三：连续3颗且两端开放，或跳活三
        if (count === 3 && openEnds >= 2) {
            result.isLiveThree = true;
        }
        // 跳活三：4颗中有1个间隔且两端至少1个开放
        if (count === 4 && gaps.length === 1 && openEnds >= 1) {
            result.isLiveThree = true;
        }

        // 判断四
        if (count === 4) {
            if (openEnds >= 1 || gaps.length === 1) {
                result.isFour = true;
            }
        }
        if (count > 4) {
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

    // 对局结束后评级
    // params: { winner: boolean/玩家赢了?, playerColor, moveCount, difficulty, usedUndo, mode }
    ratePlayer: function(params) {
        const { winner, playerColor, moveCount, difficulty, usedUndo, mode } = params;
        let score = 1000; // 基础分

        // 1. 胜负
        if (winner) {
            // 赢了
            score += 500;
            // 步数越少分越高（胜利效率）
            if (moveCount <= 20) score += 200;
            else if (moveCount <= 40) score += 100;
        } else {
            // 输了
            // 撑得越久说明越厉害
            if (moveCount >= 50) score += 200;
            else if (moveCount >= 30) score += 100;
            else if (moveCount >= 15) score += 30;
        }

        // 2. 难度加成
        if (mode === 'pva') {
            if (difficulty === 'hell') score += 500;
            else if (difficulty === 'hard') score += 300;
            else if (difficulty === 'medium') score += 150;
        }

        // 3. 悔棋扣分
        if (usedUndo > 0) {
            score -= usedUndo * 50;
        }

        // 4. 步数越多加分（代表复杂的对局）
        if (moveCount >= 40) score += 100;
        else if (moveCount >= 25) score += 50;

        // 5. 双人对战加分项：棋局棋型质量
        // 这里简单处理，评分高说明下得好

        // 确保最低分
        score = Math.max(100, score);

        // 确定段位
        return this._getRank(score);
    },

    _getRank: function(score) {
        if (score >= 1700) {
            return {
                rank: 'S',
                title: '🏆 五子棋王者',
                color: '#FFD700',
                desc: '棋力超凡，已达化境！',
                score: score
            };
        } else if (score >= 1400) {
            return {
                rank: 'A',
                title: '💎 钻石棋手',
                color: '#00BFFF',
                desc: '思路清晰，棋风稳健！',
                score: score
            };
        } else if (score >= 1150) {
            return {
                rank: 'B',
                title: '🥇 黄金棋手',
                color: '#FFD700',
                desc: '初窥门径，继续加油！',
                score: score
            };
        } else if (score >= 900) {
            return {
                rank: 'C',
                title: '🥈 白银棋手',
                color: '#C0C0C0',
                desc: '还需磨练基本功！',
                score: score
            };
        } else {
            return {
                rank: 'D',
                title: '🥉 青铜棋手',
                color: '#CD7F32',
                desc: '多多练习，必成大器！',
                score: score
            };
        }
    }
};