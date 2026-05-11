// Zobrist 哈希 - 用于快速比较棋盘状态和缓存
// 支持增量更新，避免每次全盘扫描
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
        // 使用更高质量的随机数（避免哈希冲突）
        let h = 0;
        for (let i = 0; i < 8; i++) {
            h = (h << 4) ^ (Math.random() * 0x100000000);
        }
        return h >>> 0; // 无符号32位
    },

    // 计算整个棋盘的哈希值（只在最开始时调用一次）
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

    // 增量更新哈希（下子后更新）O(1)
    // 在落子/撤子时调用，避免全盘重算
    updateHash: function(hash, row, col, player) {
        if (this.table.length === 0) this.init();
        if (player === CONFIG.PLAYER.BLACK) {
            hash ^= this.table[row][col][0];
        } else if (player === CONFIG.PLAYER.WHITE) {
            hash ^= this.table[row][col][1];
        }
        return hash;
    },

    // 撤销走子时更新哈希（与updateHash相同，因为XOR是可逆的）
    undoHash: function(hash, row, col, player) {
        return this.updateHash(hash, row, col, player);
    }
};