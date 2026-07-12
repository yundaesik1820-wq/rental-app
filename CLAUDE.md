# KBAS 장비대여실 앱 (한예진 / KBAS)

한국방송예술진흥원(한예진) 영상장비·시설 대여 관리 앱. 개발자 윤대식(장비조교 / super admin)이 솔로로 개발/운영.

## 대화 규칙
- **반말로 대화한다.**
- 작업 스타일: minimal / surgical 수정 선호, 한 번에 하나씩 단계적으로, 빠른 진행. 헛수고를 싫어함.
- 파일 수정 후에는 항상 문법 검증하고 결과를 명확히 보고.

---

## 기술 스택 & 환경
- **프론트**: React + Vite
- **백엔드**: Firebase (Auth / Firestore / Storage / Cloud Functions)
- **배포**: Vercel (웹) + Capacitor (iOS/Android 네이티브 래핑)
- **버전관리**: GitHub Desktop → repo `yundaesik1820-wq/rental-app`
- **iOS 빌드**: Codemagic → TestFlight (개발 PC가 **Windows only, Mac 없음**)
- **테스트 기기**: 갤럭시 23 + 아이폰 16 (둘 다)
- **appId**: `com.kbas.rental` / **Apple App ID**: 6779502423
- **배포 URL**: https://rental-app-delta-kohl.vercel.app
- **Storage bucket**: `kbas-equipment-rental.firebasestorage.app`

## 배포 워크플로우
```
코드 수정 → GitHub Desktop으로 push → Vercel 자동 배포
iOS: 빌드번호 ↑ → Codemagic → TestFlight → App Store Connect
```

---

## 핵심 아키텍처

### 색상 토큰 — `src/theme.js`
- `C` = 다크 테마 색 객체 (현재 흑백 모노톤). **모든 색은 `C.xxx` 참조.**
- 주요 값: `bg #0B0B0E`, `surface/card #17171C`, `navy/blue = #FFFFFF`(흰색), `text #ECECEE`, `muted #8A8A92`, `border #2A2A31`, `teal #2DD4BF`, `red #FF6B6B` 등.
- `getThemeMode`, `setTheme` export.
- ⚠️ **흰 배경 모달/패널(예: 알림 패널)에서는 `C.bg`(검정) 같은 다크 토큰을 쓰면 안 됨** — 흰 배경 전용 색을 따로 쓸 것. (과거 흰글자 일괄수정이 다크 토큰을 흰 배경에 섞어서 크래시/안 보임 버그 유발한 이력 있음.)

### Firebase — `src/firebase.js`
- export: `auth`, `db`, `storage`.

### 인증 — `src/hooks/useAuth.jsx`
- `useAuth()` → `{ user, profile, loading, login, logout, pendingError }`
- **`profile`은 로그인 시 `users/{uid}`를 `getDoc`으로 1회 로드** (실시간 onSnapshot 아님). 다른 기기 변경은 앱 재시작 시 반영.
- `isAdmin = profile?.role === "admin"`
- `profile.status`가 pending/rejected/withdrawn이면 로그인 차단.

### Firestore 훅 — `src/hooks/useFirestore.js`
- `useCollection(name, orderField="createdAt")` → `{ data, loading }` (onSnapshot 실시간, data 기본 빈 배열).
- `addItem / updateItem / deleteItem`.

### 공용 UI — `src/components/UI.jsx`
- `Modal({children,onClose,width,cinema})`, `Inp`, `Btn({children,onClick,color,text,small,full,outline,disabled})`, `Card`, `Badge`, `Empty`, `PageTitle`, `Select`, `Avatar`, `Spinner`.
- `Card`에는 `color: C.text`가 들어가야 안의 텍스트가 흰색으로 상속됨.

### 라우팅 — `src/App.jsx`
- `tab` state로 화면 전환. admin/student 각각 `renderPage` switch.
- `Layout`이 헤더 + 하단 네비 렌더.

### 하단 네비 — `src/components/Layout.jsx` + `src/components/GroupHub.jsx`
- 관리자 하단 6탭: **홈 / 대여 / 장비 / 학생 / SNS / 더보기**.
  - 홈=Dashboard, 대여=Rental(단독), 나머지(장비/학생/SNS/더보기)는 그룹탭 → `GroupHub` 카드 허브 → 기능 화면.
- 하단 탭바: `position:fixed, bottom:0`, paddingBottom 고정 8px, `main` padding-bottom 고정 70px. **safe-area env 계산 안 씀(모든 기기 동일).**
- 상단은 노치 보호로 `padding-top: max(env(safe-area-inset-top), 24px)` 유지.

