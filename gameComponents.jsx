function Game() {
    // ... 기존 상태들 ...
    const [eventTile, setEventTile] = useState(null); // 추가!

    // ... 기존 코드 ...

    // moveTo 함수 수정
    const moveTo = (targetId) => {
        if (!tiles[currentTile].connections.includes(targetId)) {
            setMessage('그곳으로는 갈 수 없습니다!');
            return;
        }
        
        const newMoveCount = playerMoveCount + 1;
        setPlayerMoveCount(newMoveCount);
        setHunger(hunger - 1);
        setTime(0);
        
        const mapGen = new MapGenerator(7);
        const positions = mapGen.generateHexPositions();
        const targetNeighbors = mapGen.getHexNeighbors(targetId, positions);
        
        const newTiles = tiles.map(t => {
            if (t.id === targetId) {
                return { ...t, visited: true, discovered: true, revealed: true };
            }
            if (targetNeighbors.includes(t.id)) {
                return { ...t, discovered: true };
            }
            return t;
        });
        
        setTiles(newTiles);
        setCurrentTile(targetId);
        
        // ... 손패 보충 로직 ...
        
        // ... 보스 이동 로직 ...
        
        const encounter = newBossPos === targetId;
        const tile = newTiles[targetId];
        let msg = '';
        
        if (encounter) {
            setGameOver(true);
            msg = '보스 몬스터와 조우했다! 게임 오버...';
        } else if (tile.type === 'normal') {
            msg = '평범한 숲길이다.';
        } else if (tile.type === 'good') {
            msg = '좋은 곳을 발견했다!';
            // 🎯 이벤트 모달 표시
            setEventTile({ ...tile });
        } else if (tile.type === 'trap') {
            const damage = Math.floor(Math.random() * 2) + 1;
            setHealth(health - damage);
            msg = `함정! 생명력 -${damage}`;
            // 🎯 이벤트 모달 표시 (데미지 정보 포함)
            setEventTile({ ...tile, damage });
        } else if (tile.type === 'exit') {
            msg = '탈출구다!';
        }
        
        if (boss.chaseMode && !encounter) {
            msg += ` [⚠️ 보스 추격중!]`;
        }
        
        setMessage(msg);
    };

    // ... render 부분에서 모달 추가 ...
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* ... 기존 UI ... */}

            {/* 🎯 타일 이벤트 모달 추가 */}
            {eventTile && (
                <TileEventModal 
                    tile={eventTile} 
                    onClose={() => setEventTile(null)} 
                />
            )}

            {showInventory && inventory && (
                <InventoryModal
                    inventory={inventory}
                    selectedItem={selectedInventoryItem}
                    setSelectedItem={setSelectedInventoryItem}
                    closeInventory={() => setShowInventory(false)}
                />
            )}

            <GameEndModal gameOver={gameOver} victory={victory} />
        </div>
    );
}