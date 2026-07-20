import { useState } from "react";
import { ArrowLeft, Plus, X, Camera, ChevronRight, Pencil, Trash2, ImagePlus } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import {
  PS, SHOT_SIZES, SHOT_ANGLES, SHOT_MOVES, SHOT_STATUS, shotStatus, newShot, locTypeLabel, canEditProject,
} from "./constants";

// 콘티 참고 이미지 업로드 (검증된 attachments/ prefix)
function uploadShotRef(projectId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const path = `attachments/projectShots/${projectId}/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on("state_changed",
      (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
    );
  });
}

// ===== 숏 추가/수정 모달 (backdrop 닫기 없음 — X로만) =====
function ShotFormModal({ shot, scene, nextNumber, uid, onClose }) {
  const isEdit = !!shot;
  const [num, setNum]     = useState(shot?.shotNumber ?? nextNumber);
  const [title, setTitle] = useState(shot?.title || "");
  const [desc, setDesc]   = useState(shot?.description || "");
  const [size, setSize]   = useState(shot?.shotSize || null);
  const [angle, setAngle] = useState(shot?.cameraAngle || null);
  const [move, setMove]   = useState(shot?.cameraMovement || null);
  const [lens, setLens]   = useState(shot?.lens || "");
  const [dialogue, setDialogue] = useState(shot?.dialogue || "");
  const [secs, setSecs]   = useState(shot?.estimatedSeconds ?? "");
  const [status, setStatus] = useState(shot?.status || "planned");
  const [refImg, setRefImg] = useState(shot?.referenceImageUrl || null);
  const [refPath, setRefPath] = useState(shot?.referenceImagePath || null);
  const [upPct, setUpPct] = useState(null);
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  const onPickRef = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("이미지 파일만 올릴 수 있어요."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("10MB 이하 이미지만 올릴 수 있어요."); return; }
    setUpPct(0);
    try {
      const p = await uploadShotRef(scene.projectId, file, setUpPct);
      // 기존 이미지 있으면 교체 — 이전 파일 정리
      if (refPath) await deleteObject(ref(storage, refPath)).catch(() => {});
      setRefImg(p.url); setRefPath(p.path);
    } catch (e2) { console.warn("ref upload error:", e2); alert("업로드에 실패했어요."); }
    setUpPct(null);
  };

  const removeRef = async () => {
    if (refPath) await deleteObject(ref(storage, refPath)).catch(() => {});
    setRefImg(null); setRefPath(null);
  };

  const save = async () => {
    if (!String(num) || Number(num) < 1) { setErr("숏 번호는 1 이상이어야 해요."); return; }
    if (!title.trim() && !desc.trim()) { setErr("숏 제목 또는 설명을 입력해주세요."); return; }
    if (secs !== "" && (isNaN(Number(secs)) || Number(secs) < 0)) { setErr("예상 길이는 0 이상의 숫자로 입력해주세요."); return; }
    setErr("");
    setBusy(true);
    const data = {
      shotNumber: Number(num), title: title.trim(), description: desc.trim(),
      shotSize: size, cameraAngle: angle, cameraMovement: move, lens: lens.trim(),
      dialogue: dialogue.trim(), estimatedSeconds: secs === "" ? null : Number(secs), status,
      referenceImageUrl: refImg, referenceImagePath: refPath,
    };
    try {
      if (isEdit) await updateItem("shots", shot.id, data);
      else await addItem("shots", { ...newShot({ projectId: scene.projectId, ownerId: uid, sceneId: scene.id, shotNumber: Number(num) }), ...data });
      onClose();
    } catch (e) {
      console.warn("shot save error:", e);
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
  // 선택형 옵션 (같은 값 다시 누르면 해제)
  const OptRow = ({ label, options, value, onChange }) => (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(value === o ? null : o)} disabled={busy} style={chip(value === o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "숏 수정" : "숏 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: PS.sub, marginBottom: 16 }}>
          S#{scene.sceneNumber} {scene.heading || scene.locationName}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>숏 번호</span>
              <input type="number" min={1} style={inputStyle} value={num} disabled={busy}
                onChange={e => setNum(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>숏 제목</span>
              <input style={inputStyle} value={title} maxLength={60} disabled={busy}
                placeholder="예) 현우 얼굴 클로즈업" onChange={e => setTitle(e.target.value)} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>숏 설명</span>
            <textarea value={desc} maxLength={1000} disabled={busy} rows={3}
              placeholder="화면에 담길 내용, 연출 의도"
              onChange={e => setDesc(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <OptRow label="화면 크기" options={SHOT_SIZES} value={size} onChange={setSize} />
          <OptRow label="카메라 앵글" options={SHOT_ANGLES} value={angle} onChange={setAngle} />
          <OptRow label="카메라 움직임" options={SHOT_MOVES} value={move} onChange={setMove} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>렌즈 (선택)</span>
              <input style={inputStyle} value={lens} maxLength={30} disabled={busy}
                placeholder="예) 35mm" onChange={e => setLens(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>예상 길이(초)</span>
              <input type="number" min={0} step={1} style={inputStyle} value={secs} disabled={busy}
                placeholder="예) 8" onChange={e => setSecs(e.target.value)} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>대사 (선택)</span>
            <textarea value={dialogue} maxLength={500} disabled={busy} rows={2}
              onChange={e => setDialogue(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <span style={labelStyle}>상태</span>
            <div style={{ display: "flex", gap: 6 }}>
              {SHOT_STATUS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)} disabled={busy}
                  style={{ ...chip(status === s.value), flex: 1 }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={labelStyle}>참고 이미지 (콘티)</span>
            {refImg ? (
              <div style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden",
                border: `1px solid ${PS.border}` }}>
                <img src={refImg} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain",
                  background: PS.bg, display: "block" }} />
                <button onClick={removeRef} disabled={busy}
                  style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                minHeight: 60, borderRadius: 12, cursor: upPct != null ? "default" : "pointer",
                background: PS.elev, border: `1px dashed ${PS.border}`, color: PS.sub,
                fontSize: 12.5, fontWeight: 700 }}>
                {upPct != null ? `업로드 중... ${upPct}%` : <><ImagePlus size={18} /> 콘티/참고 이미지 올리기</>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={onPickRef} disabled={upPct != null || busy} />
              </label>
            )}
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
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "숏 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 콘티/샷리스트 화면 — 장면 선택 → 장면별 숏 목록 =====
export default function ShotsScreen({ project, initialSceneId, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canEdit = canEditProject(project, uid); // 소유자 + 참여 팀원

  const { data: scenes, loading: scenesLoading } = useCollection(
    "scenes", null,
    uid ? { where: [["projectId", "==", project.id]] } : { enabled: false }
  );
  const { data: shots } = useCollection(
    "shots", null,
    uid ? { where: [["projectId", "==", project.id]] } : { enabled: false }
  );

  const [sceneId, setSceneId] = useState(initialSceneId || null);
  const [formShot, setFormShot] = useState(null); // null | "new" | shot 객체
  const [lightbox, setLightbox] = useState(null);  // 참고 이미지 크게 보기

  const sortedScenes = [...scenes].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const scene = scenes.find(s => s.id === sceneId);
  const sceneShots = shots
    .filter(sh => sh.sceneId === sceneId)
    .sort((a, b) => (a.shotNumber || 0) - (b.shotNumber || 0));
  const nextNumber = sceneShots.reduce((m, s) => Math.max(m, s.shotNumber || 0), 0) + 1;

  const removeShot = async (sh) => {
    if (!window.confirm(`${sh.shotNumber}번 숏을 삭제할까요?`)) return;
    try {
      await deleteItem("shots", sh.id);
      if (sh.referenceImagePath) await deleteObject(ref(storage, sh.referenceImagePath)).catch(() => {});
    }
    catch (e) { console.warn("shot delete error:", e); alert("삭제에 실패했어요."); }
  };

  const backBtnStyle = {
    background: "none", border: "none", color: PS.sub, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
    padding: "8px 4px", minHeight: 44, fontFamily: "inherit",
  };

  // ===== 장면별 숏 목록 =====
  if (scene) {
    const totalSecs = sceneShots.reduce((sum, sh) => sum + (sh.estimatedSeconds || 0), 0);
    return (
      <div style={{ padding: "4px 2px 24px", color: PS.text }}>
        <button onClick={() => setSceneId(null)} style={backBtnStyle}>
          <ArrowLeft size={17} /> 장면 목록
        </button>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "6px 0 14px" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>S#{scene.sceneNumber} 콘티</div>
            <div style={{ fontSize: 12, color: PS.sub, marginTop: 3, wordBreak: "keep-all" }}>
              {scene.heading || scene.locationName} · 숏 {sceneShots.length}개
              {totalSecs > 0 && ` · 약 ${Math.floor(totalSecs / 60) > 0 ? `${Math.floor(totalSecs / 60)}분 ` : ""}${totalSecs % 60 > 0 ? `${totalSecs % 60}초` : ""}`}
            </div>
          </div>
          {canEdit && (
            <button onClick={() => setFormShot("new")}
              style={{
                display: "flex", alignItems: "center", gap: 5, minHeight: 42, flexShrink: 0,
                background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
                border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
                padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
              <Plus size={15} /> 숏 추가
            </button>
          )}
        </div>

        {sceneShots.length === 0 ? (
          <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
            padding: "38px 20px", textAlign: "center" }}>
            <Camera size={28} color={PS.sub} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 숏이 없어요</div>
            <div style={{ fontSize: 12.5, color: PS.sub }}>이 장면을 어떤 숏으로 나눠 찍을지 계획해보세요.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sceneShots.map(sh => {
              const st = shotStatus(sh.status);
              const specs = [sh.shotSize, sh.cameraAngle, sh.cameraMovement, sh.lens].filter(Boolean);
              return (
                <div key={sh.id}
                  style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 15, padding: "13px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: PS.primaryLight, flexShrink: 0 }}>#{sh.shotNumber}</span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, wordBreak: "keep-all" }}>
                      {sh.title || sh.description || "(제목 없음)"}
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, flexShrink: 0,
                      background: `${st.color}1A`, border: `1px solid ${st.color}44`,
                      padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                      {st.label}
                    </span>
                  </div>
                  {specs.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                      {specs.map(sp => (
                        <span key={sp} style={{ padding: "3px 8px", background: PS.elev,
                          border: `1px solid ${PS.border}`, borderRadius: 999,
                          color: PS.sub, fontSize: 11, fontWeight: 700 }}>{sp}</span>
                      ))}
                      {sh.estimatedSeconds != null && (
                        <span style={{ padding: "3px 8px", background: PS.elev,
                          border: `1px solid ${PS.border}`, borderRadius: 999,
                          color: PS.sub, fontSize: 11, fontWeight: 700 }}>{sh.estimatedSeconds}초</span>
                      )}
                    </div>
                  )}
                  {sh.referenceImageUrl && (
                    <img src={sh.referenceImageUrl} alt="" onClick={() => setLightbox(sh.referenceImageUrl)}
                      style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, marginTop: 9,
                        border: `1px solid ${PS.border}`, cursor: "pointer", display: "block" }} />
                  )}
                  {sh.title && sh.description && (
                    <div style={{ fontSize: 12.5, color: PS.sub, lineHeight: 1.55, marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {sh.description}
                    </div>
                  )}
                  {sh.dialogue && (
                    <div style={{ fontSize: 12, color: PS.sub, lineHeight: 1.5, marginTop: 6,
                      borderLeft: `2px solid ${PS.border}`, paddingLeft: 9, whiteSpace: "pre-wrap" }}>
                      {sh.dialogue}
                    </div>
                  )}
                  {canEdit && (
                  <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                    <button onClick={() => setFormShot(sh)}
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 38,
                        background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                        color: PS.text, fontSize: 12, fontWeight: 700, padding: "8px 12px",
                        cursor: "pointer", fontFamily: "inherit" }}>
                      <Pencil size={13} /> 수정
                    </button>
                    <button onClick={() => removeShot(sh)}
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 38,
                        background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 10,
                        color: PS.danger, fontSize: 12, fontWeight: 700, padding: "8px 12px",
                        cursor: "pointer", fontFamily: "inherit" }}>
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {formShot && (
          <ShotFormModal
            shot={formShot === "new" ? null : formShot}
            scene={scene} nextNumber={nextNumber} uid={uid}
            onClose={() => setFormShot(null)} />
        )}

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

  // ===== 장면 선택 목록 =====
  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack} style={backBtnStyle}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ margin: "6px 0 14px" }}>
        <div style={{ fontSize: 19, fontWeight: 900 }}>콘티 / 샷리스트</div>
        <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>장면을 골라 숏을 계획해보세요</div>
      </div>

      {scenesLoading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sortedScenes.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <Camera size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>장면이 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>시나리오에서 장면을 먼저 만들어주세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {sortedScenes.map(s => {
            const count = shots.filter(sh => sh.sceneId === s.id).length;
            return (
              <div key={s.id} onClick={() => setSceneId(s.id)}
                style={{ display: "flex", alignItems: "center", gap: 10,
                  background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 15,
                  padding: "14px", cursor: "pointer", minHeight: 56 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: PS.primaryLight, flexShrink: 0 }}>S#{s.sceneNumber}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, wordBreak: "keep-all",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.heading || s.locationName || "(제목 없음)"}
                  </div>
                  <div style={{ fontSize: 11, color: PS.sub, marginTop: 2 }}>
                    {locTypeLabel(s.locationType)}{s.locationName && ` · ${s.locationName}`} · {s.timeOfDay}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, color: count > 0 ? PS.primaryLight : PS.sub, fontWeight: 800, flexShrink: 0 }}>
                  숏 {count}개
                </span>
                <ChevronRight size={15} color={PS.sub} style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
