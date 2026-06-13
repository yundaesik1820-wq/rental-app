import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   스크립터 — 스크립트 용지 위에 펜으로 작성 + 작품 폴더 관리
   저장: IndexedDB (용량 넉넉)  /  공유: 폴더를 zip(PDF 묶음)으로 내보내기
   양식 배경: /scripts/script-template.png  (내보내기 원본: /scripts/script-template.pdf)
   ============================================================ */

const TEMPLATE_IMG = "/scripts/script-template.png";
const TEMPLATE_PDF = "/scripts/script-template.pdf";
const A4_RATIO = 0.7071; // width / height

/* ───────── IndexedDB 헬퍼 ───────── */
const DB_NAME = "kbas_scripter";
const STORE   = "scripts";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    tx.onsuccess = () => resolve(tx.result || []);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(item);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDel(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ============================================================
   메인 컴포넌트
   ============================================================ */
export default function ScripterTool({ C, onBack }) {
  // view: "folders" | "scripts" | "edit"
  const [view, setView]       = useState("folders");
  const [items, setItems]     = useState([]);     // 전체 데이터 (폴더+스크립트 평면 저장)
  const [loading, setLoading] = useState(true);
  const [curFolder, setCurFolder] = useState(null); // folder id
  const [curScript, setCurScript] = useState(null); // script id

  useEffect(() => {
    (async () => {
      try { setItems(await dbAll()); } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const folders = items.filter(i => i.type === "folder");
  const scriptsOf = (fid) => items.filter(i => i.type === "script" && i.folderId === fid);

  const reload = async () => setItems(await dbAll());

  /* ── 폴더 생성/삭제 ── */
  const addFolder = async () => {
    const name = prompt("작품 폴더 이름을 입력하세요");
    if (!name?.trim()) return;
    await dbPut({ id: uid(), type: "folder", name: name.trim(), createdAt: Date.now() });
    reload();
  };
  const delFolder = async (fid) => {
    if (!window.confirm("이 폴더와 안의 모든 스크립트를 삭제할까요?")) return;
    for (const s of scriptsOf(fid)) await dbDel(s.id);
    await dbDel(fid);
    reload();
  };

  /* ── 스크립트 생성/삭제 ── */
  const addScript = async () => {
    const name = prompt("스크립트 이름 (예: S01 오프닝)");
    if (!name?.trim()) return;
    const s = { id: uid(), type: "script", folderId: curFolder, name: name.trim(),
                pages: [null], createdAt: Date.now(), updatedAt: Date.now() };
    await dbPut(s);
    await reload();
    setCurScript(s.id);
    setView("edit");
  };
  const delScript = async (sid) => {
    if (!window.confirm("이 스크립트를 삭제할까요?")) return;
    await dbDel(sid);
    reload();
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>불러오는 중...</div>;
  }

  /* ── 작성 화면 ── */
  if (view === "edit" && curScript) {
    const script = items.find(i => i.id === curScript);
    if (!script) { setView("scripts"); return null; }
    return (
      <ScriptEditor
        C={C}
        script={script}
        onBack={() => { reload(); setView("scripts"); }}
        onSave={async (pages) => {
          await dbPut({ ...script, pages, updatedAt: Date.now() });
          await reload();
        }}
      />
    );
  }

  /* ── 스크립트 목록 ── */
  if (view === "scripts" && curFolder) {
    const folder = folders.find(f => f.id === curFolder);
    const list = scriptsOf(curFolder);
    return (
      <div style={{ padding: 12 }}>
        <Header C={C} title={folder?.name || "폴더"} onBack={() => setView("folders")} />
        {list.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "24px 0" }}>
            아직 스크립트가 없어요. 아래 버튼으로 시작하세요.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(s => (
            <div key={s.id} style={card(C)}>
              <div onClick={() => { setCurScript(s.id); setView("edit"); }}
                   style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>📝</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{s.pages.length}장 · {new Date(s.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
              <button onClick={() => delScript(s.id)} style={iconBtn(C)} title="삭제">🗑️</button>
            </div>
          ))}
          <button onClick={addScript} style={addBtn(C)}>+ 새 스크립트</button>
        </div>
      </div>
    );
  }

  /* ── 폴더 목록 ── */
  return (
    <div style={{ padding: 12 }}>
      <Header C={C} title="🎬 스크립터" onBack={onBack} />
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
        스크립트 용지에 펜으로 작성하고 작품별로 관리하세요. 기기 안에 저장되니, 중요한 건 폴더를 공유해 백업하세요.
      </div>
      {folders.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "24px 0" }}>
          작품 폴더를 먼저 만들어보세요.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {folders.map(f => (
          <div key={f.id} style={card(C)}>
            <div onClick={() => { setCurFolder(f.id); setView("scripts"); }}
                 style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📁</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>스크립트 {scriptsOf(f.id).length}장</div>
              </div>
            </div>
            <button onClick={() => shareFolder(f, scriptsOf(f.id), C)} style={iconBtn(C)} title="폴더 공유">📤</button>
            <button onClick={() => delFolder(f.id)} style={iconBtn(C)} title="삭제">🗑️</button>
          </div>
        ))}
        <button onClick={addFolder} style={addBtn(C)}>+ 새 작품 폴더</button>
      </div>
    </div>
  );
}

/* ============================================================
   스크립트 작성 에디터 (양식 배경 + 펜 레이어, 페이지 여러 장)
   ============================================================ */
function ScriptEditor({ C, script, onBack, onSave }) {
  const [pages, setPages] = useState(script.pages.length ? script.pages : [null]); // 각 원소 = dataURL or null
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  const updatePage = (idx, dataUrl) => {
    setPages(prev => { const n = [...prev]; n[idx] = dataUrl; return n; });
    dirty.current = true;
  };
  const addPage = () => { setPages(prev => [...prev, null]); dirty.current = true; };

  const save = async () => {
    setSaving(true);
    await onSave(pages);
    dirty.current = false;
    setSaving(false);
  };

  const back = async () => {
    if (dirty.current) await onSave(pages);
    onBack();
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 10, background: C.surface,
        borderBottom: `1px solid ${C.border}`, padding: "10px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button onClick={back} style={{ ...iconBtn(C), fontSize: 13 }}>← 목록</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 8px" }}>{script.name}</div>
        <button onClick={save} disabled={saving}
          style={{ background: (C.navy||C.red||"#1A2B6B"), color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 16 }}>
        {pages.map((data, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textAlign: "center" }}>— {i + 1} / {pages.length} —</div>
            <PenPage C={C} initial={data} onChange={(d) => updatePage(i, d)} />
          </div>
        ))}
        <button onClick={addPage} style={addBtn(C)}>+ 페이지 추가</button>
      </div>
    </div>
  );
}

