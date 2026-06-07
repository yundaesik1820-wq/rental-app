import { useState, useEffect, useRef } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * 📝 스크립터 (TPP 스크립트 용지) — 원본 PDF 채우기 방식
 *
 * - 컷(S#-C#) 단위 기록 + 빠른 테이크 로그 (OK/NG/KEEP + 타이머)
 * - 컷별 상세: 씬정보 / 카메라세팅 / 연속성·카메라위치·사운드·B.G·지문대사 / 트랜지션
 * - localStorage 자동 저장
 * - 내보내기: 원본 양식 PDF(public/forms/script-paper.pdf) 위에 좌표로 데이터를 그려
 *   양식과 100% 동일한 PDF 생성 → 새 탭에서 열기 / 저장
 *
 * 준비물 (앱 public 폴더):
 *   public/forms/script-paper.pdf   ← 업로드한 빈 양식
 *   public/fonts/NanumGothic.ttf    ← 한글 폰트
 * 그리고: npm install pdf-lib @pdf-lib/fontkit
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const C = {
  surface: "#1a1a1a", border: "#2a2a2a",
  text: "#fafaf9", muted: "#a8a29e", mutedDim: "#71706b",
  gold: "#fbbf24", red: "#dc2626", green: "#22c55e",
};

const PROD_KEY = "scripter_prod_v2";
const CUTS_KEY = "scripter_cuts_v1";
const FORM_URL = "/forms/script-paper.pdf";
const FONT_URL = "/fonts/NanumGothic.ttf";

const MDEN = ["M", "D", "E", "N"];
const SOL  = ["S", "O", "L"];
const TRANS_IN  = ["F.I", "W.I", "O.L", "CUT"];
const TRANS_OUT = ["CUT", "O.L", "W.O", "F.O"];
const CAM_POS   = ["Tracking", "Fix", "Pan"];

const STATUS = {
  OK:   { label: "OK",   color: C.green },
  NG:   { label: "NG",   color: C.red },
  KEEP: { label: "KEEP", color: C.gold },
};

// ── 양식 좌표 (PyMuPDF 분석, 좌상단 기준 y) ──
const PH = 841.89; // 페이지 높이 pt
const F = {
  title:    { x: 88,  y: 36, s: 11 },
  pageNo:   { x: 522, y: 24, s: 10 },
  director: { x: 519, y: 40, s: 10 },
  scripter: { x: 518, y: 55, s: 10 },
  year:   { x: 40,  y: 79, s: 9 },
  month:  { x: 84,  y: 79, s: 9 },
  day:    { x: 122, y: 79, s: 9 },
  dow:    { x: 167, y: 79, s: 8 },
  startT: { x: 256, y: 79, s: 9 },
  endT:   { x: 379, y: 79, s: 9 },
  location:{ x: 474, y: 79, s: 9 },
  scene:  { x: 52,  y: 101, s: 10 },
  cut:    { x: 110, y: 101, s: 10 },
  sceneDesc:{ x: 192, y: 101, s: 9 },
  weather:{ x: 437, y: 101, s: 8 },
  wb:     { x: 57,  y: 130, s: 9 },
  lense:  { x: 170, y: 130, s: 9 },
  filter: { x: 281, y: 130, s: 9 },
  exp:    { x: 391, y: 130, s: 9 },
  roll:   { x: 499, y: 130, s: 9 },
  sound:  { x: 110, y: 528, s: 9 },
  bg:     { x: 55,  y: 580, s: 9 },
};
// 멀티라인 영역 {x, y(top), w, lineHeight, size}
const AREA = {
  continuity: { x: 40,  y: 170, w: 335, lh: 12, s: 9 },
  action:     { x: 253, y: 175, w: 315, lh: 12, s: 9 },
};
// 선택 표시용 글자 중심 좌표 [cx, cy] (좌상단 y)
const MDEN_POS = { M: [514.8, 104], D: [531, 104], E: [545.6, 104], N: [560.3, 104] };
const SOL_POS  = { S: [519.8, 117], O: [537.8, 117], L: [555.8, 117] };
const CAM_XY   = { Tracking: [120.9, 283, 21], Fix: [156.5, 283, 9], Pan: [181.8, 283, 11] };
const TIN_POS  = { "F.I": [262, 585], "W.I": [293, 585], "O.L": [328, 585], "CUT": [364, 585] };
const TOUT_POS = { "CUT": [452, 585], "O.L": [487, 585], "W.O": [524, 585], "F.O": [557, 585] };
// 테이크 테이블
const TAKE_ROW_Y = [612.6, 630.2, 647.7, 665.2, 682.7, 700.3, 717.8, 735.3, 752.8, 770.3];
const TAKE_COL = { okng: 72.5, time: 118.5, r: 162, content: 187, slate: 557 };
const BLACK = rgb(0, 0, 0);

let cutSeq = Date.now();
function newCut() {
  cutSeq += 1;
  return {
    id: cutSeq, scene: "", cut: "", sceneDesc: "",
    weather: "", mden: "", sol: "",
    wb: "", lense: "", filter: "", exp: "", roll: "",
    continuity: "", cameraPos: "", sound: "", bg: "", action: "",
    transIn: "", transOut: "", takes: [],
  };
}

function fmtTime(s) {
  const m = Math.floor(s / 60), x = s % 60;
  return String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
}

export default function Scripter({ onBack }) {
  const [prod, setProd] = useState(() => {
    try { const v = localStorage.getItem(PROD_KEY); if (v) return JSON.parse(v); } catch {}
    return { title: "", director: "", scripter: "", year: "", month: "", day: "", dow: "", startT: "", endT: "", location: "" };
  });
  const [cuts, setCuts] = useState(() => {
    try { const v = localStorage.getItem(CUTS_KEY); if (v) return JSON.parse(v); } catch {}
    return [];
  });
  const [activeCutId, setActiveCutId] = useState(null);
  const [showProd, setShowProd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [curR, setCurR] = useState("");
  const [curContent, setCurContent] = useState("");
  const [curSlate, setCurSlate] = useState("");
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(PROD_KEY, JSON.stringify(prod)); } catch {} }, [prod]);
  useEffect(() => { try { localStorage.setItem(CUTS_KEY, JSON.stringify(cuts)); } catch {} }, [cuts]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const activeCut = cuts.find(c => c.id === activeCutId) || null;
  const updateCut = (id, patch) => setCuts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  const addCut = () => {
    const c = newCut();
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
    if (running) { clearInterval(timerRef.current); setRunning(false); }
    else { setSec(0); setRunning(true); timerRef.current = setInterval(() => setSec(s => s + 1), 1000); }
  };

  const recordTake = (status) => {
    if (!activeCut) return;
    const nextT = activeCut.takes.length > 0 ? Math.max(...activeCut.takes.map(t => t.t)) + 1 : 1;
    const take = { t: nextT, status, time: sec > 0 ? fmtTime(sec) : "", r: curR, content: curContent, slate: curSlate };
    updateCut(activeCut.id, { takes: [...activeCut.takes, take] });
    setCurR(""); setCurContent(""); setCurSlate("");
    if (running) { clearInterval(timerRef.current); setRunning(false); }
    setSec(0);
  };

  const deleteTake = (cutId, t) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return;
    updateCut(cutId, { takes: cut.takes.filter(tk => tk.t !== t) });
  };

  // ── PDF 내보내기 ──
  const exportPDF = async (targetCuts) => {
    setExporting(true);
    try {
      const [formBytes, fontBytes] = await Promise.all([
        fetch(FORM_URL).then(r => { if (!r.ok) throw new Error("form"); return r.arrayBuffer(); }),
        fetch(FONT_URL).then(r => { if (!r.ok) throw new Error("font"); return r.arrayBuffer(); }),
      ]);
      const out = await PDFDocument.create();
      out.registerFontkit(fontkit);
      const font = await out.embedFont(fontBytes, { subset: false });

      for (const cut of targetCuts) {
        const chunks = [];
        if (cut.takes.length === 0) chunks.push([]);
        else for (let i = 0; i < cut.takes.length; i += 10) chunks.push(cut.takes.slice(i, i + 10));

        for (let ci = 0; ci < chunks.length; ci++) {
          const tmpl = await PDFDocument.load(formBytes);
          const [page] = await out.copyPages(tmpl, [0]);
          out.addPage(page);
          drawCut(page, font, prod, cut, chunks[ci]);
        }
      }

      const bytes = await out.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (e.message === "form") alert("양식 PDF를 찾을 수 없습니다.\npublic/forms/script-paper.pdf 를 넣어주세요.");
      else if (e.message === "font") alert("한글 폰트를 찾을 수 없습니다.\npublic/fonts/NanumGothic.ttf 를 넣어주세요.");
      else alert("PDF 생성 실패: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
        <button onClick={activeCut ? () => setActiveCutId(null) : onBack}
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: C.text, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_GOTHIC, touchAction: "manipulation" }}>
          <span style={{ color: C.gold }}>←</span> {activeCut ? "컷 목록" : "도구"}
        </button>
        <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>📝 SCRIPTER</span>
        <div style={{ width: 60 }} />
      </div>

      {!activeCut ? (
        <div>
          {/* 작품 정보 */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14, overflow: "hidden" }}>
            <button onClick={() => setShowProd(s => !s)}
              style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text, fontFamily: FONT_GOTHIC, touchAction: "manipulation" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>🎬 {prod.title || "작품 정보"}</span>
              <span style={{ color: C.gold, fontSize: 12 }}>{showProd ? "▲" : "▼"}</span>
            </button>
            {showProd && (
              <div style={{ padding: "0 14px 14px" }}>
                <Field label="제목" value={prod.title} onChange={v => setProd({ ...prod, title: v })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="감독" value={prod.director} onChange={v => setProd({ ...prod, director: v })} flex />
                  <Field label="스크립터" value={prod.scripter} onChange={v => setProd({ ...prod, scripter: v })} flex />
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, marginBottom: 3, letterSpacing: "0.05em" }}>촬영일</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input value={prod.year} onChange={e => setProd({ ...prod, year: e.target.value })} placeholder="년" style={{ ...inputSm, flex: 1.3, minWidth: 0 }} />
                  <input value={prod.month} onChange={e => setProd({ ...prod, month: e.target.value })} placeholder="월" style={{ ...inputSm, flex: 1, minWidth: 0 }} />
                  <input value={prod.day} onChange={e => setProd({ ...prod, day: e.target.value })} placeholder="일" style={{ ...inputSm, flex: 1, minWidth: 0 }} />
                  <input value={prod.dow} onChange={e => setProd({ ...prod, dow: e.target.value })} placeholder="요일" style={{ ...inputSm, flex: 1, minWidth: 0 }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="촬영시작" value={prod.startT} onChange={v => setProd({ ...prod, startT: v })} flex />
                  <Field label="끝" value={prod.endT} onChange={v => setProd({ ...prod, endT: v })} flex />
                </div>
                <Field label="촬영장소" value={prod.location} onChange={v => setProd({ ...prod, location: v })} />
              </div>
            )}
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8 }}>컷 목록 ({cuts.length})</div>
          {cuts.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.mutedDim, fontSize: 13 }}>
              아직 기록한 컷이 없습니다.<br/>아래 버튼으로 첫 컷을 추가하세요.
            </div>
          )}
          {cuts.map(c => {
            const okN = c.takes.filter(t => t.status === "OK").length;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                <div onClick={() => { setActiveCutId(c.id); setShowDetail(false); }} style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 800, color: C.gold }}>S{c.scene || "?"} · C{c.cut || "?"}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    테이크 {c.takes.length} · OK {okN}{c.sceneDesc ? ` · ${c.sceneDesc.slice(0, 16)}` : ""}
                  </div>
                </div>
                <button onClick={() => deleteCut(c.id)} style={{ background: "transparent", border: "none", color: C.mutedDim, fontSize: 16, cursor: "pointer", padding: 4, touchAction: "manipulation" }}>🗑</button>
              </div>
            );
          })}

          <button onClick={addCut} style={{ width: "100%", marginTop: 8, padding: "14px", minHeight: 48, background: C.gold, color: "#0a0a0a", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: FONT_GOTHIC, cursor: "pointer", touchAction: "manipulation" }}>
            + 새 컷 추가
          </button>
          {cuts.length > 0 && (
            <button onClick={() => exportPDF(cuts)} disabled={exporting}
              style={{ width: "100%", marginTop: 8, padding: "12px", minHeight: 46, background: C.surface, color: C.text, border: `1px solid ${C.gold}`, borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.6 : 1, touchAction: "manipulation" }}>
              {exporting ? "PDF 생성 중..." : "📄 전체 PDF 저장 / 열기"}
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* 씬/컷 헤더 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, textAlign: "center", marginBottom: 3 }}>SCENE</div>
              <input value={activeCut.scene} onChange={e => updateCut(activeCut.id, { scene: e.target.value })} style={inputBig} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, textAlign: "center", marginBottom: 3 }}>CUT</div>
              <input value={activeCut.cut} onChange={e => updateCut(activeCut.id, { cut: e.target.value })} style={inputBig} />
            </div>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO, textAlign: "center", marginBottom: 3 }}>씬 설명</div>
              <input value={activeCut.sceneDesc} onChange={e => updateCut(activeCut.id, { sceneDesc: e.target.value })} placeholder="간단히" style={{ ...inputBig, fontSize: 13 }} />
            </div>
          </div>

          {/* 컷 상세 */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => setShowDetail(s => !s)}
              style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text, fontFamily: FONT_GOTHIC, touchAction: "manipulation" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>⚙ 컷 상세 (카메라·연속성·콘티)</span>
              <span style={{ color: C.gold, fontSize: 12 }}>{showDetail ? "▲" : "▼"}</span>
            </button>
            {showDetail && (
              <div style={{ padding: "0 14px 14px" }}>
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
              style={{ flex: 1, padding: "11px", minHeight: 46, background: running ? C.red : C.surface, color: running ? "#fff" : C.text, border: `1px solid ${running ? C.red : C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO, cursor: "pointer", touchAction: "manipulation" }}>
              {running ? "■ CUT" : "▶ ACTION"}
            </button>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_MONO, color: running ? C.red : C.gold, minWidth: 80, textAlign: "center" }}>{fmtTime(sec)}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={curR} onChange={e => setCurR(e.target.value)} placeholder="R#" style={{ ...inputSm, width: 70 }} />
            <input value={curSlate} onChange={e => setCurSlate(e.target.value)} placeholder="Slate" style={{ ...inputSm, width: 80 }} />
          </div>
          <input value={curContent} onChange={e => setCurContent(e.target.value)} placeholder="내용 (연기·연속성·NG 사유 등)" style={{ ...inputSm, width: "100%", marginBottom: 10 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {Object.entries(STATUS).map(([key, s]) => (
              <button key={key} onClick={() => recordTake(key)}
                style={{ padding: "13px 0", minHeight: 48, background: C.surface, color: s.color, border: `1px solid ${s.color}`, borderRadius: 8, fontSize: 15, fontWeight: 800, fontFamily: FONT_MONO, cursor: "pointer", touchAction: "manipulation" }}>
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8 }}>테이크 로그 ({activeCut.takes.length})</div>
          {activeCut.takes.length === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0", color: C.mutedDim, fontSize: 12 }}>OK / NG / KEEP 을 눌러 테이크를 기록하세요</div>
          )}
          {[...activeCut.takes].reverse().map(tk => {
            const s = STATUS[tk.status];
            return (
              <div key={tk.t} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 11px", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 800, minWidth: 26 }}>T{tk.t}</span>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: FONT_MONO, color: s.color, minWidth: 38 }}>{s.label}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tk.content || "—"}</span>
                {tk.time && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.mutedDim }}>{tk.time}</span>}
                <button onClick={() => deleteTake(activeCut.id, tk.t)} style={{ background: "transparent", border: "none", color: C.mutedDim, fontSize: 13, cursor: "pointer", padding: 2, touchAction: "manipulation" }}>✕</button>
              </div>
            );
          })}

          <button onClick={() => exportPDF([activeCut])} disabled={exporting}
            style={{ width: "100%", marginTop: 12, padding: "12px", minHeight: 46, background: C.surface, color: C.text, border: `1px solid ${C.gold}`, borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.6 : 1, touchAction: "manipulation" }}>
            {exporting ? "PDF 생성 중..." : "📄 이 컷 PDF 저장 / 열기"}
          </button>
          <div style={{ height: 8 }} />
        </div>
      )}
    </div>
  );
}

// ── PDF 그리기 ──
function drawCut(page, font, prod, cut, takes) {
  const T = (text, f) => {
    if (text == null || text === "") return;
    page.drawText(String(text), { x: f.x, y: PH - f.y - f.s, size: f.s, font, color: BLACK });
  };
  const Tc = (text, cx, yTop, size) => {
    if (text == null || text === "") return;
    const w = font.widthOfTextAtSize(String(text), size);
    page.drawText(String(text), { x: cx - w / 2, y: PH - yTop - size, size, font, color: BLACK });
  };
  const circle = (cx, cy, rx) => {
    page.drawEllipse({ x: cx, y: PH - cy, xScale: rx, yScale: 8, borderColor: BLACK, borderWidth: 1, opacity: 0, borderOpacity: 1 });
  };
  const wrap = (text, a) => {
    if (!text) return;
    let line = "", y = a.y;
    for (const ch of [...String(text)]) {
      if (ch === "\n") { T(line, { x: a.x, y, s: a.s }); line = ""; y += a.lh; continue; }
      const test = line + ch;
      if (font.widthOfTextAtSize(test, a.s) > a.w) { T(line, { x: a.x, y, s: a.s }); line = ch; y += a.lh; }
      else line = test;
    }
    if (line) T(line, { x: a.x, y, s: a.s });
  };

  // 헤더
  T(prod.title, F.title);
  T(prod.director, F.director);
  T(prod.scripter, F.scripter);
  // 날짜
  T(prod.year, F.year); T(prod.month, F.month); T(prod.day, F.day); T(prod.dow, F.dow);
  T(prod.startT, F.startT); T(prod.endT, F.endT); T(prod.location, F.location);
  // 씬정보
  T(cut.scene, F.scene); T(cut.cut, F.cut); T(cut.sceneDesc, F.sceneDesc); T(cut.weather, F.weather);
  T(cut.wb, F.wb); T(cut.lense, F.lense); T(cut.filter, F.filter); T(cut.exp, F.exp); T(cut.roll, F.roll);
  // 시간대 / 광선 동그라미
  if (cut.mden && MDEN_POS[cut.mden]) circle(MDEN_POS[cut.mden][0], MDEN_POS[cut.mden][1], 8);
  if (cut.sol && SOL_POS[cut.sol]) circle(SOL_POS[cut.sol][0], SOL_POS[cut.sol][1], 7);
  // 메모 영역
  wrap(cut.continuity, AREA.continuity);
  wrap(cut.action, AREA.action);
  T(cut.sound, F.sound);
  T(cut.bg, F.bg);
  // 카메라 위치
  if (cut.cameraPos && CAM_XY[cut.cameraPos]) {
    const [cx, cy, rx] = CAM_XY[cut.cameraPos];
    circle(cx, cy, rx);
  }
  // 트랜지션
  if (cut.transIn && TIN_POS[cut.transIn]) circle(TIN_POS[cut.transIn][0], TIN_POS[cut.transIn][1], 11);
  if (cut.transOut && TOUT_POS[cut.transOut]) circle(TOUT_POS[cut.transOut][0], TOUT_POS[cut.transOut][1], 11);
  // 테이크
  takes.slice(0, 10).forEach((tk, i) => {
    const yTop = TAKE_ROW_Y[i];
    Tc(tk.status, TAKE_COL.okng, yTop, 9);
    Tc(tk.time, TAKE_COL.time, yTop, 9);
    Tc(tk.r, TAKE_COL.r, yTop, 9);
    if (tk.content) page.drawText(String(tk.content), { x: TAKE_COL.content, y: PH - yTop - 9, size: 8.5, font, color: BLACK });
    Tc(tk.slate, TAKE_COL.slate, yTop, 9);
  });
}

// ── 입력 헬퍼 ──
const inputBig = { width: "100%", boxSizing: "border-box", textAlign: "center", background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 20, fontWeight: 800, fontFamily: FONT_MONO, padding: "8px 4px", borderRadius: 6, outline: "none" };
const inputSm = { boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontFamily: FONT_GOTHIC, padding: "9px 10px", borderRadius: 6, outline: "none" };

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
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} style={{ ...inputSm, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
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
              style={{ padding: "6px 10px", minHeight: 32, background: active ? C.gold : "transparent", color: active ? "#0a0a0a" : C.muted, border: `1px solid ${active ? C.gold : C.border}`, borderRadius: 5, fontSize: 11, fontWeight: active ? 800 : 700, fontFamily: FONT_MONO, cursor: "pointer", touchAction: "manipulation" }}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
