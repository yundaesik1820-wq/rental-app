import { C } from "../theme";

// 장비 설명글을 "사양표"로 파싱해서 보여주는 컴포넌트
// 입력 형식(관리자 설명글):
//   - #텍스트  → 표 위 굵은 한줄 소개(헤드라인). 맨 앞에 이모지를 넣으면 양옆에 붙음
//                (예: "#🎬 5축 손떨방 탑재! 소니 초경량 시네마라인")
//   - 항목은 줄바꿈 또는 / 로 구분 (둘 다 됨)
//   - [xxx]  → 섹션 헤더
//   - 키:값   → 사양 행 (왼쪽 라벨 / 오른쪽 값). 같은 키는 " · "로 합침
//   - 나머지  → 라벨 없는 특징 (칩으로 표시)
// 구조가 전혀 없으면 null 반환 → 호출측/폴백에서 기존 텍스트로.
function splitHeadline(line) {
  const t = line.replace(/^#\s*/, "").trim();
  const m = t.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u);
  if (m) return { emoji: m[1], text: t.slice(m[0].length).trim() };
  return { emoji: "✨", text: t };
}

export function parseSpec(raw) {
  if (!raw || typeof raw !== "string") return null;

  // 줄바꿈 또는 / 로 항목 분리. 셔터속도·렌즈 등 "숫자/숫자"(1/8000초)는 보호.
  const items = raw
    .replace(/(\d)\/(\d)/g, "$1\x01$2")
    .split(/[\n\/]+/)
    .map(s => s.replace(/\x01/g, "/").trim())
    .filter(Boolean);

  let headline = null;
  const rest = [];
  for (const it of items) {
    if (headline === null && it.startsWith("#")) { headline = splitHeadline(it); continue; }
    rest.push(it);
  }

  const hasSection = rest.some(it => /^\[.+\]$/.test(it));
  const hasSpec = rest.some(it => { const i = it.indexOf(":"); return i > 0 && it.slice(i + 1).trim(); });
  if (!hasSection && !hasSpec && !headline) return null; // 구조 없음 → 폴백

  const sections = [];
  let cur = { title: "주요 사양", specs: [], features: [] };
  const flush = () => { if (cur.specs.length || cur.features.length) sections.push(cur); };

  for (const it of rest) {
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

  if (!sections.length && !headline) return null;
  return { headline, sections };
}

export default function SpecTable({ text }) {
  const parsed = parseSpec(text);

  // 구조가 없으면 기존처럼 단순 텍스트 박스로
  if (!parsed) {
    return <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: C.text }}>{text}</div>;
  }

  const { headline, sections } = parsed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {/* 한줄 소개 (굵은 고딕 + 양옆 이모지) */}
      {headline && (
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14.5, color: C.text, lineHeight: 1.4, letterSpacing: "-.01em", margin: "2px 2px 6px", wordBreak: "keep-all" }}>
          <span style={{ margin: "0 6px" }}>{headline.emoji}</span>
          {headline.text}
          <span style={{ margin: "0 6px" }}>{headline.emoji}</span>
        </div>
      )}

      {sections.map((sec, i) => (
        <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.card }}>
          {/* 섹션 헤더 */}
          <div style={{ background: C.blueLight, padding: "5px 11px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", display: "flex", alignItems: "center", gap: 6, color: C.text }}>
            <span style={{ width: 3, height: 11, borderRadius: 2, background: C.teal, flexShrink: 0 }} />
            {sec.title}
          </div>

          {/* 특징 칩 */}
          {sec.features.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "7px 11px" }}>
              {sec.features.map((f, j) => (
                <span key={j} style={{ fontSize: 10.5, fontWeight: 700, color: C.text, background: C.blueLight, border: `1px solid ${C.border}`, borderRadius: 999, padding: "2px 8px" }}>{f}</span>
              ))}
            </div>
          )}

          {/* 사양 행 */}
          {sec.specs.length > 0 && (
            <div>
              {sec.specs.map((s, j) => (
                <div key={j} style={{ display: "flex", gap: 10, padding: "4px 11px", borderTop: j === 0 && sec.features.length === 0 ? "none" : `1px solid ${C.border}`, fontSize: 12, lineHeight: 1.45 }}>
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
