import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";

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
  // view: "folders" | "edit"  (폴더 = 스크립트 하나)
  const [view, setView]       = useState("folders");
  const [items, setItems]     = useState([]);     // 폴더(=스크립트) 목록
  const [loading, setLoading] = useState(true);
  const [curFolder, setCurFolder] = useState(null); // 현재 작품 id

  useEffect(() => {
    (async () => {
      try { setItems(await dbAll()); } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const folders = items.filter(i => i.type === "folder");

  const reload = async () => setItems(await dbAll());

  /* ── 폴더 생성/삭제 ── */
  const addFolder = async () => {
    const name = prompt("작품 이름을 입력하세요");
    if (!name?.trim()) return;
    await dbPut({ id: uid(), type: "folder", name: name.trim(), pages: [null], createdAt: Date.now(), updatedAt: Date.now() });
    reload();
  };
  const delFolder = async (fid) => {
    if (!window.confirm("이 작품을 삭제할까요?")) return;
    await dbDel(fid);
    reload();
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>불러오는 중...</div>;
  }

  /* ── 작성 화면 (폴더 = 스크립트 하나) ── */
  if (view === "edit" && curFolder) {
    const folder = items.find(i => i.id === curFolder);
    if (!folder) { setView("folders"); return null; }
    return (
      <ScriptEditor
        C={C}
        script={folder}
        onBack={() => { reload(); setView("folders"); }}
        onSave={async (pages) => {
          await dbPut({ ...folder, pages, updatedAt: Date.now() });
          await reload();
        }}
      />
    );
  }

  /* ── 작품 목록 ── */
  return (
    <div style={{ padding: 12 }}>
      <Header C={C} title="🎬 스크립터" onBack={onBack} />
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
        스크립트 용지에 펜으로 바로 작성하세요. 기기 안에 저장되니, 중요한 건 공유해서 백업하세요.
      </div>
      {folders.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "24px 0" }}>
          새 작품을 만들어 시작하세요.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {folders.map(f => (
          <div key={f.id} style={card(C)}>
            <div onClick={() => { setCurFolder(f.id); setView("edit"); }}
                 style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{(f.pages?.length || 0)}장 · {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : ""}</div>
              </div>
            </div>
            <button onClick={() => shareFolder(f, [f], C)} style={iconBtn(C)} title="공유">📤</button>
            <button onClick={() => delFolder(f.id)} style={iconBtn(C)} title="삭제">🗑️</button>
          </div>
        ))}
        <button onClick={addFolder} style={addBtn(C)}>+ 새 작품</button>
      </div>
    </div>
  );
}



/* ============================================================
   스크립트 작성 에디터 (양식 배경 + 펜 레이어, 페이지 여러 장)
   ============================================================ */
function ScriptEditor({ C, script, onBack, onSave }) {
  const [pageCount, setPageCount] = useState(script.pages?.length ? script.pages.length : 1);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState("pen");   // "pen" | "eraser"
  const initialPages = useRef(script.pages?.length ? script.pages : [null]);
  const pageRefs = useRef([]);   // 각 PenPage의 ref

  const addPage = () => setPageCount(n => n + 1);

  // 모든 페이지 캔버스에서 현재 그림을 직접 수집
  const collect = () => pageRefs.current.map(r => (r && r.getData ? r.getData() : null));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(collect());
    } catch (e) {
      alert("저장 실패: " + (e.message || e));
    }
    setSaving(false);
  };

  const back = async () => {
    try { await onSave(collect()); } catch (e) {}
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
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setTool("pen")}
            style={{ background: tool === "pen" ? (C.navy||C.red||"#1A2B6B") : "transparent", color: tool === "pen" ? "#fff" : C.muted, border: `1px solid ${tool === "pen" ? (C.navy||C.red||"#1A2B6B") : C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ✏️
          </button>
          <button onClick={() => setTool("eraser")}
            style={{ background: tool === "eraser" ? (C.navy||C.red||"#1A2B6B") : "transparent", color: tool === "eraser" ? "#fff" : C.muted, border: `1px solid ${tool === "eraser" ? (C.navy||C.red||"#1A2B6B") : C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🧽
          </button>
          <button onClick={() => setTool("scroll")}
            style={{ background: tool === "scroll" ? (C.navy||C.red||"#1A2B6B") : "transparent", color: tool === "scroll" ? "#fff" : C.muted, border: `1px solid ${tool === "scroll" ? (C.navy||C.red||"#1A2B6B") : C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ✋
          </button>
        </div>
        <button onClick={save} disabled={saving}
          style={{ background: (C.navy||C.red||"#1A2B6B"), color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: pageCount }).map((_, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textAlign: "center" }}>— {i + 1} / {pageCount} —</div>
            <PenPage ref={(el) => { pageRefs.current[i] = el; }} C={C} initial={initialPages.current[i] || null} tool={tool} />
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
const PenPage = forwardRef(function PenPage({ C, initial, tool }, ref) {
  const wrapRef   = useRef(null);   // 고정 뷰포트 (overflow hidden)
  const stageRef  = useRef(null);   // 확대/이동되는 내부 (양식+캔버스)
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const last      = useRef({ x: 0, y: 0 });

  // 줌/팬 상태
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map());        // 현재 닿아있는 포인터들
  const pinch = useRef(null);                // 핀치 시작 정보
  const didInit = useRef(false);             // 첫 셋업 구분 (초기 복원 보호)

  // 저장 시 부모가 현재 그림을 직접 읽어가도록 노출
  useImperativeHandle(ref, () => ({
    getData() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        // 빈 캔버스면 null 반환 (불필요한 용량 방지)
        const blank = document.createElement("canvas");
        blank.width = canvas.width; blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) return null;
        return canvas.toDataURL("image/png");
      } catch (e) { return null; }
    },
  }));

  const applyTransform = () => {
    const s = stageRef.current; if (!s) return;
    const v = view.current;
    s.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`;
  };

  // 캔버스 해상도 = 양식 원본 비율(A4)
  const setup = useCallback(() => {
    const wrap = wrapRef.current, stage = stageRef.current, canvas = canvasRef.current;
    if (!wrap || !stage || !canvas) return;
    const w = wrap.clientWidth;
    const h = Math.round(w / A4_RATIO);
    wrap.style.height = h + "px";
    stage.style.width = w + "px";
    stage.style.height = h + "px";
    const dpr = window.devicePixelRatio || 1;
    // 첫 셋업에서는 빈 기본 캔버스를 백업하지 않는다 (저장된 initial을 덮어쓰지 않도록).
    let old = null;
    if (didInit.current && canvas.width > 0) { try { old = canvas.toDataURL(); } catch (e) {} }
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const restore = old || initial;   // 첫 셋업이면 initial(저장된 그림) 복원
    if (restore) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = restore;
    }
    didInit.current = true;
  }, [initial]);

  useEffect(() => {
    setup();
    const obs = new ResizeObserver(() => setup());
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [setup]);

  // 화면 좌표 → 캔버스 로컬 좌표 (현재 줌/팬 역산)
  const toLocal = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();   // 변환(scale·pan) 반영된 실제 화면 위치/크기
    const v = view.current;
    // rect.width = 원본 CSS폭 × scale 이므로, 로컬 좌표 = 화면거리 ÷ scale
    const x = (clientX - rect.left) / v.scale;
    const y = (clientY - rect.top)  / v.scale;
    return { x, y };
  };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid  = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onDown = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (pointers.current.size >= 2) {
      // 핀치 시작 → 그리기 취소
      drawing.current = false;
      const pts = [...pointers.current.values()];
      pinch.current = {
        startDist: dist(pts[0], pts[1]),
        startScale: view.current.scale,
        startMid: mid(pts[0], pts[1]),
        startTx: view.current.tx,
        startTy: view.current.ty,
      };
      return;
    }
    // 한 포인터 → 그리기
    drawing.current = true;
    last.current = toLocal(e.clientX, e.clientY);
  };

  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    e.preventDefault();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    // 핀치 줌/팬
    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const d = dist(pts[0], pts[1]);
      const m = mid(pts[0], pts[1]);
      let scale = pinch.current.startScale * (d / pinch.current.startDist);
      scale = Math.max(1, Math.min(5, scale));   // 1~5배
      view.current.scale = scale;
      // 두 손가락 중점 이동만큼 팬
      view.current.tx = pinch.current.startTx + (m.x - pinch.current.startMid.x);
      view.current.ty = pinch.current.startTy + (m.y - pinch.current.startMid.y);
      clampPan();
      applyTransform();
      return;
    }

    // 그리기 / 지우기
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = toLocal(e.clientX, e.clientY);
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";  // 펜 글씨만 투명하게 (양식 배경은 그대로)
      ctx.lineWidth = 24;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.2;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";  // 원복
    last.current = p;
  };

  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drawing.current && pointers.current.size === 0) {
      drawing.current = false;
    }
  };

  // 확대 상태에서 양식이 화면 밖으로 너무 빠지지 않게 제한
  const clampPan = () => {
    const wrap = wrapRef.current; if (!wrap) return;
    const v = view.current;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const maxX = (v.scale - 1) * w;
    const maxY = (v.scale - 1) * h;
    v.tx = Math.max(-maxX, Math.min(0, v.tx));
    v.ty = Math.max(-maxY, Math.min(0, v.ty));
  };

  const resetZoom = () => {
    view.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform();
  };

  const clearPage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  return (
    <div style={{ position: "relative", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden", background: "#fff" }}>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", overflow: "hidden", touchAction: tool === "scroll" ? "pan-y" : "none" }}>
        <div ref={stageRef} style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left",
          backgroundImage: `url(${TEMPLATE_IMG})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }}>
          <canvas ref={canvasRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: tool === "scroll" ? "pan-y" : "none", cursor: tool === "scroll" ? "grab" : "crosshair", pointerEvents: tool === "scroll" ? "none" : "auto" }} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 6, zIndex: 2 }}>
        <button onClick={resetZoom}
          style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, padding: "3px 8px", cursor: "pointer", color: "#333" }}>
          100%
        </button>
        <button onClick={clearPage}
          style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, padding: "3px 8px", cursor: "pointer", color: "#333" }}>
          이 장 전체삭제
        </button>
      </div>
    </div>
  );
});

/* ============================================================
   폴더 공유: 폴더 안 스크립트들을 각각 PDF로 만들어 zip으로 묶어 공유/다운로드
   ============================================================ */
async function shareFolder(folder, _ignored, C) {
  const pages = folder.pages || [];
  if (!pages.length || pages.every(p => !p)) { alert("작성된 내용이 없어요."); return; }
  try {
    const { PDFDocument } = await import("pdf-lib");
    const tplBytes = await fetch(TEMPLATE_PDF).then(r => r.arrayBuffer());

    const out = await PDFDocument.create();
    for (const pageData of pages) {
      const tpl = await PDFDocument.load(tplBytes);
      const [tplPage] = await out.copyPages(tpl, [0]);
      const page = out.addPage(tplPage);
      if (pageData) {
        const png = await out.embedPng(pageData);
        const { width, height } = page.getSize();
        page.drawImage(png, { x: 0, y: 0, width, height });
      }
    }
    const pdfBytes = await out.save();
    const safe = (folder.name || "스크립트").replace(/[\\/:*?"<>|]/g, "_");
    const fname = `${safe}.pdf`;
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const file = new File([blob], fname, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
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