/* ============================================================
   한 장: 양식 배경 이미지 + 투명 펜 캔버스
   ============================================================ */
function PenPage({ C, initial, onChange }) {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const last      = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // 캔버스 해상도 = 양식 원본 비율에 맞춤 (A4)
  const setup = useCallback(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const w = wrap.clientWidth;
    const h = Math.round(w / A4_RATIO);
    wrap.style.height = h + "px";
    const dpr = window.devicePixelRatio || 1;
    // 기존 그림 백업
    let old = null;
    if (canvas.width > 0) { try { old = canvas.toDataURL(); } catch (e) {} }
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const restore = old || initial;
    if (restore) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = restore;
    }
    setReady(true);
  }, [initial]);

  useEffect(() => {
    setup();
    const obs = new ResizeObserver(() => setup());
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [setup]);

  const getPos = (e) => {
    const ne = e.nativeEvent || e;
    let x = ne.offsetX, y = ne.offsetY;
    if (x == null || y == null) {
      const r = canvasRef.current.getBoundingClientRect();
      x = (ne.clientX ?? 0) - r.left; y = (ne.clientY ?? 0) - r.top;
    }
    return { x, y };
  };
  const start = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); drawing.current = true; last.current = getPos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    try { onChange(canvasRef.current.toDataURL("image/png")); } catch (e) {}
  };
  const clearPage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div style={{ position: "relative", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden", background: "#fff" }}>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", backgroundImage: `url(${TEMPLATE_IMG})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }}>
        <canvas ref={canvasRef}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }} />
      </div>
      <button onClick={clearPage}
        style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.85)", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, padding: "3px 8px", cursor: "pointer", color: "#333", zIndex: 2 }}>
        이 장 지우기
      </button>
    </div>
  );
}

/* ============================================================
   폴더 공유: 폴더 안 스크립트들을 각각 PDF로 만들어 zip으로 묶어 공유/다운로드
   ============================================================ */
async function shareFolder(folder, scripts, C) {
  if (!scripts.length) { alert("폴더가 비어 있어요."); return; }
  try {
    const [{ PDFDocument }, JSZip] = await Promise.all([
      import("pdf-lib"),
      import("jszip").then(m => m.default || m),
    ]);

    // 양식 원본 PDF 1장 로드 (벡터 유지)
    const tplBytes = await fetch(TEMPLATE_PDF).then(r => r.arrayBuffer());

    const zip = new JSZip();
    for (const s of scripts) {
      const out = await PDFDocument.create();
      for (const pageData of s.pages) {
        // 양식 페이지 복제
        const tpl = await PDFDocument.load(tplBytes);
        const [tplPage] = await out.copyPages(tpl, [0]);
        const page = out.addPage(tplPage);
        // 펜 레이어 오버레이
        if (pageData) {
          const png = await out.embedPng(pageData);
          const { width, height } = page.getSize();
          page.drawImage(png, { x: 0, y: 0, width, height });
        }
      }
      const pdfBytes = await out.save();
      const safe = s.name.replace(/[\\/:*?"<>|]/g, "_");
      zip.file(`${safe}.pdf`, pdfBytes);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const fname = `${folder.name.replace(/[\\/:*?"<>|]/g, "_")}.zip`;
    const file = new File([blob], fname, { type: "application/zip" });

    // 네이티브 공유 시트 (가능하면) → 아니면 다운로드
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: folder.name });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error("공유 실패:", e);
    alert("공유 중 오류가 발생했어요: " + (e.message || e));
  }
}

/* ───────── 공통 UI 조각 ───────── */
function Header({ C, title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <button onClick={onBack} style={iconBtn(C)}>←</button>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</div>
    </div>
  );
}
const card = (C) => ({
  display: "flex", alignItems: "center", gap: 8,
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px",
});
const addBtn = (C) => ({
  background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 12,
  padding: "12px", color: (C.navy||C.red||"#1A2B6B"), fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
});
const iconBtn = (C) => ({
  background: "transparent", border: "none", color: C.muted,
  fontSize: 15, cursor: "pointer", padding: "4px 8px",
});
