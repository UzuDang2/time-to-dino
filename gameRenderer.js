// gameRenderer.js - UI 렌더링 로직

class GameRenderer {
    // 타일 색상 결정
    static getTileColor(tile, boss) {
        if (!tile.visited && !tile.revealed) return '#1a1f3a';
        if (tile.type === 'start') return '#4CAF50';
        if (tile.type === 'exit' && tile.revealed) return '#2196F3';
        if (tile.type === 'good' && tile.revealed) return '#FFC107';
        if (tile.type === 'trap' && tile.revealed) return '#e94560';
        if (boss && tile.id === boss.position && tile.revealed) return '#8B0000';
        return '#2d3561';
    }

    // 발각률 색상
    static getDetectionColor(detection) {
        if (detection < 30) return '#4CAF50';
        if (detection < 60) return '#FFC107';
        return '#e94560';
    }

    // 상단 UI 패널 렌더링
    static renderTopPanel(props) {
        const { 
            health, hunger, time, maxTime, boss, detection, message,
            hand, deck, graveyard, gameOver, victory,
            showInventory, setShowInventory, useCard 
        } = props;

        const detectionColor = this.getDetectionColor(detection);

        return `
            <div class="ui-panel">
                <div style="margin-bottom: 8px; font-size: 18px; font-weight: 600;">🦖 타임투다이노</div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;">
                    <div class="stat-box">
                        <div class="stat-label">생명력</div>
                        <div class="stat-value">❤️ ${health}/6</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">배고픔</div>
                        <div class="stat-value">🍖 ${hunger}/12</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">시간</div>
                        <div class="stat-value">⏰ ${time}/${maxTime}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">보스</div>
                        <div class="stat-value" style="font-size: 13px;">
                            ${boss?.chaseMode ? '🔴 추격' : '🟢 순찰'}
                        </div>
                    </div>
                </div>
                
                <!-- 발각률 바 -->
                <!-- 메시지 박스 -->
                <!-- 손패 카드 -->
            </div>
        `;
    }

    // 육각형 타일 SVG 렌더링
    static renderHexTile(tile, gameState) {
        const { x, y } = tile.position;
        const { currentTile, tiles, boss, gameOver, victory, moveTo } = gameState;
        
        const isCurrent = tile.id === currentTile;
        const canMove = tiles[currentTile].connections.includes(tile.id);
        const isBoss = boss && tile.id === boss.position && tile.revealed;
        const isRevealed = tile.revealed || tile.visited;
        
        const fillColor = isCurrent ? '#f5f5f5' : this.getTileColor(tile, boss);
        const strokeColor = isCurrent ? 'none' : (canMove ? '#4CAF50' : '#0f3460');
        const strokeWidth = canMove ? '3' : '2';
        
        return {
            points: `${x},${y-50} ${x+43},${y-25} ${x+43},${y+25} ${x},${y+50} ${x-43},${y+25} ${x-43},${y-25}`,
            fillColor,
            strokeColor,
            strokeWidth,
            opacity: (isRevealed || isCurrent) ? 1 : 0.6,
            label: this.getTileLabel(tile, isCurrent, isBoss, isRevealed),
            textColor: isCurrent ? '#1a1a2e' : '#fff'
        };
    }

    // 타일 라벨 텍스트
    static getTileLabel(tile, isCurrent, isBoss, isRevealed) {
        if (!isRevealed && !isCurrent) return '?';
        if (isCurrent) return '내위치';
        if (tile.type === 'exit') return '탈출구';
        if (isBoss) return '🦖';
        if (tile.type === 'good') return '👍';
        if (tile.type === 'trap') return '⚠️';
        return '';
    }

    // 인벤토리 모달 렌더링
    static renderInventoryModal(inventory, selectedItem, setSelectedItem, closeInventory) {
        // 인벤토리 UI 렌더링 로직
        return `
            <div class="modal">
                <div class="modal-content">
                    <!-- 인벤토리 그리드 -->
                </div>
            </div>
        `;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameRenderer;
}