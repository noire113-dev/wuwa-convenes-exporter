# WuWa Convenes Exporter (명조 튜닝 기록 내보내기)

명조: 워더링 웨이브(Wuthering Waves) PC판의 **튜닝(가챠) 기록**을 가져와 내 PC에 저장하고, 풀별 통계와 그래프로 보여 주는 도구입니다.

[biuuu/genshin-wish-export](https://github.com/biuuu/genshin-wish-export)를 포크해, 같은 화면 구성(원형 그래프 + 풀별 통계)을 명조에 맞게 새로 만들었습니다.

## 기능

- 게임 로그에서 튜닝 기록 URL 자동 검색
  - 최신 클라이언트는 `Client.log`를 암호화(XOR)해 저장하는데, 이것도 해독해서 찾습니다.
- 게임의 튜닝 기록 화면과 같은 6개 풀
  - 공명자 이벤트 튜닝 · 무기 이벤트 튜닝 · 공명자 레귤러 튜닝 · 무기 레귤러 튜닝 · 여정이 남긴 캐릭터 튜닝 · 여정이 남긴 무기 튜닝
- 풀별 통계
  - 총 뽑기 수, 현재 천장, 5성·4성·3성 개수와 비율
  - 5성 기록과 각 천장 카운트, 평균 5성 천장
  - 공명자 이벤트 튜닝: 통상 5성(반반 실패)은 회색 기울임체로 표시, 반반 승률
- **기록 누적 저장**: 게임 서버는 최근 약 6개월 기록만 보여 주지만, 업데이트할 때마다 기존 기록과 합쳐 저장하므로 오래된 기록도 남습니다. 같은 기록은 중복 저장되지 않습니다.
- 엑셀(.xlsx) 내보내기: 풀별 시트, 회차·천장 카운트·통상 여부 포함
- JSON 내보내기 / 가져오기(기존 기록과 병합), 여러 계정(UID) 전환

## 사용법

1. [Releases](https://github.com/noire113-dev/wuwa-convenes-exporter/releases)에서 zip을 받아 원하는 폴더에 압축을 풉니다.
2. 게임을 켜고 **튜닝 → 기록** 화면을 엽니다.
3. `WuWa Convenes Exporter.exe`를 실행하고 **튜닝 기록 불러오기**(이후에는 **기록 업데이트**)를 누릅니다.

- 게임 폴더는 기본 위치에서 자동으로 찾습니다. 못 찾으면 **더보기 → 설정 → 게임 폴더**에서 런처 폴더(`Wuthering Waves`)를 지정하세요.
- URL은 시간이 지나면 만료됩니다. "URL이 만료됐습니다"가 뜨면 게임에서 기록 화면을 다시 연 뒤 업데이트하세요.
- 자동 검색이 안 되면 **더보기 → URL로 가져오기**에 URL을 직접 붙여 넣을 수 있습니다.

## 데이터 저장 위치

기록은 exe와 같은 폴더의 `userData`에 저장됩니다. 이 폴더를 백업하면 기록이 보존됩니다.

- `gacha-list-<UID>.json`: 계정별 튜닝 기록 (저장할 때마다 직전 파일을 `.bak`으로 남김)
- `config.json`: 게임 폴더 등 설정과 마지막으로 쓴 URL

기록 조회는 게임 공식 서버(`gmserver-api.aki-game2.net`, 국내판 `.com`)에만 요청하며, 그 밖의 곳으로 데이터를 보내지 않습니다.

## 개발

Node.js 20 이상이 필요합니다.

```bash
npm install
npm start          # 실행 (start.bat 더블클릭도 가능)
npm test           # 병합·천장 계산·URL 해독 검사
npm run build      # dist/ 에 exe 폴더 생성
```

- `main.js`: Electron 메인 프로세스 (IPC, 파일 저장, 대화상자)
- `src/url.js`: 로그에서 URL 찾기·해독·파싱
- `src/api.js`: 튜닝 기록 API 호출
- `src/store.js`, `src/stats.js`: 로컬 저장, 기록 병합, 통계·천장 계산
- `src/excel.js`: 엑셀 내보내기
- `renderer/`: 화면 (Vue 3 + Element Plus + ECharts)

## 라이선스

MIT. 원본 프로젝트 [genshin-wish-export](https://github.com/biuuu/genshin-wish-export)의 라이선스를 따릅니다.

이 도구는 Kuro Games와 관계없는 비공식 팬 도구입니다.
