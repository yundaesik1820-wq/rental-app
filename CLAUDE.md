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

### 장바구니 — `src/hooks/useCart.jsx` (2026-07-16 신설)
- `CartProvider`가 `<AuthProvider>` 안에서 감쌈. `useCart()` → `{ cart, setCart, cartSets, setCartSets, setQty, clearCart, cartCount }`.
- `cart` = `{ modelName: qty }` (단품), `cartSets` = `{ modelName: true }` (세트, 수량 없이 1세트).
- **배민식 흐름**: 장비 목록(EquipList)에서 담기 → 플로팅 장바구니 바 → 주문서(Reserve) → 신청서 폼(모달).
- 원래 장바구니는 Reserve 안의 로컬 state였음. EquipList와 공유하려고 밖으로 뺀 것 — 로직은 그대로.
- 라이선스·재고 검증은 **담는 시점과 제출 시점 양쪽**에 걸림. `items` 데이터 모델은 안 바뀜(관리자 화면·규칙 무관).

### 장비 호환성 — `src/utils/equipCompat.js` (2026-07-16 신설)
- 카메라/캠코더를 누르면 `EquipDetail`에서 호환 액세서리를 함께 담는다. 삭제한 `GuideReserve`(`fa218d2^`)의 매칭 규칙을 추출한 것.
- 판정은 **`equipType` 단독으로 하면 안 됨** — 중분류를 직접 입력해 등록하면 `"etc"`로 박히고, 매핑 도입 전 장비는 비어 있음. 항상 `equipType || minorCategory` 폴백. (관리자 `Equipment.jsx`도 같은 방식)
- `EQUIP_TYPE_MAP`(관리자 `Equipment.jsx:528`)이 **중분류 → equipType** 원본 기준.
- ⚠️ `majorCategory`는 `"카메라"`/`"캠코더"` 같은 12카테고리 값. **`"촬영"`이 아님** (구 가이드 조건이 틀렸던 부분).

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
  - 그룹탭 활성 판정은 `GROUP_MEMBERS` (하위 tab이 여기 없으면 탭이 활성으로 안 뜸).
- 학생 하단 4탭(`MOBILE_STU_IDS`): **홈 / 장비 / 커뮤니티 / 더보기**.
  - **예약 신청은 탭에서 뺐음** — 장비 목록에서 담고 장바구니 바로 진입. `tab: "reserve"` 라우팅과 `STU_NAV` 항목은 유효(헤더 제목용).
- **같은 탭 재탭** → `<main>`을 맨 위로 스크롤. 학생 더보기는 `onSameTab` → `mypageKey` 증가로 리마운트되어 메뉴 첫 화면 복귀(내부 `view` state라 밖에서 못 되돌림).
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
- **장비 호환성 필드** (관리자가 등록 시 입력 — 상세 페이지 매칭의 근거):
  | 필드 | 용도 |
  |------|------|
  | `forCamera` / `forCameras` | 배터리가 맞는 카메라 모델 |
  | `batteryModel` | 카메라 문서에 적힌 전용 배터리 |
  | `chargerForBatteries` | 충전기↔배터리 (구버전 폴백: `chargerForCameras`) |
  | `mount` | 바디/렌즈 마운트 — 다르면 어댑터 필요 |
  | `adapterFrom` / `adapterTo` | 어댑터가 잇는 마운트 |
  | `equipType` | camera/camcorder/battery/charger/storage/lens/adapter/tripod… |
- 렌즈 제조사 표기는 **축약형이 섞임** (`CZ` = CARL ZEISS). `equipCompat.js`의 `BRAND_ALIAS`로 정규화. 로고는 `public/lens-brands/*.png` (흰색 48×48, 24px 표시, 없으면 `onError`로 숨김).
- V마운트 배터리 판별은 `subCategory`에 `VBP`/`V-Mount`/`V마운트` 포함 여부.
- ⚠️ `groupEquipments`는 **화이트리스트**로 필드를 골라 담음. 새 필드를 학생 화면에서 쓰려면 **거기 추가해야 함** — 안 하면 조용히 `undefined`가 되어 오작동(실제로 `mount`가 빠져 모든 렌즈가 "마운트 불일치"로 판정된 이력).
- 대여 상태: 승인대기 → 승인됨 → 대여중 → 반납완료 / 거절됨 / 연체.
- 주말 대여 = 금 17:30 ~ 월 09:00. 평일 당일대여 09:00~17:30. 최소 3일 전(긴급 체크박스 예외).

---

## 최근 작업 내역 (2026-07-16, 학생 화면 대개편 — 커밋 20개)

### 장바구니 전환 (배민식)
- **초보자 가이드 제거** (`GuideReserve.jsx` 1263줄 삭제, `fa218d2^`에 남음). 호환성 매칭 로직은 `equipCompat.js`로 추출해 재사용 중.
- **`CartContext` 신설** — Reserve 안에 있던 장바구니를 밖으로. EquipList에서 담고 Reserve에서 신청.
- **Reserve = 주문서**로 축소 (장비 목록 UI 237줄 제거). 장바구니 비면 "장비 담으러 가기" 안내.
- **`EquipDetail` 신설** — 카메라/캠코더 **카드 클릭** → 상세. 액세서리는 접힌 아코디언, 순서 **렌즈 → 배터리 → 충전기 → 저장매체 → 리더기**. 삼각대/그립은 상세에서 제외(장비 목록에서 일반 담기).
  - 배터리: 전용 먼저, **V마운트는 펼치기**. 충전기는 배터리를 골라야 목록이 뜸.
  - 렌즈: **제조사별 펼치기** (`LENS_BRAND_ORDER`: SONY→CANON→XEEN CF→SAMYANG→TAMRON→CARL ZEISS→TOKINA→SIGMA→FUJINON→NIKON). 마운트 다르면 어댑터 자동 포함, 어댑터 없으면 담기 차단. XEEN CF 등 **렌즈 세트**도 함께 표시(`cartSets`로 담김).

