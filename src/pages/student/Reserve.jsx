import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

const PURPOSE_OPTIONS = ["과제 및 스터디", "동아리", "작품제작", "학교행사"];

// 시간 옵션 (30분 단위)
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m of [0, 30]) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

export default function Reserve() {
  const { profile } = useAuth();
  const { data: equipments }   = useCollection("equipments", "createdAt");
  const { data: reservations } = useCollection("rentalRequests", "createdAt");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [cart, setCart]     = useState({}); // { equipId: quantity }
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]     = useState(false);
  const [errors, setErrors] = useState({});

  // 신청서 폼
  const [form, setForm] = useState({
    emergencyContact: "",
    participants:     "",
    purpose:          "",
    purposeDetail:    "",
    startDate:        "",
    startTime:        "09:00",
    endDate:          "",
    endTime:          "18:00",
  });

  const cats     = ["전체", ...new Set(equipments.map(e => e.majorCategory || e.category).filter(Boolean))];
  const filtered = equipments.filter(e =>
    (filter === "전체" || (e.majorCategory || e.category) === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.name?.includes(search))
  );

  const cartItems  = equipments.filter(e => (cart[e.id] || 0) > 0);
  const cartTotal  = Object.values(cart).reduce((a, b) => a + b, 0);

  const setQty = (id, qty, max) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setCart(p => ({ ...p, [id]: clamped }));
  };

  const f = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (cartItems.length === 0)   errs.cart = "장비를 1개 이상 선택하세요";
    if (!form.purpose)            errs.purpose = "사용 목적을 선택하세요";
    if (!form.purposeDetail)      errs.purposeDetail = "세부 내용을 입력하세요";
    if (!form.startDate)          errs.startDate = "대여 시작일을 선택하세요";
    if (!form.endDate)            errs.endDate = "반납일을 선택하세요";
    if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = "반납일이 대여일보다 빠릅니다";
    if (cartTotal >= 2 && !form.emergencyContact) errs.emergencyContact = "2인 이상 대여 시 비상연락처 필수";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await addItem("rentalRequests", {
        // 자동입력 (로그인 정보)
        studentId:   profile.studentId,
        studentName: profile.name,
        phone:       profile.phone || "",
        dept:        profile.dept  || "",
        license:     profile.license || "없음",
        // 장비 목록
        items: cartItems.map(e => ({
          equipId:   e.id,
          equipName: e.modelName || e.name,
          category:  e.majorCategory || e.category || "",
          img:       e.img || "📦",
          quantity:  cart[e.id],
        })),
        // 추가 정보
        emergencyContact: form.emergencyContact,
        participants:     form.participants,
        purpose:          form.purpose,
        purposeDetail:    form.purposeDetail,
        startDate:        form.startDate,
        startTime:        form.startTime,
        endDate:          form.endDate,
        endTime:          form.endTime,
        status:           "승인대기",
        reason:           "",
      });
      setCart({});
      setForm({ emergencyContact:"", participants:"", purpose:"", purposeDetail:"", startDate:"", startTime:"09:00", endDate:"", endTime:"18:00" });
      setShowForm(false);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>📅 장비 예약 신청</PageTitle>
        {cartTotal > 0 && (
          <button onClick={() => setShowForm(true)} style={{ background:C.teal, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" }}>
            📋 신청서 작성
            <span style={{ background:"rgba(255,255,255,0.25)", borderRadius:20, padding:"2px 10px", fontSize:13 }}>{cartTotal}개</span>
          </button>
        )}
      </div>

      {/* 완료 메시지 */}
      {done && (
        <div style={{ background:C.greenLight, color:C.green, borderRadius:12, padding:"14px 18px", marginBottom:16, fontWeight:700, fontSize:14, border:`1px solid ${C.green}30` }}>
          ✅ 대여 신청이 완료됐어요! 관리자 승인을 기다려 주세요.
        </div>
      )}

      {/* 선택된 장비 요약 */}
      {cartTotal > 0 && (
        <Card style={{ border:`2px solid ${C.teal}40`, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.teal, marginBottom:12 }}>📋 선택한 장비 ({cartTotal}개)</div>
          {cartItems.map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20 }}>{e.img || "📦"}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName || e.name}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{e.majorCategory || e.category}</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={() => setQty(e.id, (cart[e.id]||0)-1, e.available||0)} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16, fontWeight:700 }}>−</button>
                <span style={{ fontSize:14, fontWeight:700, color:C.navy, minWidth:24, textAlign:"center" }}>{cart[e.id]}</span>
                <button onClick={() => setQty(e.id, (cart[e.id]||0)+1, e.available||0)} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, fontWeight:700, color:C.teal }}>+</button>
                <span style={{ fontSize:11, color:C.muted }}>/ {e.available}개</span>
              </div>
            </div>
          ))}
          <div style={{ display:"flex", gap:10, marginTop:12 }}>
            <Btn onClick={() => setCart({})} color={C.muted} outline full small>전체 취소</Btn>
            <Btn onClick={() => setShowForm(true)} color={C.teal} full>신청서 작성 →</Btn>
          </div>
        </Card>
      )}

      {/* 검색 + 필터 */}
      <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <input placeholder="🔍 장비명 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:180, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background:filter===c?C.navy:C.surface, color:filter===c?"#fff":C.muted, border:`1px solid ${filter===c?C.navy:C.border}`, borderRadius:20, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* 장비 목록 */}
      {errors.cart && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {errors.cart}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:14 }}>
        {filtered.map(e => {
          const avail   = e.available || 0;
          const qty     = cart[e.id] || 0;
          const selected = qty > 0;
          return (
            <Card key={e.id} style={{ border:`2px solid ${selected ? C.teal : C.border}`, transition:"border 0.15s" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                <span style={{ fontSize:32 }}>{e.img || "📦"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName || e.name}</div>
                    <Badge label={avail > 0 ? "대여가능" : "대여불가"} />
                  </div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{e.itemName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{[e.majorCategory, e.minorCategory, e.manufacturer].filter(Boolean).join(" · ")}</div>

                  {/* 재고 바 */}
                  <div style={{ background:C.border, borderRadius:6, height:5, marginTop:10, overflow:"hidden" }}>
                    <div style={{ width:`${(avail/(e.total||1))*100}%`, background:avail===0?C.red:C.teal, height:"100%", borderRadius:6 }} />
                  </div>
                  <div style={{ fontSize:11, color:avail===0?C.red:C.muted, marginTop:3, fontWeight:avail===0?700:400 }}>
                    재고 {avail}/{e.total || 0}개 {avail === 0 && "· 현재 대여 불가"}
                  </div>

                  {/* 수량 선택 */}
                  <div style={{ marginTop:12 }}>
                    {avail === 0 ? (
                      <span style={{ fontSize:12, color:C.muted }}>재고 없음</span>
                    ) : selected ? (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <button onClick={() => setQty(e.id, qty-1, avail)} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:18, fontWeight:700 }}>−</button>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontSize:18, fontWeight:800, color:C.teal, minWidth:32 }}>{qty}</div>
                          <div style={{ fontSize:9, color:C.muted }}>최대 {avail}개</div>
                        </div>
                        <button onClick={() => setQty(e.id, qty+1, avail)} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:18, fontWeight:700, color:C.teal }}>+</button>
                        <button onClick={() => setQty(e.id, 0, avail)} style={{ marginLeft:4, background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", textDecoration:"underline" }}>취소</button>
                      </div>
                    ) : (
                      <Btn onClick={() => setQty(e.id, 1, avail)} color={C.teal} small>+ 선택</Btn>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <Empty icon="🔍" text="장비가 없습니다" />}

      {/* 신청서 모달 */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} width={580}>
          <div style={{ fontSize:18, fontWeight:800, color:C.navy, marginBottom:4 }}>📋 장비 대여 신청서</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>아래 정보를 확인하고 신청해주세요</div>

          {/* ① 신청자 정보 (자동입력) */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:12 }}>👤 신청자 정보 (자동입력)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                ["이름",     profile?.name       || "-"],
                ["학번",     profile?.studentId  || "-"],
                ["연락처",   profile?.phone      || "-"],
                ["계열",     profile?.dept       || "-"],
                ["라이선스", profile?.license    || "없음"],
              ].map(([k, v]) => (
                <div key={k} style={{ background:C.surface, borderRadius:8, padding:"8px 12px", border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ② 선택 장비 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:10 }}>🔧 신청 장비</div>
            {cartItems.map(e => (
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:18 }}>{e.img || "📦"}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName || e.name}</div>
                    <div style={{ fontSize:11, color:C.muted }}>재고 {e.available}개 중</div>
                  </div>
                </div>
                <span style={{ fontSize:15, fontWeight:800, color:C.teal }}>{cart[e.id]}개</span>
              </div>
            ))}
          </div>

          {/* ③ 추가 정보 */}
          <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:12 }}>📝 추가 정보</div>

          {/* 비상연락처 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
              비상연락처
              <span style={{ color:C.red, fontSize:11, marginLeft:4 }}>{cartTotal >= 2 ? "* 2인 이상 필수" : "(선택)"}</span>
            </div>
            <input
              placeholder="예: 010-0000-0000"
              value={form.emergencyContact}
              onChange={e => f("emergencyContact", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.emergencyContact ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
            />
            {errors.emergencyContact && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.emergencyContact}</div>}
          </div>

          {/* 참여인원 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>참여인원 학번 및 이름 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
            <textarea
              placeholder={"예:\n20210001 홍길동\n20220042 이서연"}
              value={form.participants}
              onChange={e => f("participants", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }}
            />
          </div>

          {/* 사용 목적 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>사용 목적 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {PURPOSE_OPTIONS.map(p => (
                <button key={p} onClick={() => f("purpose", p)} style={{
                  background: form.purpose === p ? C.navy : C.bg,
                  color:      form.purpose === p ? "#fff"  : C.muted,
                  border:    `1.5px solid ${form.purpose === p ? C.navy : C.border}`,
                  borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
                }}>{p}</button>
              ))}
            </div>
            {errors.purpose && <div style={{ color:C.red, fontSize:11, marginBottom:8 }}>⚠️ {errors.purpose}</div>}
            <textarea
              placeholder="세부 내용을 입력해주세요 (예: 단편영화 '봄날' 제작, 야외 촬영 예정)"
              value={form.purposeDetail}
              onChange={e => f("purposeDetail", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.purposeDetail ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }}
            />
            {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.purposeDetail}</div>}
          </div>

          {/* 대여 기간 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>대여 기간 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
              {/* 시작 */}
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📅 대여 시작</div>
                <input type="date" value={form.startDate} onChange={e => f("startDate", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.startDate ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
                <select value={form.startTime} onChange={e => f("startTime", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.startDate && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.startDate}</div>}
              </div>
              {/* 종료 */}
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📅 반납</div>
                <input type="date" value={form.endDate} onChange={e => f("endDate", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.endDate ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
                <select value={form.endTime} onChange={e => f("endTime", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.endDate && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.endDate}</div>}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting}>
              {submitting ? "신청 중..." : "✅ 신청 완료"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
