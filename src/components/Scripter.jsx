import { useState, useEffect, useRef } from "react";

/**
 * 📝 스크립터 (TPP 스크립트 용지)
 *
 * - 컷(S#-C#) 단위로 기록 → 컷마다 양식 한 장
 * - 빠른 테이크 로그 (OK/NG/KEEP + 타이머 + 메모)
 * - 컷별 상세: 날씨/광선/시간대/W.B/렌즈/필터/Exp/Roll + 연결/카메라위치/사운드/B.G/지문대사/트랜지션
 * - localStorage 자동 저장
 * - TPP 양식 그대로 인쇄/PDF 내보내기 (컷마다 A4 한 장, 테이크 10줄씩)
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const C = {
  surface: "#1a1a1a",
  border: "#2a2a2a",
  text: "#fafaf9",
  muted: "#a8a29e",
  mutedDim: "#71706b",
  gold: "#fbbf24",
  red: "#dc2626",
  green: "#22c55e",
};

const PROD_KEY = "scripter_prod_v1";
const CUTS_KEY = "scripter_cuts_v1";

const MDEN = ["M", "D", "E", "N"]; // Morning / Day / Evening / Night
const SOL  = ["S", "O", "L"];      // Sunny / Overcast / Light(실내)
const TRANS_IN  = ["F.I", "W.I", "O.L", "CUT"];
const TRANS_OUT = ["CUT", "O.L", "W.O", "F.O"];
const CAM_POS   = ["Tracking", "Fix", "Pan"];

const STATUS = {
  OK:   { label: "OK",   color: C.green },
  NG:   { label: "NG",   color: C.red },
  KEEP: { label: "KEEP", color: C.gold },
};

let cutSeq = Date.now();
function newCut() {
  cutSeq += 1;
  return {
    id: cutSeq,
    scene: "", cut: "", sceneDesc: "",
    weather: "", mden: "", sol: "",
    wb: "", lense: "", filter: "", exp: "", roll: "",
    continuity: "", cameraPos: "", sound: "", bg: "", action: "",
    transIn: "", transOut: "",
    takes: [], // { t, status, time, r, content, slate }
  };
}

function fmtTime(s) {
  const m = Math.floor(s / 60), x = s % 60;
  return String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export default function Scripter({ onBack }) {
  const [prod, setProd] = useState(() => {
    try { const v = localStorage.getItem(PROD_KEY); if (v) return JSON.parse(v); } catch {}
    return { title: "", director: "", scripter: "", date: "", startT: "", endT: "", location: "" };
  });
  const [cuts, setCuts] = useState(() => {
    try { const v = localStorage.getItem(CUTS_KEY); if (v) return JSON.parse(v); } catch {}
    return [];
  });
  const [activeCutId, setActiveCutId] = useState(null);
  const [showProd, setShowProd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // 빠른 기록 입력
  const [curR, setCurR] = useState("");
  const [curContent, setCurContent] = useState("");
  const [curSlate, setCurSlate] = useState("");
  // 타이머
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(PROD_KEY, JSON.stringify(prod)); } catch {} }, [prod]);
  useEffect(() => { try { localStorage.setItem(CUTS_KEY, JSON.stringify(cuts)); } catch {} }, [cuts]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const activeCut = cuts.find(c => c.id === activeCutId) || null;

  const updateCut = (id, patch) => {
    setCuts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const addCut = () => {
    const c = newCut();
    // 직전 컷의 씬 번호 이어받기
    const last = cuts[cuts.length - 1];
    if (last) { c.scene = last.scene; c.cut = String((parseInt(last.cut) || 0) + 1); }
    else { c.scene = "1"; c.cut = "1"; }
    setCuts(prev => [...prev, c]);
    setActiveCutId(c.id);
    setShowDetail(false);
  };

  const deleteCut = (id) => {
    if (!window.confirm("이 컷을 삭제할까요? (테이크 기록도 함께 삭제)")) return;
    setCuts(prev => prev.filter(c => c.id !== id));
    if (activeCutId === id) setActiveCutId(null);
  };

  const toggleTimer = () => {
    if (running) {
      clearInterval(timerRef.current);
      setRunning(false);
    } else {
      setSec(0);
      setRunning(true);
      timerRef.current = setInterval(() => setSec(s => s + 1), 1000);
    }
  };

  const recordTake = (status) => {
    if (!activeCut) return;
    const nextT = activeCut.takes.length > 0 ? Math.max(...activeCut.takes.map(t => t.t)) + 1 : 1;
    const dur = sec;
    const take = {
      t: nextT, status,
      time: dur > 0 ? fmtTime(dur) : "",
      r: curR, content: curContent, slate: curSlate,
    };
    updateCut(activeCut.id, { takes: [...activeCut.takes, take] });
    // 리셋
    setCurR(""); setCurContent(""); setCurSlate("");
    if (running) { clearInterval(timerRef.current); setRunning(false); }
    setSec(0);
  };

  const deleteTake = (cutId, t) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return;
    updateCut(cutId, { takes: cut.takes.filter(tk => tk.t !== t) });
  };

  // ── 내보내기 ──
  const exportForm = (targetCuts) => {
    const pages = [];
    targetCuts.forEach((cut, ci) => {
      const chunks = [];
      if (cut.takes.length === 0) chunks.push([]);
      else for (let i = 0; i < cut.takes.length; i += 10) chunks.push(cut.takes.slice(i, i + 10));
      chunks.forEach((chunk, idx) => {
        pages.push(buildPageHTML(prod, cut, chunk, `${ci + 1}${chunks.length > 1 ? "-" + (idx + 1) : ""}`));
      });
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>스크립트 용지</title>
<style>${FORM_CSS}</style></head><body>${pages.join("")}
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("팝업이 차단되었습니다. 브라우저 팝업을 허용해주세요."); return; }
    w.document.write(html);
    w.document.close();
  };

  // ===== 렌더 =====
  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
        <button onClick={activeCut ? () => setActiveCutId(null) : onBack}
          style={{
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            color: C.text, fontSize: 12, fontWeight: 600,
            padding: "7px 14px", borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_GOTHIC,
            touchAction: "manipulation",
          }}>
          <span style={{ color: C.gold }}>←</span> {activeCut ? "컷 목록" : "도구"}
        </button>
        <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>
          📝 SCRIPTER
        </span>
        <div style={{ width: 60 }} />
      </div>

      {!activeCut ? (
        // ===== 컷 목록 화면 =====
        <div>
          {/* 작품 정보 (접이식) */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14, overflow: "hidden" }}>
            <button onClick={() => setShowProd(s => !s)}
              style={{
                width: "100%", background: "transparent", border: "none", cursor: "pointer",
                padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                color: C.text, fontFamily: FONT_GOTHIC, touchAction: "manipulation",
              }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                🎬 {prod.title || "작품 정보"}
              </span>
              <span style={{ color: C.gold, fontSize: 12 }}>{showProd ? "▲" : "▼"}</span>
            </button>
            {showProd && (
              <div style={{ padding: "0 14px 14px" }}>
                <Field label="제목" value={prod.title} onChange={v => setProd({ ...prod, title: v })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="감독" value={prod.director} onChange={v => setProd({ ...prod, director: v })} flex />
                  <Field label="스크립터" value={prod.scripter} onChange={v => setProd({ ...prod, scripter: v })} flex />
                </div>
                <Field label="촬영일 (예: 2026. 6. 7 (토))" value={prod.date} onChange={v => setProd({ ...prod, date: v })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="시작" value={prod.startT} onChange={v => setProd({ ...prod, startT: v })} flex />
                  <Field label="끝" value={prod.endT} onChange={v => setProd({ ...prod, endT: v })} flex />
                </div>
                <Field label="촬영장소" value={prod.location} onChange={v => setProd({ ...prod, location: v })} />
              </div>
            )}
          </div>

          {/* 컷 목록 */}
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8 }}>
            컷 목록 ({cuts.length})
          </div>
          {cuts.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.mutedDim, fontSize: 13 }}>
              아직 기록한 컷이 없습니다.<br/>아래 버튼으로 첫 컷을 추가하세요.
            </div>
          )}
          {cuts.map(c => {
            const okN = c.takes.filter(t => t.status === "OK").length;
            return (
              <div key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                <div onClick={() => { setActiveCutId(c.id); setShowDetail(false); }} style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 800, color: C.gold }}>
                    S{c.scene || "?"} · C{c.cut || "?"}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    테이크 {c.takes.length} · OK {okN}
                    {c.sceneDesc ? ` · ${c.sceneDesc.slice(0, 16)}` : ""}
                  </div>
                </div>
                <button onClick={() => deleteCut(c.id)}
                  style={{ background: "transparent", border: "none", color: C.mutedDim, fontSize: 16, cursor: "pointer", padding: 4, touchAction: "manipulation" }}>
                  🗑
                </button>
              </div>
            );
          })}

          {/* 새 컷 + 내보내기 */}
          <button onClick={addCut}
            style={{
              width: "100%", marginTop: 8, padding: "14px", minHeight: 48,
              background: C.gold, color: "#0a0a0a", border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 800, fontFamily: FONT_GOTHIC, cursor: "pointer",
              touchAction: "manipulation",
            }}>
            + 새 컷 추가
          </button>

          {cuts.length > 0 && (
            <button onClick={() => exportForm(cuts)}
              style={{
                width: "100%", marginTop: 8, padding: "12px", minHeight: 46,
                background: C.surface, color: C.text, border: `1px solid ${C.gold}`, borderRadius: 8,
                fontSize: 13, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: "pointer",
                touchAction: "manipulation",
              }}>
              🖨 전체 양식 인쇄 / PDF 저장
            </button>
          )}
        </div>
      ) : (
        // ===== 컷 상세 (테이크 로그) 화면 =====
        <div>
          {/* 씬/컷 헤더 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, textAlign: "center", marginBottom: 3 }}>SCENE</div>
              <input value={activeCut.scene} onChange={e => updateCut(activeCut.id, { scene: e.target.value })}
                style={inputBig} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, textAlign: "center", marginBottom: 3 }}>CUT</div>
              <input value={activeCut.cut} onChange={e => updateCut(activeCut.id, { cut: e.target.value })}
                style={inputBig} />
            </div>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, textAlign: "center", marginBottom: 3 }}>씬 설명</div>
              <input value={activeCut.sceneDesc} onChange={e => updateCut(activeCut.id, { sceneDesc: e.target.value })}
                placeholder="간단히" style={{ ...inputBig, fontSize: 13 }} />
            </div>
          </div>

          {/* 컷 상세 정보 (접이식) */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => setShowDetail(s => !s)}
              style={{
                width: "100%", background: "transparent", border: "none", cursor: "pointer",
                padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                color: C.text, fontFamily: FONT_GOTHIC, touchAction: "manipulation",
              }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>⚙ 컷 상세 (카메라·연속성·콘티)</span>
              <span style={{ color: C.gold, fontSize: 12 }}>{showDetail ? "▲" : "▼"}</span>
            </button>
            {showDetail && (
              <div style={{ padding: "0 14px 14px" }}>
                {/* 시간대 / 광선 */}
                <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                  <ToggleRow label="시간대" options={MDEN} value={activeCut.mden} onSelect={v => updateCut(activeCut.id, { mden: v })} />
                  <ToggleRow label="광선" options={SOL} value={activeCut.sol} onSelect={v => updateCut(activeCut.id, { sol: v })} />
                </div>
                <Field label="날씨 / 광선" value={activeCut.weather} onChange={v => updateCut(activeCut.id, { weather: v })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="W.B" value={activeCut.wb} onChange={v => updateCut(activeCut.id, { wb: v })} flex />
                  <Field label="Lense" value={activeCut.lense} onChange={v => updateCut(activeCut.id, { lense: v })} flex />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="Filter" value={activeCut.filter} onChange={v => updateCut(activeCut.id, { filter: v })} flex />
                  <Field label="Exp." value={activeCut.exp} onChange={v => updateCut(activeCut.id, { exp: v })} flex />
                  <Field label="Roll #" value={activeCut.roll} onChange={v => updateCut(activeCut.id, { roll: v })} flex />
                </div>
                <ToggleRow label="카메라 위치" options={CAM_POS} value={activeCut.cameraPos} onSelect={v => updateCut(activeCut.id, { cameraPos: v })} wide />
                <FieldArea label="연결 (Continuity)" value={activeCut.continuity} onChange={v => updateCut(activeCut.id, { continuity: v })} />
                <FieldArea label="지문과 대사 (Action & Dialogue)" value={activeCut.action} onChange={v => updateCut(activeCut.id, { action: v })} />
                <FieldArea label="사운드 (Sound)" value={activeCut.sound} onChange={v => updateCut(activeCut.id, { sound: v })} />
                <Field label="B.G" value={activeCut.bg} onChange={v => updateCut(activeCut.id, { bg: v })} />
                {/* 트랜지션 */}
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <ToggleRow label="시작 트랜지션" options={TRANS_IN} value={activeCut.transIn} onSelect={v => updateCut(activeCut.id, { transIn: v })} />
                  <ToggleRow label="끝 트랜지션" options={TRANS_OUT} value={activeCut.transOut} onSelect={v => updateCut(activeCut.id, { transOut: v })} />
                </div>
              </div>
            )}
          </div>

          {/* 타이머 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={toggleTimer}
              style={{
                flex: 1, padding: "11px", minHeight: 46,
                background: running ? C.red : C.surface,
                color: running ? "#fff" : C.text,
                border: `1px solid ${running ? C.red : C.border}`,
                borderRadius: 8, fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO,
                cursor: "pointer", touchAction: "manipulation",
              }}>
              {running ? "■ CUT" : "▶ ACTION"}
            </button>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_MONO, color: running ? C.red : C.gold, minWidth: 80, textAlign: "center" }}>
              {fmtTime(sec)}
            </span>
          </div>

          {/* 입력: R# / 내용 / Slate */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={curR} onChange={e => setCurR(e.target.value)} placeholder="R#"
              style={{ ...inputSm, width: 70 }} />
            <input value={curSlate} onChange={e => setCurSlate(e.target.value)} placeholder="Slate"
              style={{ ...inputSm, width: 80 }} />
          </div>
          <input value={curContent} onChange={e => setCurContent(e.target.value)} placeholder="내용 (연기·연속성·NG 사유 등)"
            style={{ ...inputSm, width: "100%", marginBottom: 10 }} />

          {/* OK / NG / KEEP */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {Object.entries(STATUS).map(([key, s]) => (
              <button key={key} onClick={() => recordTake(key)}
                style={{
                  padding: "13px 0", minHeight: 48,
                  background: C.surface, color: s.color,
                  border: `1px solid ${s.color}`, borderRadius: 8,
                  fontSize: 15, fontWeight: 800, fontFamily: FONT_MONO,
                  cursor: "pointer", touchAction: "manipulation",
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* 테이크 로그 */}
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8 }}>
            테이크 로그 ({activeCut.takes.length})
          </div>
          {activeCut.takes.length === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0", color: C.mutedDim, fontSize: 12 }}>
              OK / NG / KEEP 을 눌러 테이크를 기록하세요
            </div>
          )}
          {[...activeCut.takes].reverse().map(tk => {
            const s = STATUS[tk.status];
            return (
              <div key={tk.t}
                style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 11px", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 800, minWidth: 26 }}>T{tk.t}</span>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: FONT_MONO, color: s.color, minWidth: 38 }}>{s.label}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tk.content || "—"}
                </span>
                {tk.time && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.mutedDim }}>{tk.time}</span>}
                <button onClick={() => deleteTake(activeCut.id, tk.t)}
                  style={{ background: "transparent", border: "none", color: C.mutedDim, fontSize: 13, cursor: "pointer", padding: 2, touchAction: "manipulation" }}>✕</button>
              </div>
            );
          })}

          {/* 이 컷 내보내기 */}
          <button onClick={() => exportForm([activeCut])}
            style={{
              width: "100%", marginTop: 12, padding: "12px", minHeight: 46,
              background: C.surface, color: C.text, border: `1px solid ${C.gold}`, borderRadius: 8,
              fontSize: 13, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: "pointer",
              touchAction: "manipulation",
            }}>
            🖨 이 컷 양식 인쇄 / PDF
          </button>
          <div style={{ height: 8 }} />
        </div>
      )}
    </div>
  );
}

