// gameComponents.jsx - React UI 컴포넌트들

// 상단 스탯 패널 컴포넌트
function StatPanel({ health, hunger, time, maxTime, boss, detection, message }) {
    const detectionColor = detection < 30 ? '#4CAF50' : 
                          detection < 60 ? '#FFC107' : '#e94560';
    
    return (
        <div>
            <div style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600' }}>
                🦖 타임투다이노
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                <div className="stat-box">
                    <div className="stat-label">생명력</div>
                    <div className="stat-value">❤️ {health}/6</div>
                </div>
                <div className="stat-box">
                    <div className="stat-label">배고픔</div>
                    <div className="stat-value">🍖 {hunger}/12</div>
                </div>
                <div className="stat-box">
                    <div className="stat-label">시간</div>
                    <div className="stat-value">⏰ {time}/{maxTime}</div>
                </div>
                <div className="stat-box">
                    <div className="stat-label">보스</div>
                    <div className="stat-value" style={{ fontSize: '13px' }}>
                        {boss?.chaseMode ? '🔴 추격' : '🟢 순찰'}
                    </div>
                </div>
            </div>
            
            <div className="stat-box" style={{ marginBottom: '8px' }}>
                <div className="stat-label">🚨 발각률</div>
                <div style={{ background: '#0f3460', height: '20px', borderRadius: '10px', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ 
                        width: `${detection}%`, 
                        height: '100%', 
                        background: detectionColor, 
                        transition: 'all 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#fff'
                    }}>
                        {detection > 10 ? `${detection}%` : ''}
                    </div>
                </div>
            </div>

            <div className="stat-box" style={{ fontSize: '13px', marginBottom: '8px' }}>
                {message}
            </div>
        </div>
    );
}

// 손패 카드 컴포넌트
function HandCards({ hand, gameOver, victory, useCard }) {
    if (gameOver || victory || hand.length === 0) return null;
    
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {hand.map(card => (
                <div key={card.uid} className="card" onClick={() => useCard(card)}>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '3px' }}>
                        {card.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#aaa' }}>
                        {card.effect}
                    </div>
                    <div style={{ fontSize: '10px', color: card.detection > 0 ? '#e94560' : '#4CAF50' }}>
                        발각 {card.detection > 0 ? '+' : ''}{card.detection}% · ⏰{card.time}h
                    </div>
                </div>
            ))}
        </div>
    );
}

// 육각형 타일 컴포넌트
function HexTile({ tile, currentTile, tiles, boss, gameOver, victory, moveTo }) {
    const { x, y } = tile.position;
    const isCurrent = tile.id === currentTile;
    const canMove = tiles[currentTile].connections.includes(tile.id);
    const isBoss = boss && tile.id === boss.position && tile.revealed;
    const isRevealed = tile.revealed || tile.visited;
    
    const getTileColor = (tile) => {
        if (!tile.visited && !tile.revealed) return '#1a1f3a';
        if (tile.type === 'start') return '#4CAF50';
        if (tile.type === 'exit' && tile.revealed) return '#2196F3';
        if (tile.type === 'good' && tile.revealed) return '#FFC107';
        if (tile.type === 'trap' && tile.revealed) return '#e94560';
        if (boss && tile.id === boss.position && tile.revealed) return '#8B0000';
        return '#2d3561';
    };
    
    const getTileLabel = () => {
        if (!isRevealed && !isCurrent) return '?';
        if (isCurrent) return '내위치';
        if (tile.type === 'exit') return '탈출구';
        if (isBoss) return '🦖';
        if (tile.type === 'good') return '👍';
        if (tile.type === 'trap') return '⚠️';
        return '';
    };
    
    return (
        <g key={tile.id}>
            <polygon
                className={`hex-tile ${isCurrent ? 'current' : ''}`}
                points={`${x},${y-50} ${x+43},${y-25} ${x+43},${y+25} ${x},${y+50} ${x-43},${y+25} ${x-43},${y-25}`}
                fill={isCurrent ? '#f5f5f5' : getTileColor(tile)}
                stroke={isCurrent ? 'none' : canMove ? '#4CAF50' : '#0f3460'}
                strokeWidth={canMove ? '3' : '2'}
                opacity={isRevealed || isCurrent ? 1 : 0.6}
                onClick={() => !gameOver && !victory && canMove && moveTo(tile.id)}
            />
            <text 
                x={x} 
                y={y + 5} 
                textAnchor="middle" 
                fill={isCurrent ? '#1a1a2e' : isRevealed ? '#fff' : '#666'} 
                fontSize={isRevealed || isCurrent ? '14' : '24'} 
                fontWeight={isRevealed || isCurrent ? '700' : 'bold'}
            >
                {getTileLabel()}
            </text>
        </g>
    );
}

// 게임 맵 컴포넌트
function GameMap({ tiles, currentTile, boss, gameOver, victory, moveTo }) {
    const visibleTiles = tiles.filter(t => t.visited || t.discovered || t.revealed);
    
    return (
        <div className="map-container">
            <svg className="map-svg" width="1100" height="1000">
                {visibleTiles.map(tile => (
                    <HexTile
                        key={tile.id}
                        tile={tile}
                        currentTile={currentTile}
                        tiles={tiles}
                        boss={boss}
                        gameOver={gameOver}
                        victory={victory}
                        moveTo={moveTo}
                    />
                ))}
            </svg>
        </div>
    );
}

// 인벤토리 모달 컴포넌트
function InventoryModal({ inventory, selectedItem, setSelectedItem, closeInventory }) {
    return (
        <div className="modal">
            <div className="modal-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h3>가방 (5x6)</h3>
                    <button onClick={closeInventory}>닫기</button>
                </div>
                <div style={{ position: 'relative' }}>
                    <div className="inventory-grid">
                        {Array(6).fill(null).map((_, row) => 
                            Array(5).fill(null).map((_, col) => (
                                <div 
                                    key={`${row}-${col}`} 
                                    className={`inventory-cell ${inventory.grid[row][col] ? 'occupied' : ''}`}
                                />
                            ))
                        )}
                    </div>
                    {inventory.items.map(item => (
                        <div
                            key={item.id}
                            className={`inventory-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                            style={{
                                left: `${item.x * 47 + 4}px`,
                                top: `${item.y * 47 + 4}px`,
                                width: `${item.shape[0].length * 47 - 4}px`,
                                height: `${item.shape.length * 47 - 4}px`
                            }}
                            onClick={() => setSelectedItem(item)}
                        >
                            {item.name}
                        </div>
                    ))}
                </div>
                {selectedItem && (
                    <div style={{ marginTop: '10px' }}>
                        <button onClick={() => {
                            inventory.rotateItem(selectedItem);
                        }}>회전</button>
                        <button onClick={() => setSelectedItem(null)} style={{ marginLeft: '8px' }}>
                            확정
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// 게임 오버/승리 모달
function GameEndModal({ gameOver, victory }) {
    if (!gameOver && !victory) return null;
    
    return (
        <div className="modal">
            <div style={{ 
                background: victory ? '#4CAF50' : '#e94560', 
                color: 'white',
                padding: '40px', 
                borderRadius: '12px', 
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '28px', fontWeight: '600', marginBottom: '20px' }}>
                    {victory ? '🎉 승리!' : '💀 게임 오버'}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    style={{ 
                        background: 'white',
                        color: '#333',
                        border: 'none',
                        padding: '15px 30px',
                        fontSize: '16px',
                        fontWeight: '600'
                    }}
                >
                    다시 시작
                </button>
            </div>
        </div>
    );
}