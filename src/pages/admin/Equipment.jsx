import { useState, useRef } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import CategoryMigrator from "../../components/CategoryMigrator";
import EquipReorderModal from "../../components/EquipReorderModal";
import { isValidYoutubeUrl } from "../../utils/youtube";
import { isLens } from "../../utils/equipCompat";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// 🗂️ 상단 카테고리 아이콘 그리드 — 학생 EquipList와 동일한 12분류.
//    ⚠️ 학생 EquipList.jsx의 RENTAL_CATEGORIES / CAT_MATCH 와 동일하게 유지할 것.
//       (매핑이 어긋나면 장비가 목록에서 사라지는 버그로 이어짐. 원본 = EquipList.jsx)
const RENTAL_CATEGORIES = [
  { name: "카메라",        icon: "📷", img: "/cat-icons/camera.png" },
  { name: "캠코더",        icon: "📹", img: "/cat-icons/camcorder.png" },
  { name: "액션캠/드론",    icon: "🚁", img: "/cat-icons/actioncam-drone.png" },
  { name: "렌즈",          icon: "🔭", img: "/cat-icons/lens.png" },
  { name: "ACC",          icon: "🔌", img: "/cat-icons/acc.png" },
  { name: "삼각대/그립",    icon: "📐", img: "/cat-icons/tripod.png" },
  { name: "모니터",        icon: "🖥️", img: "/cat-icons/monitor.png" },
  { name: "조명",          icon: "💡", img: "/cat-icons/light.png" },
  { name: "음향",          icon: "🎤", img: "/cat-icons/audio.png" },
  { name: "기타",          icon: "📦", img: "/cat-icons/etc.png" },
  { name: "편집",          icon: "✂️", img: "/cat-icons/edit.png" },
  { name: "외부 렌탈샵", icon: "🏬", img: "/cat-icons/external.png" },
];
// 학생 아이콘(filter) → 관리자 데이터(대분류 major + 중분류 minor) 매핑
const CAT_MATCH = {
  "카메라":       (e) => e.minorCategory === "카메라" || e.majorCategory === "카메라",
  "캠코더":       (e) => e.minorCategory === "캠코더" || e.majorCategory === "캠코더",
  "액션캠/드론":   (e) => e.minorCategory === "드론/액션캠" || ["액션캠/드론", "드론/액션캠", "액션캠", "드론"].includes(e.majorCategory),
  "렌즈":         (e) => e.majorCategory === "렌즈" || isLens(e),
  "ACC":          (e) => e.majorCategory === "ACC" || ["배터리", "충전기/전원", "저장매체", "카드리더기"].includes(e.minorCategory),
  "삼각대/그립":   (e) => e.majorCategory === "트라이포드/그립" || e.majorCategory === "삼각대/그립",
  "모니터":       (e) => e.majorCategory === "모니터",
  "조명":         (e) => e.majorCategory === "조명",
  "음향":         (e) => e.majorCategory === "음향",
  "기타":         (e) => e.minorCategory === "기타" || e.majorCategory === "기타",
  "편집":         (e) => e.majorCategory === "편집",
};
// 카테고리 아이콘 — img 있으면 이미지, 없거나 로드 실패 시 이모지 폴백
function CatIcon({ c }) {
  const [err, setErr] = useState(false);
  return c.img && !err
    ? <img src={c.img} alt={c.name} onError={() => setErr(true)} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
    : <span>{c.icon}</span>;
}

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
function MultiImageUploader({ values = [], onChange, max = 10 }) {
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
          {values.map((url, i) => (
            <div key={i} style={{ position: "relative", paddingTop: "100%", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg }}>
              <img loading="lazy" decoding="async" src={url} alt={`사진${i+1}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
              <span style={{ position:"absolute", bottom:3, left:3, fontSize:9, fontWeight:800, color:"#fff", background:"rgba(0,0,0,0.55)", borderRadius:4, padding:"0 4px" }}>{i+1}</span>
              <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="tap-spring" style={{ position: "absolute", top: 3, right: 3, background: C.red, color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✕</button>
            </div>
          ))}
          {values.length < max && (
            <div onClick={() => !uploading && inputRef.current.click()} className="tap-spring" style={{ position:"relative", paddingTop:"100%", border: `2px dashed ${C.border}`, borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer", background: C.bg }}>
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                {uploading
                  ? <div style={{ color: C.blue, fontSize: 12, fontWeight: 600 }}>⏳</div>
                  : <><div style={{ fontSize: 22 }}>＋</div><div style={{ fontSize: 10, color: C.muted, marginTop:2 }}>{values.length}/{max}</div></>}
              </div>
            </div>
          )}
        </div>
      )}
      {values.length === 0 && (
        <div onClick={() => !uploading && inputRef.current.click()} className="tap-spring" style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: "20px 0", textAlign: "center", cursor: uploading ? "not-allowed" : "pointer", background: C.bg }}>
          {uploading ? <div style={{ color: C.blue, fontSize: 13, fontWeight: 600 }}>⏳ 업로드 중...</div> : (
            <><div style={{ fontSize: 28, marginBottom: 6 }}>📷</div><div style={{ fontSize: 12, color: C.muted }}>클릭하여 사진 추가 (최대 {max}장)</div></>
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

// ── 장비 사진 모달 (제품사진 / 시리얼사진 탭 · 좌우 넘김) ──
function EquipPhotoModal({ productPhotos = [], snPhoto = "", title = "사진", onClose }) {
  const [tab, setTab] = useState(productPhotos.length ? "product" : "sn");
  const [idx, setIdx] = useState(0);
  const photos = tab === "product" ? productPhotos : (snPhoto ? [snPhoto] : []);
  const cur = Math.min(idx, Math.max(0, photos.length - 1));
  const go   = (d) => setIdx(i => (i + d + photos.length) % photos.length);
  const pick = (t) => { setTab(t); setIdx(0); };
  const navBtn = { position:"absolute", top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.14)", color:"#fff", border:"none", borderRadius:"50%", width:40, height:40, fontSize:22, fontWeight:700, cursor:"pointer", lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" };
  const tabBtn = (active) => ({ flex:1, padding:"9px 0", fontSize:12.5, fontWeight:800, cursor:"pointer", border:"none", borderRadius:10, fontFamily:"inherit",
    background: active ? "linear-gradient(135deg,#3b82f6,#7c3aed)" : "rgba(255,255,255,0.08)", color: active ? "#fff" : "rgba(255,255,255,0.65)" });
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column" }}>
      {/* 헤더 */}
      <div onClick={e => e.stopPropagation()} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", paddingTop:"max(env(safe-area-inset-top),14px)" }}>
        <span style={{ color:"#fff", fontSize:14, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
        <button onClick={onClose} className="tap-spring" style={{ flexShrink:0, marginLeft:10, background:"rgba(255,255,255,0.15)", color:"#fff", border:"none", borderRadius:"50%", width:34, height:34, fontSize:15, fontWeight:700, cursor:"pointer" }}>✕</button>
      </div>
      {/* 탭: 제품사진 / 시리얼사진 */}
      <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:8, padding:"0 16px 12px", width:"100%", maxWidth:520, margin:"0 auto", boxSizing:"border-box" }}>
        <button className="tap-spring" onClick={() => pick("product")} style={tabBtn(tab === "product")}>제품사진{productPhotos.length ? ` ${productPhotos.length}` : ""}</button>
        <button className="tap-spring" onClick={() => pick("sn")}      style={tabBtn(tab === "sn")}>시리얼사진{snPhoto ? " 1" : ""}</button>
      </div>
      {/* 이미지 영역 */}
      <div onClick={onClose} style={{ flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", minHeight:0 }}>
        {photos.length ? (
          <img onClick={e => e.stopPropagation()} src={photos[cur]} alt="" style={{ maxWidth:"92%", maxHeight:"100%", objectFit:"contain", borderRadius:8 }} />
        ) : (
          <div style={{ color:"rgba(255,255,255,0.55)", fontSize:13 }}>{tab === "product" ? "등록된 제품사진이 없습니다" : "등록된 시리얼 사진이 없습니다"}</div>
        )}
        {photos.length > 1 && (<>
          <button onClick={e => { e.stopPropagation(); go(-1); }} className="tap-spring" style={{ ...navBtn, left:12 }}>‹</button>
          <button onClick={e => { e.stopPropagation(); go(1);  }} className="tap-spring" style={{ ...navBtn, right:12 }}>›</button>
        </>)}
      </div>
      {/* 점 */}
      {photos.length > 1 && (
        <div onClick={e => e.stopPropagation()} style={{ display:"flex", gap:6, justifyContent:"center", padding:"12px 0", paddingBottom:"max(env(safe-area-inset-bottom),16px)" }}>
          {photos.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{ width:i===cur?18:7, height:7, borderRadius:99, background:i===cur?"#fff":"rgba(255,255,255,0.4)", cursor:"pointer", transition:"all .2s" }} />
          ))}
        </div>
      )}
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
            <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{ flex: 1, background: form.type === t ? C.navy : C.surface, color: form.type === t ? C.bg : C.muted, border: `1px solid ${form.type === t ? C.navy : C.border}`, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t}</button>
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
      <MultiImageUploader values={form.photoUrls} onChange={urls => setForm(p => ({ ...p, photoUrls: urls }))} max={10} />
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
          ? <img loading="lazy" decoding="async" src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
          : <span style={{ fontSize:18 }}>📷</span>
        }
      </div>

      {/* 정보 */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* 1행: 모델명 + 호기 + 상태 */}
        <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{e.modelName}</span>
          {e.unitNo && <span style={{ fontSize:10, background:C.navy, color: C.bg, borderRadius:4, padding:"1px 5px", fontWeight:700, flexShrink:0 }}>{e.unitNo}</span>}
          
          {e.licenseLevel > 0 && (() => { const lv = LICENSE_LEVELS[e.licenseLevel]; return lv ? <span style={{ fontSize:10, background:lv.bg, color:lv.color, borderRadius:4, padding:"1px 5px", fontWeight:700, flexShrink:0 }}>Lv.{e.licenseLevel}</span> : null; })()}
          <span style={{ fontSize:10, background:statusBg, color:statusColor, borderRadius:4, padding:"1px 6px", fontWeight:700, flexShrink:0 }}>{e.status||"대여가능"}</span>
        </div>
        {/* 2행: 분류 + 제조사 + 위치 */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
          {e.majorCategory && <span style={{ fontSize:10, color:C.blue, background:C.blueLight, borderRadius:4, padding:"0px 5px" }}>{e.majorCategory}</span>}
          {e.minorCategory && <span style={{ fontSize:10, color:C.muted }}>{e.minorCategory}</span>}
          
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

// 개체 목록(펼침) — 학생 블루 액센트 디자인에 맞춘 상태/버튼 색
const STU_UNIT_STATUS = {
  대여가능: { color:"#34D399", bg:"rgba(52,211,153,0.14)" },
  대여중:   { color:"#7e9dff", bg:"rgba(96,130,246,0.16)" },
  수리중:   { color:"#fbbf24", bg:"rgba(245,158,11,0.14)" },
  대여불가: { color:"#FF6B6B", bg:"rgba(255,107,107,0.14)" },
};
const STU_UNIT_BTN = {
  photo:  { color:"#2DD4BF", bg:"rgba(45,212,191,0.13)",  bd:"rgba(45,212,191,0.30)" },
  edit:   { color:"#7e9dff", bg:"rgba(96,130,246,0.13)", bd:"rgba(96,130,246,0.28)" },
  status: { color:"#fbbf24", bg:"rgba(245,158,11,0.13)", bd:"rgba(245,158,11,0.28)" },
  del:    { color:"#FF6B6B", bg:"rgba(255,107,107,0.13)", bd:"rgba(255,107,107,0.28)" },
};
const stuBtnStyle = (t) => ({
  background:t.bg, color:t.color, border:`1px solid ${t.bd}`, borderRadius:7,
  padding:"4px 9px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
});

// ── 배민식 카드 UI (학생 EquipList와 동일 룩) ──────────────
const ADM_BOX_CAT = { color:"#93a8e8", bg:"rgba(96,130,246,0.13)", bd:"rgba(96,130,246,0.22)" };
// 라이선스 레벨별 컬러 (Lv.1 민트 / Lv.2 블루 / Lv.3+ 퍼플)
const admLvStyle = (n) =>
  n >= 3 ? { color:"#b79bff", bg:"rgba(124,58,237,0.18)", bd:"rgba(124,58,237,0.34)" } :
  n === 2 ? { color:"#7e9dff", bg:"rgba(96,130,246,0.15)", bd:"rgba(96,130,246,0.30)" } :
            { color:"#2DD4BF", bg:"rgba(45,212,191,0.13)", bd:"rgba(45,212,191,0.28)" };
// 블루 박스 (카테고리 / 라이선스 / 보유대수)
function AdmBox({ s, children }) {
  return <span style={{ fontSize:11, fontWeight:800, padding:"4px 9px", borderRadius:8, whiteSpace:"nowrap",
    color:s.color, background:s.bg, border:`1px solid ${s.bd}` }}>{children}</span>;
}
// 입체 버튼 — 누르면 아래로 쑥 들어가는 모션 (reserve=블루 그라데 / detail=다크)
function PressBtn({ children, onClick, variant = "detail", style }) {
  const [p, setP] = useState(false);
  const base = { fontSize:12, fontWeight:800, padding:"8px 14px", borderRadius:10, border:"none",
    whiteSpace:"nowrap", fontFamily:"inherit", cursor:"pointer",
    transition:"transform .07s ease, box-shadow .07s ease", flexShrink:0, ...style };
  const reserve = variant === "reserve";
  const sh = reserve
    ? (p ? "0 1px 0 #2a2170, 0 2px 7px rgba(79,139,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)"
         : "0 4px 0 #2a2170, 0 6px 14px rgba(79,139,255,0.40), inset 0 1px 0 rgba(255,255,255,0.35)")
    : (p ? "0 1px 0 #0d0f16, 0 2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
         : "0 3px 0 #0d0f16, 0 4px 9px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)");
  const vs = reserve
    ? { color:"#fff", background:"linear-gradient(135deg,#4f8bff,#8b5cf6)", textShadow:"0 1px 1px rgba(0,0,0,0.28)", transform:p?"translateY(3px)":"none" }
    : { color:"#cdd7f6", background:"linear-gradient(180deg,#242836,#191c26)", transform:p?"translateY(2px)":"none" };
  return (
    <button onClick={onClick}
      onPointerDown={() => setP(true)} onPointerUp={() => setP(false)}
      onPointerLeave={() => setP(false)} onPointerCancel={() => setP(false)}
      style={{ ...base, ...vs, boxShadow:sh }}>{children}</button>
  );
}

// ── 모델별 그룹 카드 ────────────────────────────────────────
function EquipCardGroup({ rep, units, onDetail, onInsp, onDelete, onCycleStatus, onEdit, onCopy }) {
  const [open, setOpen] = useState(false);
  const [photoModal, setPhotoModal] = useState(null); // { productPhotos, snPhoto, title }
  const thumb = rep.displayPhotoUrl || (rep.photoUrls?.[0]) || null;

  // 제품사진 갤러리 — 호기(개체)별 photoUrls 우선, 없으면 송출용 이미지로 폴백
  const productPhotosOf = (u) => (u.photoUrls && u.photoUrls.length)
    ? u.photoUrls
    : (u.displayPhotoUrl ? [u.displayPhotoUrl] : []);

  // 상태별 카운트
  const avail    = units.filter(u => (u.status||"대여가능") === "대여가능").length;
  const total    = units.length;

  // 개체 정렬 — 호기번호(01, 02 …) 오름차순. 번호 없으면 itemNo 자연순.
  const sortedUnits = [...units].sort((a, b) => {
    const na = parseInt(a.unitNo, 10), nb = parseInt(b.unitNo, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return (a.itemNo || "").localeCompare(b.itemNo || "", undefined, { numeric: true });
  });

  const availOk = avail > 0;

  return (
    <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, boxShadow:C.shadow, overflow:"hidden", color:C.text }}>
      <div style={{ padding:"12px 13px" }}>
        {/* 상단: 썸네일 · 모델명/제조사 · 대여가능 배지 */}
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ width:48, height:48, borderRadius:9, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {thumb
              ? <img loading="lazy" decoding="async" src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
              : <span style={{ fontSize:20 }}>📷</span>
            }
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rep.modelName}</div>
            {rep.manufacturer && <div style={{ fontSize:11.5, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:1 }}>{rep.manufacturer}</div>}
          </div>
          <span style={{ flexShrink:0, fontSize:10.5, fontWeight:800, padding:"3px 8px", borderRadius:7,
            color:availOk?"#34D399":"#FF6B6B", background:availOk?"#0F3028":"#2E1414" }}>
            {availOk ? "대여가능" : "대여불가"}
          </span>
        </div>

        {/* 하단: 블루 박스 3개 · 수정/펼치기 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:11, flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", minWidth:0 }}>
            {rep.majorCategory && <AdmBox s={ADM_BOX_CAT}>{rep.majorCategory}</AdmBox>}
            {rep.licenseLevel > 0 && <AdmBox s={admLvStyle(rep.licenseLevel)}>Lv.{rep.licenseLevel}</AdmBox>}
            <AdmBox s={ADM_BOX_CAT}>{avail}/{total}대</AdmBox>
          </div>
          <div style={{ display:"flex", gap:7, flexShrink:0, alignItems:"center" }}>
            <PressBtn variant="reserve" onClick={() => onEdit(rep)}>수정</PressBtn>
            <PressBtn onClick={() => setOpen(o => !o)}>{open ? "접기 ▴" : `${total}대 ▾`}</PressBtn>
          </div>
        </div>
      </div>

      {/* 개별 호기 목록 (펼침) — 학생 블루 디자인 · 01→02 정렬 · 2줄(정보 / 버튼) 레이아웃 */}
      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, background:"rgba(96,130,246,0.04)" }}>
          {sortedUnits.map(u => {
            const st = STU_UNIT_STATUS[u.status] || STU_UNIT_STATUS.대여가능;
            return (
              <div key={u.id} style={{ display:"flex", flexDirection:"column", gap:7, padding:"9px 12px", borderBottom:`1px solid ${C.border}` }}>
                {/* 위: 호기번호 · 제품번호 · 위치 · S/N · 대여상태 */}
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{ flexShrink:0, minWidth:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 6px", fontSize:11, fontWeight:800, color:"#93a8e8", background:"rgba(96,130,246,0.13)", border:"1px solid rgba(96,130,246,0.22)", borderRadius:7 }}>{u.unitNo || "-"}</span>
                  {u.itemNo   && <span style={{ fontSize:11, color:C.text, fontWeight:800 }}>#{u.itemNo}</span>}
                  {u.location && <span style={{ fontSize:11, color:C.text, fontWeight:800 }}>📍{u.location}</span>}
                  {u.serialNo && <span style={{ fontSize:11, color:C.text, fontWeight:800 }}>S/N:{u.serialNo}</span>}
                  <span style={{ marginLeft:"auto", flexShrink:0, fontSize:10, background:st.bg, color:st.color, borderRadius:6, padding:"2px 7px", fontWeight:800 }}>{u.status||"대여가능"}</span>
                </div>
                {/* 아래: 사진 / 수정 / 상태 / 삭제 (균등 4버튼) — 사진은 눌러야 열림 */}
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => setPhotoModal({ productPhotos: productPhotosOf(u), snPhoto: u.snPhotoUrl || "", title: `${rep.modelName}${u.unitNo ? " · " + u.unitNo + "호기" : ""}` })}
                    className="tap-spring" style={{ ...stuBtnStyle(STU_UNIT_BTN.photo), flex:1 }}>사진</button>
                  <button onClick={() => onEdit(u)}         className="tap-spring" style={{ ...stuBtnStyle(STU_UNIT_BTN.edit),   flex:1 }}>수정</button>
                  <button onClick={() => onCycleStatus(u)}  className="tap-spring" style={{ ...stuBtnStyle(STU_UNIT_BTN.status), flex:1 }}>상태</button>
                  <button onClick={() => onDelete(u.id)}    className="tap-spring" style={{ ...stuBtnStyle(STU_UNIT_BTN.del),    flex:1 }}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {photoModal && <EquipPhotoModal {...photoModal} onClose={() => setPhotoModal(null)} />}
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
    "장비설명":"description","라이선스단계":"licenseLevel","라이선스단계(0~3)":"licenseLevel","라이선스제한":"licenseLevel",
    "라이센스단계":"licenseLevel","라이센스단계(0~3)":"licenseLevel","라이센스제한":"licenseLevel", // 옛 표기 CSV 호환
    "호기":"unitNo","물품번호":"itemNo",
    "보관위치":"location","S/N":"serialNo","상태":"status","특이사항":"note",
    "마운트":"mount","마운트(E-mount/EF-mount)":"mount",
    "키워드":"keywords",
    "구성품":"bundledItems","구성품/포함아이템":"bundledItems",
    "매뉴얼영상":"guideVideoUrl","매뉴얼영상(유튜브)":"guideVideoUrl","유튜브":"guideVideoUrl",
    "호환배터리모델명":"batteryModel",
    "호환카메라모델명(배터리)":"_forCamerasRaw","호환카메라(배터리)":"_forCamerasRaw",
    "호환카메라모델명(충전기)":"_chargerCamerasRaw","호환카메라(충전기)":"_chargerCamerasRaw",
    "호환배터리":"_chargerBatteriesRaw","호환배터리(충전기)":"_chargerBatteriesRaw",
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
          } else if (en === "_chargerBatteriesRaw") {
            obj.chargerForBatteries = val ? val.split(",").map(s=>s.trim()).filter(Boolean) : [];
          } else if (en === "licenseLevel") {
            obj[en] = parseInt(val.replace(/[^0-9]/g,"")) || 0; // "2단계" → 2
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
        <button onClick={async () => {
          const XLSX = await import("xlsx");
          // 헤더 + 예시 1행 (학생들이 어떻게 입력해야 할지 보기 좋게)
          const examples = [
            {
              "대분류": "촬영", "중분류": "카메라", "소분류": "", "제조사": "Sony",
              "모델명": "Sony FX3", "호기": "1호기", "물품번호": "EQ-001",
              "상태": "대여가능", "보관위치": "장비실 A-1", "S/N": "",
              "라이선스제한": "1단계", "장비설명": "4K 풀프레임 시네마 카메라",
              "키워드": "4K 120fps, S-Cinetone, 풀프레임",
              "구성품": "본체, 마운트 어댑터",
              "매뉴얼영상(유튜브)": "https://youtu.be/예시영상ID",
              "마운트": "E-mount",
              "호환배터리모델명": "NP-FZ100",
              "호환카메라(배터리)": "", "호환카메라(충전기)": "", "호환배터리(충전기)": "",
              "특이사항": "",
            },
            {
              "대분류": "촬영", "중분류": "배터리", "소분류": "", "제조사": "Sony",
              "모델명": "NP-FZ100", "호기": "1호기", "물품번호": "EQ-002",
              "상태": "대여가능", "보관위치": "장비실 B-1", "S/N": "",
              "라이선스제한": "0단계", "장비설명": "",
              "키워드": "", "구성품": "", "매뉴얼영상(유튜브)": "", "마운트": "",
              "호환배터리모델명": "",
              "호환카메라(배터리)": "Sony FX3, Sony A7S3",
              "호환카메라(충전기)": "", "호환배터리(충전기)": "",
              "특이사항": "",
            },
            {
              "대분류": "촬영", "중분류": "충전기/전원", "소분류": "", "제조사": "Sony",
              "모델명": "BC-QZ1", "호기": "1호기", "물품번호": "EQ-003",
              "상태": "대여가능", "보관위치": "장비실 B-2", "S/N": "",
              "라이선스제한": "0단계", "장비설명": "",
              "키워드": "", "구성품": "", "매뉴얼영상(유튜브)": "", "마운트": "",
              "호환배터리모델명": "",
              "호환카메라(배터리)": "",
              "호환카메라(충전기)": "",
              "호환배터리(충전기)": "NP-FZ100",
              "특이사항": "",
            },
            {
              "대분류": "촬영", "중분류": "저장매체", "소분류": "", "제조사": "ProGrade",
              "모델명": "CFexpress Type A 320GB", "호기": "1호기", "물품번호": "EQ-004",
              "상태": "대여가능", "보관위치": "장비실 C-1", "S/N": "",
              "라이선스제한": "0단계", "장비설명": "고속 CFexpress 카드",
              "키워드": "CFexpress Type A, 320GB", "구성품": "", "매뉴얼영상(유튜브)": "", "마운트": "",
              "호환배터리모델명": "",
              "호환카메라(배터리)": "Sony FX3, Sony A7S3",
              "호환카메라(충전기)": "", "호환배터리(충전기)": "",
              "특이사항": "",
            },
          ];
          const ws = XLSX.utils.json_to_sheet(examples);
          const example = examples[0];
          ws["!cols"] = Object.keys(example).map(k => ({ wch: Math.max(14, k.length * 2) }));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "장비목록");
          XLSX.writeFile(wb, "장비_일괄등록_템플릿.xlsx");
        }}
          style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, whiteSpace:"nowrap", fontFamily:"inherit" }}>
          ⬇️ 템플릿 받기
        </button>
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
  "촬영":        ["카메라", "캠코더", "드론/액션캠", "배터리", "충전기/전원", "저장매체", "카드리더기", "기타"],
  "렌즈":        ["단렌즈", "줌렌즈", "시네렌즈", "렌즈어댑터", "렌즈액세서리", "기타"],
  "ACC":         ["리그/케이지", "무선송수신", "라이브송출", "슬레이트/타임코드", "케이블/젠더", "가방/운반", "기타"],
  "트라이포드/그립": ["비디오삼각대", "사진삼각대", "모노포드", "짐벌", "슬라이더", "숄더리그", "그립장비", "기타"],
  "모니터":      ["카메라용 모니터", "감독용 모니터", "모니터액세서리", "기타"],
  "조명":        ["조명본체", "조명액세서리", "그립장비", "기타"],
  "음향":        ["마이크", "레코더/믹서", "음향액세서리", "기타"],
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
  keywords: "",       // 제조사 키워드 (예: "4K 120fps, S-Cinetone")
  bundledItems: "",   // 구성품/포함 목록 (예: "리그셋, 메모리카드 64GB")
  isSet: false,       // (사용 안함, 호환용)
  setItems: "",       // (사용 안함, 호환용)
  displayPhotoUrl: "",  // 학생 송출용 이미지 URL
  guideVideoUrl: "",    // 유튜브 사용 매뉴얼 영상 URL
  // 가이드 모드용 필드
  equipType: "",        // "camera" | "lens" | "battery" | "adapter" | "etc"
  mount: "",            // "E-mount" | "EF-mount"
  batteryModel: "",     // 카메라용: 호환 배터리 모델명
  forCamera: "",        // 배터리용: 어떤 카메라에 쓰이는지 (구버전 호환)
  forCameras: [],       // 배터리용: 호환 카메라 목록 (다대다)
  chargerForCameras: [], // 충전기/전원용: 호환 카메라 목록 (구버전, 호환용)
  chargerForBatteries: [], // 충전기/전원용: 호환 배터리 목록 (신버전)
  adapterFrom: "",      // 어댑터용: 렌즈 마운트
  adapterTo: "",        // 어댑터용: 카메라 마운트
};

const LICENSE_LEVELS = [
  { val:0, label:"0단계", desc:"누구나 대여 가능", color:C.green,  bg:C.greenLight  },
  { val:1, label:"1단계", desc:"1단계 이상",       color:C.blue,   bg:C.blueLight   },
  { val:2, label:"2단계", desc:"2단계 이상",       color:C.yellow, bg:C.yellowLight  },
  { val:3, label:"3단계", desc:"3단계만",          color:C.red,    bg:C.redLight    },
];

// ── 메인 ──────────────────────────────────────────────────
export default function Equipment({ initialTab = "equip" }) {
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: inspections } = useCollection("inspections", "createdAt");

  const [activeTab, setActiveTab]     = useState(initialTab);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState("카메라");
  const [minorFilter, setMinorFilter] = useState("전체");
  const [showAdd, setShowAdd]         = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [form, setForm]               = useState(EMPTY);
  const [inspItem, setInspItem]       = useState(null);
  const [detailItem, setDetailItem]   = useState(null);
  const [editItem, setEditItem]       = useState(null); // 수정 대상
  const [copyItem, setCopyItem]       = useState(null); // 복사 대상
  const [showMigrator, setShowMigrator] = useState(false); // 카테고리 일괄 정리
  const [showReorder, setShowReorder] = useState(false); // 장비 표시 순서 편집

  // 카테고리 판정 — 학생 아이콘(filter)을 관리자 데이터(major/minor)에 매핑.
  //   CAT_MATCH 규칙이 있으면 그걸 쓰고, 없으면(외부 렌탈샵 등) 대분류 직접 비교로 폴백.
  const inCategory = (e) => {
    const match = CAT_MATCH[filter];
    return match ? match(e) : e.majorCategory === filter;
  };
  const minorList = ["전체", ...new Set(equipments.filter(inCategory).map(e => e.minorCategory).filter(Boolean))];
  const filtered  = equipments.filter(e =>
    inCategory(e) &&
    (minorFilter === "전체" || e.minorCategory === minorFilter) &&
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
      keywords:           e.keywords           || "",
      bundledItems:       e.bundledItems       || "",
      isSet:              e.isSet              || false,
      setItems:           e.setItems           || "",
      description:        e.description        || "",
      equipType:          e.equipType          || "",
      mount:              e.mount              || "",
      batteryModel:       e.batteryModel       || "",
      forCamera:          e.forCamera          || "",
      forCameras:         e.forCameras         || [],
      chargerForCameras:  e.chargerForCameras  || [],
      chargerForBatteries: e.chargerForBatteries || [],
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
      keywords:        e.keywords        || "",
      bundledItems:    e.bundledItems    || "",
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

    // 동일 modelName 다른 호기에도 공통 필드(설명/키워드/구성품/송출이미지/매뉴얼영상) 자동 반영
    const sameModel = equipments.filter(e =>
      e.id !== editItem.id && (e.modelName || e.name) === form.modelName
    );
    if (sameModel.length > 0) {
      const sharedFields = {
        description:     form.description     || "",
        keywords:        form.keywords        || "",
        bundledItems:    form.bundledItems    || "",
        displayPhotoUrl: form.displayPhotoUrl || "",
        guideVideoUrl:   form.guideVideoUrl   || "",
      };
      await Promise.all(
        sameModel.map(e => updateItem("equipments", e.id, sharedFields))
      );
    }

    setEditItem(null);
    setForm(EMPTY);
  };

  // 엑셀 내보내기
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = equipments.map(e => ({
      "대분류":   e.majorCategory || "",
      "중분류":   e.minorCategory || "",
      "소분류":   e.subCategory   || "",
      "제조사":   e.manufacturer  || "",
      "모델명":   e.modelName     || "",
      "호기":     e.unitNo        || "",
      "물품번호": e.itemNo        || "",
      "상태":     e.status        || "대여가능",
      "보관위치": e.location      || "",
      "S/N":      e.serialNo      || "",
      "라이선스제한": `${e.licenseLevel || 0}단계`,
      "장비설명": e.description   || "",
      "키워드":   e.keywords      || "",
      "구성품":   e.bundledItems  || "",
      "매뉴얼영상(유튜브)": e.guideVideoUrl || "",
      "마운트":   e.mount         || "",
      "호환배터리모델명": e.batteryModel || "",
      "호환카메라(배터리)": (e.forCameras || []).join(", "),
      "호환카메라(충전기)": (e.chargerForCameras || []).join(", "),
      "호환배터리(충전기)": (e.chargerForBatteries || []).join(", "),
      "특이사항": e.note          || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 16 }));
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
      {/* 탭 + 버튼 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        {/* 탭 */}
        <div style={{ display:"flex", background:C.bg, borderRadius:10, padding:3, gap:2 }}>
          {[["equip","🔧 장비"]].map(([v,l]) => (
            <button key={v} onClick={() => setActiveTab(v)}
              style={{ padding:"6px 14px", borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background:activeTab===v?C.navy:"transparent", color:activeTab===v?C.bg:C.muted }}>
              {l}
            </button>
          ))}
        </div>
        {/* 버튼 */}
        <div style={{ display:"flex", gap:5 }}>
          {activeTab === "equip" && <>
            <button onClick={exportExcel}               style={{ background:C.greenLight, color:C.green, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>📤 내보내기</button>
            <button onClick={() => setShowMigrator(true)} style={{ background:C.blueLight, color:C.blue, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>🗂️ 카테고리</button>
            <button onClick={() => setShowImport(true)} style={{ background:C.tealLight, color:C.teal, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>📥 일괄등록</button>
            <button onClick={() => setShowReorder(true)} style={{ background:C.purpleLight, color:C.purple, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>↕ 순서</button>
            <button onClick={() => setShowAdd(true)}    style={{ background:C.navy, color: C.bg, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>+ 추가</button>
          </>}
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

          {/* 라이선스 제한 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>라이선스 제한 단계</div>
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
            {(form.equipType==="charger" || form.minorCategory==="충전기/전원") && (<>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 배터리 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능, 학생에게 추천될 기준)</span></div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                  {(form.chargerForBatteries||[]).map((bm, i) => (
                    <span key={i} style={{ background:C.tealLight, color:C.teal, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                      🔋 {bm}
                      <button onClick={() => f("chargerForBatteries", (form.chargerForBatteries||[]).filter((_,j)=>j!==i))}
                        style={{ background:"none", border:"none", color:C.teal, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <input id="chargerBatInput" placeholder="예: NP-FZ100, BP-U60" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      f("chargerForBatteries", [...(form.chargerForBatteries||[]), e.target.value.trim()]);
                      e.target.value = "";
                    }
                  }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                  <button onClick={() => {
                    const input = document.getElementById("chargerBatInput");
                    if (input?.value.trim()) { f("chargerForBatteries", [...(form.chargerForBatteries||[]), input.value.trim()]); input.value = ""; }
                  }} style={{ background:C.teal, color:"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능, 선택사항)</span></div>
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
                  }} style={{ background:C.navy, color: C.bg, border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
            </>)}
            {(form.equipType==="battery" || form.minorCategory==="배터리" || form.equipType==="storage" || form.minorCategory==="저장매체" || form.minorCategory==="카드리더기") && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 선택 가능)</span></div>
                {/* 선택된 카메라 태그 */}
                {(form.forCameras||[]).length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                    {(form.forCameras||[]).map((cam, i) => (
                      <span key={i} style={{ background:C.blueLight, color:C.navy, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                        {cam}
                        <button onClick={() => f("forCameras", (form.forCameras||[]).filter((_,j)=>j!==i))}
                          style={{ background:"none", border:"none", color:C.navy, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {/* 드롭다운 선택 */}
                <select
                  value=""
                  onChange={e => {
                    const val = e.target.value;
                    if (val && !(form.forCameras||[]).includes(val)) {
                      f("forCameras", [...(form.forCameras||[]), val]);
                    }
                  }}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  <option value="">카메라 선택...</option>
                  {equipments
                    .filter(eq => ["카메라","캠코더","드론/액션캠"].includes(eq.minorCategory) && !eq.isSet)
                    .reduce((acc, eq) => acc.some(x => x.modelName === eq.modelName) ? acc : [...acc, eq], [])
                    .sort((a,b) => a.modelName.localeCompare(b.modelName))
                    .map(eq => (
                      <option key={eq.id} value={eq.modelName}
                        disabled={(form.forCameras||[]).includes(eq.modelName)}>
                        {eq.modelName} {(form.forCameras||[]).includes(eq.modelName) ? "✓" : ""}
                      </option>
                    ))
                  }
                </select>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>중복 선택 시 자동으로 제외돼요</div>
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
            <MultiImageUploader values={form.photoUrls} onChange={urls => f("photoUrls", urls)} max={10} />
            <Inp label="보관 위치" placeholder="예: A동 101호 3번 선반" value={form.location} onChange={e => f("location", e.target.value)} />
            <Inp label="S/N" placeholder="예: SN-20240001" value={form.serialNo} onChange={e => f("serialNo", e.target.value)} />
            <SingleImageUploader label="S/N 사진" value={form.snPhotoUrl} onChange={url => f("snPhotoUrl", url)} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>특이사항</div>
              <textarea placeholder="특이사항 또는 메모" value={form.note} onChange={e => f("note", e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:60, boxSizing:"border-box" }} />
            </div>
          </div>

          {/* 키워드 (제조사 푸시 스펙) */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>🏷️ 키워드 (스펙/특장점)</div>
            <input
              placeholder="쉼표로 구분 (예: 4K 120fps, S-Cinetone, 5축 손떨림보정)"
              value={form.keywords}
              onChange={e => f("keywords", e.target.value)}
              style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>예약 신청 시 학생에게 배지로 표시됩니다</div>
          </div>

          {/* 구성품 (포함 아이템) */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>📦 구성품 / 포함 아이템</div>
            <textarea
              placeholder="한 줄에 하나씩 또는 쉼표로 구분 (예: 리그셋, 메모리카드 64GB, 핸드그립)"
              value={form.bundledItems}
              onChange={e => f("bundledItems", e.target.value)}
              style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:80, boxSizing:"border-box" }}
            />
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>대여 시 함께 제공되는 항목들</div>
          </div>
          {/* 사용 매뉴얼 영상 (유튜브) */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>🎬 사용 매뉴얼 영상 <span style={{ fontSize:10, color:C.muted }}>(유튜브 링크)</span></div>
            <input
              placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..."
              value={form.guideVideoUrl}
              onChange={e => f("guideVideoUrl", e.target.value)}
              style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${form.guideVideoUrl && !isValidYoutubeUrl(form.guideVideoUrl) ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
            {form.guideVideoUrl && !isValidYoutubeUrl(form.guideVideoUrl)
              ? <div style={{ fontSize:11, color:C.red, marginTop:4 }}>⚠️ 올바른 유튜브 링크가 아니에요</div>
              : <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>학생이 "장비가 궁금하다면?"에서 시청할 수 있어요</div>
            }
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
      {editItem && (() => {
        const sameModelCount = equipments.filter(e =>
          e.id !== editItem.id && (e.modelName || e.name) === editItem.modelName
        ).length;
        return (
        <Modal onClose={() => { setEditItem(null); setForm(EMPTY); }} width={520}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>✏️ 장비 수정</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>{editItem.modelName} {editItem.unitNo && `· ${editItem.unitNo}`}</div>
          {sameModelCount > 0 && (
            <div style={{ background:C.tealLight, color:C.teal, borderRadius:10, padding:"10px 14px", marginBottom:18, fontSize:12, border:`1px solid ${C.teal}30`, lineHeight:1.5 }}>
              💡 <b>동일 모델 {sameModelCount}대에 자동 반영</b> — 장비 설명 · 키워드 · 구성품 · 송출 이미지 · 매뉴얼 영상 항목은 같은 modelName의 다른 호기에도 자동으로 적용됩니다.
            </div>
          )}
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

          {/* 라이선스 제한 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>라이선스 제한 단계</div>
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
                  color:      form.status===s ? C.bg : C.muted,
                  border:     `1.5px solid ${form.status===s ? C.navy : C.border}`,
                }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ border:`1px dashed ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:14 }}>세부사항</div>
            <SingleImageUploader label="🖼️ 송출용 이미지 (학생에게 표시)" value={form.displayPhotoUrl || ""} onChange={url => f("displayPhotoUrl", url)} />
            <MultiImageUploader values={form.photoUrls} onChange={urls => f("photoUrls", urls)} max={10} />
            <Inp label="보관 위치" value={form.location} onChange={e => f("location", e.target.value)} />
            <Inp label="S/N" value={form.serialNo} onChange={e => f("serialNo", e.target.value)} />
            <SingleImageUploader label="S/N 사진" value={form.snPhotoUrl} onChange={url => f("snPhotoUrl", url)} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>특이사항</div>
              <textarea value={form.note} onChange={e => f("note", e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:60, boxSizing:"border-box" }} />
            </div>
          </div>

          {/* 키워드 (제조사 푸시 스펙) */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>🏷️ 키워드 (스펙/특장점)</div>
            <input
              placeholder="쉼표로 구분 (예: 4K 120fps, S-Cinetone)"
              value={form.keywords || ""}
              onChange={e => f("keywords", e.target.value)}
              style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
          </div>

          {/* 구성품 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>📦 구성품 / 포함 아이템</div>
            <textarea
              placeholder="쉼표 또는 줄바꿈으로 구분 (예: 리그셋, 메모리카드 64GB)"
              value={form.bundledItems || ""}
              onChange={e => f("bundledItems", e.target.value)}
              style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical", minHeight:80, boxSizing:"border-box" }}
            />
          </div>

          {/* 사용 매뉴얼 영상 (유튜브) */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>🎬 사용 매뉴얼 영상 <span style={{ fontSize:10, color:C.muted }}>(유튜브 링크)</span></div>
            <input
              placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..."
              value={form.guideVideoUrl || ""}
              onChange={e => f("guideVideoUrl", e.target.value)}
              style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${form.guideVideoUrl && !isValidYoutubeUrl(form.guideVideoUrl) ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
            {form.guideVideoUrl && !isValidYoutubeUrl(form.guideVideoUrl)
              ? <div style={{ fontSize:11, color:C.red, marginTop:4 }}>⚠️ 올바른 유튜브 링크가 아니에요</div>
              : <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>학생이 "장비가 궁금하다면?"에서 시청할 수 있어요</div>
            }
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
            {(form.equipType==="charger" || form.minorCategory==="충전기/전원") && (<>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 배터리 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능, 학생에게 추천될 기준)</span></div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                  {(form.chargerForBatteries||[]).map((bm, i) => (
                    <span key={i} style={{ background:C.tealLight, color:C.teal, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                      🔋 {bm}
                      <button onClick={() => f("chargerForBatteries", (form.chargerForBatteries||[]).filter((_,j)=>j!==i))}
                        style={{ background:"none", border:"none", color:C.teal, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <input id="chargerBatInputEdit" placeholder="예: NP-FZ100, BP-U60" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      f("chargerForBatteries", [...(form.chargerForBatteries||[]), e.target.value.trim()]);
                      e.target.value = "";
                    }
                  }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                  <button onClick={() => {
                    const input = document.getElementById("chargerBatInputEdit");
                    if (input?.value.trim()) { f("chargerForBatteries", [...(form.chargerForBatteries||[]), input.value.trim()]); input.value = ""; }
                  }} style={{ background:C.teal, color:"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 가능, 선택사항)</span></div>
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
                  <input id="chargerCamInputEdit" placeholder="예: Sony FX3" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      f("chargerForCameras", [...(form.chargerForCameras||[]), e.target.value.trim()]);
                      e.target.value = "";
                    }
                  }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                  <button onClick={() => {
                    const input = document.getElementById("chargerCamInputEdit");
                    if (input?.value.trim()) { f("chargerForCameras", [...(form.chargerForCameras||[]), input.value.trim()]); input.value = ""; }
                  }} style={{ background:C.navy, color: C.bg, border:"none", borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>추가</button>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Enter 또는 추가 버튼으로 입력</div>
              </div>
            </>)}
            {(form.equipType==="battery" || form.minorCategory==="배터리" || form.equipType==="storage" || form.minorCategory==="저장매체" || form.minorCategory==="카드리더기") && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>호환 카메라 모델명 <span style={{ fontSize:10, color:C.muted }}>(여러 개 선택 가능)</span></div>
                {/* 선택된 카메라 태그 */}
                {(form.forCameras||[]).length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                    {(form.forCameras||[]).map((cam, i) => (
                      <span key={i} style={{ background:C.blueLight, color:C.navy, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                        {cam}
                        <button onClick={() => f("forCameras", (form.forCameras||[]).filter((_,j)=>j!==i))}
                          style={{ background:"none", border:"none", color:C.navy, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {/* 드롭다운 선택 */}
                <select
                  value=""
                  onChange={e => {
                    const val = e.target.value;
                    if (val && !(form.forCameras||[]).includes(val)) {
                      f("forCameras", [...(form.forCameras||[]), val]);
                    }
                  }}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  <option value="">카메라 선택...</option>
                  {equipments
                    .filter(eq => ["카메라","캠코더","드론/액션캠"].includes(eq.minorCategory) && !eq.isSet)
                    .reduce((acc, eq) => acc.some(x => x.modelName === eq.modelName) ? acc : [...acc, eq], [])
                    .sort((a,b) => a.modelName.localeCompare(b.modelName))
                    .map(eq => (
                      <option key={eq.id} value={eq.modelName}
                        disabled={(form.forCameras||[]).includes(eq.modelName)}>
                        {eq.modelName} {(form.forCameras||[]).includes(eq.modelName) ? "✓" : ""}
                      </option>
                    ))
                  }
                </select>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>중복 선택 시 자동으로 제외돼요</div>
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
        );
      })()}

      {showImport && <ExcelImportModal onClose={() => setShowImport(false)} onImport={async rows => { for (const r of rows) { try { await addItem("equipments", { ...r, name: r.modelName }); } catch {} } }} />}
      {showMigrator && <CategoryMigrator onClose={() => setShowMigrator(false)} />}
      {showReorder && <EquipReorderModal equipments={equipments} onClose={() => setShowReorder(false)} />}

      {/* 장비 탭 */}
      {activeTab === "equip" && (<>
      {/* 카테고리 아이콘 그리드 (4열, 학생 EquipList와 동일 룩) */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px 4px", marginBottom:18 }}>
        {RENTAL_CATEGORIES.map(c => {
          const on = filter === c.name;
          return (
            <div key={c.name} role="button" onClick={() => { setFilter(c.name); setMinorFilter("전체"); setSearch(""); }}
              style={{ textAlign:"center", cursor:"pointer" }}>
              <div style={{ width:54, height:54, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto", overflow:"hidden",
                background: on ? "linear-gradient(135deg,#3b82f6,#7c3aed)" : C.surface, border:`1px solid ${on ? "#3b82f6" : C.border}`, transition:"all .15s", boxShadow: on ? "0 4px 12px rgba(59,130,246,0.4)" : "none" }}>
                <CatIcon c={c} />
              </div>
              <div style={{ fontSize:11, color: on ? "#7e9dff" : C.muted, marginTop:7, fontWeight: on ? 700 : 600, wordBreak:"keep-all", lineHeight:1.25 }}>{c.name}</div>
            </div>
          );
        })}
      </div>

      {/* 검색 */}
      <input placeholder="🔍 모델명, 품명, 호기, 물품번호 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:12, boxSizing:"border-box" }} />

      {/* 중분류 필터 */}
      {minorList.length > 1 && (
        <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
          {minorList.map(m => (
            <button key={m} onClick={() => setMinorFilter(m)} style={{ background:minorFilter===m?C.teal:"transparent", color:minorFilter===m?"#fff":C.muted, border:`1px solid ${minorFilter===m?C.teal:C.border}`, borderRadius:14, padding:"4px 12px", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{m}</button>
          ))}
        </div>
      )}

      {/* 모델별 그룹화 */}
      {(() => {
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
      </>)}


      {inspItem   && <InspModal   item={inspItem}   inspections={inspections} onClose={() => setInspItem(null)} />}
      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailItem(null)} onSave={(id, data) => updateItem("equipments", id, data)} />}
    </div>
  );
}
