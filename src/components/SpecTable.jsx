import { C } from "../theme";

// 장비 설명글을 "사양표"로 파싱해서 보여주는 컴포넌트
// 입력 형식(관리자 설명글):
//   - 항목은 줄바꿈 또는 " / " 로 구분
//   - [xxx]  → 섹션 헤더
//   - 키:값   → 사양 행 (왼쪽 라벨 / 오른쪽 값). 같은 키는 " · "로 합침
//   - 나머지  → 라벨 없는 특징 (칩으로 표시)
// 위 구조가 전혀 없으면 null 반환 → 호출측에서 기존 텍스트로 폴백.
export function parseSpec(raw) {
  if (!raw || typeof raw !== "string") return null;
  const items = raw
    .split("\n")
    .flatMap(line => line.split(/\s+\/\s+/))
    .map(s => s.trim())
    .filter(s => s && s !== "/");

  const hasSection = items.some(it => /^\[.+\]$/.test(it));
  const hasSpec = items.some(it => { const i = it.indexOf(":"); return i > 0 && it.slice(i + 1).trim(); });
  if (!hasSection && !hasSpec) return null; // 구조 없음 → 폴백

  const sections = [];
  let cur = { title: "주요 사양", specs: [], features: [] };
  const flush = () => { if (cur.specs.length || cur.features.length) sections.push(cur); };

  for (const it of items) {
    const sm = it.match(/^\[(.+)\]$/);
    if (sm) { flush(); cur = { title: sm[1].trim(), specs: [], features: [] }; continue; }
    const ci = it.indexOf(":");
    if (ci > 0) {
      const k = it.slice(0, ci).trim();
      const v = it.slice(ci + 1).trim();
      if (k && v) {
        const ex = cur.specs.find(s => s.k === k);
        if (ex) ex.v += " · " + v; else cur.specs.push({ k, v });
        continue;
      }
    }
    cur.features.push(it);
  }
  flush();
  return sections.length ? sections : null;
}

export default function SpecTable({ text }) {
  const sections = parseSpec(text);

  // 구조가 없으면 기존처럼 단순 텍스트 박스로
  if (!sections) {
    return <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: C.text }}>{text}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map((sec, i) => (
        <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
          {/* 섹션 헤더 */}
          <div style={{ background: C.blueLight, padding: "8px 13px", fontSize: 12, fontWeight: 800, letterSpacing: ".02em", display: "flex", alignItems: "center", gap: 7, color: C.text }}>
            <span style={{ width: 3, height: 13, borderRadius: 2, background: C.teal, flexShrink: 0 }} />
            {sec.title}
          </div>

          {/* 특징 칩 */}
          {sec.features.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "11px 13px" }}>
              {sec.features.map((f, j) => (
                <span key={j} style={{ fontSize: 11, fontWeight: 700, color: C.text, background: C.blueLight, border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 10px" }}>{f}</span>
              ))}
            </div>
          )}

          {/* 사양 행 */}
          {sec.specs.length > 0 && (
            <div>
              {sec.specs.map((s, j) => (
                <div key={j} style={{ display: "flex", gap: 10, padding: "8px 13px", borderTop: j === 0 && sec.features.length === 0 ? "none" : `1px solid ${C.border}`, fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ color: C.muted, width: "38%", flexShrink: 0, fontWeight: 600, wordBreak: "keep-all" }}>{s.k}</span>
                  <span style={{ color: C.text, fontWeight: 600, flex: 1, wordBreak: "break-word" }}>{s.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