// ── 입력 헬퍼들 ──
const inputBig = {
  width: "100%", boxSizing: "border-box", textAlign: "center",
  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
  fontSize: 20, fontWeight: 800, fontFamily: FONT_MONO,
  padding: "8px 4px", borderRadius: 6, outline: "none",
};
const inputSm = {
  boxSizing: "border-box",
  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
  fontSize: 13, fontFamily: FONT_GOTHIC,
  padding: "9px 10px", borderRadius: 6, outline: "none",
};

function Field({ label, value, onChange, flex }) {
  return (
    <div style={{ marginBottom: 8, flex: flex ? 1 : undefined, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, marginBottom: 3, letterSpacing: "0.05em" }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ ...inputSm, width: "100%" }} />
    </div>
  );
}

function FieldArea({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, marginBottom: 3, letterSpacing: "0.05em" }}>{label}</div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
        style={{ ...inputSm, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
    </div>
  );
}

function ToggleRow({ label, options, value, onSelect, wide }) {
  return (
    <div style={{ marginBottom: 8, flex: wide ? "none" : 1 }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, marginBottom: 4, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {options.map(o => {
          const active = value === o;
          return (
            <button key={o} onClick={() => onSelect(active ? "" : o)}
              style={{
                padding: "6px 10px", minHeight: 32,
                background: active ? C.gold : "transparent",
                color: active ? "#0a0a0a" : C.muted,
                border: `1px solid ${active ? C.gold : C.border}`,
                borderRadius: 5, fontSize: 11, fontWeight: active ? 800 : 700,
                fontFamily: FONT_MONO, cursor: "pointer", touchAction: "manipulation",
              }}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TPP 양식 HTML 빌더 ──
function circ(opts, val) {
  return opts.map(o => val === o ? `<b style="text-decoration:underline">${o}</b>` : o).join(" ");
}

function buildPageHTML(prod, cut, takes, pageNo) {
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const tk = takes[i];
    rows.push(`<tr>
      <td class="tn">${i + 1}</td>
      <td>${tk ? esc(tk.status) : ""}</td>
      <td>${tk ? esc(tk.time) : ""}</td>
      <td class="rcol">${tk ? esc(tk.r) : ""}</td>
      <td class="content">${tk ? esc(tk.content) : ""}</td>
      <td>${tk ? esc(tk.slate) : ""}</td>
    </tr>`);
  }
  return `<div class="page">
  <div class="top">
    <div class="title">제목: ${esc(prod.title)}</div>
    <div class="ctitle">스크립트 용지 / SCRIPT PAPER</div>
    <div class="pageinfo">PAGE NO. ${esc(pageNo)}<br>감독 : ${esc(prod.director)}<br>스크립터 : ${esc(prod.scripter)}</div>
  </div>
  <div class="dateline">${esc(prod.date) || "년. 월. 일 (. )"} &nbsp; 촬영시작 : ${esc(prod.startT)} &nbsp; 끝 : ${esc(prod.endT)} &nbsp; 촬영장소 : ${esc(prod.location)}</div>

  <table class="info">
    <tr>
      <td class="lbl">S#</td><td class="v">${esc(cut.scene)}</td>
      <td class="lbl">C#</td><td class="v">${esc(cut.cut)}</td>
      <td class="desc">${esc(cut.sceneDesc)}</td>
      <td class="lbl">날씨/광선</td><td class="v">${esc(cut.weather)}</td>
      <td class="mden">${circ(["M","D","E","N"], cut.mden)}<br>${circ(["S","O","L"], cut.sol)}</td>
    </tr>
    <tr>
      <td class="lbl">W.B</td><td class="v">${esc(cut.wb)}</td>
      <td class="lbl">Lense</td><td class="v">${esc(cut.lense)}</td>
      <td class="lbl">Filter</td><td class="v">${esc(cut.filter)}</td>
      <td class="lbl">Exp.</td><td class="v">${esc(cut.exp)}</td>
      <td class="lbl">Roll#</td>
    </tr>
  </table>

  <table class="body">
    <tr>
      <td class="bl">
        <div class="seclbl">연결 : Continuity</div>
        <div class="secval">${esc(cut.continuity)}</div>
        <div class="seclbl mt">카메라 위치 [ ${circ(["Tracking","Fix","Pan"], cut.cameraPos)} ]</div>
        <div class="seclbl mt">사운드 : Sound</div>
        <div class="secval">${esc(cut.sound)}</div>
        <div class="seclbl">B.G ${esc(cut.bg)}</div>
      </td>
      <td class="br">
        <div class="seclbl">지문과 대사 / Action &amp; Dialogue</div>
        <div class="secval">${esc(cut.action)}</div>
        <div class="trans">
          ${["F.I","W.I","O.L","CUT"].map(o => `<span class="${cut.transIn===o?'on':''}">${o}</span>`).join("")}
          <span class="arrow">→</span>
          ${["CUT","O.L","W.O","F.O"].map(o => `<span class="${cut.transOut===o?'on':''}">${o}</span>`).join("")}
        </div>
      </td>
    </tr>
  </table>

  <table class="takes">
    <tr class="th"><th class="tn">T#</th><th>OK/NG</th><th>TIME</th><th class="rcol">R#</th><th>내　용</th><th>Slate</th></tr>
    ${rows.join("")}
  </table>
  <div class="footer">TPP 스크립트 용지</div>
</div>`;
}

const FORM_CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #000; }
.page { width: 190mm; min-height: 277mm; margin: 0 auto; padding: 8mm; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.title { font-size: 13px; font-weight: bold; flex: 1; }
.ctitle { font-size: 15px; font-weight: bold; text-align: center; flex: 1; }
.pageinfo { font-size: 11px; text-align: right; flex: 1; line-height: 1.5; }
.dateline { font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
table { border-collapse: collapse; width: 100%; }
.info td { border: 1px solid #000; font-size: 11px; padding: 4px 6px; height: 24px; }
.info .lbl { background: #eee; font-weight: bold; white-space: nowrap; width: 1%; }
.info .v { min-width: 40px; }
.info .desc { width: 30%; }
.info .mden { text-align: center; font-weight: bold; letter-spacing: 2px; white-space: nowrap; line-height: 1.6; }
.body { margin-top: 0; border: 1px solid #000; }
.body td { border: 1px solid #000; vertical-align: top; padding: 6px; width: 50%; }
.body .bl { height: 360px; }
.seclbl { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
.seclbl.mt { margin-top: 14px; }
.secval { font-size: 11px; white-space: pre-wrap; line-height: 1.5; min-height: 40px; }
.trans { margin-top: 16px; display: flex; gap: 6px; align-items: center; font-size: 11px; border-top: 1px solid #000; padding-top: 4px; }
.trans span { padding: 1px 3px; }
.trans .on { background: #000; color: #fff; font-weight: bold; }
.trans .arrow { flex: 1; text-align: center; }
.takes { margin-top: 0; }
.takes th, .takes td { border: 1px solid #000; font-size: 11px; padding: 3px 5px; height: 22px; text-align: center; }
.takes .th th { background: #eee; }
.takes .tn { width: 24px; background: #f5f5f5; }
.takes .rcol { width: 36px; background: #ddd; }
.takes .content { text-align: left; }
.footer { text-align: right; font-size: 11px; margin-top: 4px; }
@page { size: A4 portrait; margin: 8mm; }
`;
