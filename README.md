# 🎓 장비대여실 웹 앱

대학교 미디어센터 장비 대여 관리 시스템 (React + Firebase + Vercel)

---

## 🚀 배포 방법 (순서대로 따라하세요)

### 1단계. Firebase 프로젝트 만들기

1. [console.firebase.google.com](https://console.firebase.google.com) 접속
2. **프로젝트 추가** 클릭 → 프로젝트 이름 입력 (예: `mjrental`)
3. 좌측 메뉴 **Authentication** → **시작하기** → **이메일/비밀번호** 사용 설정 ON
4. 좌측 메뉴 **Firestore Database** → **데이터베이스 만들기** → **테스트 모드**로 시작
5. 좌측 상단 **프로젝트 설정 (톱니바퀴)** → **앱 추가 (웹 아이콘 </>)** → 앱 등록
6. 아래처럼 생긴 설정값 복사해두기:
   ```
   apiKey: "AIza..."
   authDomain: "mjrental.firebaseapp.com"
   projectId: "mjrental"
   ...
   ```

### 2단계. 관리자 계정 만들기

Firebase Console → **Authentication** → **사용자 추가**
- 이메일: 관리자 이메일 입력
- 비밀번호: 설정

그 다음 **Firestore** → **데이터 시작** → 컬렉션 `users` 생성 →
문서 ID를 **Authentication에서 복사한 UID**로 설정 후 아래 필드 추가:
```
name: "관리자 이름"
role: "admin"
email: "admin@example.com"
```

### 3단계. 환경변수 설정

`.env.example` 파일을 `.env.local`로 복사 후 Firebase 설정값 붙여넣기:
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4단계. 로컬 테스트

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 5단계. GitHub에 올리기

1. [github.com](https://github.com) 에서 새 저장소 생성
2. **GitHub Desktop** 앱으로 폴더 열기 → Commit → Push

### 6단계. Vercel로 배포

1. [vercel.com](https://vercel.com) → GitHub 계정으로 로그인
2. **New Project** → GitHub 저장소 선택 → **Import**
3. **Environment Variables** 섹션에 `.env.local`의 내용 그대로 입력
4. **Deploy** 클릭 → 1~2분 후 배포 완료!

### 7단계. 도메인 연결 (선택)

1. 가비아 등에서 도메인 구매
2. Vercel 프로젝트 → **Settings** → **Domains** → 도메인 입력
3. 가비아 DNS 설정에서 Vercel이 알려주는 값 입력
4. 30분~1시간 후 도메인 연결 완료

---

## 🔒 Firestore 보안 규칙 설정

Firebase Console → Firestore → **규칙** 탭에 아래 붙여넣기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 로그인한 사용자만 접근
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    // 관리자만 users 컬렉션 수정 가능
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## 📁 프로젝트 구조

```
src/
├── firebase.js          # Firebase 초기화
├── theme.js             # 디자인 토큰 (색상 등)
├── App.jsx              # 메인 앱 + 라우팅
├── components/
│   ├── UI.jsx           # 공통 UI 컴포넌트
│   └── Layout.jsx       # 사이드바 + 반응형 레이아웃
├── hooks/
│   ├── useAuth.js       # 로그인 상태 관리
│   └── useFirestore.js  # Firestore 데이터 훅
└── pages/
    ├── Login.jsx
    ├── admin/           # 관리자 페이지
    │   ├── Dashboard.jsx
    │   ├── Equipment.jsx
    │   ├── Rental.jsx
    │   ├── Students.jsx
    │   ├── Calendar.jsx
    │   ├── Stats.jsx
    │   ├── Notices.jsx
    │   └── Settings.jsx
    └── student/         # 학생 페이지
        ├── Home.jsx
        ├── EquipList.jsx
        ├── History.jsx
        ├── Reserve.jsx
        └── Profile.jsx
```

---

## 💡 학생 계정 추가 방법

관리자로 로그인 → **학생 관리** 탭 → **학생 등록** 버튼
이메일 + 비밀번호 입력하면 Firebase Auth + Firestore에 자동으로 계정 생성됩니다.

---

## 🛠 기술 스택

- **프론트엔드**: React 18 + Vite
- **데이터베이스**: Firebase Firestore (실시간)
- **인증**: Firebase Authentication
- **차트**: Recharts
- **엑셀**: SheetJS (xlsx)
- **배포**: Vercel
