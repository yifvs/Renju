// MCTS (蒙特卡洛树搜索) - AlphaGo 风格的核心AI引擎
const MCTS = {
    root: null,
    aiPlayer: CONFIG.PLAYER.WHITE,
    iterations: 5000,
    maxDepth: 3,

    // MCTS节点
    Node: function(board, move, player, parent) {
        this.board = board;           // 棋盘状态
        this.move = move;             // 走到这个节点的落子 {row, col}
        this.player = player;         // 走到这步的玩家
        this.parent = parent;         // 父节点
        this.children = [];           // 子节点列表
        this.visits = 0;              // 访问次数
        this.wins = 0;                // 胜利次数
        this.untriedMoves = [];       // 尚未探索的走法
        this.isTerminal = false;      // 是否为终局节点
        this.winner = 0;              // 赢家（如果有）
    },

    // 获取AI的最佳走法
    getBestMove: function(board, aiPlayer, difficulty, moveHistory) {
        this.aiPlayer = aiPlayer;
        const config = CONFIG.DIFFICULTY[difficulty] || CONFIG.DIFFICULTY.medium;
        this.iterations = config.mctsIterations;
        this.maxDepth = config.simulationDepth;

        // === 第一步：检查开局库 ===
        if (moveHistory && moveHistory.length > 0) {
            const bookMove = OpeningBook.lookup(moveHistory);
            if (bookMove && bookMove.priority <= 2) {
                // 优先级1（必胜）或2（优势）的开局走法，直接使用
                return { row: bookMove.row, col: bookMove.col };
            }
        }

        // === 第二步：检查有没有必胜/必防的位置 ===
        const urgentMove = this._checkUrgentMove(board, aiPlayer);
        if (urgentMove) return urgentMove;

        // 创建根节点
        this.root = new this.Node(
            board.map(row => [...row]),
            null,
            null,
            null
        );

        // 初始化根节点的未探索走法
        const candidates = Evaluate.getCandidateMoves(board, aiPlayer);
        this.root.untriedMoves = candidates.map(c => ({ row: c.row, col: c.col }));

        // 如果只有一步可走，直接返回
        if (this.root.untriedMoves.length === 1) {
            return this.root.untriedMoves[0];
        }

        // === 第三步：MCTS搜索 ===
        for (let i = 0; i < this.iterations; i++) {
            // 1. 选择（Selection）
            let node = this._select(this.root);
            
            // 2. 扩展（Expansion）
            if (!node.isTerminal && node.untriedMoves.length > 0) {
                node = this._expand(node);
            }

            // 3. 模拟（Simulation）
            const result = this._simulate(node);

            // 4. 回溯（Backpropagation）
            this._backpropagate(node, result);
        }

        // 选择访问次数最多的子节点
        return this._getBestChildMove();
    },

    // 选择阶段：从根节点开始，选择最优子节点直到叶子节点
    _select: function(node) {
        while (node.children.length > 0 && node.untriedMoves.length === 0 && !node.isTerminal) {
            node = this._selectBestChild(node);
        }
        return node;
    },

    // 选择最佳子节点（使用UCB1公式）
    _selectBestChild: function(node) {
        let bestChild = null;
        let bestValue = -Infinity;
        const C = Math.SQRT2; // 探索常数

        for (const child of node.children) {
            if (child.visits === 0) {
                // 未访问过的节点优先探索
                return child;
            }

            // UCB1 = winRate + C * sqrt(log(parentVisits) / childVisits)
            const winRate = child.wins / child.visits;
            const exploration = C * Math.sqrt(Math.log(node.visits) / child.visits);
            const value = winRate + exploration;

            if (value > bestValue) {
                bestValue = value;
                bestChild = child;
            }
        }

        return bestChild;
    },

    // 扩展阶段：为节点添加一个新的子节点
    _expand: function(node) {
        // 从未探索的走法中随机选一个
        const idx = Math.floor(Math.random() * node.untriedMoves.length);
        const move = node.untriedMoves.splice(idx, 1)[0];

        // 计算新棋盘状态
        const newBoard = node.board.map(row => [...row]);
        const nextPlayer = node.player === null ? this.aiPlayer : 3 - node.player;
        
        // 修正：根节点时，下一步应该是AI
        const movePlayer = node.player === null ? this.aiPlayer : 
                          (node.player === CONFIG.PLAYER.BLACK ? CONFIG.PLAYER.WHITE : CONFIG.PLAYER.BLACK);
        
        newBoard[move.row][move.col] = movePlayer;

        // 检查是否形成五子连珠
        const isWin = Evaluate.checkWin(newBoard, move.row, move.col, movePlayer);
        
        const childNode = new this.Node(
            newBoard,
            move,
            movePlayer,
            node
        );

        // 如果是终局，标记
        if (isWin) {
            childNode.isTerminal = true;
            childNode.winner = movePlayer;
        } else {
            // 计算子节点的候选走法
            const candidates = Evaluate.getCandidateMoves(newBoard, 3 - movePlayer);
            childNode.untriedMoves = candidates.map(c => ({ row: c.row, col: c.col }));
        }

        node.children.push(childNode);
        return childNode;
    },

    // 模拟阶段：快速随机对弈到终局
    _simulate: function(node) {
        if (node.isTerminal) {
            if (node.winner === this.aiPlayer) return 1;
            if (node.winner === 3 - this.aiPlayer) return -1;
            return 0;
        }

        // 使用Playout引擎进行快速模拟
        return Playout.simulate(node.board, this.aiPlayer);
    },

    // 回溯阶段：将模拟结果向上传播
    _backpropagate: function(node, result) {
        while (node !== null) {
            node.visits++;
            // 从AI视角看胜负
            if (result === 1) {
                node.wins++; // AI赢了
            } else if (result === -1) {
                // AI输了，wins不变
            } else {
                node.wins += 0.5; // 平局算半胜
            }
            node = node.parent;
        }
    },

    // 检查紧急情况：是否有必胜或必防的位置
    _checkUrgentMove: function(board, player) {
        const opponent = 3 - player;
        const size = CONFIG.BOARD_SIZE;
        let bestAttack = null, bestAttackScore = 0;
        let bestDefend = null, bestDefendScore = 0;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== CONFIG.PLAYER.EMPTY) continue;

                // 检查在此位置进攻的价值
                const attackScore = Evaluate.evaluatePosition(board, r, c, player);
                if (attackScore >= CONFIG.SCORES.LIVE_FOUR && attackScore > bestAttackScore) {
                    bestAttack = { row: r, col: c };
                    bestAttackScore = attackScore;
                }

                // 检查在此位置防守的价值
                const defendScore = Evaluate.evaluatePosition(board, r, c, opponent);
                if (defendScore >= CONFIG.SCORES.LIVE_FOUR && defendScore > bestDefendScore) {
                    bestDefend = { row: r, col: c };
                    bestDefendScore = defendScore;
                }
            }
        }

        // 如果能直接获胜，优先进攻
        if (bestAttackScore >= CONFIG.SCORES.FIVE) return bestAttack;
        if (bestAttackScore >= CONFIG.SCORES.LIVE_FOUR) return bestAttack;
        
        // 如果对手能活四或冲四，必须防守
        if (bestDefendScore >= CONFIG.SCORES.LIVE_FOUR) return bestDefend;
        if (bestDefendScore >= CONFIG.SCORES.RUSH_FOUR && bestAttackScore < CONFIG.SCORES.RUSH_FOUR) {
            return bestDefend;
        }

        return null;
    },

    // 获取最佳落子位置
    _getBestChildMove: function() {
        let bestChild = null;
        let bestVisits = -1;

        for (const child of this.root.children) {
            if (child.visits > bestVisits) {
                bestVisits = child.visits;
                bestChild = child;
            }
        }

        if (bestChild && bestChild.move) {
            return bestChild.move;
        }

        // 兜底：返回第一个候选
        const candidates = Evaluate.getCandidateMoves(this.root.board, this.aiPlayer);
        return candidates.length > 0 ? candidates[0] : { row: 7, col: 7 };
    }
};