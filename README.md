# WuWa Convenes Exporter (명조 튜닝 기록 내보내기)

**한국어** | [English](docs/README_EN.md)
<img width="1280" height="876" alt="image" src="https://github.com/user-attachments/assets/5d6b3c7c-b57f-47b1-9f9c-ea02d010457d" />

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
- 화면 언어: 한국어 / English (**더보기 → 설정 → 언어**). 아이템 이름은 게임에서 기록 화면을 열 때의 언어로 저장됩니다.

## 프로그램 업데이트

실행 시 GitHub의 최신 정식 릴리스를 확인합니다. 새 버전이 있으면 **업데이트 v…** 버튼이 표시됩니다. 다운로드와 SHA-256 검증이 끝난 뒤 **다시 시작**을 누르면 새 버전을 적용하고 자동으로 실행합니다. `userData`의 기록·설정은 보존하고, 이전 프로그램 폴더는 옆의 `.backup-…` 폴더에 남깁니다. 프로그램 폴더와 상위 폴더에 쓰기 권한 및 압축 해제·백업에 필요한 여유 공간이 있어야 합니다.

릴리스는 `vX.Y.Z` 태그와 `WuWa-Convenes-Exporter-X.Y.Z-win-x64.zip` 파일로 게시하세요. ZIP 최상위 폴더는 `WuWa Convenes Exporter-win32-x64`이며 개인 `userData`를 포함하지 않습니다. GitHub가 제공하는 SHA-256 digest가 없는 릴리스는 다운로드 페이지로 안내합니다.

## 사용법

1. [Releases](https://github.com/noire113-dev/wuwa-convenes-exporter/releases)에서 zip을 받아 원하는 폴더에 압축을 풉니다.
2. 게임을 켜고 **튜닝 → 기록** 화면을 엽니다.
3. `WuWa Convenes Exporter.exe`를 실행하고 **튜닝 기록 불러오기**(이후에는 **기록 업데이트**)를 누릅니다.

- 기본 게임 경로는 없습니다. 처음 실행하거나 저장된 경로가 유효하지 않으면 첫 화면의 **게임 경로 지정**을 눌러 런처 폴더(`Wuthering Waves`) 또는 `Wuthering Waves Game` 폴더를 선택하세요.
- URL은 시간이 지나면 만료됩니다. "URL이 만료됐습니다"가 뜨면 게임에서 기록 화면을 다시 연 뒤 업데이트하세요.
- 자동 검색이 안 되면 **더보기 → URL로 가져오기**에 URL을 직접 붙여 넣을 수 있습니다.

## 데이터 저장 위치

기록은 exe와 같은 폴더의 `userData`에 저장됩니다. 이 폴더를 백업하면 기록이 보존됩니다.

- `gacha-list-<UID>.json`: 계정별 튜닝 기록 (저장할 때마다 직전 파일을 `.bak`으로 남김)
- `config.json`: 게임 폴더 등 설정과 마지막으로 쓴 URL

업데이트 확인·다운로드에는 GitHub에 접속하며 게임 기록이나 조회 URL을 전송하지 않습니다. 기록 조회는 게임 공식 서버(`gmserver-api.aki-game2.net`, 국내판 `.com`)에만 요청하며, 그 밖의 곳으로 데이터를 보내지 않습니다.

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
- `src/i18n.js`: 화면·메시지·엑셀 번역 문자열 (한국어 / English)
- `renderer/`: 화면 (Vue 3 + Element Plus + ECharts)

## 라이선스

MIT. 원본 프로젝트 [genshin-wish-export](https://github.com/biuuu/genshin-wish-export)의 라이선스를 따릅니다.

글꼴은 [Pretendard](https://github.com/orioncactus/pretendard)(SIL Open Font License 1.1)를 사용하며, 라이선스 전문은 빌드 시 `renderer/vendor/Pretendard-LICENSE.txt`로 함께 포함됩니다.

이 도구는 Kuro Games와 관계없는 비공식 팬 도구입니다.
