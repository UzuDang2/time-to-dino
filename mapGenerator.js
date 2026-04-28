// mapGenerator.js - 인접 타일 자동 연결 방식

// D-54 (2026-04-24): 플레이 그리드 주변 빈 패딩(hex 단위).
// 요한 지시: "유저가 맵 한계지점을 느끼는 부분이 없게" — 스크롤해도 "끝"이
// 안 보이도록 넉넉한 여백을 SVG 캔버스에 확보한다. 타일은 기존 7x7만 렌더,
// 패딩 영역은 빈 공간(렌더 요소 없음). 숫자를 키우면 더 넉넉하지만 그만큼
// DOM 크기·초기 paint 비용이 늘어난다.
const PADDING_HEXES = 7;

// D-54: HexTile 폴리곤은 x±43, y±50 고정. 좌표 생성과 extent 계산이 같은
// 상수를 쓰도록 한 자리에서 상수 선언.
const HEX_COL_STEP = 110;   // 가로 열 간격 (홀짝 행은 +55 오프셋)
const HEX_ROW_STEP = 95;    // 세로 행 간격
const HEX_HALF_WIDTH = 55;  // 폴리곤 최외곽 반 폭 여유(짝수 행 오프셋과 동일값)
const HEX_HALF_HEIGHT = 50; // 폴리곤 최외곽 반 높이

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
    // D-54: PADDING_HEXES * (hex step) 만큼 원점 오프셋을 더해 그리드를 캔버스
    // 중앙으로 민다. 이렇게 하면 상하좌우 모두 패딩 공간이 생겨, 스크롤
    // 끝에서도 빈 배경이 계속 이어져 "맵 경계"를 유저가 못 느낀다.
    generateHexPositions() {
        const xOffset = PADDING_HEXES * HEX_COL_STEP + 100;
        const yOffset = PADDING_HEXES * HEX_ROW_STEP + 100;
        const positions = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = col * HEX_COL_STEP + (row % 2) * HEX_HALF_WIDTH + xOffset;
                const y = row * HEX_ROW_STEP + yOffset;
                positions.push({ x, y, row, col });
            }
        }
        return positions;
    }

    // D-54: SVG 캔버스 크기 산출 — 플레이 그리드 양옆에 PADDING_HEXES만큼 여백.
    // 반환: { totalWidth, totalHeight }. GameMap의 <svg width/height>에 그대로 적용.
    // 계산: (플레이 그리드 칸수 + 2*PADDING) * step + 폴리곤 반폭·반높이 여유.
    getMapExtent() {
        const cols = this.gridSize;
        const rows = this.gridSize;
        const totalWidth =
            (cols + 2 * PADDING_HEXES) * HEX_COL_STEP + HEX_HALF_WIDTH + 2 * HEX_HALF_WIDTH;
        const totalHeight =
            (rows + 2 * PADDING_HEXES) * HEX_ROW_STEP + 2 * HEX_HALF_HEIGHT;
        return { totalWidth, totalHeight };
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

    // D-47 맵 생성 — 검증·재시도 래퍼.
    //   빈 슬롯 랜덤 배치로 인해 플레이어↔탈출구가 분리된 섬에 놓이거나 시작점이
    //   모든 인접을 빈 슬롯에 둘러싸여 고립되는 케이스가 간헐적으로 발생했다.
    //   MAX_RETRIES 내에서 _isValidMap을 통과할 때까지 재생성, 초과 시에도 마지막
    //   결과를 반환(게임 진행은 최대한 막지 않도록 fallback).
    generate() {
        const MAX_RETRIES = 40;
        let lastResult = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const result = this._generateOnce();
            if (this._isValidMap(result)) return result;
            lastResult = result;
        }
        console.warn('[mapGen] 검증 실패 맵 ' + MAX_RETRIES + '회 재생성 초과 — 마지막 결과 반환');
        return lastResult || this._generateOnce();
    }

    // 맵 유효성 검증.
    //   1) playerStart 타일에 1개 이상의 connection 보장
    //   2) playerStart에서 BFS로 exitPos 도달 가능
    //   3) playerStart에서 bossPos 도달 가능 (D-68)
    //   4) non-empty 타일이 모두 reachable (D-68, 요한 원문: 어떤 타일도 고립 금지)
    _isValidMap({ tiles, playerStart, exitPos, bossPos }) {
        if (!tiles[playerStart] || tiles[playerStart].connections.length === 0) return false;
        const reachable = new Set([playerStart]);
        const queue = [playerStart];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (const n of tiles[cur].connections) {
                if (!reachable.has(n)) {
                    reachable.add(n);
                    queue.push(n);
                }
            }
        }
        if (!reachable.has(exitPos)) return false;
        if (bossPos != null && !reachable.has(bossPos)) return false;
        // D-68: non-empty 타일은 모두 도달 가능해야 함 (고립 섬 금지).
        const nonEmpty = tiles.filter(t => !t.isEmpty).length;
        return reachable.size === nonEmpty;
    }

    // D-61: 모서리 후보를 gridSize 기반으로 동적 산출.
    //   4꼭짓점(TL/TR/BL/BR) + 상하 가운데(TC/BC). 예: 7x7→[0,6,42,48,3,45].
    //   11x11→[0,10,110,120,5,115] 등.
    getCornerCandidates() {
        const n = this.gridSize;
        const last = n * n - 1;
        const mid = Math.floor((n - 1) / 2);
        return [
            0,              // top-left
            n - 1,          // top-right
            (n - 1) * n,    // bottom-left
            last,           // bottom-right
            mid,            // top-center
            (n - 1) * n + mid // bottom-center
        ];
    }

    _generateOnce() {
        const cornerCandidates = this.getCornerCandidates();
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

        // D-61: 빈 슬롯 수를 gridSize 기반 비율로 스케일.
        //   7x7(49타일)에서 10~15개(약 20~31%)였음. 동일 비율 유지.
        //   11x11(121타일) → 약 25~38개.
        const totalTiles = this.gridSize * this.gridSize;
        const emptyMin = Math.floor(totalTiles * 0.20);
        const emptyMax = Math.floor(totalTiles * 0.31);
        const emptySlotCount = emptyMin + Math.floor(Math.random() * (emptyMax - emptyMin + 1));
        const emptySlots = new Set();

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

        // D-68: 고립 섬 제거 — playerStart에서 BFS reachable 아닌 non-empty 타일을
        //   isEmpty로 전환하고 양방향 connections에서 제거. 이렇게 하면 보스/사냥감이
        //   도달 불가한 섬에 배치되는 버그가 원천 차단된다.
        const reachableInit = new Set([playerStart]);
        const queueInit = [playerStart];
        while (queueInit.length > 0) {
            const cur = queueInit.shift();
            for (const n of tiles[cur].connections) {
                if (!reachableInit.has(n)) {
                    reachableInit.add(n);
                    queueInit.push(n);
                }
            }
        }
        for (let i = 0; i < tiles.length; i++) {
            if (!tiles[i].isEmpty && !reachableInit.has(i)) {
                tiles[i].isEmpty = true;
                tiles[i].region = null;
                // 이웃의 connections에서 이 i 제거.
                for (const n of tiles[i].connections) {
                    const idx = tiles[n].connections.indexOf(i);
                    if (idx >= 0) tiles[n].connections.splice(idx, 1);
                }
                tiles[i].connections = [];
            }
        }

        // playerStart 자체가 고립(연결 0)이면 이 맵은 폐기 — generate() 재시도에 맡김.
        if (tiles[playerStart].connections.length === 0) {
            return { tiles, playerStart, bossPos: exitPos, exitPos };
        }

        // 타입 설정
        tiles[playerStart].type = 'start';
        tiles[playerStart].visited = true;
        tiles[playerStart].discovered = true;

        // exitPos가 고립 제거로 isEmpty가 됐으면 이 맵은 폐기 대상 — _isValidMap에서 걸림.
        if (!tiles[exitPos].isEmpty) {
            tiles[exitPos].type = 'exit';
        }

        // D-61: 보스 최소 거리도 gridSize에 비례. 7x7=5칸 → 11x11≈8칸.
        const minBossDistance = Math.max(5, Math.floor(this.gridSize * 0.7));
        const distances = tiles
            .map((tile, index) => ({
                index,
                distance: this.calculateDistance(tiles, playerStart, index)
            }))
            // D-68: Infinity 거리(도달 불가) 명시 제외 — reachable 집합 밖 안전장치.
            .filter(d => Number.isFinite(d.distance) &&
                        d.distance >= minBossDistance &&
                        d.index !== exitPos &&
                        d.index !== playerStart &&
                        !tiles[d.index].isEmpty);

        distances.sort((a, b) => b.distance - a.distance);
        const bossPos = distances.length > 0
            ? distances[Math.floor(Math.random() * Math.min(3, distances.length))].index
            : exitPos - 1;

        // D-61: 특수 타일 개수를 gridSize에 비례 스케일.
        //   7x7: good=4, trap=2 (합 6 ≈ 49의 12%). 동일 비율로 11x11≈10/5.
        const availableIndices = tiles
            .map((t, i) => i)
            .filter(i => tiles[i].type === 'normal' && i !== bossPos && !tiles[i].isEmpty);

        const scale = totalTiles / 49; // 7x7 기준 비율
        // D-126: event 타일 5% 스폰. 7x7 → 2~3개. 11x11 → 6개.
        //   비복원 풀 추첨은 도착 시점에 결정되므로 여기선 슬롯만 잡아둔다.
        //   풀이 슬롯보다 적으면 도착 시 normal 폴백 → 모달 안 뜸 (mapDispatch 참고).
        const eventCount = Math.max(2, Math.round(totalTiles * 0.05));
        const specialTiles = {
            good: Math.max(4, Math.round(4 * scale)),
            trap: Math.max(2, Math.round(2 * scale)),
            event: eventCount
        };
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

// D-46/D-76 사냥감 스폰:
//   level 1/2 사냥감을 counts.level1 / counts.level2 만큼 별도 풀에서 스폰.
//   habitat region 매칭, reserved/occupied 제외.
//   habitat 필드가 시트에서 CSV("덤불,숲")면 런타임에서 split — prey.habitat이
//   string이면 배열로 변환. 없으면 habitatFallback[prey.id] 사용.
//
//   D-76: Level 2 간 타일거리 3~5 보장.
//     한 L2 prey 배치 후, 그로부터 BFS 거리 3 이내 타일은 다음 L2 spawn
//     candidates에서 제외(최소 거리 3). 거리 5 상한은 "충분히 떨어져 있으면 OK"
//     로 해석하므로 상한 체크 없이 min 거리만 보장(공간 부족 시 완화).
//
// 인자:
//   tiles          — 생성된 타일 배열
//   preyData       — window.TTD_DATA.PREY (배열)
//   counts         — { level1, level2 } (기본 {5,5}). 구버전 호환: number면 level1 마릿수.
//   reserved       — { playerStartId, bossPosId, exitPosId }
//   habitatFallback— 외부에서 주입하는 habitat 매핑 (index.html의 PREY_HABITAT)
//
// 반환: [{ id: 'prey_0', tileId, preyType: 'rabbit' }, ...]
function spawnPrey(tiles, preyData, counts = { level1: 5, level2: 5 }, reserved = {}, habitatFallback = {}) {
    if (!Array.isArray(preyData) || preyData.length === 0) return [];
    // 구버전 호환: counts가 number면 level1 전용.
    if (typeof counts === 'number') counts = { level1: counts, level2: 0 };
    const count1 = Math.max(0, Number(counts.level1) || 0);
    const count2 = Math.max(0, Number(counts.level2) || 0);

    const level1 = preyData.filter(p => p && p.level === 1);
    const level2 = preyData.filter(p => p && p.level === 2);

    const reservedSet = new Set(
        [reserved.playerStartId, reserved.bossPosId, reserved.exitPosId]
            .filter(v => v !== undefined && v !== null)
    );
    const occupied = new Set();
    const spawned = [];
    let idCounter = 0;

    // habitat 정규화: CSV string → array.
    const habitatOf = (prey) => {
        const h = prey && prey.habitat;
        if (Array.isArray(h) && h.length > 0) return h;
        if (typeof h === 'string' && h.trim()) {
            return h.split(',').map(s => s.trim()).filter(Boolean);
        }
        return habitatFallback[prey.id] || [];
    };

    // BFS 거리 (connections 기반).
    const bfsDist = (fromId, toId) => {
        if (fromId === toId) return 0;
        const visited = new Set([fromId]);
        const q = [{ tile: fromId, d: 0 }];
        while (q.length > 0) {
            const { tile, d } = q.shift();
            for (const n of (tiles[tile].connections || [])) {
                if (visited.has(n)) continue;
                if (n === toId) return d + 1;
                visited.add(n);
                q.push({ tile: n, d: d + 1 });
            }
        }
        return Infinity;
    };

    const MAX_SPECIES_ATTEMPTS = 10;

    const spawnOne = (pool, extraFilter) => {
        const triedTypes = new Set();
        for (let attempt = 0; attempt < MAX_SPECIES_ATTEMPTS; attempt++) {
            const available = pool.filter(p => !triedTypes.has(p.id));
            if (available.length === 0) return null;
            const prey = available[Math.floor(Math.random() * available.length)];
            triedTypes.add(prey.id);
            const habitat = habitatOf(prey);
            if (habitat.length === 0) continue;

            let candidates = tiles.filter(t =>
                !t.isEmpty &&
                habitat.includes(t.region) &&
                !reservedSet.has(t.id) &&
                !occupied.has(t.id)
            );
            if (extraFilter) candidates = candidates.filter(extraFilter);
            if (candidates.length === 0) continue;

            const tile = candidates[Math.floor(Math.random() * candidates.length)];
            occupied.add(tile.id);
            const rec = { id: `prey_${idCounter++}`, tileId: tile.id, preyType: prey.id };
            spawned.push(rec);
            return rec;
        }
        return null;
    };

    // Level 1 — 기존 동작 그대로.
    for (let i = 0; i < count1; i++) spawnOne(level1, null);

    // Level 2 — 상호 거리 3 이상 강제. 공간이 부족하면 거리 제약 완화.
    const placedL2 = [];
    const MIN_L2_DIST = 3;
    for (let i = 0; i < count2; i++) {
        const filter = (t) => {
            for (const other of placedL2) {
                if (bfsDist(t.id, other.tileId) < MIN_L2_DIST) return false;
            }
            return true;
        };
        let rec = spawnOne(level2, filter);
        // 거리 제약으로 실패했다면 완화된 조건으로 재시도.
        if (!rec) rec = spawnOne(level2, null);
        if (rec) placedL2.push(rec);
    }

    return spawned;
}

// ─── D-156 (2026-04-28) hex 방향 계산 헬퍼 ──────────────────────────
//
// 두 타일 사이의 6방향 라벨/화살표를 산출.
// 게임 그리드는 'flat-side hex (옆이 평평한 정육각)' + odd-r 오프셋으로,
// 6방향은 W/E/NW/NE/SW/SE (정북/정남 이웃 없음).
//
// 사용처: index.html showHint, 단계 2 발각 토스트, 단계 3 시네마틱.
//
// 입력:
//   tiles       — generate()가 반환한 tiles 배열
//   fromId/toId — tile id
// 반환:
//   {
//     dir:    'W' | 'E' | 'NW' | 'NE' | 'SW' | 'SE' | 'here' | 'unknown',
//     arrow:  '←' | '→' | '↖' | '↗' | '↙' | '↘' | '·' | '?',
//     label:  한국어 방향 라벨,
//     dist:   hex 거리 (cube 거리)
//   }
function getHexDirection(tiles, fromId, toId) {
    if (!Array.isArray(tiles)) return { dir: 'unknown', arrow: '?', label: '알 수 없는 방향', dist: 0 };
    if (fromId === toId) return { dir: 'here', arrow: '·', label: '바로 이곳', dist: 0 };
    const a = tiles[fromId] && tiles[fromId].position;
    const b = tiles[toId] && tiles[toId].position;
    if (!a || !b || typeof a.row !== 'number' || typeof b.row !== 'number') {
        return { dir: 'unknown', arrow: '?', label: '알 수 없는 방향', dist: 0 };
    }

    // odd-r offset → axial 변환 (cube 거리 계산용).
    const toAxial = (p) => {
        const q = p.col - ((p.row - (p.row & 1)) >> 1);
        const r = p.row;
        return { q, r };
    };
    const A = toAxial(a);
    const B = toAxial(b);
    const dq = B.q - A.q;
    const dr = B.r - A.r;
    const dz = dr;
    const dx = dq;
    const dy = -dx - dz;
    const dist = (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) / 2;

    // 화면 픽셀 차이로 6방향 분기 (flat-side hex):
    //   col_step=110, row_step=95 — pixel dx/dy로 각도 계산이 가장 직관적.
    //   tan(30°)≈0.577. dy/|dx| < tan(30°) 영역은 좌/우(E/W).
    const px = b.x - a.x;
    const py = b.y - a.y;
    const absPx = Math.abs(px);
    const absPy = Math.abs(py);

    let dir;
    if (absPx === 0 && absPy === 0) {
        return { dir: 'here', arrow: '·', label: '바로 이곳', dist };
    }
    // 좌/우 영역: |py|/|px|이 충분히 작은 영역.
    //   row_step/col_step ≈ 0.86 → ±1행 1열 차이도 상하 대각으로 본다.
    //   그러나 정확히 같은 행(py===0)이고 px≠0이면 무조건 E/W.
    if (py === 0) {
        dir = (px > 0) ? 'E' : 'W';
    } else if (py < 0) {
        // 위쪽 절반
        dir = (px >= 0) ? 'NE' : 'NW';
    } else {
        // 아래쪽 절반
        dir = (px >= 0) ? 'SE' : 'SW';
    }

    const ARROW = { W: '←', E: '→', NW: '↖', NE: '↗', SW: '↙', SE: '↘' };
    const LABEL = {
        W: '서쪽', E: '동쪽',
        NW: '북서쪽', NE: '북동쪽',
        SW: '남서쪽', SE: '남동쪽'
    };
    return { dir, arrow: ARROW[dir] || '?', label: LABEL[dir] || '알 수 없는 방향', dist };
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapGenerator, REGIONS, REGION_WEIGHTS, pickWeightedRegion, spawnPrey, getHexDirection };
    module.exports.default = MapGenerator;
} else if (typeof window !== 'undefined') {
    window.spawnPrey = spawnPrey;
    window.getHexDirection = getHexDirection;
}