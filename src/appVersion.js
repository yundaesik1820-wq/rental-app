// 이 앱 번들의 버전. 릴리스마다 여기 값을 올린다 (iOS MARKETING_VERSION / Android versionName 과 맞춤).
// 번들이 통째로 고정 배포되므로, 이 상수 = 실제 실행 중인 앱의 버전.
export const APP_VERSION = "1.0.9";

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
