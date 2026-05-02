import { useState, useRef } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `equipment/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on("state_changed", null,
      err  => reject(err),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

// ── 이미지 업로더 (최대 N장) ──────────────────────────────
function MultiImageUploader({ values = [], onChange, max = 4 }) {
  const inputRef  = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files).slice(0, max - values.length);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadImage));
      onChange([...values, ...urls]);
    } catch { alert("업로드 실패. 다시 시도해주세요."); }
    finally { setUploading(false); e.target.value = ""; }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
        제품 사진 <span style={{ color: C.muted, fontWeight: 400 }}>(최대 {max}장 · 선택)</span>
      </div>
      {values.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 8 }}>
          {values.map((url, i) => (
            <div key={i} style={{ position: "relative", paddingTop: "75%", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg }}>
              <img src={url} alt={`사진${i+1}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
              <button onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, background: C.red, color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {values.length < max && (
        <div onClick={() => !uploading && inputRef.current.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: "20px 0", textAlign: "center", cursor: uploading ? "not-allowed" : "pointer", background: C.bg }}>
          {uploading ? <div style={{ color: C.blue, fontSize: 13, fontWeight: 600 }}>⏳ 업로드 중...</div> : (
            <><div style={{ fontSize: 28, marginBottom: 6 }}>📷</div><div style={{ fontSize: 12, color: C.muted }}>클릭하여 사진 추가 ({values.length}/{max}장)</div></>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
    </div>
  );
}

function SingleImageUploader({ label, value, onChange }) {
  const inputRef  = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const url = await uploadImage(file); onChange(url); }
    catch { alert("업로드 실패."); }
    finally { setUploading(false); e.target.value = ""; }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label} <span style={{ color: C.muted, fontWeight: 400 }}>(선택)</span></div>
      {value ? (
        <div style={{ position: "relative" }}>
          <img src={value} alt={label} style={{ width: "100%", maxHeight: 140, objectFit: "contain", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg }} />
          <button onClick={() => onChange("")} style={{ position: "absolute", top: 6, right: 6, background: C.red, color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕</button>
        </div>
      ) : (
        <div onClick={() => !uploading && inputRef.current.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: "16px 0", textAlign: "center", cursor: uploading ? "not-allowed" : "pointer", background: C.bg }}>
          {uploading ? <div style={{ color: C.blue, fontSize: 12 }}>⏳ 업로드 중...</div> : <><div style={{ fontSize: 22, marginBottom: 4 }}>🔍</div><div style={{ fontSize: 11, color: C.muted }}>클릭하여 업로드</div></>}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

// ── 점검 이력 모달 ─────────────────────────────────────────
function InspModal({ item, inspections, onClose }) {
  const [form, setForm] = useState({ type: "정기점검", note: "", result: "정상" });
  const mine = inspections.filter(i => i.equipId === item.id)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const handleAdd = async () => {
    if (!form.note) return;
    await addItem("inspections", { equipId: item.id, equipName: `${item.modelName} ${item.unitNo || ""}`.trim(), date: new Date().toISOString().slice(0,10), inspector: "관리자", ...form });
    setForm({ type: "정기점검", note: "", result: "정상" });
  };

  return (
    <Modal onClose={onClose} width={500}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 4 }}>🔧 점검 이력</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{item.modelName} {item.unitNo && `· ${item.unitNo}`}</div>
      <div style={{ background: C.bg, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["정기점검","수리","파손확인"].map(t => (
            <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{ flex: 1, background: form.type === t ? C.navy : C.surface, color: form.type === t ? "#fff" : C.muted, border: `1px solid ${form.type === t ? C.navy : C.border}`, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t}</button>
          ))}
        </div>
        <Inp placeholder="점검 내용" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["정상","수리필요","폐기"].map(r => (
            <button key={r} onClick={() => setForm(p => ({ ...p, result: r }))} style={{ flex: 1, background: form.result === r ? C.green : C.surface, color: form.result === r ? "#fff" : C.muted, border: `1px solid ${form.result === r ? C.green : C.border}`, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{r}</button>
          ))}
        </div>
        <Btn onClick={handleAdd} color={C.teal} full>기록 추가</Btn>
      </div>
      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {mine.length === 0 && <Empty icon="📋" text="점검 이력이 없습니다" />}
        {mine.map(i => (
          <div key={i.id} style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{i.type}</span>
              <Badge label={i.result} />
            </div>
            <div style={{ fontSize: 12, color: C.text }}>{i.note}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{i.date} · {i.inspector}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><Btn onClick={onClose} color={C.navy} full>닫기</Btn></div>
    </Modal>
  );
}

// ── 세부사항 모달 ──────────────────────────────────────────
function DetailModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    location:   item.location   || "",
    photoUrls:  item.photoUrls  || [],
    snPhotoUrl: item.snPhotoUrl || "",
    serialNo:   item.serialNo   || "",
    note:       item.note       || "",
  });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await onSave(item.id, form); setSaving(false); onClose(); };

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 4 }}>📋 세부사항</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>{item.modelName} {item.unitNo && `· ${item.unitNo}`}</div>
      <MultiImageUploader values={form.photoUrls} onChange={urls => setForm(p => ({ ...p, photoUrls: urls }))} max={4} />
      <Inp label="보관 위치" placeholder="예: A동 101호 3번 선반" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
      <Inp label="S/N (시리얼 넘버)" placeholder="예: SN-20240001" value={form.serialNo} onChange={e => setForm(p => ({ ...p, serialNo: e.target.value }))} />
      <SingleImageUploader label="S/N 사진" value={form.snPhotoUrl} onChange={url => setForm(p => ({ ...p, snPhotoUrl: url }))} />
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>특이사항</div>
        <textarea placeholder="특이사항 또는 관리 메모" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
          style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 80, boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={onClose} color={C.muted} outline full>취소</Btn>
        <Btn onClick={handleSave} full disabled={saving}>{saving ? "저장 중..." : "저장"}</Btn>
      </div>
    </Modal>
  );
}

