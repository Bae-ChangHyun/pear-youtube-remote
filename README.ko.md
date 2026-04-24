<div align="center">
  <img src="assets/icon.png" alt="Pear YouTube Remote 아이콘" width="128" height="128" />

# Pear YouTube Remote

Pear Desktop 안에서 실행 중인 YouTube Music을 다른 Linux/macOS 컴퓨터에서 제어하는 원격 컨트롤러입니다.

[![Electron](https://img.shields.io/badge/Electron-34-9feaf9?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS-111111)](#설치)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](#라이선스)

[English](README.md) · 한국어

</div>

## 소개

Pear YouTube Remote는 [Pear Desktop](https://github.com/pear-devs/pear-desktop)에서 재생 중인 YouTube Music을 다른 Linux 또는 macOS 기기에서 제어하기 위한 작은 Electron 앱입니다.

실제 음악 재생은 Pear Desktop이 실행 중인 원격 컴퓨터에서 이루어지고, 이 앱은 Pear Desktop의 `api-server` 플러그인에 HTTP로 연결해 검색, 재생, 큐, 탐색, 볼륨, 좋아요, 셔플, 반복 등을 제어합니다.

이 프로젝트는 Pear Desktop 플러그인이라기보다 **원격 companion app**에 가깝습니다. Pear Desktop은 플레이어와 API 서버를 담당하고, Pear YouTube Remote는 별도 컴퓨터에서 그 API를 조작하는 전용 컨트롤러입니다.

## 포지셔닝

Pear Desktop에는 이미 플레이어, 플러그인, `api-server`가 있습니다. 이 프로젝트는 음악이 재생되는 컴퓨터가 책상 반대편에 있거나, Mac mini/거실 PC/회사 Mac 같은 별도 장비에서 돌아갈 때 사용할 수 있는 원격 조작 화면을 제공합니다.

Pear Desktop upstream에 PR하기 좋은 범위는 전체 UI가 아니라 다음처럼 API 개선에 가까운 항목입니다.

- lyrics endpoint 노출
- remote client 사용 문서 보강
- volume state 동기화 개선
- queue/search response 타입 안정화

전체 컨트롤러 UI는 Pear Desktop maintainers가 명확히 원하지 않는 한, 이 저장소에 별도 앱으로 유지하는 편이 적절합니다.

## 미리보기

UI는 YouTube Music과 Pear Desktop의 구조를 참고하지만, 완전한 클론을 목표로 하지 않습니다.

- 왼쪽 사이드바에서 원격 서버 관리
- 상단에서 검색과 연결 상태 확인
- 중앙에서 현재 재생 중인 아트워크 표시
- 오른쪽에서 원격 큐 확인
- 하단 고정 플레이어 바에서 재생 제어

## 주요 기능

- 여러 원격 서버 프로필 등록: alias, API URL, bearer token, active server 전환
- 현재 트랙 표시: 아트워크, 아티스트, 경과 시간, 전체 길이, 재생 상태
- 재생 제어: play, pause, previous, next, 상대 seek, 클릭 seek
- 볼륨 조절: 퍼센트 툴팁, mute toggle
- YouTube Music 검색 후 바로 재생
- 검색 결과를 원격 큐에 추가
- 큐 표시: 썸네일, 특정 항목으로 이동, 항목 제거, 큐 비우기
- 좋아요, 싫어요, 셔플, 반복, 전체화면 제어
- Help 모달에 Pear Desktop 설정 가이드 포함
- Linux에서는 flat custom titlebar, macOS에서는 native-friendly hidden titlebar
- `electron-builder` 기반 Linux/macOS 패키징

## 요구 사항

- Node.js 20 이상
- npm
- 재생용 컴퓨터에 Pear Desktop 설치
- Pear Desktop `api-server` 플러그인 활성화
- 컨트롤러 컴퓨터에서 원격 Pear Desktop API 포트에 접근 가능해야 함
- Pear Desktop이 기본 `AUTH_AT_FIRST` 인증 전략을 사용하는 경우 bearer token 필요

기본 Pear Desktop API URL:

```text
http://127.0.0.1:26538
```

다른 컴퓨터를 제어하려면 `127.0.0.1` 대신 해당 컴퓨터의 LAN IP를 사용합니다.

```text
http://192.168.0.25:26538
```

## 빠른 시작

```bash
git clone https://github.com/Bae-ChangHyun/pear-youtube-remote.git
cd pear-youtube-remote
npm install
npm run dev:electron
```

앱을 실행한 뒤 Settings에서 원격 서버를 추가합니다.

```text
Alias: Studio Mac
API URL: http://192.168.0.25:26538
Token: Pear Desktop 인증이 켜져 있을 때만 입력
```

## Pear Desktop 설정

음악을 실제로 재생할 컴퓨터에서 다음을 설정합니다.

1. Pear Desktop을 설치합니다.
2. Pear Desktop에서 `api-server` 플러그인을 활성화합니다.
3. API server host와 port를 확인합니다. Pear Desktop 플러그인의 기본값은 `0.0.0.0:26538`입니다.
4. 인증이 켜져 있으면 클라이언트를 승인하고 반환된 bearer token을 복사합니다. Pear Desktop 기본 인증 전략은 `AUTH_AT_FIRST`입니다.
5. 컨트롤러 컴퓨터에서 해당 API URL에 접근 가능한지 확인합니다.

로컬 테스트:

```bash
curl http://127.0.0.1:26538/api/v1/song
```

원격 테스트:

```bash
curl http://REMOTE_IP:26538/api/v1/song
```

## 설치

### 다운로드

빌드된 설치 파일은 [Releases](https://github.com/Bae-ChangHyun/pear-youtube-remote/releases) 페이지에서 받을 수 있습니다.

| 플랫폼 | 파일 |
| --- | --- |
| macOS (Apple Silicon) | `.dmg` / `.zip` |
| Linux | `.AppImage` / `.deb` |

### 개발 실행

```bash
npm install
npm run dev:electron
```

개발 서버는 `5187` 포트를 사용합니다.

포트가 이미 사용 중이면 기존 dev process를 종료한 뒤 다시 실행합니다.

### 프로덕션 빌드

```bash
npm run dist
```

빌드 결과물은 `release/`에 생성됩니다.

### Linux

Linux 타깃:

- AppImage
- deb

```bash
npm run dist
```

### macOS

macOS 타깃:

- dmg
- zip

```bash
npm run dist
```

macOS 설치 파일은 macOS에서 빌드하는 것이 가장 안정적입니다.

> **macOS Gatekeeper 경고**
>
> Apple Developer 인증서로 서명되지 않은 앱이므로, 처음 실행할 때 _"Apple이 악성 소프트웨어가 없는지 확인할 수 없습니다"_ 경고가 표시됩니다.
>
> 설치 후 터미널에서 다음 명령어를 실행하면 해결됩니다:
>
> ```bash
> xattr -cr "/Applications/Pear YouTube Remote.app"
> ```
>
> 또는 **시스템 설정 > 개인정보 보호 및 보안**에서 **확인 없이 열기**를 클릭하세요.

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | Vite renderer dev server 실행 |
| `npm run dev:electron` | Vite와 Electron을 함께 실행 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run build` | TypeScript 검사 후 renderer build |
| `npm run dist` | electron-builder로 데스크톱 설치 파일 생성 |

## API 범위

Pear YouTube Remote는 현재 Pear Desktop `api-server`의 다음 API를 사용합니다.

- `GET /api/v1/song`
- `GET /api/v1/song-info`
- `GET /api/v1/queue`
- `GET /api/v1/queue/next`
- `POST /api/v1/search`
- `POST /api/v1/play`
- `POST /api/v1/pause`
- `POST /api/v1/previous`
- `POST /api/v1/next`
- `POST /api/v1/seek-to`
- `POST /api/v1/go-back`
- `POST /api/v1/go-forward`
- `GET /api/v1/volume`
- `POST /api/v1/volume`
- `POST /api/v1/toggle-mute`
- `GET /api/v1/like-state`
- `POST /api/v1/like`
- `POST /api/v1/dislike`
- `GET /api/v1/shuffle`
- `POST /api/v1/shuffle`
- `GET /api/v1/repeat-mode`
- `POST /api/v1/switch-repeat`
- `GET /api/v1/fullscreen`
- `POST /api/v1/fullscreen`

자세한 구현 메모는 [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)를 참고하세요.

## 가사와 썸네일

썸네일은 Pear Desktop이 현재 곡, 검색 결과, 큐 payload에서 제공할 때 표시됩니다.

가사는 현재 지원하지 않습니다. 이 앱이 사용하는 Pear Desktop public `api-server` route에는 안정적인 lyrics endpoint가 없습니다. Pear Desktop 내부에는 synced-lyrics 플러그인이 있으므로, 향후 가장 깔끔한 방향은 내부 UI scraping이 아니라 upstream에서 lyrics API가 노출되는 것입니다.

## 구조

```text
renderer React UI
      |
      | safe IPC bridge
      v
Electron preload
      |
      | ipcMain handlers
      v
Electron main process
      |
      | HTTP requests
      v
Pear Desktop api-server
```

Renderer는 Pear Desktop에 직접 요청하지 않습니다. Electron main process가 API 요청을 담당하고, `src/preload/index.cjs`의 좁은 IPC bridge만 renderer에 노출합니다. 이 구조는 CORS 문제를 피하고 renderer에서 Node API 접근을 막는 데 유리합니다.

## 설정

설정은 Electron app data directory에 저장됩니다.

- 원격 서버 목록
- active server id
- 서버별 alias
- 서버별 base API URL
- optional bearer token
- polling interval

## 문제 해결

### `Port 5187 is already in use`

이미 다른 Vite dev server가 실행 중입니다. 기존 프로세스를 종료한 뒤 다시 실행하세요.

```bash
npm run dev:electron
```

### Remote가 offline으로 표시됨

다음을 확인하세요.

- 재생용 컴퓨터에서 Pear Desktop이 실행 중인지
- `api-server` 플러그인이 활성화되어 있는지
- IP 주소와 port가 정확한지
- firewall이 해당 port를 막고 있지 않은지
- Pear Desktop 인증이 켜져 있다면 token을 입력했는지

### 볼륨 UI가 시스템 볼륨과 다름

Pear Desktop의 YouTube Music 볼륨은 OS 볼륨과 별개입니다. Pear YouTube Remote는 `api-server`가 노출하는 Pear/YouTube Music player volume을 제어합니다.

## 프로젝트 상태

현재는 초기 버전이지만 핵심 원격 제어 기능은 사용할 수 있습니다. 향후 작업 후보는 signed installer, 자동 원격 검색, 더 세밀한 큐 편집, Pear Desktop stable lyrics API가 생겼을 때의 가사 지원입니다.

## 홍보 방향

추천 메시지:

- "음악이 재생되는 Pear Desktop 컴퓨터가 멀리 있을 때 쓰는 원격 컨트롤러"
- 일반 YouTube Music 사용자보다 Pear Desktop 사용자를 먼저 타겟팅
- 검색, 큐, 볼륨, 원격 서버 전환이 보이는 짧은 영상이나 스크린샷 공유
- Pear Desktop upstream에는 전체 앱이 아니라 API 개선 이슈/PR로 접근
- Google, YouTube, YouTube Music, Pear Desktop의 공식 앱처럼 보이게 홍보하지 않기

## 기여

Issue와 Pull Request를 환영합니다.

변경 전 다음 명령어로 확인하세요.

```bash
npm run typecheck
npm run build
```

이 앱은 Pear Desktop의 YouTube Music API를 조작하는 원격 컨트롤러입니다. 완전한 YouTube Music 대체 앱을 목표로 하지 않습니다.

## 작성자

Maintained by `chbae624@gmail.com`.

## 고지

Pear YouTube Remote는 독립적인 비공식 companion app입니다. Google LLC, YouTube, YouTube Music, Pear Desktop, pear-devs와 제휴, 승인, 보증, 공식 연결 관계가 없습니다.

"Google", "YouTube", "YouTube Music", "Pear Desktop" 이름은 호환성 설명과 식별 목적으로만 사용됩니다. 모든 상표는 각 소유자에게 있습니다.

## 라이선스

MIT
