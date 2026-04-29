import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Modal } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import SignaturePad from "../../components/SignaturePad";
import { serverTimestamp } from "firebase/firestore";

const STEPS = ["카메라", "배터리", "렌즈", "액세서리", "확인"];

export default function GuideReserve() {
  const { profile }      = useAuth();
  const { data: equips } = useCollection("equipments", "modelName");

  const [step, setStep]         = useState(0);
  const [cart, setCart]         = useState({});        // { modelName: quantity }
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [showSign, setShowSign] = useState(false);
  const [sig, setSig]           = useState("");
  const [form, setForm]         = useState({ startDate:"", endDate:"", startTime:"09:00", endTime:"18:00", purpose:"수업", purposeDetail:"" });
  const [done, setDone]         = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0,10);

  // 유형별 장비 필터
  const cameras    = equips.filter(e => e.equipType === "camera" && e.status !== "수리중" && !e.isSet);
  const batteries  = equips.filter(e => e.equipType === "battery");
  const lenses     = equips.filter(e => e.equipType === "lens" && !e.isSet);
  const adapters   = equips.filter(e => e.equipType === "adapter");
  const extras     = equips.filter(e => e.equipType === "etc" || !e.equipType);

  // 선택한 카메라에 맞는 배터리
  const matchedBatteries = selectedCamera
    ? batteries.filter(b => b.forCamera === selectedCamera.modelName || b.batteryModel === selectedCamera.batteryModel)
    : batteries;

  // 렌즈 + 어댑터 필요 여부
  const needsAdapter = (lens) => {
    if (!selectedCamera || !lens.mount) return false;
    return lens.mount !== selectedCamera.mount;
  };
  const getAdapter = (lens) => {
    if (!selectedCamera) return null;
    return adapters.find(a => a.adapterFrom === lens.mount && a.adapterTo === selectedCamera.mount);
  };

  const addToCart = (modelName, qty = 1) => setCart(p => ({ ...p, [modelName]: (p[modelName]||0) + qty }));
  const removeFromCart = (modelName) => setCart(p => { const n = {...p}; delete n[modelName]; return n; });
  const getQty = (modelName) => cart[modelName] || 0;

  const cartItems = Object.entries(cart).map(([modelName, quantity]) => {
    const e = equips.find(eq => eq.modelName === modelName);
    return { modelName, quantity, equip: e };
  });

  const handleSubmit = async () => {
    if (!sig) { alert("서명이 필요합니다"); return; }
    setSubmitting(true);
    await addItem("rentalRequests", {
      studentId:   profile?.studentId || "",
      studentName: profile?.name      || "",
      dept:        profile?.dept      || "",
      phone:       profile?.phone     || "",
      items: cartItems.map(i => ({ modelName: i.modelName, quantity: i.quantity, equipName: i.equip?.itemName || "" })),
      startDate:   form.startDate,
      endDate:     form.endDate,
      startTime:   form.startTime,
      endTime:     form.endTime,
      purpose:     form.purpose,
      purposeDetail: form.purposeDetail,
      studentSignature: sig,
      status:      "승인대기",
      createdAt:   serverTimestamp(),
    });
    setDone(true);
    setSubmitting(false);
  };

  if (done) return (
    <div style={{ textAlign:"center", padding:"40px 20px" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <div style={{ fontSize:18, fontWeight:800, color:C.navy, marginBottom:8 }}>예약 신청 완료!</div>
      <div style={{ fontSize:13, color:C.muted }}>관리자 승인을 기다려 주세요.</div>
    </div>
  );

  const EquipCard = ({ e, onSelect, selected, qty, onAdd, onRemove, badge }) => {
    const photos = e.displayPhotoUrl ? [e.displayPhotoUrl] : (e.photoUrls || []);
    return (
      <Card style={{ padding:"12px", border:`1.5px solid ${selected?C.teal:C.border}`, marginBottom:8 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {photos[0] && <div style={{ width:52, height:52, borderRadius:8, overflow:"hidden", flexShrink:0, border:`1px solid ${C.border}` }}><img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} /></div>}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:2 }}>{e.modelName}</div>
            {e.itemName && <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{e.itemName}</div>}
            {badge && <span style={{ background:C.orangeLight, color:C.orange, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{badge}</span>}
          </div>
          {onSelect && (
            <Btn onClick={onSelect} color={selected ? C.teal : C.navy} small>{selected ? "✓ 선택됨" : "선택"}</Btn>
          )}
          {onAdd && (
            qty > 0 ? (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <button onClick={onRemove} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                <button onClick={onAdd} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
              </div>
            ) : (
              <Btn onClick={onAdd} color={C.navy} small>+ 선택</Btn>
            )
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      {/* 스텝 인디케이터 */}
      <div style={{ display:"flex", gap:4, marginBottom:20 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex:1, height:4, borderRadius:2, background: i<=step ? C.teal : C.border }} />
        ))}
      </div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:16 }}>Step {step+1} / {STEPS.length} — {STEPS[step]}</div>

      {/* Step 0: 카메라 선택 */}
      {step === 0 && (
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>📷 어떤 카메라를 사용할 건가요?</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>촬영 목적에 맞는 카메라를 선택해주세요</div>
          {cameras.map(e => (
            <EquipCard key={e.id} e={e}
              selected={selectedCamera?.modelName === e.modelName}
              onSelect={() => {
                setSelectedCamera(e);
                addToCart(e.modelName, 1);
              }} />
          ))}
          <Btn onClick={() => setStep(1)} color={C.navy} full disabled={!selectedCamera}>다음 →</Btn>
        </div>
      )}

      {/* Step 1: 배터리 선택 */}
      {step === 1 && (
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>🔋 배터리를 선택하세요</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>{selectedCamera?.modelName}에 맞는 배터리예요</div>
          {matchedBatteries.length === 0 && <div style={{ color:C.muted, fontSize:13, marginBottom:16 }}>등록된 배터리가 없습니다</div>}
          {matchedBatteries.map(e => (
            <EquipCard key={e.id} e={e}
              qty={getQty(e.modelName)}
              onAdd={() => addToCart(e.modelName, 1)}
              onRemove={() => {
                const q = getQty(e.modelName);
                if (q <= 1) removeFromCart(e.modelName);
                else setCart(p => ({...p, [e.modelName]: q-1}));
              }} />
          ))}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setStep(0)} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={() => setStep(2)} color={C.navy} full>다음 →</Btn>
          </div>
        </div>
      )}

      {/* Step 2: 렌즈 선택 */}
      {step === 2 && (
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>🔭 렌즈를 선택하세요</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>다른 마운트 렌즈는 어댑터가 자동으로 추가돼요</div>
          {lenses.map(e => {
            const need = needsAdapter(e);
            const adapter = need ? getAdapter(e) : null;
            const qty = getQty(e.modelName);
            return (
              <div key={e.id}>
                <EquipCard e={e}
                  qty={qty}
                  badge={need ? `⚠️ ${adapter ? adapter.modelName+"(자동추가)" : "어댑터 없음"}` : null}
                  onAdd={() => {
                    addToCart(e.modelName, 1);
                    if (need && adapter && getQty(adapter.modelName) === 0) addToCart(adapter.modelName, 1);
                  }}
                  onRemove={() => {
                    const q = getQty(e.modelName);
                    if (q <= 1) { removeFromCart(e.modelName); if (need && adapter) removeFromCart(adapter.modelName); }
                    else setCart(p => ({...p, [e.modelName]: q-1}));
                  }} />
              </div>
            );
          })}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setStep(1)} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={() => setStep(3)} color={C.navy} full>다음 →</Btn>
          </div>
        </div>
      )}

      {/* Step 3: 추가 액세서리 */}
      {step === 3 && (
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>🎒 추가 장비가 필요한가요?</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>선택하지 않아도 돼요</div>
          {extras.map(e => (
            <EquipCard key={e.id} e={e}
              qty={getQty(e.modelName)}
              onAdd={() => addToCart(e.modelName, 1)}
              onRemove={() => {
                const q = getQty(e.modelName);
                if (q <= 1) removeFromCart(e.modelName);
                else setCart(p => ({...p, [e.modelName]: q-1}));
              }} />
          ))}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setStep(2)} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={() => setStep(4)} color={C.navy} full>다음 →</Btn>
          </div>
        </div>
      )}

      {/* Step 4: 최종 확인 */}
      {step === 4 && (
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:16 }}>✅ 최종 확인</div>

          {/* 선택 장비 목록 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>선택한 장비</div>
            {cartItems.map(item => (
              <div key={item.modelName} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                <span>{item.modelName}</span>
                <span style={{ fontWeight:700, color:C.navy }}>{item.quantity}개</span>
              </div>
            ))}
          </div>

          {/* 대여 일시 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>대여 일시 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>시작일</div>
                <input type="date" value={form.startDate} min={today} onChange={e => setForm(p=>({...p,startDate:e.target.value,endDate:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>반납일</div>
                <input type="date" value={form.endDate} min={form.startDate||today} onChange={e => setForm(p=>({...p,endDate:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>대여 시간</div>
                <input type="time" value={form.startTime} onChange={e => setForm(p=>({...p,startTime:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>반납 시간</div>
                <input type="time" value={form.endTime} onChange={e => setForm(p=>({...p,endTime:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>
          </div>

          {/* 목적 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>목적 *</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
              {["수업","과제","개인 프로젝트","기타"].map(p => (
                <button key={p} onClick={() => setForm(f=>({...f,purpose:p}))}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.purpose===p?C.teal:C.border}`, background:form.purpose===p?C.tealLight:C.bg, color:form.purpose===p?C.teal:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  {p}
                </button>
              ))}
            </div>
            <textarea placeholder="세부 목적을 입력해주세요" value={form.purposeDetail} onChange={e => setForm(p=>({...p,purposeDetail:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:72, boxSizing:"border-box" }} />
          </div>

          {/* 서명 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>신청자 서명 *</div>
            {sig ? (
              <div style={{ background:C.bg, borderRadius:10, padding:8, border:`1px solid ${C.border}`, position:"relative" }}>
                <img src={sig} alt="서명" style={{ width:"100%", height:80, objectFit:"contain" }} />
                <button onClick={() => setSig("")} style={{ position:"absolute", top:6, right:8, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13 }}>다시 서명</button>
              </div>
            ) : (
              <Btn onClick={() => setShowSign(true)} color={C.muted} outline full>✍️ 서명하기</Btn>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setStep(3)} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting || !form.startDate || !sig}>
              {submitting ? "신청 중..." : "✅ 신청 완료"}
            </Btn>
          </div>
        </div>
      )}

      {/* 서명 모달 */}
      {showSign && (
        <Modal onClose={() => setShowSign(false)} width={500}>
          <SignaturePad title="✍️ 서명" onSave={s => { setSig(s); setShowSign(false); }} onCancel={() => setShowSign(false)} />
        </Modal>
      )}
    </div>
  );
}
