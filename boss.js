// boss.js - 보스 몬스터 AI 시스템

class BossMonster {
    constructor(tiles, playerStartTile) {
        this.tiles = tiles;
        this.position = this.findSpawnPosition(playerStartTile);
        this.chaseMode = false;
        this.playerMoveCount = 0;
        this.bossMovePhase = 0; // 0=1칸, 1=2칸
        this.health = 10;
        this.name = '티라노사우루스';
    }

    // 스폰 위치 찾기 (플레이어 시작점에서 가장 먼 3곳 중 랜덤)
    findSpawnPosition(playerStartTile) {
        const distances = this.tiles.map((tile, index) => ({
            index,
            distance: this.calculateDistance(playerStartTile, index)
        }));
        
        distances.sort((a, b) => b.distance - a.distance);
        const topThree = distances.slice(0, 3);
        const chosen = topThree[Math.floor(Math.random() * topThree.length)];
        
        return chosen.index;
    }

    // 거리 계산 (BFS)
    calculateDistance(from, to) {
        const queue = [{ tile: from, dist: 0 }];
        const visited = new Set([from]);
        
        while (queue.length > 0) {
            const { tile, dist } = queue.shift();
            
            if (tile === to) return dist;
            
            for (const conn of this.tiles[tile].connections) {
                if (!visited.has(conn)) {
                    visited.add(conn);
                    queue.push({ tile: conn, dist: dist + 1 });
                }
            }
        }
        
        return Infinity;
    }

    // 플레이어 이동 시 호출
    onPlayerMove(playerTile, detectionRate) {
        this.playerMoveCount++;
        
        // 발각률 80% 이상이면 추격 모드
        if (detectionRate >= 80 && !this.chaseMode) {
            this.chaseMode = true;
            console.log('보스 추격 모드 활성화!');
        }
        
        // 보스 이동 로직
        if (this.chaseMode) {
            // 추격 모드: 1칸, 2칸, 1칸 패턴
            if (this.playerMoveCount % 1 === 0) {
                const moves = this.bossMovePhase === 0 ? 1 : 2;
                for (let i = 0; i < moves; i++) {
                    this.moveTowards(playerTile);
                }
                this.bossMovePhase = (this.bossMovePhase + 1) % 3;
                if (this.bossMovePhase === 2) this.bossMovePhase = 0; // 1,2,1 패턴
            }
        } else {
            // 일반 모드: 2칸마다 1칸 랜덤 이동
            if (this.playerMoveCount % 2 === 0) {
                this.moveRandom();
            }
        }
        
        return this.position === playerTile; // 플레이어와 조우 여부
    }

    // 플레이어 방향으로 이동
    moveTowards(playerTile) {
        const connections = this.tiles[this.position].connections;
        if (connections.length === 0) return;
        
        let bestMove = this.position;
        let shortestDist = this.calculateDistance(this.position, playerTile);
        
        for (const conn of connections) {
            const dist = this.calculateDistance(conn, playerTile);
            if (dist < shortestDist) {
                shortestDist = dist;
                bestMove = conn;
            }
        }
        
        if (bestMove !== this.position) {
            this.position = bestMove;
        }
    }

    // 랜덤 이동
    moveRandom() {
        const connections = this.tiles[this.position].connections;
        if (connections.length === 0) return;
        
        const randomConn = connections[Math.floor(Math.random() * connections.length)];
        this.position = randomConn;
    }

    // 보스 위치 반환
    getPosition() {
        return this.position;
    }

    // 추격 모드 여부
    isChasing() {
        return this.chaseMode;
    }

    // 데미지 입히기
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }

    // 보스 정보 반환
    getInfo() {
        return {
            name: this.name,
            health: this.health,
            position: this.position,
            chaseMode: this.chaseMode
        };
    }
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BossMonster;
}