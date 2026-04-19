// mapGenerator.js - 미로식 맵 생성 시스템

class MapGenerator {
    constructor(gridSize = 7) {
        this.gridSize = gridSize;
    }

    // 육각형 그리드 좌표 생성 (간격 축소)
    generateHexPositions() {
        const positions = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                // 타일 간격 축소: 150 → 110, 75 → 55, 130 → 95
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

    // 미로 생성 (Recursive Backtracking) - 복잡도 증가
    generateMaze(playerStart, exitPos) {
        const totalTiles = this.gridSize * this.gridSize;
        const positions = this.generateHexPositions();
        const tiles = [];
        
        // 초기화
        for (let i = 0; i < totalTiles; i++) {
            tiles.push({
                id: i,
                type: 'normal',
                connections: [],
                visited: false,
                discovered: false,
                revealed: false,
                position: positions[i]
            });
        }
        
        // Recursive Backtracking으로 미로 생성
        const visited = new Set();
        const stack = [playerStart];
        visited.add(playerStart);
        
        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getHexNeighbors(current, positions);
            const unvisitedNeighbors = neighbors.filter(n => !visited.has(n));
            
            if (unvisitedNeighbors.length > 0) {
                // 랜덤 이웃 선택
                const next = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
                
                // 연결 생성 (양방향)
                tiles[current].connections.push(next);
                tiles[next].connections.push(current);
                
                visited.add(next);
                stack.push(next);
            } else {
                stack.pop();
            }
        }
        
        // 추가 랜덤 연결 증가 (10% → 25%): 미로를 더 복잡하게
        const extraConnectionsCount = Math.floor(totalTiles * 0.25);
        for (let i = 0; i < extraConnectionsCount; i++) {
            const randomTile = Math.floor(Math.random() * totalTiles);
            const neighbors = this.getHexNeighbors(randomTile, positions);
            
            if (neighbors.length > 0) {
                const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                if (!tiles[randomTile].connections.includes(randomNeighbor)) {
                    tiles[randomTile].connections.push(randomNeighbor);
                    tiles[randomNeighbor].connections.push(randomTile);
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
        
        // 미로 생성
        const tiles = this.generateMaze(playerStart, exitPos);
        
        // 타입 설정
        tiles[playerStart].type = 'start';
        tiles[playerStart].visited = true;
        tiles[playerStart].discovered = true;
        
        tiles[exitPos].type = 'exit';
        
        // 보스 위치 (플레이어에서 5칸 이상 떨어진 곳)
        const distances = tiles.map((tile, index) => ({
            index,
            distance: this.calculateDistance(tiles, playerStart, index)
        })).filter(d => d.distance >= 5 && d.index !== exitPos && d.index !== playerStart);
        
        distances.sort((a, b) => b.distance - a.distance);
        const bossPos = distances.length > 0 
            ? distances[Math.floor(Math.random() * Math.min(3, distances.length))].index 
            : exitPos - 1;
        
        // 특수 타일
        const availableIndices = tiles
            .map((t, i) => i)
            .filter(i => tiles[i].type === 'normal' && i !== bossPos);
        
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