// ── 장비 카드 (가로형) ─────────────────────────────────────
function EquipCard({ e, onDetail, onInsp, onDelete, onCycleStatus, onEdit, onCopy }) {
  const thumb = e.displayPhotoUrl || (e.photoUrls?.[0]) || null;
  const statusColor = { 대여가능: C.green, 대여중: C.blue, 수리중: C.yellow, 대여불가: C.red }[e.status] || C.muted;
  const statusBg    = { 대여가능: C.greenLight, 대여중: C.blueLight, 수리중: C.yellowLight, 대여불가: C.redLight }[e.status] || C.bg;

  return (
    <div style={{ background:C.surface, borderRadius:12, border:`1.5px solid ${statusColor}40`, padding:"9px 12px", display:"flex", alignItems:"center", gap:10 }}>
      {/* 썸네일 */}
      <div style={{ width:42, height:42, borderRadius:8, overflow:"hidden", flexShrink:0, background:C.bg, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {thumb
          ? <img src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
          : <span style={{ fontSize:18 }}>📷</span>
        }
      </div>

      {/* 정보 */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* 1행: 모델명 + 호기 + 상태 */}
        <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{e.modelName}</span>
          {e.unitNo && <span style={{ fontSize:10, background:C.navy, color:"#fff", borderRadius:4, padding:"1px 5px", fontWeight:700, flexShrink:0 }}>{e.unitNo}</span>}
          {e.isSet && <span style={{ fontSize:10, background:C.orangeLight, color:C.orange, borderRadius:4, padding:"1px 5px", fontWeight:700, flexShrink:0 }}>세트</span>}
          {e.licenseLevel > 0 && (() => { const lv = LICENSE_LEVELS[e.licenseLevel]; return lv ? <span style={{ fontSize:10, background:lv.bg, color:lv.color, borderRadius:4, padding:"1px 5px", fontWeight:700, flexShrink:0 }}>Lv.{e.licenseLevel}</span> : null; })()}
          <span style={{ fontSize:10, background:statusBg, color:statusColor, borderRadius:4, padding:"1px 6px", fontWeight:700, flexShrink:0 }}>{e.status||"대여가능"}</span>
        </div>
        {/* 2행: 분류 + 제조사 + 위치 */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
          {e.majorCategory && <span style={{ fontSize:10, color:C.blue, background:C.blueLight, borderRadius:4, padding:"0px 5px" }}>{e.majorCategory}</span>}
          {e.minorCategory && <span style={{ fontSize:10, color:C.muted }}>{e.minorCategory}</span>}
          {e.subCategory   && <span style={{ fontSize:10, color:C.muted }}>· {e.subCategory}</span>}
          {e.manufacturer  && <span style={{ fontSize:10, color:C.muted }}>· {e.manufacturer}</span>}
          {e.location      && <span style={{ fontSize:10, color:C.muted }}>📍{e.location}</span>}
          {e.itemNo        && <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>#{e.itemNo}</span>}
        </div>
      </div>

      {/* 버튼 */}
      <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
        <div style={{ display:"flex", gap:3 }}>
          <button onClick={() => onEdit(e)}        style={{ background:C.greenLight, color:C.green, border:"none", borderRadius:6, padding:"4px 7px", fontSize:10, fontWeight:700, cursor:"pointer" }}>수정</button>
          <button onClick={() => onCycleStatus(e)} style={{ background:C.yellowLight, color:C.yellow, border:"none", borderRadius:6, padding:"4px 7px", fontSize:10, fontWeight:700, cursor:"pointer" }}>상태</button>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          <button onClick={() => onDetail(e)}      style={{ background:C.blueLight, color:C.blue, border:"none", borderRadius:6, padding:"4px 7px", fontSize:10, fontWeight:700, cursor:"pointer" }}>상세</button>
          <button onClick={() => onDelete(e.id)}   style={{ background:C.redLight, color:C.red, border:"none", borderRadius:6, padding:"4px 7px", fontSize:10, fontWeight:700, cursor:"pointer" }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// ── 모델별 그룹 카드 ────────────────────────────────────────
function EquipCardGroup({ rep, units, onDetail, onInsp, onDelete, onCycleStatus, onEdit, onCopy }) {
  const [open, setOpen] = useState(false);
  const thumb = rep.displayPhotoUrl || (rep.photoUrls?.[0]) || null;

  // 상태별 카운트
  const avail    = units.filter(u => (u.status||"대여가능") === "대여가능").length;
  const renting  = units.filter(u => u.status === "대여중").length;
  const repair   = units.filter(u => u.status === "수리중").length;
  const total    = units.length;

  const statusSummaryColor = avail === 0 ? C.red : avail < total ? C.yellow : C.green;

  return (
    <div style={{ background:C.surface, borderRadius:12, border:`1.5px solid ${statusSummaryColor}40`, overflow:"hidden" }}>
      {/* 대표 행 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px" }}>
        {/* 썸네일 */}
        <div style={{ width:42, height:42, borderRadius:8, overflow:"hidden", flexShrink:0, background:C.bg, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {thumb
            ? <img src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
            : <span style={{ fontSize:18 }}>📷</span>
          }
        </div>

        {/* 정보 */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
            <span style={{ fontSize:13, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{rep.modelName}</span>
            {rep.licenseLevel > 0 && (() => { const lv = LICENSE_LEVELS[rep.licenseLevel]; return lv ? <span style={{ fontSize:10, background:lv.bg, color:lv.color, borderRadius:4, padding:"1px 5px", fontWeight:700, flexShrink:0 }}>Lv.{rep.licenseLevel}</span> : null; })()}
            {/* 재고 요약 */}
            <span style={{ fontSize:10, fontWeight:700, color:statusSummaryColor, flexShrink:0 }}>
              {avail}/{total}대
            </span>
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
            {rep.majorCategory && <span style={{ fontSize:10, color:C.blue, background:C.blueLight, borderRadius:4, padding:"0px 5px" }}>{rep.majorCategory}</span>}
            {rep.minorCategory && <span style={{ fontSize:10, color:C.muted }}>{rep.minorCategory}</span>}
            {rep.subCategory   && <span style={{ fontSize:10, color:C.muted }}>· {rep.subCategory}</span>}
            {rep.manufacturer  && <span style={{ fontSize:10, color:C.muted }}>· {rep.manufacturer}</span>}
            {renting > 0 && <span style={{ fontSize:10, color:C.blue }}>대여중 {renting}</span>}
            {repair  > 0 && <span style={{ fontSize:10, color:C.yellow }}>수리중 {repair}</span>}
          </div>
        </div>

        {/* 펼치기 + 추가 버튼 */}
        <div style={{ display:"flex", gap:4, flexShrink:0, alignItems:"center" }}>
          <button onClick={() => onEdit(rep)}       style={{ background:C.greenLight, color:C.green, border:"none", borderRadius:6, padding:"4px 7px", fontSize:10, fontWeight:700, cursor:"pointer" }}>수정</button>
          <button onClick={() => { setOpen(o => !o); }} style={{ background:C.bg, color:C.muted, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 7px", fontSize:10, fontWeight:700, cursor:"pointer" }}>
            {open ? "접기" : `${total}대 ▾`}
          </button>
        </div>
      </div>

      {/* 개별 호기 목록 (펼침) */}
      {open && (
        <div style={{ borderTop:`1px solid ${C.border}` }}>
          {units.map(u => {
            const sc = { 대여가능: C.green, 대여중: C.blue, 수리중: C.yellow, 대여불가: C.red }[u.status] || C.muted;
            const sb = { 대여가능: C.greenLight, 대여중: C.blueLight, 수리중: C.yellowLight, 대여불가: C.redLight }[u.status] || C.bg;
            return (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px 7px 18px", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ flex:1, display:"flex", gap:6, alignItems:"center", minWidth:0 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.muted }}>{u.unitNo || "-"}</span>
                  {u.itemNo && <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>#{u.itemNo}</span>}
                  {u.location && <span style={{ fontSize:10, color:C.muted }}>📍{u.location}</span>}
                  {u.serialNo && <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>S/N:{u.serialNo}</span>}
                </div>
                <span style={{ fontSize:10, background:sb, color:sc, borderRadius:4, padding:"1px 6px", fontWeight:700, flexShrink:0 }}>{u.status||"대여가능"}</span>
                <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                  <button onClick={() => onEdit(u)}         style={{ background:C.greenLight, color:C.green, border:"none", borderRadius:5, padding:"3px 6px", fontSize:9, fontWeight:700, cursor:"pointer" }}>수정</button>
                  <button onClick={() => onCycleStatus(u)}  style={{ background:C.yellowLight, color:C.yellow, border:"none", borderRadius:5, padding:"3px 6px", fontSize:9, fontWeight:700, cursor:"pointer" }}>상태</button>
                  <button onClick={() => onDetail(u)}       style={{ background:C.blueLight, color:C.blue, border:"none", borderRadius:5, padding:"3px 6px", fontSize:9, fontWeight:700, cursor:"pointer" }}>상세</button>
                  <button onClick={() => onDelete(u.id)}    style={{ background:C.redLight, color:C.red, border:"none", borderRadius:5, padding:"3px 6px", fontSize:9, fontWeight:700, cursor:"pointer" }}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 엑셀 임포트 모달 ──────────────────────────────────────
function ExcelImportModal({ onClose, onImport }) {
  const inputRef              = useRef();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const COL_MAP = {
    "대분류":"majorCategory","중분류":"minorCategory","소분류":"subCategory",
    "제조사":"manufacturer","모델명":"modelName",
    "장비설명":"description","라이센스단계":"licenseLevel","라이센스단계(0~3)":"licenseLevel",
    "호기":"unitNo","물품번호":"itemNo",
    "보관위치":"location","S/N":"serialNo","상태":"status","특이사항":"note",
    "마운트":"mount","마운트(E-mount/EF-mount)":"mount",
    "호환배터리모델명":"batteryModel",
    "호환카메라모델명(배터리)":"_forCamerasRaw",
    "호환카메라모델명(충전기)":"_chargerCamerasRaw",
  };

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setError(""); setRows([]);
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type:"array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(allRows.length, 10); i++) {
        const row = allRows[i].map(c => String(c).trim());
        const cleanRow = row.map(c => String(c).replace(/\*/g,"").trim());
        if (cleanRow.includes("대분류") || cleanRow.includes("모델명")) { headerRowIdx = i; break; }
      }
      if (headerRowIdx === -1) { setError("헤더를 찾을 수 없습니다. 템플릿 파일을 사용해주세요."); setLoading(false); e.target.value = ""; return; }
      const hdrs    = allRows[headerRowIdx].map(c => String(c).replace(/\*/g,"").trim());
      const dataRows = allRows.slice(headerRowIdx + 1);
      const mapped   = dataRows.map(row => {
        const obj = { status: "대여가능", photoUrls: [], snPhotoUrl: "" };
        hdrs.forEach((h, i) => {
          const en = COL_MAP[h];
          if (!en) return;
          const val = row[i] !== undefined ? String(row[i]).trim() : "";
          if (en === "_forCamerasRaw") {
            obj.forCameras = val ? val.split(",").map(s=>s.trim()).filter(Boolean) : [];
          } else if (en === "_chargerCamerasRaw") {
            obj.chargerForCameras = val ? val.split(",").map(s=>s.trim()).filter(Boolean) : [];
          } else if (en === "licenseLevel") {
            obj[en] = parseInt(val) || 0;
          } else {
            obj[en] = val;
          }
        });
        return obj;
      }).filter(r => r.modelName);
      if (!mapped.length) setError("데이터를 읽을 수 없습니다. 모델명을 확인해주세요.");
      else setRows(mapped);
    } catch { setError("파일을 읽는 중 오류가 발생했습니다."); }
    finally { setLoading(false); e.target.value = ""; }
  };

  const handleSave = async () => {
    setSaving(true);
    for (const r of rows) {
      try { await addItem("equipments", { ...r, name: r.modelName }); } catch (err) { console.error(err); }
    }
    setSaving(false); onClose();
  };

  return (
    <Modal onClose={onClose} width={700}>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 4 }}>📥 엑셀로 일괄 등록</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>각 행 = 장비 1대 (같은 모델 3대면 3행 입력)</div>
      {/* 템플릿 다운로드 */}
      <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:16, border:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:2 }}>📋 템플릿을 먼저 받아주세요</div>
          <div style={{ fontSize:11, color:C.muted }}>템플릿에 맞게 작성 후 업로드하면 자동 등록돼요</div>
        </div>
        <a href="/장비_일괄등록_템플릿.xlsx" download="장비_일괄등록_템플릿.xlsx"
          style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, color:"#fff", borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, textDecoration:"none", flexShrink:0, whiteSpace:"nowrap" }}>
          ⬇️ 템플릿 받기
        </a>
      </div>
      {rows.length === 0 && (
        <div onClick={() => inputRef.current.click()} style={{ border:`2px dashed ${C.border}`, borderRadius:12, padding:"36px 0", textAlign:"center", cursor:"pointer", background:C.bg, marginBottom:14 }}>
          {loading ? <div style={{ color:C.blue, fontSize:14, fontWeight:600 }}>⏳ 파일 읽는 중...</div> : (
            <><div style={{ fontSize:44, marginBottom:10 }}>📊</div><div style={{ fontSize:14, color:C.text, fontWeight:600 }}>엑셀 파일 클릭하여 업로드</div><div style={{ fontSize:12, color:C.muted, marginTop:4 }}>.xlsx 파일 지원</div></>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:"none" }} />
      {error && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 }}>⚠️ {error}</div>}
      {rows.length > 0 && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.navy }}>✅ {rows.length}대 인식됨</div>
            <Btn onClick={() => { setRows([]); setError(""); }} small color={C.muted} outline>다시 선택</Btn>
          </div>
          <div style={{ maxHeight:300, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:C.navy, position:"sticky", top:0 }}>
                  {["대분류","소분류","제조사","모델명","품명","호기","물품번호"].map(h => (
                    <th key={h} style={{ color:"#fff", padding:"8px 10px", textAlign:"left", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background:i%2===0?C.bg:C.surface, borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"7px 10px", color:C.blue, fontWeight:600 }}>{r.majorCategory}</td>
                    <td style={{ padding:"7px 10px", color:C.muted }}>{r.minorCategory}</td>
                    <td style={{ padding:"7px 10px", color:C.muted }}>{r.manufacturer}</td>
                    <td style={{ padding:"7px 10px", color:C.text, fontWeight:600 }}>{r.modelName}</td>
                    <td style={{ padding:"7px 10px", color:C.text }}>{r.itemName}</td>
                    <td style={{ padding:"7px 10px", color:C.navy, fontWeight:700 }}>{r.unitNo}</td>
                    <td style={{ padding:"7px 10px", color:C.muted, fontFamily:"monospace" }}>{r.itemNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={onClose} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSave} color={C.teal} full disabled={saving}>{saving ? "등록 중..." : `📥 ${rows.length}대 일괄 등록`}</Btn>
          </div>
        </>
      )}
      {rows.length === 0 && !error && <div style={{ textAlign:"center" }}><Btn onClick={onClose} color={C.muted} outline>닫기</Btn></div>}
    </Modal>
  );
}

// ── EMPTY FORM ────────────────────────────────────────────
const MAJOR_CATS = ["촬영", "렌즈", "ACC", "트라이포드/그립", "모니터", "조명", "음향"];

const MINOR_CATS = {
  "촬영":        ["카메라", "캠코더", "드론/액션캠", "배터리", "충전기/전원", "저장매체", "카드리더기"],
  "렌즈":        ["단렌즈", "줌렌즈", "시네렌즈", "렌즈어댑터", "렌즈액세서리"],
  "ACC":         ["리그/케이지", "무선송수신", "라이브송출", "슬레이트/타임코드", "케이블/젠더", "가방/운반", "기타"],
  "트라이포드/그립": ["비디오삼각대", "사진삼각대", "모노포드", "짐벌", "슬라이더", "숄더리그", "그립장비"],
  "모니터":      ["카메라용 모니터", "감독용 모니터", "모니터액세서리"],
  "조명":        ["조명본체", "조명액세서리", "그립장비"],
  "음향":        ["마이크", "레코더/믹서", "음향액세서리"],
};

// 소분류 → equipType 매핑
const EQUIP_TYPE_MAP = {
  "카메라": "camera", "캠코더": "camcorder", "드론/액션캠": "camera",
  "배터리": "battery", "충전기/전원": "charger",
  "저장매체": "storage", "카드리더기": "storage",
  "단렌즈": "lens", "줌렌즈": "lens", "시네렌즈": "lens",
  "렌즈어댑터": "adapter", "렌즈액세서리": "lens_acc",
  "리그/케이지": "rig", "무선송수신": "wireless", "라이브송출": "live",
  "슬레이트/타임코드": "slate", "케이블/젠더": "cable",
  "가방/운반": "bag", "기타": "etc",
  "비디오삼각대": "tripod", "사진삼각대": "tripod", "모노포드": "tripod",
  "짐벌": "gimbal", "슬라이더": "slider", "숄더리그": "shoulder", "그립장비": "grip",
  "카메라용 모니터": "monitor", "감독용 모니터": "monitor", "모니터액세서리": "monitor_acc",
  "조명본체": "light", "조명액세서리": "light_acc",
  "마이크": "mic", "레코더/믹서": "recorder", "음향액세서리": "audio_acc",
};

// 드롭박스 스타일
const selStyle = (C) => ({
  display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`,
  borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13,
  fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer",
  appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", paddingRight:32,
});

const EMPTY = {
  majorCategory:"", minorCategory:"", subCategory:"", manufacturer:"", _minorCustom:false,
  modelName:"", unitNo:"", itemNo:"",
  description:"",
  status:"대여가능",
  licenseLevel: 0,  // 0~3단계
  location:"", photoUrls:[], snPhotoUrl:"", serialNo:"", note:"",
  isSet: false,
  setItems: "",
  displayPhotoUrl: "",  // 학생 송출용 이미지 URL
  // 가이드 모드용 필드
  equipType: "",        // "camera" | "lens" | "battery" | "adapter" | "etc"
  mount: "",            // "E-mount" | "EF-mount"
  batteryModel: "",     // 카메라용: 호환 배터리 모델명
  forCamera: "",        // 배터리용: 어떤 카메라에 쓰이는지 (구버전 호환)
  forCameras: [],       // 배터리용: 호환 카메라 목록 (다대다)
  chargerForCameras: [], // 충전기/전원용: 호환 카메라 목록
  adapterFrom: "",      // 어댑터용: 렌즈 마운트
  adapterTo: "",        // 어댑터용: 카메라 마운트
};

const LICENSE_LEVELS = [
  { val:0, label:"0단계", desc:"누구나 대여 가능", color:"#10B981", bg:"#D1FAE5" },
  { val:1, label:"1단계", desc:"1단계 이상",       color:"#3B6CF8", bg:"#EEF2FF" },
  { val:2, label:"2단계", desc:"2단계 이상",       color:"#F59E0B", bg:"#FFFBEB" },
  { val:3, label:"3단계", desc:"3단계만",          color:"#EF4444", bg:"#FEF2F2" },
];

// ── 메인 ──────────────────────────────────────────────────
export default function Equipment() {
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: inspections } = useCollection("inspections", "createdAt");

  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState("전체");
  const [showAdd, setShowAdd]         = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [form, setForm]               = useState(EMPTY);
  const [inspItem, setInspItem]       = useState(null);
  const [detailItem, setDetailItem]   = useState(null);
  const [editItem, setEditItem]       = useState(null); // 수정 대상
  const [copyItem, setCopyItem]       = useState(null); // 복사 대상

  const majorCats = ["전체", ...new Set(equipments.map(e => e.majorCategory).filter(Boolean))];
  const filtered  = equipments.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) ||
     e.manufacturer?.includes(search) || e.itemNo?.includes(search) || e.unitNo?.includes(search))
  );

  // 모델별 통계
  const modelStats = equipments.reduce((acc, e) => {
    const key = e.modelName || "";
    if (!key) return acc;
    if (!acc[key]) acc[key] = { total: 0, available: 0 };
    acc[key].total++;
    if ((e.status || "대여가능") === "대여가능") acc[key].available++;
    return acc;
  }, {});

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const addEquip = async () => {
    if (!form.modelName) return;
    await addItem("equipments", { ...form, name: form.modelName });
    setForm(EMPTY); setShowAdd(false);
  };

  // 수정 시작 — 기존 데이터로 폼 채우기
  const startEdit = (e) => {
    setEditItem(e);
    setForm({
      majorCategory:      e.majorCategory      || "",
      minorCategory:      e.minorCategory      || "",
      subCategory:        e.subCategory        || "",
      manufacturer:       e.manufacturer       || "",
      modelName:          e.modelName          || "",
      itemName:           e.itemName           || "",
      unitNo:             e.unitNo             || "",
      itemNo:             e.itemNo             || "",
      status:             e.status             || "대여가능",
      licenseLevel:       e.licenseLevel       || 0,
      location:           e.location           || "",
      photoUrls:          e.photoUrls          || [],
      snPhotoUrl:         e.snPhotoUrl         || "",
      displayPhotoUrl:    e.displayPhotoUrl    || "",
      serialNo:           e.serialNo           || "",
      note:               e.note               || "",
      isSet:              e.isSet              || false,
      setItems:           e.setItems           || "",
      description:        e.description        || "",
      equipType:          e.equipType          || "",
      mount:              e.mount              || "",
      batteryModel:       e.batteryModel       || "",
      forCamera:          e.forCamera          || "",
      forCameras:         e.forCameras         || [],
      chargerForCameras:  e.chargerForCameras  || [],
      adapterFrom:        e.adapterFrom        || "",
      adapterTo:          e.adapterTo          || "",
      _minorCustom:       false,
    });
  };

  // 복사 시작 — 기존 데이터로 폼 채우되 itemNo/serialNo 비움
  const startCopy = (e) => {
    setCopyItem(e);
    setForm({
      majorCategory:   e.majorCategory   || "",
      minorCategory:   e.minorCategory   || "",
      manufacturer:    e.manufacturer    || "",
      modelName:       e.modelName       || "",
      itemName:        e.itemName        || "",
      unitNo:          e.unitNo          || "",
      itemNo:          "",   // 번호만 비움
      status:          "대여가능",
      licenseLevel:    e.licenseLevel    || 0,
      location:        e.location        || "",
      photoUrls:       e.photoUrls       || [],
      snPhotoUrl:      "",   // S/N 사진 비움
      displayPhotoUrl: e.displayPhotoUrl || "",
      serialNo:        "",   // 시리얼 비움
      note:            e.note            || "",
      isSet:           e.isSet           || false,
      setItems:        e.setItems        || "",
    });
  };

  const saveCopy = async () => {
    if (!form.modelName) return;
    await addItem("equipments", { ...form, name: form.modelName });
    setCopyItem(null);
    setForm(EMPTY);
  };

  const saveEdit = async () => {
    if (!form.modelName || !editItem) return;
    await updateItem("equipments", editItem.id, { ...form, name: form.modelName });
    setEditItem(null);
    setForm(EMPTY);
  };

  // 엑셀 내보내기
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = equipments.map(e => ({
      "대분류":   e.majorCategory || "",
      "소분류":   e.minorCategory || "",
      "제조사":   e.manufacturer  || "",
      "모델명":   e.modelName     || "",
      "품명":     e.itemName      || "",
      "호기":     e.unitNo        || "",
      "물품번호": e.itemNo        || "",
      "상태":     e.status        || "대여가능",
      "보관위치": e.location      || "",
      "S/N":      e.serialNo      || "",
      "라이센스제한": `${e.licenseLevel || 0}단계`,
      "세트여부": e.isSet ? "O" : "",
      "구성품":   e.isSet ? (e.setItems || "").split("\n").join(", ") : "",
      "특이사항": e.note          || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    // 컬럼 너비 설정
    ws["!cols"] = [
      {wch:10},{wch:12},{wch:10},{wch:18},{wch:22},
      {wch:8},{wch:12},{wch:10},{wch:20},{wch:16},{wch:8},{wch:30},{wch:20}
    ];
    XLSX.utils.book_append_sheet(wb, ws, "장비목록");
    XLSX.writeFile(wb, `장비현황_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const cycleStatus = async (e) => {
    const cycle = ["대여가능","수리중","대여불가","대여중"];
    const next  = cycle[(cycle.indexOf(e.status || "대여가능") + 1) % cycle.length];
    await updateItem("equipments", e.id, { status: next });
  };

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>🔧 장비 관리</div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={exportExcel}              style={{ background:C.greenLight, color:C.green, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>📤 내보내기</button>
            <button onClick={() => setShowImport(true)} style={{ background:C.tealLight, color:C.teal, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>📥 일괄등록</button>
            <button onClick={() => setShowAdd(true)}    style={{ background:C.navy, color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>+ 추가</button>
          </div>
        </div>
      </div>



      {/* 장비 추가 모달 */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setForm(EMPTY); }} width={520}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>새 장비 등록 (1대)</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>같은 모델을 여러 대 등록할 경우 각각 별도로 등록하세요</div>
          {/* 대분류 + 중분류 1행 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>대분류 *</div>
              <select value={form.majorCategory} onChange={e => { f("majorCategory", e.target.value); f("minorCategory", ""); }}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:form.majorCategory?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
                <option value="">대분류 선택</option>
                {MAJOR_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>중분류</div>
                <button onClick={() => { f("_minorCustom", !form._minorCustom); f("minorCategory",""); }}
                  style={{ fontSize:10, color:C.teal, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
                  {form._minorCustom ? "목록에서 선택" : "+ 직접 추가"}
                </button>
              </div>
              {form._minorCustom ? (
                <input placeholder="중분류 직접 입력" value={form.minorCategory} onChange={e => { f("minorCategory", e.target.value); f("equipType","etc"); }}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.teal}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              ) : (
                <select value={form.minorCategory} onChange={e => { f("minorCategory", e.target.value); f("equipType", EQUIP_TYPE_MAP[e.target.value]||"etc"); }}
                  disabled={!form.majorCategory}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:form.minorCategory?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", cursor:form.majorCategory?"pointer":"not-allowed", opacity:form.majorCategory?1:0.5, boxSizing:"border-box" }}>
                  <option value="">중분류 선택</option>
                  {(MINOR_CATS[form.majorCategory]||[]).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>
          {/* 소분류 텍스트 입력 - 다음 행 전체 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>소분류 <span style={{ fontSize:10, color:C.muted }}>(직접 입력)</span></div>
            <input placeholder="예: ILME-FX3, 50mm F1.8, NP-FZ100" value={form.subCategory||""} onChange={e => f("subCategory", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>
          <Inp label="제조사" placeholder="예: SONY, CANON" value={form.manufacturer} onChange={e => f("manufacturer", e.target.value)} />
          <Inp label="모델명 *" placeholder="예: PXW-Z150" value={form.modelName} onChange={e => f("modelName", e.target.value)} />
<div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>장비 설명 <span style={{ fontSize:10, color:C.muted }}>(학생에게 표시)</span></div>
              <textarea placeholder="이 장비가 어떤 건지, 어떨 때 쓰는지 설명해주세요" value={form.description||""} onChange={e => f("description", e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }} />
            </div>

          {/* 라이센스 제한 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>라이센스 제한 단계</div>
            <div style={{ display:"flex", gap:8 }}>
              {LICENSE_LEVELS.map(lv => (
                <button key={lv.val} onClick={() => f("licenseLevel", lv.val)} style={{ flex:1, padding:"10px 0", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", textAlign:"center",
                  background: form.licenseLevel===lv.val ? lv.color : C.bg,
                  color:      form.licenseLevel===lv.val ? "#fff"    : C.muted,
                  border:    `1.5px solid ${form.licenseLevel===lv.val ? lv.color : C.border}`,
                }}>
                  {lv.label}
                  <div style={{ fontSize:9, marginTop:2, opacity:0.8 }}>{lv.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Inp label="호기 (구분번호)" placeholder="예: 1호기, A, No.1" value={form.unitNo} onChange={e => f("unitNo", e.target.value)} />
            <Inp label="물품번호" placeholder="예: CAM-001" value={form.itemNo} onChange={e => f("itemNo", e.target.value)} />
          </div>

          {/* 가이드 모드 설정 */}
          <div style={{ marginBottom:16, background:C.purpleLight, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.purple, marginBottom:12 }}>🧭 가이드 모드 설정</div>
            <div style={{ marginBottom:12, padding:"8px 12px", background:C.bg, borderRadius:8 }}>
              <div style={{ fontSize:11, color:C.purple, fontWeight:600 }}>🧭 가이드 유형: {form.equipType || "소분류 선택 시 자동 설정"}</div>
            </div>
            {(form.equipType==="camera" || form.equipType==="lens" || form.equipType==="camcorder" || ["카메라","드론/액션캠","단렌즈","줌렌즈","시네렌즈"].includes(form.minorCategory)) && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>마운트</div>
                <div style={{ display:"flex", gap:6 }}>
                  {[["E-mount","E-mount (Sony)"],["EF-mount","EF-mount (Canon)"]].map(([val, label]) => (
                    <button key={val} onClick={() => f("mount", val)}
                      style={{ flex:1, padding:"7px 0", borderRadius:9, border:`1.5px solid ${form.mount===val?C.purple:C.border}`, background:form.mount===val?C.purple:C.bg, color:form.mount===val?"#fff":C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(form.equipType==="camera" || ["카메라","드론/액션캠"].includes(form.minorCategory)) && (
              <Inp label="호환 배터리 모델명" placeholder="예: NP-FZ100"
                value={form.batteryModel||""} onChange={e => f("batteryModel", e.target.value)} />
            )}
            {(form.equipType==="charger" || form.minorCategory==="충전기/전원") && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능)</span></div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                  {(form.chargerForCameras||[]).map((cam, i) => (
                    <span key={i} style={{ background:C.blueLight, color:C.navy, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                      {cam}
                      <button onClick={() => f("chargerForCameras", (form.chargerForCameras||[]).filter((_,j)=>j!==i))}
                        style={{ background:"none", border:"none", color:C.navy, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <input id="chargerCamInput" placeholder="예: Sony FX3" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      f("chargerForCameras", [...(form.chargerForCameras||[]), e.target.value.trim()]);
                      e.target.value = "";
                    }
                  }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                  <button onClick={() => {
                    const input = document.getElementById("chargerCamInput");
                    if (input?.value.trim()) { f("chargerForCameras", [...(form.chargerForCameras||[]), input.value.trim()]); input.value = ""; }
                  }} style={{ background:C.navy, color:"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
            )}
            {(form.equipType==="battery" || form.minorCategory==="배터리") && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능)</span></div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                  {(form.forCameras||[]).map((cam, i) => (
                    <span key={i} style={{ background:C.blueLight, color:C.navy, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                      {cam}
                      <button onClick={() => f("forCameras", (form.forCameras||[]).filter((_,j)=>j!==i))}
                        style={{ background:"none", border:"none", color:C.navy, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <input id="camInput" placeholder="예: Sony FX3" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      f("forCameras", [...(form.forCameras||[]), e.target.value.trim()]);
                      e.target.value = "";
                    }
                  }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                  <button onClick={() => {
                    const input = document.getElementById("camInput");
                    if (input?.value.trim()) { f("forCameras", [...(form.forCameras||[]), input.value.trim()]); input.value = ""; }
                  }} style={{ background:C.navy, color:"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
            )}
            {form.equipType==="adapter" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>렌즈 마운트 (From)</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {["EF-mount","E-mount"].map(v => (
                      <button key={v} onClick={() => f("adapterFrom", v)}
                        style={{ padding:"6px 0", borderRadius:8, border:`1.5px solid ${form.adapterFrom===v?C.purple:C.border}`, background:form.adapterFrom===v?C.purple:C.bg, color:form.adapterFrom===v?"#fff":C.muted, fontSize:12, cursor:"pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>카메라 마운트 (To)</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {["E-mount","EF-mount"].map(v => (
                      <button key={v} onClick={() => f("adapterTo", v)}
                        style={{ padding:"6px 0", borderRadius:8, border:`1.5px solid ${form.adapterTo===v?C.purple:C.border}`, background:form.adapterTo===v?C.purple:C.bg, color:form.adapterTo===v?"#fff":C.muted, fontSize:12, cursor:"pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ border:`1px dashed ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:14 }}>세부사항 (선택)</div>
            <SingleImageUploader label="🖼️ 송출용 이미지 (학생에게 표시)" value={form.displayPhotoUrl || ""} onChange={url => f("displayPhotoUrl", url)} />
            <MultiImageUploader values={form.photoUrls} onChange={urls => f("photoUrls", urls)} max={4} />
            <Inp label="보관 위치" placeholder="예: A동 101호 3번 선반" value={form.location} onChange={e => f("location", e.target.value)} />
            <Inp label="S/N" placeholder="예: SN-20240001" value={form.serialNo} onChange={e => f("serialNo", e.target.value)} />
            <SingleImageUploader label="S/N 사진" value={form.snPhotoUrl} onChange={url => f("snPhotoUrl", url)} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>특이사항</div>
              <textarea placeholder="특이사항 또는 메모" value={form.note} onChange={e => f("note", e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:60, boxSizing:"border-box" }} />
            </div>
          </div>

          {/* 세트 구성 */}
          <div style={{ border:`1px dashed ${C.orange}`, borderRadius:12, padding:16, marginBottom:16, background:form.isSet?C.orangeLight:"transparent" }}>
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom: form.isSet ? 14 : 0 }}>
              <input type="checkbox" checked={form.isSet} onChange={e => f("isSet", e.target.checked)} style={{ width:18, height:18, cursor:"pointer" }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.orange }}>📦 세트 장비로 등록</div>
                <div style={{ fontSize:11, color:C.muted }}>체크 시 구성품 전체가 세트로만 대여 가능</div>
              </div>
            </label>
            {form.isSet && (
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>구성품 목록 *</div>
                <textarea
                  placeholder="한 줄에 하나씩 입력하세요 (예: Zoom F6 본체, 쇼크마운트, 윈드스크린)"
                  value={form.setItems}
                  onChange={e => f("setItems", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.orange}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:120, boxSizing:"border-box" }}
                />
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowAdd(false); setForm(EMPTY); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={addEquip} full disabled={!form.modelName}>등록</Btn>
          </div>
        </Modal>
      )}

      {/* 복사 모달 */}
      {copyItem && (
        <Modal onClose={() => { setCopyItem(null); setForm(EMPTY); }} width={560}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>📋 장비 복사 등록</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
            <span style={{ color:C.teal, fontWeight:700 }}>{copyItem.modelName}</span> 을 복사합니다.
            제품 번호와 S/N만 변경 후 등록하세요.
          </div>

          {/* 핵심 변경 필드 강조 */}
          <div style={{ background:C.tealLight, borderRadius:12, padding:"14px 16px", marginBottom:16, border:`1.5px solid ${C.teal}40` }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.teal, marginBottom:10 }}>변경 필요 항목</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Inp label="제품 번호 (itemNo) *" placeholder="예: SET_ZOOM F6 02" value={form.itemNo} onChange={e => setForm(p=>({...p,itemNo:e.target.value}))} />
              <Inp label="시리얼 번호" placeholder="예: SN12345" value={form.serialNo} onChange={e => setForm(p=>({...p,serialNo:e.target.value}))} />
            </div>
          </div>

          {/* 나머지 필드 (수정 가능) */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <Inp label="모델명" value={form.modelName} onChange={e => setForm(p=>({...p,modelName:e.target.value}))} />
<div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>장비 설명 <span style={{ fontSize:10, color:C.muted }}>(학생에게 표시)</span></div>
              <textarea placeholder="이 장비가 어떤 건지, 어떨 때 쓰는지 설명해주세요" value={form.description||""} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }} />
            </div>
            <Inp label="보관 위치" value={form.location} onChange={e => setForm(p=>({...p,location:e.target.value}))} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>상태</div>
              <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                <option>대여가능</option><option>대여중</option><option>수리중</option><option>분실</option>
              </select>
            </div>
          </div>
          <Inp label="비고" value={form.note} onChange={e => setForm(p=>({...p,note:e.target.value}))} />

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn onClick={() => { setCopyItem(null); setForm(EMPTY); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={saveCopy} color={C.teal} full disabled={!form.itemNo.trim()}>📋 복사 등록</Btn>
          </div>
        </Modal>
      )}

      {/* 수정 모달 */}
      {editItem && (
        <Modal onClose={() => { setEditItem(null); setForm(EMPTY); }} width={520}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>✏️ 장비 수정</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>{editItem.modelName} {editItem.unitNo && `· ${editItem.unitNo}`}</div>
          {/* 대분류 + 중분류 1행 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>대분류 *</div>
              <select value={form.majorCategory} onChange={e => { f("majorCategory", e.target.value); f("minorCategory", ""); }}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:form.majorCategory?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
                <option value="">대분류 선택</option>
                {MAJOR_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>중분류</div>
                <button onClick={() => { f("_minorCustom", !form._minorCustom); f("minorCategory",""); }}
                  style={{ fontSize:10, color:C.teal, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
                  {form._minorCustom ? "목록에서 선택" : "+ 직접 추가"}
                </button>
              </div>
              {form._minorCustom ? (
                <input placeholder="중분류 직접 입력" value={form.minorCategory} onChange={e => { f("minorCategory", e.target.value); f("equipType","etc"); }}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.teal}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              ) : (
                <select value={form.minorCategory} onChange={e => { f("minorCategory", e.target.value); f("equipType", EQUIP_TYPE_MAP[e.target.value]||"etc"); }}
                  disabled={!form.majorCategory}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:form.minorCategory?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", cursor:form.majorCategory?"pointer":"not-allowed", opacity:form.majorCategory?1:0.5, boxSizing:"border-box" }}>
                  <option value="">중분류 선택</option>
                  {(MINOR_CATS[form.majorCategory]||[]).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>
          {/* 소분류 텍스트 입력 - 다음 행 전체 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>소분류 <span style={{ fontSize:10, color:C.muted }}>(직접 입력)</span></div>
            <input placeholder="예: ILME-FX3, 50mm F1.8, NP-FZ100" value={form.subCategory||""} onChange={e => f("subCategory", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>
          <Inp label="제조사" value={form.manufacturer} onChange={e => f("manufacturer", e.target.value)} />
          <Inp label="모델명 *" value={form.modelName} onChange={e => f("modelName", e.target.value)} />
<div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>장비 설명 <span style={{ fontSize:10, color:C.muted }}>(학생에게 표시)</span></div>
              <textarea placeholder="이 장비가 어떤 건지, 어떨 때 쓰는지 설명해주세요" value={form.description||""} onChange={e => f("description", e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }} />
            </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Inp label="호기" value={form.unitNo} onChange={e => f("unitNo", e.target.value)} />
            <Inp label="물품번호" value={form.itemNo} onChange={e => f("itemNo", e.target.value)} />
          </div>

          {/* 라이센스 제한 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>라이센스 제한 단계</div>
            <div style={{ display:"flex", gap:8 }}>
              {LICENSE_LEVELS.map(lv => (
                <button key={lv.val} onClick={() => f("licenseLevel", lv.val)} style={{ flex:1, padding:"10px 0", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", textAlign:"center",
                  background: form.licenseLevel===lv.val ? lv.color : C.bg,
                  color:      form.licenseLevel===lv.val ? "#fff"    : C.muted,
                  border:    `1.5px solid ${form.licenseLevel===lv.val ? lv.color : C.border}`,
                }}>
                  {lv.label}
                  <div style={{ fontSize:9, marginTop:2, opacity:0.8 }}>{lv.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 상태 선택 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>상태</div>
            <div style={{ display:"flex", gap:8 }}>
              {["대여가능","수리중","대여불가","대여중"].map(s => (
                <button key={s} onClick={() => f("status", s)} style={{ flex:1, padding:"8px 0", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit",
                  background: form.status===s ? C.navy : C.bg,
                  color:      form.status===s ? "#fff" : C.muted,
                  border:     `1.5px solid ${form.status===s ? C.navy : C.border}`,
                }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ border:`1px dashed ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:14 }}>세부사항</div>
            <SingleImageUploader label="🖼️ 송출용 이미지 (학생에게 표시)" value={form.displayPhotoUrl || ""} onChange={url => f("displayPhotoUrl", url)} />
            <MultiImageUploader values={form.photoUrls} onChange={urls => f("photoUrls", urls)} max={4} />
            <Inp label="보관 위치" value={form.location} onChange={e => f("location", e.target.value)} />
            <Inp label="S/N" value={form.serialNo} onChange={e => f("serialNo", e.target.value)} />
            <SingleImageUploader label="S/N 사진" value={form.snPhotoUrl} onChange={url => f("snPhotoUrl", url)} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>특이사항</div>
              <textarea value={form.note} onChange={e => f("note", e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:60, boxSizing:"border-box" }} />
            </div>
          </div>

          {/* 세트 구성 */}
          <div style={{ border:`1px dashed ${C.orange}`, borderRadius:12, padding:16, marginBottom:16, background:form.isSet?C.orangeLight:"transparent" }}>
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom: form.isSet ? 14 : 0 }}>
              <input type="checkbox" checked={form.isSet} onChange={e => f("isSet", e.target.checked)} style={{ width:18, height:18, cursor:"pointer" }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.orange }}>📦 세트 장비</div>
                <div style={{ fontSize:11, color:C.muted }}>체크 시 구성품 전체가 세트로만 대여 가능</div>
              </div>
            </label>
            {form.isSet && (
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>구성품 목록</div>
                <textarea placeholder="한 줄에 하나씩 입력 (예: Zoom F6 본체, 쇼크마운트...)" value={form.setItems} onChange={e => f("setItems", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.orange}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:100, boxSizing:"border-box" }} />
              </div>
            )}
          </div>

          {/* 가이드 모드 설정 (수정 모달) */}
          <div style={{ marginBottom:16, background:C.purpleLight, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.purple, marginBottom:12 }}>🧭 가이드 모드 설정</div>
            <div style={{ marginBottom:12, padding:"8px 12px", background:C.bg, borderRadius:8 }}>
              <div style={{ fontSize:11, color:C.purple, fontWeight:600 }}>🧭 가이드 유형: {form.equipType || "소분류 선택 시 자동 설정"}</div>
            </div>
            {(form.equipType==="camera" || form.equipType==="lens" || form.equipType==="camcorder" || ["카메라","드론/액션캠","단렌즈","줌렌즈","시네렌즈"].includes(form.minorCategory)) && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>마운트</div>
                <div style={{ display:"flex", gap:6 }}>
                  {[["E-mount","E-mount (Sony)"],["EF-mount","EF-mount (Canon)"]].map(([val, label]) => (
                    <button key={val} onClick={() => f("mount", val)}
                      style={{ flex:1, padding:"7px 0", borderRadius:9, border:`1.5px solid ${form.mount===val?C.purple:C.border}`, background:form.mount===val?C.purple:C.bg, color:form.mount===val?"#fff":C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(form.equipType==="camera" || ["카메라","드론/액션캠"].includes(form.minorCategory)) && (
              <Inp label="호환 배터리 모델명" placeholder="예: NP-FZ100"
                value={form.batteryModel||""} onChange={e => f("batteryModel", e.target.value)} />
            )}
            {(form.equipType==="battery" || form.minorCategory==="배터리") && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능)</span></div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                  {(form.forCameras||[]).map((cam, i) => (
                    <span key={i} style={{ background:C.blueLight, color:C.navy, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                      {cam}
                      <button onClick={() => f("forCameras", (form.forCameras||[]).filter((_,j)=>j!==i))}
                        style={{ background:"none", border:"none", color:C.navy, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <input id="camInput" placeholder="예: Sony FX3" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      f("forCameras", [...(form.forCameras||[]), e.target.value.trim()]);
                      e.target.value = "";
                    }
                  }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                  <button onClick={() => {
                    const input = document.getElementById("camInput");
                    if (input?.value.trim()) { f("forCameras", [...(form.forCameras||[]), input.value.trim()]); input.value = ""; }
                  }} style={{ background:C.navy, color:"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
            )}
            {form.equipType==="adapter" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>렌즈 마운트 (From)</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {["EF-mount","E-mount"].map(v => (
                      <button key={v} onClick={() => f("adapterFrom", v)}
                        style={{ padding:"6px 0", borderRadius:8, border:`1.5px solid ${form.adapterFrom===v?C.purple:C.border}`, background:form.adapterFrom===v?C.purple:C.bg, color:form.adapterFrom===v?"#fff":C.muted, fontSize:12, cursor:"pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>카메라 마운트 (To)</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {["E-mount","EF-mount"].map(v => (
                      <button key={v} onClick={() => f("adapterTo", v)}
                        style={{ padding:"6px 0", borderRadius:8, border:`1.5px solid ${form.adapterTo===v?C.purple:C.border}`, background:form.adapterTo===v?C.purple:C.bg, color:form.adapterTo===v?"#fff":C.muted, fontSize:12, cursor:"pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setEditItem(null); setForm(EMPTY); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={saveEdit} color={C.green} full disabled={!form.modelName}>저장</Btn>
          </div>
        </Modal>
      )}

      {showImport && <ExcelImportModal onClose={() => setShowImport(false)} onImport={async rows => { for (const r of rows) { try { await addItem("equipments", { ...r, name: r.modelName }); } catch {} } }} />}

      {/* 검색 + 필터 */}
      <div style={{ display:"flex", gap:14, marginBottom:14, flexWrap:"wrap" }}>
        <input placeholder="🔍 모델명, 품명, 호기, 물품번호 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:200, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {majorCats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background:filter===c?C.navy:C.surface, color:filter===c?"#fff":C.muted, border:`1px solid ${filter===c?C.navy:C.border}`, borderRadius:20, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* 모델별 그룹화 */}
      {(() => {
        // 모델명 기준 그룹화
        const groups = Object.values(
          filtered.reduce((acc, e) => {
            const key = e.modelName || e.id;
            if (!acc[key]) acc[key] = { rep: e, units: [] };
            acc[key].units.push(e);
            return acc;
          }, {})
        );
        return groups.length === 0
          ? <Empty icon="🔧" text="등록된 장비가 없습니다" />
          : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {groups.map(({ rep, units }) => (
                <EquipCardGroup key={rep.modelName||rep.id} rep={rep} units={units}
                  onDetail={setDetailItem}
                  onInsp={setInspItem}
                  onDelete={id => deleteItem("equipments", id)}
                  onCycleStatus={cycleStatus}
                  onEdit={startEdit}
                  onCopy={startCopy}
                />
              ))}
            </div>
          );
      })()}

      {inspItem   && <InspModal   item={inspItem}   inspections={inspections} onClose={() => setInspItem(null)} />}
      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailItem(null)} onSave={(id, data) => updateItem("equipments", id, data)} />}
    </div>
  );
}
