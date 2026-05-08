// Zobrist 哈希 - 用于快速比较棋盘状态和缓存
const Zobrist = {
    table: [],
    init: function() {
        const size = CONFIG.BOARD_SIZE;
        this.table = [];
        for (let i = 0; i < size; i++) {
            this.table[i] = [];
            for (let j = 0; j < size; j++) {
                this.table[i][j] = [
                    this._randomInt(), // 黑子
                    this._randomInt()  // 白子
                ];
            }
        }
    },

    _randomInt: function() {
        return Math.floor(Math.random() * 2147483647);
    },

    // 计算整个棋盘的哈希值
    computeHash: function(board) {
        if (this.table.length === 0) this.init();
        let hash = 0;
        const size = CONFIG.BOARD_SIZE;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (board[i][j] === CONFIG.PLAYER.BLACK) {
                    hash ^= this.table[i][j][0];
                } else if (board[i][j] === CONFIG.PLAYER.WHITE) {
                    hash ^= this.table[i][j][1];
                }
            }
        }
        return hash;
    },

    // 增量更新哈希（下子后更新）
    updateHash: function(hash, row, col, player) {
        if (this.table.length === 0) this.init();
        if (player === CONFIG.PLAYER.BLACK) {
            hash ^= this.table[row][col][0];
        } else if (player === CONFIG.PLAYER.WHITE) {
            hash ^= this.table[row][col][1];
        }
        return hash;
    },

    // 撤销走子时更新哈希
    undoHash: function(hash, row, col, player) {
        return this.updateHash(hash, row, col, player);
    }
};