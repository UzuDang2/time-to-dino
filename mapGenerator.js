// mapGenerator.js - 유기적 연결 기반 맵 생성 시스템

class MapGenerator {
    constructor(gridSize = 7) {
        this.gridSize = gridSize;
    }

    // 육각형 그리드 좌표 생성 (간격 축소)
    generateHexPositions() {
        const positions = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                // 타일 간격: x=110, offset=55, y=95
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

    // 유기적 맵 생성 (연결 기반)
    generateOrganicMap(playerStart, exitPos, emptySlots) {
        const totalTiles = this.gridSize * this.gridSize;
        const positions = this.generateHexPositions();
        const tiles = [];
        
        // 초기화: 모든 타일 생성
        for (let i = 0; i < totalTiles; i++) {
            tiles.push({
                id: i,
                type: 'normal',
                connections: [],
                visited: false,
                discovered: false,
                revealed: false,
                position: positions[i],
                isEmpty: emptySlots.has(i) // 빈 슬롯 표시
            });
        }
        
        // 빈 슬롯이 아닌 타일들만 연결
        const activeTiles = Array.from({ length: totalTiles }, (_, i) => i)
            .filter(i => !emptySlots.has(i));
        
        // 각 타일마다 인접한 타일과 랜덤하게 연결 (60% 확률)
        for (const tileId of activeTiles) {
            const neighbors = this.getHexNeighbors(tileId, positions)
                .filter(n => !emptySlots.has(n)); // 빈 슬롯 제외
            
            for (const neighborId of neighbors) {
                // 아직 연결되지 않았고, 60% 확률로 연결
                if (!tiles[tileId].connections.includes(neighborId) && Math.random() < 0.6) {
                    tiles[tileId].connections.push(neighborId);
                    tiles[neighborId].connections.push(tileId);
                }
            }
        }
        
        // 시작점 → 탈출구 경로 보장
        this.ensurePathExists(tiles, playerStart, exitPos, positions, emptySlots);
        
        return tiles;
    }

    // BFS로 경로 찾기
    findPath(tiles, from, to) {
        const queue = [from];
        const visited = new Set([from]);
        const parent = new Map();
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === to) {
                // 경로 재구성
                const path = [];
                let node = to;
                while (node !== from) {
                    path.unshift(node);
                    node = parent.get(node);
                }
                path.unshift(from);
                return path;
            }
            
            for (const conn of tiles[current].connections) {
                if (!visited.has(conn)) {
                    visited.add(conn);
                    parent.set(conn, current);
                    queue.push(conn);
                }
            }
        }
        return null; // 경로 없음
    }

    // 경로 보장: 시작점 → 탈출구
    ensurePathExists(tiles, playerStart, exitPos, positions, emptySlots) {
        let path = this.findPath(tiles, playerStart, exitPos);
        
        // 경로가 없으면 강제로 연결 생성
        while (!path) {
            // BFS로 시작점에서 갈 수 있는 모든 타일 찾기
            const reachable = new Set([playerStart]);
            const queue = [playerStart];
            
            while (queue.length > 0) {
                const current = queue.shift();
                for (const conn of tiles[current].connections) {
                    if (!reachable.has(conn)) {
                        reachable.add(conn);
                        queue.push(conn);
                    }
                }
            }
            
            // 탈출구에서 갈 수 있는 모든 타일 찾기
            const exitReachable = new Set([exitPos]);
            const exitQueue = [exitPos];
            
            while (exitQueue.length > 0) {
                const current = exitQueue.shift();
                for (const conn of tiles[current].connections) {
                    if (!exitReachable.has(conn)) {
                        exitReachable.add(conn);
                        exitQueue.push(conn);
                    }
                }
            }
            
            // 두 그룹을 연결할 다리 찾기
            let bridgeFound = false;
            for (const tile1 of reachable) {
                const neighbors = this.getHexNeighbors(tile1, positions)
                    .filter(n => !emptySlots.has(n));
                
                for (const tile2 of neighbors) {
                    if (exitReachable.has(tile2) && !tiles[tile1].connections.includes(tile2)) {
                        // 연결 생성
                        tiles[tile1].connections.push(tile2);
                        tiles[tile2].connections.push(tile1);
                        bridgeFound = true;
                        break;
                    }
                }
                if (bridgeFound) break;
            }
            
            // 경로 재확인
            path = this.findPath(tiles, playerStart, exitPos);
        }
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
        
        // 유기적 맵 생성
        const tiles = this.generateOrganicMap(playerStart, exitPos, emptySlots);
        
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

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapGenerator;
}