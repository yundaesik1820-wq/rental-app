import { useState, useRef } from "react";
import { C } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// 사진 업로드 (Equipment 패턴 동일)
async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `external-rentals/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      null,
      (err) => reject(err),
      async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
    );
  });
}

const EMPTY = { name: "", region: "", address: "", phone: "", kakao: "", website: "", hours: "", parking: "", transit: "", desc: "", photo: "" };

export default function ExternalRental() {
  const { data: shops, loading } = useCollection("externalRentals", "createdAt");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const openNew  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...EMPTY, ...s }); setShowForm(true); };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((p) => ({ ...p, photo: url }));
    } catch (err) {
      alert("사진 업로드 실패: " + err.message);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("업체명을 입력해 주세요"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        region: form.region.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        kakao: form.kakao.trim(),
        website: form.website.trim(),
        hours: form.hours.trim(),
        parking: form.parking.trim(),
        transit: form.transit.trim(),
        desc: form.desc.trim(),
        photo: form.photo || "",
      };
      if (editing) await updateItem("externalRentals", editing.id, payload);
      else await addItem("externalRentals", payload);
      setShowForm(false);
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`'${s.name}' 업체를 삭제할까요?`)) return;
    try {
      await deleteItem("externalRentals", s.id);
    } catch (err) {
      alert("삭제 실패: " + err.message);
    }
  };

  return (
    <div>
      <PageTitle>외부 렌탈샵 관리</PageTitle>
      <div style={{ marginBottom: 14 }}>
        <Btn onClick={openNew} color={C.teal} full>+ 업체 추가</Btn>
      </div>

      {loading && <Empty icon="⏳" text="불러오는 중..." />}
      {!loading && shops.length === 0 && <Empty icon="🏬" text="등록된 외부 렌탈샵이 없어요" />}

      {shops.map((s) => (
        <Card key={s.id} style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
          {s.photo ? (
            <img src={s.photo} alt={s.name} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 90, background: `linear-gradient(135deg,${C.surface},${C.border})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: C.muted }}>🏢</div>
          )}
          <div style={{ padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.name || "(이름 없음)"}</div>
              {s.region && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: C.tealLight, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{s.region}</span>
              )}
            </div>
            {s.desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>{s.desc}</div>}
            {s.address && <div style={{ fontSize: 12.5, color: C.text, marginTop: 6 }}>📍 {s.address}</div>}
            {s.phone && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>📞 {s.phone}</div>}
            {s.kakao && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4, wordBreak: "break-all" }}>💬 {s.kakao}</div>}
            {s.hours && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>🕒 {s.hours}</div>}
            {s.parking && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>🅿️ {s.parking}</div>}
            {s.transit && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>🚇 {s.transit}</div>}
            {s.website && <div style={{ fontSize: 12.5, color: C.blue, marginTop: 4, wordBreak: "break-all" }}>🔗 {s.website}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn onClick={() => openEdit(s)} color={C.navy} small full>수정</Btn>
              <Btn onClick={() => handleDelete(s)} color={C.red} small full outline>삭제</Btn>
            </div>
          </div>
        </Card>
      ))}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} width={480}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 14 }}>
            {editing ? "업체 수정" : "업체 추가"}
          </div>

          {/* 사진 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>업체 사진</div>
            <input ref={inputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
            {form.photo ? (
              <div style={{ position: "relative" }}>
                <img src={form.photo} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12, display: "block" }} />
                <button
                  onClick={() => setForm((p) => ({ ...p, photo: "" }))}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
                >
                  삭제
                </button>
              </div>
            ) : (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                style={{ width: "100%", height: 100, border: `1px dashed ${C.border}`, borderRadius: 12, background: C.surface, color: C.muted, fontSize: 13, cursor: "pointer" }}
              >
                {uploading ? "업로드 중..." : "+ 사진 선택"}
              </button>
            )}
          </div>

          <Inp label="업체명 *" placeholder="예: 필름기어 렌탈" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Inp label="지역 (배지)" placeholder="예: 마포구" value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} />
          <Inp label="주소" placeholder="예: 서울 마포구 와우산로 00길 12, 2층" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <Inp label="전화번호" placeholder="예: 02-123-4567" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Inp label="카카오톡 채널" placeholder="예: http://pf.kakao.com/_xxxxx" value={form.kakao} onChange={(e) => setForm((p) => ({ ...p, kakao: e.target.value }))} />
          <Inp label="홈페이지 URL" placeholder="예: https://example.com" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
          <Inp label="영업시간" placeholder="예: 평일 10:00 – 19:00 / 주말 휴무" value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} />
          <Inp label="주차" placeholder="예: 건물 주차장 / 2시간 무료" value={form.parking} onChange={(e) => setForm((p) => ({ ...p, parking: e.target.value }))} />
          <Inp label="대중교통" placeholder="예: 6호선 합정역 3번 출구 도보 5분" value={form.transit} onChange={(e) => setForm((p) => ({ ...p, transit: e.target.value }))} />
          <Inp label="한 줄 설명" placeholder="예: 시네마 카메라·렌즈 전문 / 당일 대여" value={form.desc} onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))} />

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSave} color={C.teal} full disabled={saving || uploading}>{saving ? "저장 중..." : "저장"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
