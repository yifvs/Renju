// 棋盘绘制引擎
const Board = {
    canvas: null,
    ctx: null,
    lastMoveRow: -1,
    lastMoveCol: -1,

    // 初始化
    init: function() {
        this.canvas = document.getElementById('boardCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置canvas尺寸
        this.canvas.width = CONFIG.BOARD_SIZE_PX;
        this.canvas.height = CONFIG.BOARD_SIZE_PX;

        // 绑定事件
        this.canvas.addEventListener('click', this._onClick.bind(this));
    },

    // 绘制整个棋盘
    draw: function(board) {
        const ctx = this.ctx;
        const size = CONFIG.BOARD_SIZE;
        const cellSize = CONFIG.CELL_SIZE;
        const padding = CONFIG.BOARD_PADDING;
        const canvasSize = CONFIG.BOARD_SIZE_PX;

        // 清空画布
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // 绘制木色背景
        ctx.fillStyle = '#dcb35c';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // 绘制木质纹理（简单效果）
        ctx.strokeStyle = 'rgba(160, 120, 60, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvasSize; i += 3) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvasSize, i);
            ctx.stroke();
        }

        // 绘制网格线
        ctx.strokeStyle = '#5d3a1a';
        ctx.lineWidth = 1;

        for (let i = 0; i < size; i++) {
            const pos = padding + i * cellSize;
            
            // 横线
            ctx.beginPath();
            ctx.moveTo(padding, pos);
            ctx.lineTo(padding + (size - 1) * cellSize, pos);
            ctx.stroke();

            // 竖线
            ctx.beginPath();
            ctx.moveTo(pos, padding);
            ctx.lineTo(pos, padding + (size - 1) * cellSize);
            ctx.stroke();
        }

        // 绘制星位（天元 + 四个星）
        const starPoints = [
            { row: 7, col: 7 },  // 天元
            { row: 3, col: 3 }, { row: 3, col: 11 },
            { row: 11, col: 3 }, { row: 11, col: 11 }
        ];

        ctx.fillStyle = '#5d3a1a';
        for (const star of starPoints) {
            const x = padding + star.col * cellSize;
            const y = padding + star.row * cellSize;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制数字和字母坐标
        ctx.fillStyle = '#5d3a1a';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < size; i++) {
            const pos = padding + i * cellSize;
            // 上方字母
            ctx.fillText(String.fromCharCode(65 + i), pos, padding - 14);
            // 左侧数字
            ctx.fillText(size - i, padding - 14, pos);
        }

        // 绘制棋子
        this._drawStones(board);
    },

    // 绘制所有棋子
    _drawStones: function(board) {
        const ctx = this.ctx;
        const size = CONFIG.BOARD_SIZE;
        const cellSize = CONFIG.CELL_SIZE;
        const padding = CONFIG.BOARD_PADDING;
        const radius = CONFIG.STONE_RADIUS;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === CONFIG.PLAYER.EMPTY) continue;

                const x = padding + c * cellSize;
                const y = padding + r * cellSize;

                // 绘制棋子阴影
                ctx.beginPath();
                ctx.arc(x + 1.5, y + 1.5, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fill();

                if (board[r][c] === CONFIG.PLAYER.BLACK) {
                    // 黑棋
                    const gradient = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, radius);
                    gradient.addColorStop(0, '#555');
                    gradient.addColorStop(0.5, '#222');
                    gradient.addColorStop(1, '#000');
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else {
                    // 白棋
                    const gradient = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, radius);
                    gradient.addColorStop(0, '#fff');
                    gradient.addColorStop(0.5, '#f0f0f0');
                    gradient.addColorStop(1, '#ddd');
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                    ctx.strokeStyle = '#bbb';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    },

    // 绘制最后一手标记
    drawLastMove: function(row, col) {
        this.lastMoveRow = row;
        this.lastMoveCol = col;

        const ctx = this.ctx;
        const cellSize = CONFIG.CELL_SIZE;
        const padding = CONFIG.BOARD_PADDING;
        const x = padding + col * cellSize;
        const y = padding + row * cellSize;

        // 在最后一手棋子上画红色圆点
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
    },

    // 点击事件
    _onClick: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // 计算最近的交叉点
        const cellSize = CONFIG.CELL_SIZE;
        const padding = CONFIG.BOARD_PADDING;
        const size = CONFIG.BOARD_SIZE;

        let col = Math.round((x - padding) / cellSize);
        let row = Math.round((y - padding) / cellSize);

        // 边界检查
        if (row < 0 || row >= size || col < 0 || col >= size) return;

        // 检查点击是否在交叉点附近（容差）
        const cx = padding + col * cellSize;
        const cy = padding + row * cellSize;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist > cellSize * 0.45) return;

        // 执行落子
        Game.playerMove(row, col);
    }
};

// 音效模块 - 使用 Web Audio API，无需外部音频文件
const Sound = {
    ctx: null,
    
    _getContext: function() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        return this.ctx;
    },
    
    // 落子音效（清脆的点击声）
    playStone: function() {
        try {
            const ctx = this._getContext();
            if (!ctx) return;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
            
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        } catch(e) { /* 静默失败 */ }
    },
    
    // 胜利/获胜音效
    playWin: function() {
        try {
            const ctx = this._getContext();
            if (!ctx) return;
            
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.3);
            });
        } catch(e) { /* 静默失败 */ }
    },
    
    // 失败音效
    playLose: function() {
        try {
            const ctx = this._getContext();
            if (!ctx) return;
            
            const notes = [400, 350, 300, 250];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.2);
                osc.stop(ctx.currentTime + i * 0.2 + 0.3);
            });
        } catch(e) { /* 静默失败 */ }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    Board.init();
    Game.init();

    // 绑定控件事件
    document.getElementById('restartBtn').addEventListener('click', function() {
        Game.init();
    });

    document.getElementById('undoBtn').addEventListener('click', function() {
        Game.undo();
    });

    document.getElementById('mode').addEventListener('change', function() {
        Game.setMode(this.value);
    });

    document.getElementById('difficulty').addEventListener('change', function() {
        Game.setDifficulty(this.value);
    });

    document.getElementById('firstMove').addEventListener('change', function() {
        if (Game.mode === 'pva') Game.init();
    });
});