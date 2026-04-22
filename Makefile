.PHONY: data data-offline help

help:
	@echo "make data          — 구글 시트 6탭 + items.raw.json을 JSON/JS로 추출"
	@echo "make data-offline  — 네트워크 없이 캐시된 xlsx로 재생성"

data:
	python3 scripts/fetch_data.py

data-offline:
	python3 scripts/fetch_data.py --skip-sheet
