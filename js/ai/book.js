// 五子棋开局定式库
// 坐标系统: (row, col) 0-indexed, 天元在 (7,7)
// 编码格式：用 "r1_c1,r2_c2,..." 作为局面签名，值为推荐的应着 {row, col}
const OpeningBook = {
    // 开局数据：{ "落子序列签名": {row, col, priority} }
    // priority: 1=必须走(必胜), 2=推荐走(优势), 3=可选走
    book: {},

    // 初始化棋谱库
    init: function() {
        this.book = {};
        
        // 花月局 (直指第四局) - 黑必胜开局
        // 黑1=(7,7), 白2变化
        this._addVariation([
            [7,7], [8,8],    // 黑1天元，白2右下角
            [6,6], [5,5],    // 黑3，白4
            [9,9], [9,8],    // 黑5活三，白6挡
            [8,9], [7,10],   // 黑7，白8
            [6,9],           // 黑9
        ], 1);
        
        // 花月 - 白2另种应法
        this._addVariation([
            [7,7], [8,8],
            [6,6], [8,7],    // 白4挡
            [9,9], [10,10],  // 黑5，白6
            [8,9],           // 黑7
        ], 1);

        // 花月 - 白4最强防 (I8)
        this._addVariation([
            [7,7], [8,8],
            [6,8], [7,8],    // 黑3跳到边上，白4挡
            [8,7], [7,6],    // 黑5，白6
            [6,7], [9,7],    // 黑7活三，白8挡
            [5,7],           // 黑9
        ], 1);
        
        // 花月 - 白4 G7
        this._addVariation([
            [7,7], [8,8],
            [6,8], [5,9],    // 黑3，白4 跳挡
            [8,7], [7,9],    // 黑5，白6
            [8,9], [9,10],   // 黑7，白8
            [6,7],           // 黑9
        ], 1);

        // 花月 - 白4 J10
        this._addVariation([
            [7,7], [8,8],
            [6,8], [9,10],   // 黑3，白4远挡
            [5,7], [8,9],    // 黑5，白6
            [4,6], [9,7],    // 黑7，白8
            [8,7],           // 黑9活三
        ], 1);

        // 花月 - 白4 J8
        this._addVariation([
            [7,7], [8,8],
            [6,8], [9,8],    // 黑3，白4跳
            [5,7], [6,9],    // 黑5，白6
            [7,10], [8,9],   // 黑7，白8
            [4,6], [10,8],   // 黑9活三，白10
            [9,9], [10,9],   // 黑11，白12
            [8,11],          // 黑13
        ], 1);

        // 花月 - 白4 I7
        this._addVariation([
            [7,7], [8,8],
            [6,8], [7,9],    // 黑3斜二，白4
            [9,9], [8,10],   // 黑5活三，白6
            [8,7], [8,9],    // 黑7，白8
            [6,7],           // 黑9
        ], 1);

        // ====== 浦月局 ======
        // 浦月 - 白2 右侧
        this._addVariation([
            [7,7], [7,8],    // 黑1天元，白2右侧
            [6,6], [6,7],    // 黑3斜二，白4挡
            [5,5], [5,6],    // 黑5活三，白6
            [8,8], [7,9],    // 黑7，白8
            [9,9],           // 黑9
        ], 1);

        // 浦月 - 白2 右下
        this._addVariation([
            [7,7], [8,8],    // 黑1，白2右下
            [7,8], [7,6],    // 黑3活二，白4挡
            [8,9], [9,10],   // 黑5，白6
            [6,9], [8,7],    // 黑7，白8
            [6,7], [5,5],    // 黑9，白10
            [9,7],           // 黑11
        ], 1);

        // 浦月 - 白4 I8
        this._addVariation([
            [7,7], [7,8],
            [6,8], [8,8],    // 黑3，白4
            [6,7], [9,8],    // 黑5，白6
            [5,7], [9,7],    // 黑7活三，白8
            [8,9], [7,10],   // 黑9，白10
            [5,6],           // 黑11
        ], 1);

        // 浦月 - 白6跳挡
        this._addVariation([
            [7,7], [7,8],
            [6,8], [8,8],
            [6,7], [9,9],    // 黑5，白6跳挡
            [5,6], [8,9],    // 黑7活三，白8
            [5,7], [9,8],    // 黑9，白10
            [8,7], [10,10],  // 黑11，白12
            [9,7],           // 黑13
        ], 1);

        // ====== 恒星 ======
        // 恒星 - 常见变化
        this._addVariation([
            [7,7], [8,8],
            [9,9], [6,9],    // 黑3，白4
            [9,8], [8,7],    // 黑5活二，白6挡
            [7,6], [10,8],   // 黑7，白8
            [5,5], [10,7],   // 黑9，白10
            [6,6],           // 黑11
        ], 2);
        
        // ====== 流星 ======
        this._addVariation([
            [7,7], [8,8],
            [6,6], [10,10],   // 黑3，白4远子
            [5,5], [9,9],     // 黑5，白6
            [4,4], [8,7],     // 黑7，白8
        ], 2);

        // ====== 云月 ======
        this._addVariation([
            [7,7], [8,8],
            [7,6], [8,7],     // 黑3，白4
            [6,5], [6,7],     // 黑5，白6
            [9,9], [7,5],     // 黑7，白8
        ], 2);

        // ====== 雨月 ======
        this._addVariation([
            [7,7], [8,8],
            [7,8], [9,8],     // 黑3，白4
            [6,6], [8,9],     // 黑5，白6
            [6,8], [8,7],     // 黑7，白8
        ], 2);

        // ====== 松月 ======
        this._addVariation([
            [7,7], [8,8],
            [7,8], [6,9],     // 黑3，白4
            [8,7], [9,7],     // 黑5，白6
            [9,9], [8,6],     // 黑7，白8
        ], 2);

        // ====== 寒星 ======
        this._addVariation([
            [7,7], [8,8],
            [9,7], [9,9],     // 黑3，白4
            [10,8], [7,9],    // 黑5，白6
            [8,6], [8,7],     // 黑7，白8
            [6,6],            // 黑9
        ], 2);

        // ====== 瑞星 ======
        this._addVariation([
            [7,7], [8,8],
            [9,9], [9,7],     // 黑3，白4
            [10,8], [8,9],    // 黑5，白6
            [8,7], [7,10],    // 黑7，白8
            [10,6], [6,10],   // 黑9，白10
        ], 2);

        // ====== 峡谷/岚月 ======
        this._addVariation([
            [7,7], [8,8],
            [7,8], [9,9],     // 黑3，白4
            [8,7], [9,7],     // 黑5，白6
            [6,8], [7,10],    // 黑7，白8
            [8,10],           // 黑9
        ], 2);

        // ====== 银月 ======
        this._addVariation([
            [7,7], [8,8],
            [5,5], [7,9],     // 黑3，白4
            [9,9], [8,10],    // 黑5斜活二，白6
            [6,4], [9,7],     // 黑7，白8
            [6,8],            // 黑9
        ], 2);
        
        // ====== 残月 ======
        this._addVariation([
            [7,7], [8,8],
            [6,6], [8,7],     // 黑3，白4
            [5,5], [9,9],     // 黑5，白6
            [9,8], [7,9],     // 黑7，白8
        ], 2);

        // ====== 斜月 ======
        this._addVariation([
            [7,7], [8,7],
            [9,8], [6,9],     // 黑3，白4
            [8,9], [10,7],    // 黑5，白6
            [9,6], [6,8],     // 黑7，白8
        ], 2);

        // ====== 游星 ======
        this._addVariation([
            [7,7], [8,7],
            [9,9], [6,8],     // 黑3，白4
            [5,7], [10,8],    // 黑5，白6
            [8,8], [9,7],     // 黑7，白8
        ], 2);

        // ====== 长星 ======
        this._addVariation([
            [7,7], [8,7],
            [9,8], [8,9],     // 黑3斜二，白4
            [9,9], [7,9],     // 黑5，白6
            [10,10], [9,10],  // 黑7，白8
            [8,10],           // 黑9
        ], 3);

        // ====== 水月 ======
        this._addVariation([
            [7,7], [8,7],
            [6,8], [9,9],     // 黑3，白4
            [9,8], [8,9],     // 黑5，白6
            [7,6], [7,9],     // 黑7，白8
        ], 2);

        // ====== 明星 ======
        this._addVariation([
            [7,7], [8,7],
            [8,8], [6,9],     // 黑3，白4
            [9,9], [7,9],     // 黑5，白6
            [7,6], [9,8],     // 黑7，白8
            [10,7],           // 黑9
        ], 2);
        
        // ====== 名月 ======
        this._addVariation([
            [7,7], [8,7],
            [7,8], [9,9],     // 黑3，白4
            [6,6], [8,9],     // 黑5，白6
            [7,5], [9,7],     // 黑7，白8
        ], 2);

        // ====== 山月 ======
        this._addVariation([
            [7,7], [8,7],
            [6,8], [7,9],     // 黑3，白4
            [9,9], [9,7],     // 黑5，白6
            [8,8], [10,8],    // 黑7，白8
            [8,10],           // 黑9
        ], 2);

        // ====== 新月 ======
        this._addVariation([
            [7,7], [8,7],
            [7,8], [8,8],     // 黑3，白4
            [6,6], [9,9],     // 黑5，白6
            [7,9], [8,10],    // 黑7，白8
            [9,8], [6,7],     // 黑9，白10
        ], 2);

        // ====== 金星 ======
        this._addVariation([
            [7,7], [8,7],
            [6,8], [8,9],     // 黑3，白4
            [9,8], [7,9],     // 黑5，白6
            [7,10], [8,8],    // 黑7，白8
            [9,6], [6,7],     // 黑9，白10
        ], 2);

        // ====== 松月 ======
        this._addVariation([
            [7,7], [8,7],
            [9,8], [9,9],     // 黑3，白4
            [8,9], [6,9],     // 黑5，白6
            [7,6], [10,8],    // 黑7，白8
            [8,6],            // 黑9
        ], 2);

        // ====== 丘月 ======
        this._addVariation([
            [7,7], [8,7],
            [9,9], [6,9],     // 黑3，白4
            [9,8], [10,8],    // 黑5，白6
            [8,9], [7,10],    // 黑7，白8
            [7,9],            // 黑9
        ], 2);

        // ====== 必胜定式补充（地狱难度优先使用）======

        // 花月局 - 深度必胜主线1（直指斜活三→VCF连杀）
        this._addVariation([
            [7,7], [8,8],
            [6,6], [5,5],     // 直指斜二
            [6,5], [6,7],     // 黑5做棋型，白6挡
            [5,6], [4,6],     // 黑7活三！白8唯一防
            [7,6], [4,5],     // 黑9冲四，白10堵
            [8,6], [3,5],     // 黑11再冲四，白12堵
            [9,6],            // 黑13活四！VCF必胜
        ], 1);

        // 花月局 - 深度必胜主线2（另一变例）
        this._addVariation([
            [7,7], [8,8],
            [6,6], [5,5],
            [6,5], [5,6],     // 白6另一应法
            [7,5], [8,5],     // 黑7，白8
            [5,7], [4,7],     // 黑9眠三转进攻
            [6,7], [4,6],     // 黑11
            [8,6],            // 黑13活三
        ], 1);

        // 浦月局 - 深度必胜主线1（横活三+纵眠三）
        this._addVariation([
            [7,7], [7,8],
            [6,6], [6,7],     // 斜二
            [5,5], [5,6],     // 活三
            [8,8], [7,9],     // 冲四方向
            [9,9], [4,4],     // VCF
            [4,5], [3,6],     // 连续冲四
            [2,7],            // 活四必胜
        ], 1);

        // 浦月局 - 深度必胜主线2
        this._addVariation([
            [7,7], [8,8],
            [7,8], [7,6],     // 活二
            [8,9], [9,10],    // 活三
            [6,9], [5,10],    // 延伸
            [8,7], [9,6],     // 双杀棋型
            [9,8],            // 双三/四杀
        ], 1);

        // 花月 - AI执黑先手专用：白2=(8,7)的应对（常见防守）
        this._addVariation([
            [7,7], [8,7],
            [8,8], [9,9],     // 黑3斜向，白4
            [7,8], [6,9],     // 黑5活二，白6
            [9,8], [10,9],    // 黑7活三，白8
            [6,8], [5,8],     // 黑9冲四，白10堵
            [9,7], [11,9],    // 黑11再冲四
            [8,10],           // 黑13活四
        ], 1);

        // 花月 - AI执黑：白2=(7,8)的应对
        this._addVariation([
            [7,7], [7,8],
            [8,8], [9,9],     // 对角发展
            [8,7], [6,9],     // 做棋
            [9,7], [10,7],    // 活三延伸
            [7,9], [6,10],    // 眠三
            [9,8], [5,11],    // 冲四
            [8,9],            // 活四
        ], 1);

        // 雨月 - 强化版（黑优）
        this._addVariation([
            [7,7], [8,8],
            [7,8], [9,8],
            [6,6], [8,9],
            [6,8], [6,9],    // 黑7双活二
            [5,7], [10,8],   // 黑9活三
            [7,6], [4,6],    // VCF开始
            [8,6],           // 活四
        ], 1);

        // 寒星 - 强化版（黑优）
        this._addVariation([
            [7,7], [8,8],
            [9,7], [8,6],    // 白4远挡
            [10,8], [7,9],   // 黑5，白6
            [8,9], [6,10],   // 黑7活三
            [9,9], [5,11],   // 延伸
            [11,8],          // 冲四成五
        ], 1);
    },

    // 添加一个变例到棋谱库
    // 修复：现在会为每一步都存储一条记录
    // 例如传入 [B1, W2, B3, W4, B5] 会存4条：
    //   {B1 → W2}, {B1_W2 → B3}, {B1_W2_B3 → W4}, {B1_W2_B3_W4 → B5}
    // 这样无论AI执黑还是执白，开局都能命中
    _addVariation: function(moves, priority) {
        // 为每一步棋都生成一条记录：前i步作为签名，第i+1步作为应手
        for (let m = 1; m < moves.length; m++) {
            // 前m步作为局面签名（对手下完后的局面）
            const signature = moves.slice(0, m).map(mv => mv[0] + "_" + mv[1]).join(",");
            // 第m+1步是推荐的应着
            const response = moves[m];
            
            // 已有记录且优先级更高时不覆盖
            if (!this.book[signature] || this.book[signature].priority > priority) {
                this.book[signature] = {
                    row: response[0],
                    col: response[1],
                    priority: priority
                };
            }
        }
    },

    // 查找当前局面是否匹配棋谱
    // 重要：只做精确匹配！棋谱命中=秒出，不命中=走搜索
    // 不做降级匹配，因为降级可能返回已落过的子，破坏棋盘
    lookup: function(moveHistory) {
        if (moveHistory.length === 0) return null;
        
        // 用完整历史步数做精确匹配
        const signature = moveHistory.map(m => m.row + "_" + m.col).join(",");
        return this.book[signature] || null;
    },

    // 获取开局库大小
    size: function() {
        return Object.keys(this.book).length;
    }
};

