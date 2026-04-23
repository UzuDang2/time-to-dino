// mapGenerator.js - 인접 타일 자동 연결 방식

// 타일 지형(region) — 뒤져보기 드롭 테이블과 연동되는 키
// 값은 Notion "🎲 타일 드롭 테이블" DB의 지역 title과 일치시킨다.
const REGIONS = ['숲', '덤불', '평원', '시냇물', '동굴'];

// 지역별 생성 가중치 (합이 1일 필요는 없음, 상대 비율)
// 숲/덤불은 다니기 쉬운 기본 지형, 시냇물/동굴은 상대적으로 희소하게.
const REGION_WEIGHTS = {
    '숲': 28,
    '덤불': 24,
    '평원': 24,
    '시냇물': 12,
    '동굴': 12
};

function pickWeightedRegion() {
    const total = Object.values(REGION_WEIGHTS).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const region of REGIONS) {
        r -= REGION_WEIGHTS[region];
        if (r <= 0) return region;
    }
    return REGIONS[0];
}

class MapGenerator {
    constructor(gridSize = 7) {
        this.gridSize = gridSize;
    }

    // 육각형 그리드 좌표 생성 (간격 축소)
    generateHexPositions() {
        const positions = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = col * 110 + (row % 2) * 55 + 100;
                const y = row * 95 + 100;
                positions.push({ x, y, row, col });
            }
        }
        return positions;
    }

    // 육각형 인접 타일 계산
    getHexNeighbors(index, positions) {
        const { row, col } = positions[index];
        const neighbors = [];
        
        if (row % 2 === 0) {
            // 짝수 행
            if (row > 0) {
                neighbors.push((row - 1) * this.gridSize + col); // 위
                if (col > 0) neighbors.push((row - 1) * this.gridSize + col - 1); // 좌상
            }
            if (col > 0) neighbors.push(row * this.gridSize + col - 1); // 좌
            if (col < this.gridSize - 1) neighbors.push(row * this.gridSize + col + 1); // 우
            if (row < this.gridSize - 1) {
                neighbors.push((row + 1) * this.gridSize + col); // 아래
                if (col > 0) neighbors.push((row + 1) * this.gridSize + col - 1); // 좌하
            }
        } else {
            // 홀수 행
            if (row > 0) {
                neighbors.push((row - 1) * this.gridSize + col); // 위
                if (col < this.gridSize - 1) neighbors.push((row - 1) * this.gridSize + col + 1); // 우상
            }
            if (col > 0) neighbors.push(row * this.gridSize + col - 1); // 좌
            if (col < this.gridSize - 1) neighbors.push(row * this.gridSize + col + 1); // 우
            if (row < this.gridSize - 1) {
                neighbors.push((row + 1) * this.gridSize + col); // 아래
                if (col < this.gridSize - 1) neighbors.push((row + 1) * this.gridSize + col + 1); // 우하
            }
        }
        
        return neighbors.filter(n => n >= 0 && n < this.gridSize * this.gridSize);
    }

    // 맵 생성: 물리적으로 인접하면 무조건 연결
    generateConnectedMap(emptySlots) {
        const totalTiles = this.gridSize * this.gridSize;
        const positions = this.generateHexPositions();
        const tiles = [];
        
        // 초기화: 모든 타일 생성
        for (let i = 0; i < totalTiles; i++) {
            const isEmpty = emptySlots.has(i);
            tiles.push({
                id: i,
                type: 'normal',
                region: isEmpty ? null : pickWeightedRegion(),
                connections: [],
                visited: false,
                discovered: false,
                revealed: false,
                position: positions[i],
                isEmpty,
                // D-35: 반복 뒤져보기 페널티를 위한 상태.
                //   searchedCount — 이 타일에서 뒤져보기를 시전한 누적 횟수
                //   hasBeenLeft   — 플레이어가 이 타일을 한 번이라도 떠난 적 있는가
                //                   (돌아와도 true 유지 — "이미 쓸고 간" 뉘앙스)
                searchedCount: 0,
                hasBeenLeft: false
            });
        }
        
        // 물리적으로 인접한 모든 타일을 자동 연결
        for (let i = 0; i < totalTiles; i++) {
            if (emptySlots.has(i)) continue; // 빈 슬롯은 스킵
            
            const neighbors = this.getHexNeighbors(i, positions);
            
            for (const neighborId of neighbors) {
                if (emptySlots.has(neighborId)) continue; // 빈 슬롯 제외
                
                // 양방향 연결 (중복 방지)
                if (!tiles[i].connections.includes(neighborId)) {
                    tiles[i].connections.push(neighborId);
                }
                if (!tiles[neighborId].connections.includes(i)) {
                    tiles[neighborId].connections.push(i);
                }
            }
        }
        
        return tiles;
    }

    // BFS로 거리 계산
    calculateDistance(tiles, from, to) {
        const queue = [{ tile: from, dist: 0 }];
        const visited = new Set([from]);
        
        while (queue.length > 0) {
            const { tile, dist } = queue.shift();
            if (tile === to) return dist;
            
            for (const conn of tiles[tile].connections) {
                if (!visited.has(conn)) {
                    visited.add(conn);
                    queue.push({ tile: conn, dist: dist + 1 });
                }
            }
        }
        return Infinity;
    }

    // 완전한 맵 생성
    generate() {
        const cornerCandidates = [0, 6, 42, 48, 3, 45];
        const playerStart = cornerCandidates[Math.floor(Math.random() * cornerCandidates.length)];
        
        // 플레이어 시작점에서 가장 먼 모서리를 탈출구로
        let maxDist = 0;
        let exitPos = 0;
        const positions = this.generateHexPositions();
        
        for (const candidate of cornerCandidates) {
            if (candidate !== playerStart) {
                const dist = Math.abs(positions[candidate].row - positions[playerStart].row) + 
                             Math.abs(positions[candidate].col - positions[playerStart].col);
                if (dist > maxDist) {
                    maxDist = dist;
                    exitPos = candidate;
                }
            }
        }
        
        // 빈 슬롯 랜덤 생성 (10~15개)
        const emptySlotCount = Math.floor(Math.random() * 6) + 10;
        const emptySlots = new Set();
        const totalTiles = this.gridSize * this.gridSize;
        
        while (emptySlots.size < emptySlotCount) {
            const randomTile = Math.floor(Math.random() * totalTiles);
            // 시작점, 탈출구, 모서리는 빈 슬롯 제외
            if (randomTile !== playerStart && 
                randomTile !== exitPos && 
                !cornerCandidates.includes(randomTile)) {
                emptySlots.add(randomTile);
            }
        }
        
        // 연결된 맵 생성
        const tiles = this.generateConnectedMap(emptySlots);
        
        // 타입 설정
        tiles[playerStart].type = 'start';
        tiles[playerStart].visited = true;
        tiles[playerStart].discovered = true;
        
        tiles[exitPos].type = 'exit';
        
        // 보스 위치 (플레이어에서 5칸 이상 떨어진 곳)
        const distances = tiles
            .map((tile, index) => ({
                index,
                distance: this.calculateDistance(tiles, playerStart, index)
            }))
            .filter(d => d.distance >= 5 && 
                        d.index !== exitPos && 
                        d.index !== playerStart && 
                        !tiles[d.index].isEmpty);
        
        distances.sort((a, b) => b.distance - a.distance);
        const bossPos = distances.length > 0 
            ? distances[Math.floor(Math.random() * Math.min(3, distances.length))].index 
            : exitPos - 1;
        
        // 특수 타일 (빈 슬롯 제외)
        const availableIndices = tiles
            .map((t, i) => i)
            .filter(i => tiles[i].type === 'normal' && i !== bossPos && !tiles[i].isEmpty);
        
        const specialTiles = { good: 4, trap: 2 };
        for (const [type, count] of Object.entries(specialTiles)) {
            for (let i = 0; i < count && availableIndices.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * availableIndices.length);
                const tileIndex = availableIndices.splice(randomIndex, 1)[0];
                tiles[tileIndex].type = type;
            }
        }
        
        return { tiles, playerStart, bossPos, exitPos };
    }
}

