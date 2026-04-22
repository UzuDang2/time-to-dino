.PHONY: data data-offline data-xlsx install-deps help

help:
	@echo "make data          — (API 우선) 시트 6탭 + items.raw.json → JSON/JS"
	@echo "make data-xlsx     — xlsx export만 사용 (API 우회)"
	@echo "make data-offline  — 네트워크 없이 캐시된 xlsx로 재생성"
	@echo "make install-deps  — Python 의존성 설치 (gspread 포함)"

data:
	python3 scripts/fetch_data.py

data-xlsx:
	python3 scripts/fetch_data.py --no-api

data-offline:
	python3 scripts/fetch_data.py --skip-sheet --no-api

install-deps:
	pip3 install --user -r requirements.txt
