// 游戏配置
const CONFIG = {
    BOARD_SIZE: 15,          // 15x15 标准五子棋盘
    CELL_SIZE: 36,          // 格子像素大小
    BOARD_PADDING: 20,      // 棋盘边距
    STONE_RADIUS: 15,       // 棋子半径
    
    // 难度对应的搜索深度
    DIFFICULTY: {
        easy: { searchDepth: 4, label: '简单' },
        medium: { searchDepth: 6, label: '中等' },
        hard: { searchDepth: 8, label: '困难' },
        hell: { searchDepth: 10, label: '地狱' }
    },

    // 棋型分数
    SCORES: {
        FIVE: 10000000,          // 连五
        LIVE_FOUR: 1000000,      // 活四
        RUSH_FOUR: 100000,       // 冲四
        LIVE_THREE: 50000,       // 活三
        SLEEP_THREE: 5000,       // 眠三
        LIVE_TWO: 500,           // 活二
        SLEEP_TWO: 100,          // 眠二
        LIVE_ONE: 10             // 活一
    },

    // 搜索参数
    SEARCH: {
        // 走法排序时，进攻分和防守分的权重比例
        ATTACK_WEIGHT: 1.0,
        DEFEND_WEIGHT: 1.1,     // 防守权重略高，避免漏防
        
        // 位置权重（中心加分）
        CENTER_BONUS: 3,
        
        // 置换表大小
        TT_SIZE: 1000000,
        
        // 杀手走法数量（每层保留的杀手走法数）
        KILLER_MOVES: 2,
        
        // 搜索时间限制（毫秒） - 不同难度不同
        TIME_LIMITS: {
            easy: 3000,
            medium: 5000,
            hard: 8000,
            hell: 12000
        },
        
        // 杀棋模块最大强制搜索深度
        KILL_SEARCH_DEPTH: 16,
        
        // 候选限制
        MAX_CANDIDATES: {
            2: 25,
            4: 20,
            6: 15,
            8: 12,
            10: 10
        }
    },

    // 棋手
    PLAYER: {
        EMPTY: 0,
        BLACK: 1,
        WHITE: 2
    }
};

// 计算棋盘总尺寸
CONFIG.BOARD_SIZE_PX = (CONFIG.BOARD_SIZE - 1) * CONFIG.CELL_SIZE + CONFIG.BOARD_PADDING * 2;