### 화면 정리
- **소품 전체 제거** — 목록·예약 배너·서브탭. 소품 예약은 원래 "준비 중" 껍데기였고 **데이터도 0건**이라 화면만 지우면 끝이었음.
- 예약 신청: 초보자/전문가 선택·메인 화면 제거 → **장비 예약 직행**. 하단 탭에서도 뺌.
- 홈: 나의 예약현황·공지사항 섹션 제거(120줄). ⚠️ **반납 사진 업로드 경로가 사라짐** → [[return-photo-screen-todo]]
- 친구 시간표: 서브탭 3개·친구 요청/추가 탭·삭제 버튼 제거. 검색·정렬·고정·시간표만 남김.
- 헤더: 프로필 아바타·이름 제거 → 알림 벨만.

### 버그 수정
- **PWA 스토어 리디렉트** — 홈 화면에 설치해도 아이콘으로 열면 스토어로 튕김. `display-mode: standalone`(Android) + `navigator.standalone`(iOS) 감지 + `start_url: /?web=1`.
- **알림 패널 상태바 침범**(네이티브) — 이 WebView는 `calc()` 안의 `env()`를 무시. probe로 실측해 px로 박음. **같은 패턴이 `ScenePatch`·`ARDistance`·`PdfViewer`·`GuideReserve`(삭제됨)·`Community` 이미지뷰어에 아직 남아 있음.**
- `groupEquipments` 화이트리스트에서 `mount`/`batteryModel`/`equipType` 누락 → 렌즈 전부 "마운트 불일치" 오판.
- 세트 카드에 라이선스 잠금 판정이 없었음(단품만 있었음).

---

## 이전 작업 내역 (2026-06, 디자인 개편 + 알림/보안)

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

### 출시 상태 (2026-07-16 기준)
- ✅ **iOS App Store 출시 중** — 1.0.8 승인됨 / **1.0.9 (빌드 11) 심사 중**
- ✅ **Google Play Store 정식 출시 완료**
- 현재 버전: iOS/Android 모두 versionCode·빌드 11 / versionName·마케팅 1.0.9
- ⚠️ 1.0.9가 **승인되기 전**이면 트레인이 열려 있어 빌드번호만 올려 재업로드 가능. **승인 후**엔 1.0.10으로 3곳(`pbxproj`/`build.gradle`/`appVersion.js`)을 같이 올려야 함. → [[ios-release-version-bump]]

### 다음 점검 후보
- **[최우선] 반납 사진 화면 신규 제작** — 지금 학생이 반납 사진 올릴 경로가 없어 반납 플로우가 막힘. → [[return-photo-screen-todo]]
- **장바구니 실기기 테스트** — 담기→주문서 인계, 배터리/충전기 매칭(데이터 의존), 제출 후 비워짐.
- **펫게임 버그 2건** (미수정): ① 방어가 양쪽 다 무효 — stale closure로 `myGuard`가 항상 false, 상대 `opGuard`는 반환값을 아무도 안 씀 ② 하트가 `heartedBy` 배열을 스냅샷으로 통째 덮어써서 동시에 누르면 유실 (`arrayUnion` 필요).
- **보안**: `firestore_rules_복붙용.txt:42`의 `hasOnly(['pet'])` — 로그인한 아무나 **남의 pet 필드를 통째로 교체 가능**(`{pet: null}`로 삭제도 됨). EXP·배틀 승패가 전부 클라 계산이라 순위 조작도 가능.
- 남은 `calc()` 안 `env()` 패턴 정리 (ScenePatch 3곳 등 — 위 버그 수정 참고).
- 안 쓰는 코드 정리: Reserve의 `tabView`·`search`·`filter`·`lightbox`·`equipDetail`·`toggleSet`, Home의 `selectedRequest`/`selectedNotice` 모달·`friendSubTab`·`sendFriendRequest`·`deleteFriend`.
- Firebase 콘솔에서 **익명(Anonymous) 인증이 꺼져 있는지** 확인 (이메일/비번만 사용).
- `users` create 규칙에 `isOwner(userId)` 추가해서 남의 uid 자리 문서 생성 차단(선택).
- 알림 클릭 시 해당 화면으로 이동(딥링크) — `buildAlerts` 항목에 `tab` 필드 추가하면 됨(미구현).
- 읽음 기록(`seenNotifs`) 장기 누적 정리 로직(지금은 불필요).

---

## 검증/주의
- JSX 수정 후 문법 체크. (참고: 과거 채팅 환경에선 `@babel/parser`로 파싱 검증했음.)
- `theme.js`는 localStorage/document 참조가 있어 단순 import 실행이 어려울 수 있음 — 구문만 확인.
- 사용자 로컬 파일이 repo보다 최신일 수 있으니, 수정 전 현재 파일 내용을 먼저 확인할 것.
