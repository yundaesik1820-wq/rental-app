import { useState, useRef } from "react";
import { C } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `facilities/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", null, reject, async () => {
      resolve(await getDownloadURL(task.snapshot.ref));
    });
  });
}

function ImageUploader({ label, value, onChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
      {value ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, height: 140, background: C.bg }}>
          <img src={value} alt="미리보기" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button onClick={() => onChange("")}
            style={{ position: "absolute", top: 6, right: 6, background: C.red, color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>삭제</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 80, background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: 10, fontSize: 13, color: C.muted, cursor: "pointer" }}>
          {uploading ? "⏳ 업로드 중..." : "📷 이미지 추가"}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          setUploading(true);
          try { onChange(await uploadImage(file)); }
          catch { alert("업로드 실패"); }
          finally { setUploading(false); e.target.value = ""; }
        }} />
    </div>
  );
}

const EMPTY = { name: "", location: "", desc: "", displayPhotoUrl: "", available: true };

export default function FacilityAdmin() {
  const { data: facilities } = useCollection("facilities", "createdAt");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const openAdd = () => { setForm(EMPTY); setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setForm({ ...EMPTY, ...item }); setEditItem(item); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim()) return;
    setSubmitting(true);
    if (editItem) {
      await updateItem("facilities", editItem.id, form);
    } else {
      await addItem("facilities", form);
    }
    setShowModal(false);
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("이 시설을 삭제하시겠습니까?")) return;
    await deleteItem("facilities", id);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>시설 관리</PageTitle>
        <Btn onClick={openAdd} color={C.navy}>+ 시설 추가</Btn>
      </div>

      {facilities.length === 0 && <Empty icon="🏢" text="등록된 시설이 없습니다" />}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {facilities.map(fac => (
          <Card key={fac.id} style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {/* 썸네일 */}
            {fac.displayPhotoUrl ? (
              <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
                <img src={fac.displayPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏢</div>
            )}
            {/* 정보 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{fac.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fac.location}</div>
                  {fac.desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fac.desc}</div>}
                </div>
                <span style={{ background: fac.available !== false ? C.greenLight : C.redLight, color: fac.available !== false ? C.green : C.red, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {fac.available !== false ? "대여가능" : "대여불가"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn onClick={() => openEdit(fac)} color={C.blue} small>✏️ 수정</Btn>
                <Btn onClick={() => handleDelete(fac.id)} color={C.red} outline small>삭제</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} width={480}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>
            {editItem ? "시설 수정" : "시설 추가"}
          </div>

          <Inp label="시설명 *" placeholder="예: 호리존 스튜디오" value={form.name} onChange={e => f("name", e.target.value)} />
          <Inp label="위치 *" placeholder="예: 1관 1층" value={form.location} onChange={e => f("location", e.target.value)} />
          <Inp label="설명" placeholder="예: 방송 촬영용 호리존 스튜디오" value={form.desc} onChange={e => f("desc", e.target.value)} />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>대여 상태</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => f("available", v)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1.5px solid ${form.available === v ? (v ? C.green : C.red) : C.border}`, background: form.available === v ? (v ? C.greenLight : C.redLight) : C.bg, color: form.available === v ? (v ? C.green : C.red) : C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {v ? "대여가능" : "대여불가"}
                </button>
              ))}
            </div>
          </div>

          <ImageUploader
            label="🖼️ 송출용 이미지 (학생에게 표시)"
            value={form.displayPhotoUrl}
            onChange={url => f("displayPhotoUrl", url)}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setShowModal(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSave} color={C.navy} full disabled={submitting || !form.name.trim() || !form.location.trim()}>
              {submitting ? "저장 중..." : "저장"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