---

## 권한 체계 (users 문서 필드)
- `role`: `"student"` | `"admin"`
- `adminRole`: `super` / `assistant` (전체 권한) | `teacher` / `professor` (제한 — 문의 열람 등, 에브리타임 X)
- `status`: `pending` / `approved` / `rejected` / `withdrawn`
- `license`: 라이선스 레벨 (LV0~LV3, 대여 가능 등급)
- `reporterStatus`: `approved`면 씬스패치 기자(기사 작성 가능)
- 에브리타임은 영상계열 학생만.

## 데이터 모델 메모
- 카테고리 필드: `majorCategory`(대분류, 학생 화면 12카테고리 필터), `minorCategory`(중분류 = 소분류 칩), `subCategory`(소분류).
- 대여 상태: 승인대기 → 승인됨 → 대여중 → 반납완료 / 거절됨 / 연체.
- 주말 대여 = 금 17:30 ~ 월 09:00. 평일 당일대여 09:00~17:30. 최소 3일 전(긴급 체크박스 예외).

---

## 최근 작업 내역 (2026-06, 디자인 개편 + 알림/보안)

### 완료 (배포 필요 시 push)
- **흑백 모노톤 테마 전환**: theme.js `C`에서 navy/blue를 흰색(#FFFFFF), bg를 #0B0B0E로.
- **텍스트 안 보임 버그 수정**: `index.html` body에 `color:#ECECEE`, `UI.jsx` Card에 `color:C.text` (Card 안 상속 텍스트가 검정으로 안 보이던 문제).
- **버튼 nowrap**: `index.html`에 `button { white-space:nowrap }` (버튼 글자 두 줄 깨짐 방지).
- **하단 탭바 여백 정리**: `Layout.jsx` — safe-area env 계산 제거, 고정값으로 모든 기기 통일.
- **Dashboard 계정전환 버튼**: 아이콘만 표시(텍스트 침범 해결).
- **학생 홈 마스코트 카드**: "렌토리랑 친해져보기"/"친구 초대" 버튼 제거, 워터마크를 말풍선 바로 아래로 이동 + 카드 콤팩트화. (`src/pages/student/Home.jsx`)
- **알림 구조 통합** (`src/App.jsx`): 배지 카운트와 알림 패널이 각각 계산하던 중복 로직을 **`buildAlerts(isAdmin, profile, data)` 단일 함수**로 통합. 최신순 정렬 포함. 흰 배경 패널 색은 `NOTIF_CC` 모듈 상수 사용. → 배지 숫자와 목록 개수 항상 일치.
- **알림 읽음 서버 동기화** (`src/App.jsx`): 읽음 기록을 `users/{uid}.seenNotifs` 배열에 `arrayUnion`으로 저장. 읽음 판정 = `localStorage ∪ profile.seenNotifs`. 기기 바꿔도 읽음 유지(앱 실행 시 동기화).
- **Firestore 보안 규칙 강화**(`firestore.rules`, Firebase 콘솔에 게시): 본인이 자기 문서의 권한 필드(`role/adminRole/status/reporterStatus/license`)를 못 바꾸게 잠금(관리자 예외). 가입 시 admin 역할·자동 승인(approved) 차단.

### 출시 상태
- ✅ **iOS App Store 출시 중** (1.0.6="1.6" 2026-07-12 승인 / 1.0.7 준비 중 = 강제업데이트 게이트+버전추적)
- ✅ **Google Play Store 정식 출시 완료**
- 현재 버전: iOS/Android 모두 versionCode·빌드 9 / versionName·마케팅 1.0.7

### 다음 점검 후보
- Firebase 콘솔에서 **익명(Anonymous) 인증이 꺼져 있는지** 확인 (이메일/비번만 사용).
- `users` create 규칙에 `isOwner(userId)` 추가해서 남의 uid 자리 문서 생성 차단(선택).
- 알림 클릭 시 해당 화면으로 이동(딥링크) — `buildAlerts` 항목에 `tab` 필드 추가하면 됨(미구현).
- 읽음 기록(`seenNotifs`) 장기 누적 정리 로직(지금은 불필요).

---

## 검증/주의
- JSX 수정 후 문법 체크. (참고: 과거 채팅 환경에선 `@babel/parser`로 파싱 검증했음.)
- `theme.js`는 localStorage/document 참조가 있어 단순 import 실행이 어려울 수 있음 — 구문만 확인.
- 사용자 로컬 파일이 repo보다 최신일 수 있으니, 수정 전 현재 파일 내용을 먼저 확인할 것.