// ============================================================
//  AI执白专用策略库（进攻型 + 随机化）
//  设计理念：
//  - 白棋作为后手，不能只被动防守，必须主动制造威胁
//  - 每个局面提供多个候选走法，按权重随机选取
//  - 战术标签：standard(稳健)/aggressive(对攻)/counterAttack(反击)/trap(陷阱)/unorthodox(非常规)
//  - 覆盖前12手（早期阶段），之后交还给搜索引擎
// ============================================================
const WhiteStrategy = {
    whiteBook: {},       // { 签名: [{row, col, weight, tactic, note}] }

    // 初始化白棋专用策略库
    init: function() {
        this.whiteBook = {};

        // ==================== 白2：应对黑1天元(7,7) ====================
        // 五子棋白2是最关键的一步棋，决定了整局走向
        this._addWhiteChoices('7_7', [
            { row: 8, col: 8, weight: 30, tactic: 'standard',     note: '直指斜向-经典均衡应法' },
            { row: 8, col: 7, weight: 22, tactic: 'aggressive',   note: '横向邻近-积极干扰黑棋发展' },
            { row: 7, col: 8, weight: 22, tactic: 'aggressive',   note: '纵向邻近-积极干扰' },
            { row: 6, col: 6, weight: 10, tactic: 'counterAttack',note: '直指方向-反方向牵制' },
            { row: 9, col: 9, weight: 8,  tactic: 'unorthodox',  note: '远角-打乱对手开局库节奏' },
            { row: 6, col: 8, weight: 5,  tactic: 'surprise',     note: '斜向跳位-非常规' },
            { row: 8, col: 6, weight: 3,  tactic: 'surprise',     note: '另一侧跳位' },
        ]);

        // ==================== 白4：应对花月/浦月类常见黑3 ====================

        // 黑3=(6,6) 直指斜二（花月最常见续招）
        this._addWhiteChoices('7_7,8_8,6_6', [
            { row: 5, col: 5, weight: 25, tactic: 'counterAttack', note: '顺斜线跟防+做自己的棋' },
            { row: 9, col: 9, weight: 20, tactic: 'counterAttack', note: '反向延伸-对称发展' },
            { row: 5, col: 6, weight: 18, tactic: 'aggressive',   note: '堵一边同时做眠三' },
            { row: 6, col: 5, weight: 18, tactic: 'aggressive',   note: '另一侧堵+做棋' },
            { row: 6, col: 7, weight: 12, tactic: 'trap',         note: '跳位-诱导黑棋走入被动' },
            { row: 9, col: 6, weight: 7,  tactic: 'unorthodox',  note: '远距离干扰' },
        ]);

        // 黑3=(6,8) 浦月式横跳
        this._addWhiteChoices('7_7,8_7,6_8', [
            { row: 8, col: 8, weight: 28, tactic: 'standard',     note: '补强中心控制' },
            { row: 6, col: 6, weight: 22, tactic: 'counterAttack',note: '斜向做棋反击' },
            { row: 8, col: 6, weight: 18, tactic: 'aggressive',   note: '下方封堵+活二' },
            { row: 5, col: 8, weight: 15, tactic: 'aggressive',   note: '上方延伸' },
            { row: 9, col: 8, weight: 10, tactic: 'trap',         note: '远挡-拉开战线' },
            { row: 6, col: 7, weight: 7,  tactic: 'unorthodox',  note: '内嵌位' },
        ]);

        // 黑3=(7,8) 横向活二（浦月/雨月类）
        this._addWhiteChoices('7_7,7_8,6_6', [
            { row: 6, col: 7, weight: 25, tactic: 'aggressive',   note: '夹击中间-制造混乱' },
            { row: 8, col: 8, weight: 22, tactic: 'standard',     note: '斜向补强' },
            { row: 6, col: 8, weight: 20, tactic: 'counterAttack',note: '堵+做眠二' },
            { row: 8, col: 6, weight: 15, tactic: 'aggressive',   note: '下方发展' },
            { row: 9, col: 9, weight: 10, tactic: 'unorthodox',  note: '远角牵制' },
            { row: 5, col: 5, weight: 8,  tactic: 'counterAttack',note: '反斜向' },
        ]);

        // 黑3=(8,8) 斜向（流星/云月等）
        this._addWhiteChoices('7_7,8_8,9_9', [
            { row: 6, col: 6, weight: 28, tactic: 'counterAttack',note: '反向对称-经典防守' },
            { row: 6, col: 9, weight: 20, tactic: 'aggressive',   note: '右侧截断+做棋' },
            { row: 9, col: 8, weight: 18, tactic: 'aggressive',   note: '下方堵' },
            { row: 6, col: 8, weight: 15, tactic: 'trap',         note: '中间嵌入' },
            { row: 10, col: 10, weight: 10, tactic: 'unorthodox', note: '继续延伸-赌黑棋没准备' },
            { row: 5, col: 5, weight: 9,  tactic: 'counterAttack',note: '另一侧发展' },
        ]);

        // 黑3=(7,6) 云月式
        this._addWhiteChoices('7_7,8_8,7_6', [
            { row: 8, col: 7, weight: 25, tactic: 'aggressive',   note: '夹击' },
            { row: 6, col: 6, weight: 22, tactic: 'counterAttack',note: '斜向发展' },
            { row: 6, col: 7, weight: 20, tactic: 'standard',     note: '中间位置' },
            { row: 7, col: 5, weight: 15, tactic: 'aggressive',   note: '纵向延伸' },
            { row: 8, col: 6, weight: 10, tactic: 'trap',         note: '横向嵌' },
            { row: 9, col: 9, weight: 8,  tactic: 'unorthodox',  note: '远角' },
        ]);

        // 黑3=(9,7) 寒星式斜向
        this._addWhiteChoices('7_7,8_8,9_7', [
            { row: 9, col: 9, weight: 25, tactic: 'counterAttack',note: '补斜线' },
            { row: 8, col: 7, weight: 22, tactic: 'aggressive',   note: '中间夹击' },
            { row: 10, col: 8, weight: 18, tactic: 'standard',     note: '延伸方向堵' },
            { row: 6, col: 6, weight: 15, tactic: 'counterAttack',note: '反向发展' },
            { row: 8, col: 6, weight: 12, tactic: 'aggressive',   note: '左侧做棋' },
            { row: 10, col: 6, weight: 8,  tactic: 'unorthodox',  note: '大跳位' },
        ]);

        // 黑3=(5,5) 银月式远跳
        this._addWhiteChoices('7_7,8_8,5_5', [
            { row: 6, col: 6, weight: 30, tactic: 'standard',     note: '中间拦截' },
            { row: 9, col: 9, weight: 22, tactic: 'counterAttack',note: '对称发展' },
            { row: 6, col: 5, weight: 18, tactic: 'aggressive',   note: '右侧贴防' },
            { row: 5, col: 6, weight: 15, tactic: 'aggressive',   note: '下方贴防' },
            { row: 4, col: 4, weight: 10, tactic: 'unorthodox',  note: '继续放任-赌一把' },
            { row: 7, col: 9, weight: 5,  tactic: 'surprise',     note: '完全不打边' },
        ]);

        // ==================== 白4：应对直指类开局(黑1=7,7 白2=8,7) ====================

        // 黑3=(9,8) 斜月/长星等
        this._addWhiteChoices('7_7,8_7,9_8', [
            { row: 8, col: 8, weight: 26, tactic: 'standard',     note: '补天元斜线' },
            { row: 8, col: 9, weight: 22, tactic: 'aggressive',   note: '右侧包夹' },
            { row: 6, col: 8, weight: 18, tactic: 'counterAttack',note: '上方堵' },
            { row: 10, col: 7, weight: 15, tactic: 'trap',         note: '远端延伸' },
            { row: 9, col: 9, weight: 10, tactic: 'unorthodox',  note: '跳位' },
            { row: 6, col: 9, weight: 9,  tactic: 'aggressive',   note: '左上发展' },
        ]);

        // 黑3=(9,9)
        this._addWhiteChoices('7_7,8_7,9_9', [
            { row: 8, col: 8, weight: 28, tactic: 'standard',     note: '中心补' },
            { row: 9, col: 8, weight: 22, tactic: 'aggressive',   note: '夹击' },
            { row: 6, col: 6, weight: 20, tactic: 'counterAttack',note: '反向对称' },
            { row: 10, col: 10, weight: 12, tactic: 'unorthodox', note: '远延伸' },
            { row: 8, col: 9, weight: 10, tactic: 'trap',         note: '嵌位' },
            { row: 6, col: 8, weight: 8,  tactic: 'aggressive',   note: '上方' },
        ]);

        // 黑3=(6,8)
        this._addWhiteChoices('7_7,8_7,6_8', [
            { row: 8, col: 8, weight: 26, tactic: 'standard',     note: '斜向补强' },
            { row: 6, col: 7, weight: 22, tactic: 'aggressive',   note: '夹击' },
            { row: 6, col: 6, weight: 18, tactic: 'counterAttack',note: '斜向发展' },
            { row: 8, col: 6, weight: 15, tactic: 'aggressive',   note: '下方' },
            { row: 5, col: 8, weight: 10, tactic: 'trap',         note: '远端' },
            { row: 9, col: 9, weight: 9,  tactic: 'unorthodox',  note: '远角' },
        ]);

        // ==================== 白6：关键分支点（第6手）====================

        // 花月变例：7_7,8_8,6_6,5_5,6_5 → 白6
        this._addWhiteChoices('7_7,8_8,6_6,5_5,6_5', [
            { row: 6, col: 7, weight: 28, tactic: 'aggressive',   note: '堵活三+做眠二' },
            { row: 5, col: 6, weight: 24, tactic: 'aggressive',   note: '另一侧堵+做棋' },
            { row: 7, col: 5, weight: 20, tactic: 'counterAttack',note: '纵向延伸' },
            { row: 8, col: 5, weight: 15, tactic: 'trap',         note: '下方嵌位' },
            { row: 4, col: 5, weight: 8,  tactic: 'unorthodox',  note: '远挡' },
            { row: 5, col: 7, weight: 5,  tactic: 'surprise',     note: '内侧跳' },
        ]);

        // 花月变例：7_7,8_8,6_6,5_5,9_9 → 白6（黑5走另一侧）
        this._addWhiteChoices('7_7,8_8,6_6,5_5,9_9', [
            { row: 5, col: 6, weight: 26, tactic: 'aggressive',   note: '堵+做棋' },
            { row: 6, col: 5, weight: 24, tactic: 'aggressive',   note: '另一侧堵' },
            { row: 8, col: 7, weight: 20, tactic: 'counterAttack',note: '中间反击' },
            { row: 4, col: 4, weight: 15, tactic: 'standard',     note: '反向延伸' },
            { row: 10, col: 10, weight: 8,  tactic: 'unorthodox', note: '远角' },
            { row: 7, col: 9, weight: 7,  tactic: 'trap',         note: '右侧嵌' },
        ]);

        // 浦月变例：7_7,7_8,6_6,6_7,5_5 → 白6
        this._addWhiteChoices('7_7,7_8,6_6,6_7,5_5', [
            { row: 5, col: 6, weight: 28, tactic: 'aggressive',   note: '堵活三+做成活二' },
            { row: 4, col: 4, weight: 22, tactic: 'counterAttack',note: '反向斜线发展' },
            { row: 7, col: 6, weight: 18, tactic: 'trap',         note: '纵向嵌位' },
            { row: 8, col: 5, weight: 15, tactic: 'aggressive',   note: '右下延伸' },
            { row: 5, col: 7, weight: 10, tactic: 'unorthodox',  note: '右侧跳' },
            { row: 4, col: 6, weight: 7,  tactic: 'surprise',     note: '上方堵' },
        ]);

        // 直指类：7_7,8_7,9_8,8_9,9_9 → 白6
        this._addWhiteChoices('7_7,8_7,9_8,8_9,9_9', [
            { row: 10, col: 10, weight: 26, tactic: 'counterAttack',note: '延伸阻挡' },
            { row: 9, col: 10, weight: 23, tactic: 'aggressive',   note: '右侧堵+做棋' },
            { row: 10, col: 9, weight: 21, tactic: 'aggressive',   note: '下方堵' },
            { row: 7, col: 9, weight: 15, tactic: 'trap',         note: '内侧嵌位' },
            { row: 6, col: 6, weight: 10, tactic: 'unorthodox',  note: '远离战场' },
            { row: 8, col: 10, weight: 5,  tactic: 'surprise',     note: '跳位' },
        ]);

        // ==================== 白8：中盘进攻转折点 ====================

        // 常见花月中盘：黑7做了活三后的局面
        this._addWhiteChoices('7_7,8_8,6_6,5_5,6_5,6_7,5_6', [
            { row: 4, col: 6, weight: 32, tactic: 'aggressive',   note: '唯一堵点+做成眠三' },
            { row: 7, col: 6, weight: 25, tactic: 'counterAttack',note: '堵后做纵向活二' },
            { row: 4, col: 5, weight: 20, tactic: 'trap',         note: '斜向嵌-尝试反击' },
            { row: 8, col: 6, weight: 13, tactic: 'unorthodox',  note: '远挡' },
            { row: 3, col: 6, weight: 10, tactic: 'surprise',     note: '超远挡' },
        ]);

        // 另一种花月中盘
        this._addWhiteChoices('7_7,8_8,6_6,5_5,9_9,5_6,6_5', [
            { row: 4, col: 5, weight: 30, tactic: 'aggressive',   note: '堵+做眠二' },
            { row: 7, col: 5, weight: 25, tactic: 'counterAttack',note: '纵向往上发展' },
            { row: 4, col: 4, weight: 20, tactic: 'counterAttack',note: '斜向反击' },
            { row: 6, col: 4, weight: 15, tactic: 'trap',         note: '嵌位' },
            { row: 8, col: 4, weight: 10, tactic: 'unorthodox',  note: '远位' },
        ]);
    },

    // 添加一组候选走法（加权随机池）
    _addWhiteChoices: function(signature, choices) {
        this.whiteBook[signature] = choices;
    },

    // 查询AI执白的最佳走法（加权随机选择）
    // 返回 {row, col} 或 null
    lookupWhite: function(moveHistory) {
        if (!moveHistory || moveHistory.length === 0) return null;

        const signature = moveHistory.map(m => m.row + '_' + m.col).join(',');
        const choices = this.whiteBook[signature];
        if (!choices || choices.length === 0) return null;

        // 加权轮盘赌随机选择
        const totalWeight = choices.reduce((sum, c) => sum + c.weight, 0);
        let rand = Math.random() * totalWeight;

        for (const choice of choices) {
            rand -= choice.weight;
            if (rand <= 0) {
                return { row: choice.row, col: choice.col };
            }
        }

        // 兜底返回最后一个
        const last = choices[choices.length - 1];
        return { row: last.row, col: last.col };
    },

    // 获取当前签名的所有候选（调试用）
    getCandidates: function(moveHistory) {
        if (!moveHistory || moveHistory.length === 0) return [];
        const signature = moveHistory.map(m => m.row + '_' + m.col).join(',');
        return this.whiteBook[signature] || [];
    },

    size: function() {
        return Object.keys(this.whiteBook).length;
    }
};