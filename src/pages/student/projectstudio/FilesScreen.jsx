import { useState, useRef } from "react";
import { ArrowLeft, FolderOpen, Trash2, Download, Upload, File as FileIcon } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, FILE_CATEGORIES, newProjectFile, fmtBytes, canEditProject } from "./constants";

// 학생도 쓰는 검증된 Storage prefix(attachments/) 아래에 저장 → Storage 규칙 변경 불필요
function uploadFile(projectId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const path = `attachments/projectFiles/${projectId}/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on("state_changed",
      (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
    );
  });
}

// ===== 파일 보관함 화면 =====
export default function FilesScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canEdit = canEditProject(project, uid); // 소유자 + 참여 팀원

  const { data: files, loading } = useCollection(
    "projectFiles", null,
    uid ? { where: [["projectId", "==", project.id]] } : { enabled: false }
  );

  const [category, setCategory] = useState("시나리오");
  const [filter, setFilter] = useState("전체");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef(null);

  const sorted = [...files].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const shown = filter === "전체" ? sorted : sorted.filter(f => f.category === filter);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { alert("25MB 이하 파일만 올릴 수 있어요."); return; }
    setUploading(true); setProgress(0);
    try {
      const { url, path } = await uploadFile(project.id, file, setProgress);
      await addItem("projectFiles", {
        ...newProjectFile({
          projectId: project.id, ownerId: uid, name: file.name, url, category,
          size: file.size, contentType: file.type,
        }),
        storagePath: path,
      });
    } catch (err) {
      console.warn("file upload error:", err);
      alert("업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
    setUploading(false); setProgress(0);
  };

  const removeFile = async (f) => {
    if (!window.confirm(`'${f.name}' 파일을 삭제할까요?`)) return;
    try {
      await deleteItem("projectFiles", f.id);
      if (f.storagePath) await deleteObject(ref(storage, f.storagePath)).catch(() => {});
    } catch (e) { console.warn("file delete error:", e); alert("삭제에 실패했어요."); }
  };

  const isImage = (f) => (f.contentType || "").startsWith("image/");

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack}
        style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit" }}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ margin: "6px 0 14px" }}>
        <div style={{ fontSize: 19, fontWeight: 900 }}>파일 보관함</div>
        <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
          {files.length > 0 ? `파일 ${files.length}개` : "시나리오·콘티·참고자료를 모아두세요"}
        </div>
      </div>

      {/* 업로드 */}
      {canEdit && (
        <div style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 8, display: "block" }}>분류</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {FILE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} disabled={uploading}
                style={{ padding: "7px 12px", minHeight: 34, borderRadius: 999, cursor: "pointer",
                  background: category === c ? PS.primary : PS.elev,
                  border: `1px solid ${category === c ? PS.primary : PS.border}`,
                  color: category === c ? "#fff" : PS.sub, fontSize: 11.5, fontWeight: 700,
                  fontFamily: "inherit", whiteSpace: "nowrap" }}>{c}</button>
            ))}
          </div>
          <input ref={fileInput} type="file" style={{ display: "none" }} onChange={onPick} />
          <button onClick={() => fileInput.current?.click()} disabled={uploading}
            style={{ width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
              opacity: uploading ? 0.7 : 1 }}>
            <Upload size={16} /> {uploading ? `업로드 중... ${progress}%` : `${category} 파일 올리기`}
          </button>
          <div style={{ fontSize: 11, color: PS.sub, textAlign: "center", marginTop: 7 }}>25MB 이하 · 모든 형식</div>
        </div>
      )}

      {/* 필터 */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, WebkitOverflowScrolling: "touch" }}>
          {["전체", ...FILE_CATEGORIES].map(c => {
            const cnt = c === "전체" ? files.length : files.filter(f => f.category === c).length;
            if (c !== "전체" && cnt === 0) return null;
            return (
              <button key={c} onClick={() => setFilter(c)}
                style={{ flexShrink: 0, minHeight: 32, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                  background: filter === c ? `${PS.primary}22` : PS.surface,
                  border: `1px solid ${filter === c ? PS.primary : PS.border}`,
                  color: filter === c ? PS.primaryLight : PS.sub, fontSize: 11.5, fontWeight: 700,
                  fontFamily: "inherit", whiteSpace: "nowrap" }}>{c} {cnt}</button>
            );
          })}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : shown.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <FolderOpen size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>
            {files.length === 0 ? "아직 파일이 없어요" : "이 분류에 파일이 없어요"}
          </div>
          {files.length === 0 && <div style={{ fontSize: 12.5, color: PS.sub }}>시나리오 PDF, 콘티 이미지 등을 올려보세요.</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map(f => (
            <div key={f.id}
              style={{ display: "flex", alignItems: "center", gap: 11,
                background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 14, padding: "11px 13px" }}>
              {/* 썸네일/아이콘 */}
              <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                background: PS.elev, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isImage(f)
                  ? <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <FileIcon size={20} color={PS.sub} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, wordBreak: "break-all",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                <div style={{ fontSize: 10.5, color: PS.sub, marginTop: 2 }}>
                  {f.category}{f.size ? ` · ${fmtBytes(f.size)}` : ""}
                </div>
              </div>
              <a href={f.url} target="_blank" rel="noreferrer"
                style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: PS.elev, border: `1px solid ${PS.border}`, color: PS.primaryLight,
                  display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                <Download size={16} />
              </a>
              {canEdit && (
                <button onClick={() => removeFile(f)}
                  style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: PS.elev, border: `1px solid ${PS.danger}44`, color: PS.danger, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
