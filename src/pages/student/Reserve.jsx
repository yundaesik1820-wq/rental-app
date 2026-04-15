import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";
import { groupEquipments } from "../../utils/groupEquipments";

const PURPOSE_OPTIONS = ["과제 및 스터디", "동아리", "작품제작", "학교행사"];

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  }
}

export default function Reserve() {
  const { profile } = useAuth();
  const { data: equipments } = useCollection("equipments", "createdAt");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [cart, setCart]     = useState({}); // { modelName: quantity }
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]     = useState(false);
  const [errors, setErrors] = useState({});

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

  // 모델별로 묶기
  const grouped  = groupEquipments(equipments);
  const cats     = ["전체", ...new Set(grouped.map(e => e.majorCategory).filter(Boolean))];
  const filtered = grouped.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search))
  );

  const cartModels  = grouped.filter(e => (cart[e.modelName] || 0) > 0);
  const cartTotal   = Object.values(cart).reduce((a, b) => a + b, 0);

  const setQty = (modelName, qty, max) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setCart(p => ({ ...p, [modelName]: clamped }));
  };

  const f = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: "" })); };

  const validate = () => {
    const errs = {};
    if (cartModels.length === 0)  errs.cart = "장비를 1개 이상 선택하세요";
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
        studentId:   profile.studentId,
        studentName: profile.name,
        phone:       profile.phone   || "",
        dept:        profile.dept    || "",
        license:     profile.license || "없음",
        items: cartModels.map(e => ({
          modelName: e.modelName,
          equipName: e.modelName,
          itemName:  e.itemName,
          category:  e.majorCategory,
          quantity:  cart[e.modelName],
        })),
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
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>📅 장비 예약 신청</PageTitle>
        {cartTotal > 0 && (
          <button onClick={() => setShowForm(true)} style={{ background:C.teal, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" }}>
            📋 신청서 작성
            <span style={{ background:"rgba(255,255,255,0.25)", borderRadius:20, padding:"2px 10px" }}>{cartTotal}개</span>
          </button>
        )}
      </div>

      {done && <div style={{ background:C.greenLight, color:C.green, borderRadius:12, padding:"14px 18px", marginBottom:16, fontWeight:700, fontSize:14, border:`1px solid ${C.green}30` }}>✅ 대여 신청이 완료됐어요! 관리자 승인을 기다려 주세요.</div>}

      {/* 선택된 장비 요약 */}
      {cartTotal > 0 && (
        <Card style={{ border:`2px solid ${C.teal}40`, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.teal, marginBottom:12 }}>📋 선택한 장비 ({cartTotal}개)</div>
          {cartModels.map(e => (
            <div key={e.modelName} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName}</div>
                <div style={{ fontSize:11, color:C.muted }}>{e.majorCategory}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={() => setQty(e.modelName, (cart[e.modelName]||0)-1, e.available)} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16, fontWeight:700 }}>−</button>
                <span style={{ fontSize:14, fontWeight:700, color:C.navy, minWidth:24, textAlign:"center" }}>{cart[e.modelName]}</span>
                <button onClick={() => setQty(e.modelName, (cart[e.modelName]||0)+1, e.available)} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, fontWeight:700, color:C.teal }}>+</button>
                <span style={{ fontSize:11, color:C.muted }}>/ {e.available}대</span>
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
        <input placeholder="🔍 모델명, 품명, 제조사 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:180, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background:filter===c?C.navy:C.surface, color:filter===c?"#fff":C.muted, border:`1px solid ${filter===c?C.navy:C.border}`, borderRadius:20, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {errors.cart && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {errors.cart}</div>}

      {/* 장비 목록 (모델별) */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:14 }}>
        {filtered.map(e => {
          const avail    = e.available;
          const qty      = cart[e.modelName] || 0;
          const selected = qty > 0;
          return (
            <Card key={e.modelName} style={{ border:`2px solid ${selected?C.teal:C.border}`, transition:"border 0.15s" }}>
              <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                {e.majorCategory && <span style={{ background:C.blueLight, color:C.blue, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{e.majorCategory}</span>}
                {e.minorCategory && <span style={{ background:C.bg, color:C.muted, borderRadius:6, padding:"2px 8px", fontSize:11, border:`1px solid ${C.border}` }}>{e.minorCategory}</span>}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>{e.modelName}</div>
                <Badge label={avail > 0 ? "대여가능" : "대여불가"} />
              </div>
              {e.itemName     && <div style={{ fontSize:13, color:C.text, marginBottom:2 }}>{e.itemName}</div>}
              {e.manufacturer && <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>🏭 {e.manufacturer}</div>}

              <div style={{ background:C.border, borderRadius:6, height:5, overflow:"hidden", marginBottom:4 }}>
                <div style={{ width:`${(avail/e.total)*100}%`, background:avail===0?C.red:C.teal, height:"100%", borderRadius:6 }} />
              </div>
              <div style={{ fontSize:12, color:avail===0?C.red:C.muted, fontWeight:avail===0?700:400, marginBottom:12 }}>
                대여 가능 {avail}대 / 전체 {e.total}대{avail===0?" · 현재 대여 불가":""}
              </div>

              {/* 수량 선택 */}
              {avail === 0 ? (
                <span style={{ fontSize:12, color:C.muted }}>재고 없음</span>
              ) : selected ? (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button onClick={() => setQty(e.modelName, qty-1, avail)} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:18, fontWeight:700 }}>−</button>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:800, color:C.teal, minWidth:36 }}>{qty}</div>
                    <div style={{ fontSize:9, color:C.muted }}>최대 {avail}대</div>
                  </div>
                  <button onClick={() => setQty(e.modelName, qty+1, avail)} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:18, fontWeight:700, color:C.teal }}>+</button>
                  <button onClick={() => setQty(e.modelName, 0, avail)} style={{ marginLeft:4, background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", textDecoration:"underline" }}>취소</button>
                </div>
              ) : (
                <Btn onClick={() => setQty(e.modelName, 1, avail)} color={C.teal} small>+ 선택</Btn>
              )}
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

          {/* 신청자 정보 (자동입력) */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:12 }}>👤 신청자 정보 (자동입력)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["이름", profile?.name], ["학번", profile?.studentId], ["연락처", profile?.phone || "-"], ["계열", profile?.dept || "-"], ["라이선스", profile?.license || "없음"]].map(([k,v]) => (
                <div key={k} style={{ background:C.surface, borderRadius:8, padding:"8px 12px", border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 선택 장비 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:10 }}>🔧 신청 장비</div>
            {cartModels.map(e => (
              <div key={e.modelName} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>가능 {e.available}대 중</div>
                </div>
                <span style={{ fontSize:15, fontWeight:800, color:C.teal }}>{cart[e.modelName]}대</span>
              </div>
            ))}
          </div>

          {/* 비상연락처 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
              비상연락처 <span style={{ color:cartTotal>=2?C.red:C.muted, fontSize:11 }}>{cartTotal>=2?"* 2인 이상 필수":"(선택)"}</span>
            </div>
            <input placeholder="예: 010-0000-0000" value={form.emergencyContact} onChange={e => f("emergencyContact", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.emergencyContact?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            {errors.emergencyContact && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.emergencyContact}</div>}
          </div>

          {/* 참여인원 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>참여인원 학번 및 이름 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
            <textarea placeholder={"예:\n20210001 홍길동\n20220042 이서연"} value={form.participants} onChange={e => f("participants", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
          </div>

          {/* 사용 목적 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>사용 목적 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {PURPOSE_OPTIONS.map(p => (
                <button key={p} onClick={() => f("purpose", p)} style={{ background:form.purpose===p?C.navy:C.bg, color:form.purpose===p?"#fff":C.muted, border:`1.5px solid ${form.purpose===p?C.navy:C.border}`, borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{p}</button>
              ))}
            </div>
            {errors.purpose && <div style={{ color:C.red, fontSize:11, marginBottom:8 }}>⚠️ {errors.purpose}</div>}
            <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.purposeDetail?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
            {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.purposeDetail}</div>}
          </div>

          {/* 대여 기간 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>대여 기간 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📅 대여 시작</div>
                <input type="date" value={form.startDate} onChange={e => f("startDate", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.startDate?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
                <select value={form.startTime} onChange={e => f("startTime", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.startDate && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.startDate}</div>}
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📅 반납</div>
                <input type="date" value={form.endDate} onChange={e => f("endDate", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.endDate?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
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
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting}>{submitting?"신청 중...":"✅ 신청 완료"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
