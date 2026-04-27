// boss.js - 보스 몬스터 AI 시스템

class BossMonster {
    constructor(tiles, playerStartTile) {
        this.tiles = tiles;
        this.position = this.findSpawnPosition(playerStartTile);
        this.chaseMode = false;
        this.health = 10;
        this.name = '티라노사우루스';
        // D-77 (2026-04-24): 포식 상태.
        //   predationTarget — 현재 쫓는 prey id (null=포식 모드 아님).
        //   predationStay   — 포식 중 남은 정지 턴 수 (0이면 포식 아님 / 종료).
        //   onPredationComplete — 포식 완료 시 호출될 콜백. 사체 타일 생성 세터 주입.
        // D-139 (2026-04-27): L2 한정 → L1 포함 모든 prey가 포식 후보. "사냥감 타일에 보스 도착
        //   = 무조건 포식"이 사용자 멘탈 모델 — L1 토끼 타일에서도 포식 시작되어 플레이어 안전.
        // D-90 (2026-04-25): predationPreyType — 포식 진행 중 prey 종(preyType) 보존.
        //   onPredationComplete 호출 시 콜백에 전달 → 사체 메시지에 사냥감 이름 사용.
        this.predationTarget = null;
        this.predationStay = 0;
        this.predationPreyType = null;
        this.onPredationComplete = null;
        // D-62: 보스가 밟은 타일 집합 — 일반 모드 랜덤 이동 시
        //   미방문 타일을 우선 선택해 전맵을 잘 돌아다니게 한다.
        //   chaseMode에선 사용하지 않음(플레이어 추격이 우선).
        //   스폰 타일부터 방문 처리. 게임 내 지속, 리셋 안 함.
        this.visitedTiles = new Set([this.position]);
        // D-70 (2026-04-24 요한 지시): 보스 순찰 waypoint.
        //   중앙 ↔ 먼 코너 교대로 왕복. 게임 중 1~2번은 플레이어 경로와 교차해
        //   '위기 순간'을 유발. 생성 위치와 무관하게 항상 중앙을 가로지른다.
        this.patrolWaypoints = this._buildPatrolWaypoints(playerStartTile);
        this.patrolIndex = 0;
    }