// D-46 사냥감 스폰 (2026-04-23, 9차 세션):
//   level 1 사냥감 9종 중 무작위로 `count`마리 스폰. habitat region과 일치하는 타일에만 배치.
//   reserved 타일(플레이어 시작/보스/탈출구)과 이미 다른 prey 있는 타일은 제외.
//   habitat 필드는 prey.habitat → window.TTD_PREY_HABITAT → habitatFallback 순서로 fallback.
//
// 인자:
//   tiles          — 생성된 타일 배열
//   preyData       — window.TTD_DATA.PREY (배열)
//   count          — 스폰 마릿수 (기본 5)
//   reserved       — { playerStartId, bossPosId, exitPosId } (다른 prey 이미 있는 타일은 내부에서 추적)
//   habitatFallback— 외부에서 주입하는 habitat 매핑 (index.html의 PREY_HABITAT 상수)
//
// 반환: [{ id: 'prey_0', tileId, preyType: 'rabbit' }, ...]
function spawnPrey(tiles, preyData, count = 5, reserved = {}, habitatFallback = {}) {
    if (!Array.isArray(preyData) || preyData.length === 0) return [];
    const level1 = preyData.filter(p => p && p.level === 1);
    if (level1.length === 0) return [];

    const reservedSet = new Set(
        [reserved.playerStartId, reserved.bossPosId, reserved.exitPosId].filter(v => v !== undefined && v !== null)
    );
    const occupied = new Set();
    const spawned = [];

    const MAX_SPECIES_ATTEMPTS = 10;
    for (let i = 0; i < count; i++) {
        let placed = false;
        const triedTypes = new Set();
        for (let attempt = 0; attempt < MAX_SPECIES_ATTEMPTS && !placed; attempt++) {
            const pool = level1.filter(p => !triedTypes.has(p.id));
            if (pool.length === 0) break;
            const prey = pool[Math.floor(Math.random() * pool.length)];
            triedTypes.add(prey.id);

            const habitat = (Array.isArray(prey.habitat) && prey.habitat.length > 0)
                ? prey.habitat
                : (habitatFallback[prey.id] || []);
            if (habitat.length === 0) continue;

            const candidates = tiles.filter(t =>
                !t.isEmpty &&
                habitat.includes(t.region) &&
                !reservedSet.has(t.id) &&
                !occupied.has(t.id)
            );
            if (candidates.length === 0) continue;

            const tile = candidates[Math.floor(Math.random() * candidates.length)];
            occupied.add(tile.id);
            spawned.push({ id: `prey_${i}`, tileId: tile.id, preyType: prey.id });
            placed = true;
        }
    }

    return spawned;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapGenerator, REGIONS, REGION_WEIGHTS, pickWeightedRegion, spawnPrey };
    module.exports.default = MapGenerator;
} else if (typeof window !== 'undefined') {
    window.spawnPrey = spawnPrey;
}