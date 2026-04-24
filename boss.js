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
        // D-62: 보스가 밟은 타일 집합 — 일반 모드 랜덤 이동 시
        //   미방문 타일을 우선 선택해 전맵을 잘 돌아다니게 한다.
        //   chaseMode에선 사용하지 않음(플레이어 추격이 우선).
        //   스폰 타일부터 방문 처리. 게임 내 지속, 리셋 안 함.
        this.visitedTiles = new Set([this.position]);
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

    // 거리 계산 (BFS) — path 기반. 보스 AI(추격·스폰 위치)에 사용.
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

    // D-55 (2026-04-23 요한 지시): 청각(listen) 전용 '물리적 육각 거리'.
    // 기존 calculateDistance는 connections(길 있는 이웃)만 세기 때문에
    // 물리적으로 바로 옆이어도 사이에 빈 슬롯이 끼면 거리 3+로 잡히고,
    // 또 offset-row 그리드에서 '대각선 위'가 실제 hex 이웃이 아닌 경우
    // 2+로 잡혀 listen이 "멀리서 들린다"고 잘못 보고하던 문제.
    // 소리는 걸어갈 수 있는지와 무관하게 공간적 거리로 전달되므로
    // axial 좌표 변환 후 표준 hex 거리 공식 사용.
    calculateHexDistance(fromId, toId) {
        const a = this._toAxial(fromId);
        const b = this._toAxial(toId);
        if (!a || !b) return Infinity;
        const dq = a.q - b.q;
        const dr = a.r - b.r;
        return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    }

    _toAxial(tileId) {
        const pos = this.tiles[tileId] && this.tiles[tileId].position;
        if (!pos || typeof pos.row !== 'number' || typeof pos.col !== 'number') return null;
        // odd-r offset (홀수 행이 우측으로 반칸 밀림) → axial
        const q = pos.col - ((pos.row - (pos.row & 1)) >> 1);
        return { q, r: pos.row };
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

    // 플레이어 방향으로 이동 (chase mode).
    // D-62: 추격 모드는 플레이어 접근이 최우선이라 visitedTiles 필터를 적용하지 않는다.
    // 이동 이후에는 방문 기록 갱신.
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
            this.visitedTiles.add(this.position);
        }
    }

    // D-62: 일반 모드 랜덤 이동 — 미방문 타일을 선호.
    //   1) 인접 연결 중 visitedTiles에 없는 것 → 거기서 랜덤.
    //   2) 전부 방문했으면 → 인접 전체에서 랜덤 (기존 동작).
    //   이동 후 visitedTiles에 추가. 11x11 맵에서도 전맵 순회 유도(D-62 요한 지시).
    moveRandom() {
        const connections = this.tiles[this.position].connections;
        if (connections.length === 0) return;

        const unvisited = connections.filter(c => !this.visitedTiles.has(c));
        const pool = unvisited.length > 0 ? unvisited : connections;
        const next = pool[Math.floor(Math.random() * pool.length)];
        this.position = next;
        this.visitedTiles.add(this.position);
    }

    // 보스 위치 반환
    getPosition() {
        return this.position;
    }

    // D-62: 외부에서 스폰 위치를 override할 때 visitedTiles도 동기화.
    //   index.html 초기화에서 mapGenerator가 준 bossPos로 덮어쓸 때 사용.
    setPosition(pos) {
        this.position = pos;
        this.visitedTiles.add(pos);
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