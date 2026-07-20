import { useState } from "react";
import { ArrowLeft, Plus, X, MapPin, Pencil, Trash2, Phone, Map, ImagePlus } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, SCENE_LOCATION_TYPES, locTypeLabel, newLocation, canEditProject } from "./constants";
import SceneChecklist from "./SceneChecklist";

// 헌팅 사진 업로드 (학생도 쓰는 attachments/ prefix 아래 → Storage 규칙 변경 불필요)
function uploadLocationPhoto(projectId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const path = `attachments/projectLocations/${projectId}/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on("state_changed",
      (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
    );
  });
}

// ===== 로케이션 추가/수정 모달 (backdrop 닫기 없음) =====
function LocationFormModal({ loc, scenes, projectId, uid, onClose }) {
  const isEdit = !!loc;
  const [name, setName] = useState(loc?.name || "");
  const [address, setAddress] = useState(loc?.address || "");
  const [type, setType] = useState(loc?.type || "INT");
  const [contact, setContact] = useState(loc?.contact || "");
  const [sceneIds, setSceneIds] = useState(loc?.sceneIds || []);
  const [notes, setNotes] = useState(loc?.notes || "");
  const [photos, setPhotos] = useState(loc?.photos || []);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [upPct, setUpPct] = useState(null); // 사진 업로드 진행률

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("이미지 파일만 올릴 수 있어요."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("10MB 이하 이미지만 올릴 수 있어요."); return; }
    setUpPct(0);
    try {
      const p = await uploadLocationPhoto(projectId, file, setUpPct);
      setPhotos(prev => [...prev, p]);
    } catch (err2) {
      console.warn("photo upload error:", err2);
      alert("사진 업로드에 실패했어요.");
    }
    setUpPct(null);
  };

  const removePhoto = async (photo) => {
    setPhotos(prev => prev.filter(p => p.url !== photo.url));
    if (photo.path) await deleteObject(ref(storage, photo.path)).catch(() => {});
  };

  const save = async () => {
    if (!name.trim()) { setErr("장소 이름을 입력해주세요."); return; }
    setErr("");
    setBusy(true);
    const data = {
      name: name.trim(), address: address.trim(), type,
      contact: contact.trim(), sceneIds, notes: notes.trim(), photos,
    };
    try {
      if (isEdit) await updateItem("psLocations", loc.id, data);
      else await addItem("psLocations", { ...newLocation({ projectId, ownerId: uid }), ...data });
      onClose();
    } catch (e) {
      console.warn("location save error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", minHeight: 42,
    background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
    color: PS.text, fontSize: 13.5, padding: "9px 12px", outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" };
  const chip = (on) => ({
    padding: "7px 11px", minHeight: 34, borderRadius: 999, cursor: "pointer",
    background: on ? PS.primary : PS.elev, border: `1px solid ${on ? PS.primary : PS.border}`,
    color: on ? "#fff" : PS.sub, fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "로케이션 수정" : "로케이션 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>장소 이름 <b style={{ color: PS.primaryLight }}>*</b></span>
            <input style={inputStyle} value={name} maxLength={40} disabled={busy}
              placeholder="예) 작업실, 학교 옥상" onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <span style={labelStyle}>실내/야외</span>
            <div style={{ display: "flex", gap: 7 }}>
              {SCENE_LOCATION_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)} disabled={busy} style={chip(type === t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={labelStyle}>주소 (선택)</span>
            <input style={inputStyle} value={address} maxLength={100} disabled={busy}
              placeholder="주소 입력 시 지도로 열 수 있어요" onChange={e => setAddress(e.target.value)} />
          </div>

          <div>
            <span style={labelStyle}>대관 연락처 (선택)</span>
            <input style={inputStyle} value={contact} maxLength={40} disabled={busy}
              placeholder="전화번호" inputMode="tel" onChange={e => setContact(e.target.value)} />
          </div>

          <div>
            <span style={labelStyle}>헌팅 사진</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {photos.map(p => (
                <div key={p.url} style={{ position: "relative", width: 72, height: 72 }}>
                  <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover",
                    borderRadius: 10, border: `1px solid ${PS.border}` }} />
                  <button onClick={() => removePhoto(p)} disabled={busy}
                    style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%",
                      background: PS.danger, border: "2px solid " + PS.surface, color: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label style={{ width: 72, height: 72, borderRadius: 10, cursor: upPct != null ? "default" : "pointer",
                background: PS.elev, border: `1px dashed ${PS.border}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                color: PS.sub, fontSize: 10, fontWeight: 700 }}>
                {upPct != null ? `${upPct}%` : <><ImagePlus size={20} /><span>추가</span></>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={onPickPhoto} disabled={upPct != null || busy} />
              </label>
            </div>
            <div style={{ fontSize: 11, color: PS.sub, marginTop: 6 }}>팀원들도 볼 수 있어요 · 10MB 이하</div>
          </div>

          <div>
            <span style={labelStyle}>사용 장면</span>
            <SceneChecklist scenes={scenes} value={sceneIds} onChange={setSceneIds} disabled={busy} />
          </div>

          <div>
            <span style={labelStyle}>메모</span>
            <textarea value={notes} maxLength={300} disabled={busy} rows={2}
              placeholder="주차, 전기, 대관 조건 등"
              onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>

        {err && (
          <div style={{ background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14 }}>{err}</div>
        )}

        <button onClick={save} disabled={busy}
          style={{ width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", marginTop: 18,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
            opacity: busy ? 0.7 : 1 }}>
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "로케이션 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 로케이션 화면 =====
export default function LocationScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canEdit = canEditProject(project, uid); // 소유자 + 참여 팀원

  const opts = () => uid ? { where: [["projectId", "==", project.id]] } : { enabled: false };
  const { data: locs, loading } = useCollection("psLocations", null, opts());
  const { data: scenes } = useCollection("scenes", null, opts());

  const [formLoc, setFormLoc] = useState(null);
  const [lightbox, setLightbox] = useState(null); // 크게 볼 사진 url

  const sorted = [...locs].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const sceneNo = (id) => scenes.find(s => s.id === id)?.sceneNumber;

  const removeLoc = async (l) => {
    if (!window.confirm(`'${l.name}' 로케이션을 삭제할까요?`)) return;
    try {
      await deleteItem("psLocations", l.id);
      // 헌팅 사진도 Storage에서 정리
      await Promise.all((l.photos || []).filter(p => p.path).map(p => deleteObject(ref(storage, p.path)).catch(() => {})));
    }
    catch (e) { console.warn("location delete error:", e); alert("삭제에 실패했어요."); }
  };

  const telHref = (c) => {
    const digits = (c || "").replace(/[^0-9+]/g, "");
    return digits.length >= 7 ? `tel:${digits}` : null;
  };
  const mapHref = (addr) => addr ? `https://map.naver.com/v5/search/${encodeURIComponent(addr)}` : null;

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack}
        style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit" }}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "6px 0 14px" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900 }}>로케이션</div>
          <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
            {locs.length > 0 ? `장소 ${locs.length}곳` : "촬영 장소를 정리해보세요"}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setFormLoc("new")}
            style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 42, flexShrink: 0,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
              padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <Plus size={15} /> 로케이션 추가
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <MapPin size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 로케이션이 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>촬영할 장소와 대관 정보를 정리해보세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(l => {
            const tel = telHref(l.contact);
            const map = mapHref(l.address);
            return (
              <div key={l.id}
                style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, wordBreak: "keep-all" }}>
                      {l.name}
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: PS.primaryLight, marginLeft: 7,
                        background: `${PS.primary}1A`, border: `1px solid ${PS.primary}44`,
                        padding: "2px 7px", borderRadius: 999 }}>{locTypeLabel(l.type)}</span>
                    </div>
                    {l.address && <div style={{ fontSize: 11.5, color: PS.sub, marginTop: 3, wordBreak: "keep-all" }}>{l.address}</div>}
                    {(l.sceneIds || []).length > 0 && (
                      <div style={{ fontSize: 10.5, color: PS.sub, marginTop: 3 }}>
                        사용 {l.sceneIds.map(id => sceneNo(id)).filter(Boolean).map(n => `S#${n}`).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                {/* 헌팅 사진 */}
                {(l.photos || []).length > 0 && (
                  <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 9, WebkitOverflowScrolling: "touch" }}>
                    {l.photos.map(p => (
                      <img key={p.url} src={p.url} alt="" onClick={() => setLightbox(p.url)}
                        style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, flexShrink: 0,
                          border: `1px solid ${PS.border}`, cursor: "pointer" }} />
                    ))}
                  </div>
                )}
                {l.notes && <div style={{ fontSize: 12, color: PS.sub, marginTop: 7, whiteSpace: "pre-wrap" }}>{l.notes}</div>}
                <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  {map && (
                    <a href={map} target="_blank" rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                        background: `${PS.primary}1A`, border: `1px solid ${PS.primary}55`, borderRadius: 10,
                        color: PS.primaryLight, fontSize: 11.5, fontWeight: 800, padding: "7px 11px",
                        textDecoration: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                      <Map size={13} /> 지도
                    </a>
                  )}
                  {tel && (
                    <a href={tel}
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                        background: `${PS.success}14`, border: `1px solid ${PS.success}55`, borderRadius: 10,
                        color: PS.success, fontSize: 11.5, fontWeight: 800, padding: "7px 11px",
                        textDecoration: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                      <Phone size={13} /> 전화
                    </a>
                  )}
                  {canEdit && (
                    <>
                      <button onClick={() => setFormLoc(l)}
                        style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                          background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                          color: PS.text, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                          cursor: "pointer", fontFamily: "inherit" }}>
                        <Pencil size={12} /> 수정
                      </button>
                      <button onClick={() => removeLoc(l)}
                        style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                          background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 10,
                          color: PS.danger, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                          cursor: "pointer", fontFamily: "inherit" }}>
                        <Trash2 size={12} /> 삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formLoc && (
        <LocationFormModal loc={formLoc === "new" ? null : formLoc}
          scenes={scenes} projectId={project.id} uid={uid} onClose={() => setFormLoc(null)} />
      )}

      {/* 사진 크게 보기 */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          <button onClick={() => setLightbox(null)}
            style={{ position: "fixed", top: 20, right: 20, width: 42, height: 42, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
