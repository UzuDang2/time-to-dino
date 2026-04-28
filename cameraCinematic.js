// cameraCinematic.js — D-157 (2026-04-28) 재사용 카메라 시네마틱 모듈.
//
// 사용처:
//   - snare_trap 발동 시 보스 위치로 패닝 → 1.2초 정지 → 원위치 복귀.
//   - 향후 보스 발견·사체 첫 도착 등에서도 동일 헬퍼 재활용.
//
// 의도:
//   기존 GameMap은 SVG <g transform="translate(..)"> 내부에서 자체 패닝/줌을 갖는다.
//   카메라 시네마틱은 외부 컨테이너 스크롤 위치(scrollLeft/scrollTop)를
//   부드럽게 전환하는 방식으로 구현. 단순 fallback은 페이드 오버레이.
//
// API: window.CameraCinematic.panToTile({ scrollEl, tilePixelXY, panMs, holdMs, returnMs, onMidway, onDone })
//   - scrollEl: 스크롤 가능한 컨테이너(.map-scroll 등).
//   - tilePixelXY: { x, y } SVG 내부 픽셀 좌표(generateHexPositions 결과).
//   - panMs/holdMs/returnMs: 단계별 시간(기본 800/1200/600).
//   - onMidway: 패닝 후 hold 시작 시 호출(보스 가시화·토스트 등에 사용).
//   - onDone: 시퀀스 종료 시 호출(원위치 복귀 후).
// 부재 환경(DOM/RAF 없음)에서도 fail-safe — 즉시 onMidway/onDone 콜백 실행.

(function (root) {
    'use strict';

    function lerp(a, b, t) { return a + (b - a) * t; }

    // 한 번 호출당 하나의 시퀀스만 권장. 동시 다중 호출은 마지막이 우세.
    function panToTile(opts) {
        const {
            scrollEl,
            tilePixelXY,
            panMs = 800,
            holdMs = 1200,
            returnMs = 600,
            onMidway,
            onDone
        } = opts || {};

        // 안전망: 환경 부재 시 동기 콜백.
        if (!scrollEl || !tilePixelXY || typeof tilePixelXY.x !== 'number' || typeof tilePixelXY.y !== 'number') {
            if (typeof onMidway === 'function') try { onMidway(); } catch (e) { console.warn(e); }
            if (typeof onDone === 'function') setTimeout(() => { try { onDone(); } catch (e) { console.warn(e); } }, 50);
            return;
        }

        // 컨테이너 가시 영역 중심에 tile이 오도록 목표 스크롤 산출.
        const rect = scrollEl.getBoundingClientRect();
        const targetLeft = Math.max(0, tilePixelXY.x - rect.width / 2);
        const targetTop = Math.max(0, tilePixelXY.y - rect.height / 2);
        const startLeft = scrollEl.scrollLeft;
        const startTop = scrollEl.scrollTop;

        const tStart = performance.now();
        function step1(now) {
            const t = Math.min(1, (now - tStart) / panMs);
            // ease-out cubic
            const e = 1 - Math.pow(1 - t, 3);
            scrollEl.scrollLeft = lerp(startLeft, targetLeft, e);
            scrollEl.scrollTop = lerp(startTop, targetTop, e);
            if (t < 1) {
                requestAnimationFrame(step1);
            } else {
                if (typeof onMidway === 'function') {
                    try { onMidway(); } catch (e) { console.warn('[cinematic] onMidway error:', e); }
                }
                setTimeout(startReturn, holdMs);
            }
        }

        function startReturn() {
            const rStart = performance.now();
            const fromLeft = scrollEl.scrollLeft;
            const fromTop = scrollEl.scrollTop;
            function step2(now) {
                const t = Math.min(1, (now - rStart) / returnMs);
                const e = 1 - Math.pow(1 - t, 3);
                scrollEl.scrollLeft = lerp(fromLeft, startLeft, e);
                scrollEl.scrollTop = lerp(fromTop, startTop, e);
                if (t < 1) {
                    requestAnimationFrame(step2);
                } else {
                    if (typeof onDone === 'function') {
                        try { onDone(); } catch (e) { console.warn('[cinematic] onDone error:', e); }
                    }
                }
            }
            requestAnimationFrame(step2);
        }

        requestAnimationFrame(step1);
    }

    const api = { panToTile };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CameraCinematic = api;
})(typeof window !== 'undefined' ? window : this);
