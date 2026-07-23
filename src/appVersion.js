// 이 앱 번들의 버전. 릴리스마다 여기 값을 올린다 (iOS MARKETING_VERSION / Android versionName 과 맞춤).
// 번들이 통째로 고정 배포되므로, 이 상수 = 실제 실행 중인 앱의 버전.
export const APP_VERSION = "1.0.12";

// config/appVersion 문서에서 플랫폼 전용 필드를 골라 읽는다.
//   pickPlatformVersion(cfg, "minVersion", "ios") → cfg.minVersionIos ?? cfg.minVersion
// iOS/Android 는 심사 기간이 달라 스토어 버전이 어긋나므로 플랫폼별로 따로 둘 수 있게 함.
// 전용 필드가 없으면 기존 공용 필드로 폴백 → 지금까지의 동작과 완전히 동일.
export function pickPlatformVersion(cfg, base, platform) {
  if (!cfg) return null;
  const suffix = platform === "ios" ? "Ios" : platform === "android" ? "Android" : null;
  return (suffix && cfg[base + suffix]) || cfg[base] || null;
}

// "1.0.6" 같은 버전 문자열 비교. a<b → -1, a==b → 0, a>b → 1
export function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