    // D-70: 순찰 waypoint 목록 계산.
    //   [중앙, 스폰에서 먼 코너A, 중앙, 먼 코너B, ...] 형태로 중앙을 자주 지나가게.
    //   코너 후보는 맵 꼭짓점들 중 non-empty를 거리순 정렬해 상위 3개.
    _buildPatrolWaypoints(playerStartTile) {
        const tiles = this.tiles;
        if (!tiles || tiles.length === 0) return [this.position];
        const n = Math.round(Math.sqrt(tiles.length));
        const centerRow = Math.floor(n / 2);
        const centerCol = Math.floor(n / 2);

        // 중앙 후보: non-empty 타일 중 (centerRow, centerCol)에 가장 가까운 곳.
        let centerTile = -1;
        let bestCenterDist = Infinity;
        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i].isEmpty) continue;
            const p = tiles[i].position;
            if (!p) continue;
            const d = Math.abs(p.row - centerRow) + Math.abs(p.col - centerCol);
            if (d < bestCenterDist) { bestCenterDist = d; centerTile = i; }
        }
        if (centerTile < 0) centerTile = this.position;

        // 코너 후보: 스폰 위치에서 먼 non-empty 타일 상위 3개.
        const candidates = [];
        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i].isEmpty || i === this.position) continue;
            const d = this.calculateDistance(this.position, i);
            if (Number.isFinite(d)) candidates.push({ i, d });
        }
        candidates.sort((a, b) => b.d - a.d);
        const farCorners = candidates.slice(0, 3).map(c => c.i);

        const waypoints = [];
        // 중앙을 매번 거치도록: [중앙, 코너, 중앙, 코너, ...] 편성.
        if (farCorners.length === 0) return [centerTile];
        for (const corner of farCorners) {
            waypoints.push(centerTile);
            waypoints.push(corner);
        }
        return waypoints.length > 0 ? waypoints : [centerTile];
    }

    // 스폰 위치 찾기 (플레이어 시작점에서 가장 먼 3곳 중 랜덤).
    //   D-70: isEmpty/Infinity 타일을 후보에서 제외. 이전 구현은 필터가 없어
    //   공백 타일(connections=0, distance=Infinity)이 상위로 들어가 보스가
    //   고립 위치에 스폰되는 케이스가 있었다(waypoints 계산도 망가짐).
    findSpawnPosition(playerStartTile) {
        const distances = this.tiles
            .map((tile, index) => ({
                index,
                distance: this.calculateDistance(playerStartTile, index)
            }))
            .filter(d =>
                Number.isFinite(d.distance) &&
                !this.tiles[d.index].isEmpty &&
                d.index !== playerStartTile
            );

        distances.sort((a, b) => b.distance - a.distance);
        const topThree = distances.slice(0, 3);
        if (topThree.length === 0) return playerStartTile; // 안전망
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

    // 플레이어 이동 시 호출.
    //   D-77: preys 배열을 받아 포식 이동 우선권 판단.
    //     - predationStay > 0: 이번 턴 이동 스킵, 감소. 0이면 포식 완료 콜백 실행.
    //     - 포식 중이 아니면 L2 prey 중 타일거리 2 이내가 있는지 확인, 있으면
    //       BFS 첫 홉으로 전진. 타일 일치 시 포식 시작(predationStay=2, prey 제거).
    //     - 포식 로직이 적용되지 않으면 기존 추격/일반 이동 경로 수행.
    onPlayerMove(playerTile, detectionRate, preys) {
        // 발각률 80% 이상이면 추격 모드
        if (detectionRate >= 80 && !this.chaseMode) {
            this.chaseMode = true;
            console.log('보스 추격 모드 활성화!');
        }

        // D-77: 포식 중이면 이번 턴은 정지. 0이 되면 포식 완료.
        if (this.predationStay > 0) {
            this.predationStay -= 1;
            if (this.predationStay === 0) {
                // 포식 완료 — 사체 타일 콜백. 이동 없음.
                const completedAt = this.position;
                const targetId = this.predationTarget;
                const preyType = this.predationPreyType;
                this.predationTarget = null;
                this.predationPreyType = null;
                if (typeof this.onPredationComplete === 'function') {
                    try { this.onPredationComplete(completedAt, targetId, preyType); }
                    catch (e) { console.warn('[boss] onPredationComplete error:', e); }
                }
            }
            return this.position === playerTile;
        }

        // D-77 / D-139: 포식 타겟 탐색/추적 — 모든 prey(L1·L2)가 거리 2 이내면 포식 경로 우선.
        //   1) 타겟이 없으면 탐색 (prey 중 거리 ≤ 2).
        //   2) 타겟이 있으면 해당 prey를 preys 배열에서 찾아 BFS 첫 홉으로 전진.
        //      타겟이 이미 사라졌으면(이미 잡힌 경우 등) 타겟 해제하고 일반 경로.
        //   3) 타겟 타일 도달 시 포식 시작(predationStay=3, onPredationStart 콜백).
        if (Array.isArray(preys)) {
            let target = null;
            if (this.predationTarget) {
                target = preys.find(p => p && p.id === this.predationTarget);
                if (!target) {
                    // 타겟이 사라짐(다른 경로로 소멸) — 포식 해제.
                    this.predationTarget = null;
                }
            }
            if (!target && !this.predationTarget) {
                // D-139: 타겟 탐색은 L1·L2 가리지 않음. 거리 2 이내 모든 prey 후보.
                const nearby = preys.filter(p => {
                    if (!p || typeof p.tileId !== 'number') return false;
                    const d = this.calculateDistance(this.position, p.tileId);
                    return Number.isFinite(d) && d <= 2;
                });
                if (nearby.length > 0) {
                    nearby.sort((a, b) =>
                        this.calculateDistance(this.position, a.tileId)
                        - this.calculateDistance(this.position, b.tileId));
                    target = nearby[0];
                    this.predationTarget = target.id;
                }
            }

            if (target) {
                if (this.position !== target.tileId) {
                    const hop = this._bfsFirstHopToAny(new Set([target.tileId]));
                    if (hop !== null) {
                        this.position = hop;
                        this.visitedTiles.add(this.position);
                    }
                }
                if (this.position === target.tileId) {
                    // D-90 (2026-04-25 요한 지시): 포식 시간 2→3턴 (체감 강화 + 인접 listen 시
                    // "포식중인 짐승" 모달을 만날 창을 1턴 추가).
                    this.predationStay = 3;
                    this.predationPreyType = target.preyType;
                    if (typeof this.onPredationStart === 'function') {
                        try { this.onPredationStart(target.id, this.position, target); }
                        catch (e) { console.warn('[boss] onPredationStart error:', e); }
                    }
                }
                return this.position === playerTile;
            }
        }

        // D-86 (2026-04-24 요한 지시): 플레이어 1이동 = 보스 1이동. 모드 무관.
        //   이전: 일반 모드 2턴에 1번(0.5칸/턴), 추격 모드 1·2·1·2 교대(평균 1.33칸/턴).
        //   변경: 일반 = 순찰 1홉, 추격 = 플레이어 방향 1홉. 둘 다 매 턴 고정 1칸.
        //   포식 경로(상단 블록)도 이미 BFS 첫 홉 한 칸 구조라 동일 템포를 공유.
        if (this.chaseMode) {
            this.moveTowards(playerTile);
        } else {
            this.moveRandom();
        }

        return this.position === playerTile;
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

    // D-70 (2026-04-24): 순찰 waypoint 기반 이동 — 맵 중앙을 가로지르는 동선.
    //   patrolWaypoints 순서대로 타겟 지정, BFS 최단 경로 첫 홉으로 한 칸 전진.
    //   도달하면 다음 waypoint로. 순회 끝나면 처음으로 loop.
    //   D-62/D-69의 visitedTiles 로직은 UI 결과 화면용으로만 유지(bossMoveHistory).
    moveRandom() {
        const connections = this.tiles[this.position].connections;
        if (connections.length === 0) return;

        // waypoint가 비어 있으면(엣지 케이스) 인접 랜덤 안전망.
        if (!this.patrolWaypoints || this.patrolWaypoints.length === 0) {
            const next = connections[Math.floor(Math.random() * connections.length)];
            this.position = next;
            this.visitedTiles.add(this.position);
            return;
        }

        // 현재 waypoint 도달 → 다음으로 전환. 연속 중복 skip.
        let target = this.patrolWaypoints[this.patrolIndex];
        let guard = 0;
        while (this.position === target && guard < this.patrolWaypoints.length) {
            this.patrolIndex = (this.patrolIndex + 1) % this.patrolWaypoints.length;
            target = this.patrolWaypoints[this.patrolIndex];
            guard++;
        }

        const targetSet = new Set([target]);
        const firstHop = this._bfsFirstHopToAny(targetSet);
        if (firstHop !== null) {
            this.position = firstHop;
            this.visitedTiles.add(this.position);
        } else {
            // 경로 없음(고립 후속 안전망) → 인접 랜덤.
            const next = connections[Math.floor(Math.random() * connections.length)];
            this.position = next;
            this.visitedTiles.add(this.position);
        }
    }

    // D-69: 현재 위치에서 BFS로 타겟 집합 중 가장 가까운 타일을 찾고,
    //   그 경로의 '첫 홉'(현재 위치에서 1칸 떨어진 이웃)을 반환.
    //   경로 없으면 null.
    _bfsFirstHopToAny(targetSet) {
        if (!targetSet || targetSet.size === 0) return null;
        const prev = new Map();
        const visited = new Set([this.position]);
        const queue = [this.position];
        let reached = null;
        while (queue.length > 0) {
            const cur = queue.shift();
            if (targetSet.has(cur) && cur !== this.position) {
                reached = cur;
                break;
            }
            for (const n of this.tiles[cur].connections) {
                if (!visited.has(n)) {
                    visited.add(n);
                    prev.set(n, cur);
                    queue.push(n);
                }
            }
        }
        if (reached === null) return null;
        let step = reached;
        while (prev.has(step) && prev.get(step) !== this.position) {
            step = prev.get(step);
        }
        return step;
    }

    // 보스 위치 반환
    getPosition() {
        return this.position;
    }

    // D-62: 외부에서 스폰 위치를 override할 때 visitedTiles도 동기화.
    //   index.html 초기화에서 mapGenerator가 준 bossPos로 덮어쓸 때 사용.
    //   D-70: 새 position 기준으로 patrolWaypoints 재빌드 — 이전 constructor 기준
    //   waypoints가 override된 현 위치와 무관해지는 문제 해결.
    setPosition(pos) {
        this.position = pos;
        this.visitedTiles.add(pos);
        this.patrolWaypoints = this._buildPatrolWaypoints(pos);
        this.patrolIndex = 0;
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