import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

export default function EquipList() {
  const { profile } = useAuth();
  const { data: equipments } = useCollection("equipments", "createdAt");

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("전체");
  const [cart, setCart]       = useState({}); // { equipId: quantity }
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState({ purpose: "", startDate: "", endDate: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);

  const cats     = ["전체", ...new Set(equipments.map(e => e.majorCategory || e.category))];
  const filtered = equipments.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.name?.includes(search))
  );

  const cartCount   = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems   = equipments.filter(e => cart[e.id] > 0);

  const setQty = (id, qty) => {
    setCart(p => ({ ...p, [id]: Math.max(0, qty) }));
  };

  const handleSubmit = async () => {
    if (!form.purpose || !form.startDate || !form.endDate) return;
    if (cartItems.length === 0) return;
    setSubmitting(true);
    await addItem("rentalRequests", {
      studentId:   profile.studentId,
      studentName: profile.name,
      dept:        profile.dept,
      license:     profile.license || "없음",
      items: cartItems.map(e => ({
        equipId:   e.id,
        equipName: e.modelName || e.name,
        category: e.majorCategory || e.category,
        img:       e.img || "📦",
        quantity:  cart[e.id],
      })),
      purpose:   form.purpose,
      startDate: form.startDate,
      endDate:   form.endDate,
      status:    "승인대기",
      reason:    "",
    });
    setCart({});
    setForm({ purpose: "", startDate: "", endDate: "" });
    setSubmitting(false);
    setShowForm(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>🔍 장비 목록</PageTitle>
        {cartCount > 0 && (
          <button onClick={() => setShowForm(true)} style={{
            background: C.teal, color: "#fff", border: "none", borderRadius: 12,
            padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
          }}>
            📋 신청서 제출
            <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "2px 10px", fontSize: 13 }}>{cartCount}개</span>
          </button>
        )}
      </div>

      {/* 완료 메시지 */}
      {done && (
        <div style={{ background: C.greenLight, color: C.green, borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontWeight: 700, fontSize: 14, border: `1px solid ${C.green}30` }}>
          ✅ 대여 신청이 완료됐어요! 관리자 승인을 기다려 주세요.
        </div>
      )}

      {/* 장바구니 요약 */}
      {cartCount > 0 && (
        <Card style={{ border: `2px solid ${C.teal}40`, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.teal, marginBottom: 12 }}>📋 선택한 장비 ({cartCount}개)</div>
          {cartItems.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{e.img || "📦"}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{e.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setQty(e.id, cart[e.id] - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>−</button>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.navy, minWidth: 24, textAlign: "center" }}>{cart[e.id]}</span>
                <button onClick={() => setQty(e.id, cart[e.id] + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>+</button>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <Btn onClick={() => setCart({})} color={C.muted} outline full small>전체 취소</Btn>
            <Btn onClick={() => setShowForm(true)} color={C.teal} full>신청서 작성 →</Btn>
          </div>
        </Card>
      )}

      {/* 검색 + 필터 */}
      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="🔍 장비명 또는 카테고리 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? "#fff" : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* 장비 목록 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 16 }}>
        {filtered.map(e => {
          const selected = (cart[e.id] || 0) > 0;
          const avail    = e.available || 0;
          return (
            <Card key={e.id} style={{ border: `2px solid ${selected ? C.teal : C.border}`, transition: "border 0.15s" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span style={{ fontSize: 36 }}>{e.img || "📦"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{e.modelName || e.name}</div>
                    <Badge label={e.status} />
                  </div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{e.itemName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {[e.majorCategory, e.minorCategory, e.manufacturer].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{ background: C.border, borderRadius: 6, height: 5, marginTop: 10, overflow: "hidden" }}>
                    <div style={{ width: `${(avail / (e.total || 1)) * 100}%`, background: avail === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>재고 {avail}/{e.total}</div>

                  {/* 수량 조절 */}
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    {selected ? (
                      <>
                        <button onClick={() => setQty(e.id, (cart[e.id] || 0) - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer", fontSize: 18, fontWeight: 700 }}>−</button>
                        <span style={{ fontSize: 16, fontWeight: 800, color: C.teal, minWidth: 28, textAlign: "center" }}>{cart[e.id]}</span>
                        <button onClick={() => setQty(e.id, (cart[e.id] || 0) + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.teal}`, background: C.tealLight, cursor: "pointer", fontSize: 18, fontWeight: 700, color: C.teal }}>+</button>
                        <button onClick={() => setQty(e.id, 0)} style={{ marginLeft: 4, background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>취소</button>
                      </>
                    ) : (
                      <Btn onClick={() => avail > 0 && setQty(e.id, 1)} color={avail > 0 ? C.teal : C.muted} small disabled={avail === 0}>
                        {avail > 0 ? "+ 선택" : "대여 불가"}
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <Empty icon="🔍" text="해당하는 장비가 없습니다" />}

      {/* 신청서 모달 */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} width={500}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 6 }}>📋 대여 신청서</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{profile?.name} · {profile?.dept}</div>

          {/* 선택 장비 목록 */}
          <div style={{ background: C.bg, borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>선택한 장비</div>
            {cartItems.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.text }}>{e.img || "📦"} {e.modelName || e.name}</span>
                <span style={{ fontWeight: 700, color: C.teal }}>{cart[e.id]}개</span>
              </div>
            ))}
          </div>

          <Inp label="사용 목적 *" placeholder="예: 단편영화 제작, 졸업작품 촬영" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} />
          <div style={{ display: "flex", gap: 12 }}>
            <Inp label="대여 시작일 *" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={{ flex: 1 }} />
            <Inp label="반납 예정일 *" type="date" value={form.endDate}   onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}   style={{ flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting || !form.purpose || !form.startDate || !form.endDate}>
              {submitting ? "신청 중..." : "신청 완료"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
