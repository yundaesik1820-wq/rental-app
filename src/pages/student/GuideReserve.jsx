import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Modal } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import SignaturePad from "../../components/SignaturePad";
import { serverTimestamp } from "firebase/firestore";

export default function GuideReserve() {
  const { profile }      = useAuth();

  const licenseToNum = (lic) => {
    if (!lic || lic === "없음") return 0;
    const n = parseInt(lic);
    return isNaN(n) ? 0 : n;
  };
  const myLicNum = licenseToNum(profile?.license);
  const isProf   = profile?.role === "professor" || profile?.role === "admin";
  const { data: equips } = useCollection("equipments", "modelName");

  // 선택한 카메라 목록 (순서 있음)
  const [camType, setCamType]           = useState(null);
  const [camQty, setCamQty]             = useState({});  // { modelName: qty } // null=미선택, "camera"|"camcorder"|"both"
  const [selectedCameras, setSelectedCameras] = useState([]);
  // 카메라별 배터리/렌즈 선택 { cameraModelName: { batteries: {model:qty}, lens: {model:qty} } }
  const [cameraSelections, setCameraSelections] = useState({});
  // 현재 처리 중인 카메라 인덱스
  const [camIdx, setCamIdx]       = useState(0);
  // 전체 스텝: 0=카메라선택, 1=배터리, 2=렌즈, 3=액세서리, 4=확인
  const [step, setStep]           = useState(0);

  const [extraCart, setExtraCart] = useState({});
  const [sig, setSig]             = useState("");
  const [showSign, setShowSign]   = useState(false);
  const [form, setForm]           = useState({ startDate:"", endDate:"", startTime:"09:00", endTime:"18:00", purpose:"수업", purposeDetail:"" });
  const [done, setDone]           = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0,10);

  // equipType="camera" 또는 minorCategory가 카메라 계열인 것 모두 포함
  const CAMERA_MINOR = ["카메라/드론", "캠코더", "액션캠"];
  const allCameraEquips = equips.filter(e =>
    (e.equipType === "camera" || CAMERA_MINOR.includes(e.minorCategory)) &&
    e.status !== "수리중" && !e.isSet
  );
  const cameras = camType === "camcorder"
    ? allCameraEquips.filter(e => e.minorCategory === "캠코더" || e.equipType === "camcorder")
    : camType === "camera"
    ? allCameraEquips.filter(e => e.minorCategory !== "캠코더")
    : allCameraEquips;
  const batteries = equips.filter(e => e.equipType === "battery" || e.minorCategory === "배터리");
  const chargers  = equips.filter(e => e.equipType === "charger" || e.minorCategory === "충전기/전원");
  const lenses   = equips.filter(e => e.equipType === "lens" && !e.isSet);
  const adapters = equips.filter(e => e.equipType === "adapter");
  const extras   = equips.filter(e => e.equipType === "etc" || !e.equipType);

  const currentCam = selectedCameras[camIdx];

  // 현재 카메라에 맞는 배터리
  const matchedBatteries = currentCam
    ? batteries.filter(b =>
        // 구버전 호환: forCamera 단일 필드
        b.forCamera === currentCam.modelName ||
        // 신버전: forCameras 배열
        (b.forCameras || []).includes(currentCam.modelName) ||
        // 카메라의 batteryModel 필드와 매칭
        (currentCam.batteryModel && b.modelName === currentCam.batteryModel)
      )
    : batteries;

  const needsAdapter = (lens) => currentCam && lens.mount && lens.mount !== currentCam.mount;
  const getAdapter   = (lens) => adapters.find(a => a.adapterFrom === lens.mount && a.adapterTo === currentCam?.mount);

  // 선택 헬퍼
  const getSelection = (camModel) => cameraSelections[camModel] || { batteries:{}, lens:{} };

  const setBatteryQty = (camModel, battModel, qty) => {
    setCameraSelections(p => ({
      ...p,
      [camModel]: { ...getSelection(camModel), batteries: { ...getSelection(camModel).batteries, [battModel]: qty } }
    }));
  };
  const setLensQty = (camModel, lensModel, qty, adapterModel) => {
    setCameraSelections(p => {
      const sel = getSelection(camModel);
      const newLens = { ...sel.lens, [lensModel]: qty };
      const newAdapters = { ...sel.batteries }; // 어댑터는 배터리 slot에 같이 저장
      if (adapterModel) {
        if (qty > 0) newAdapters[adapterModel] = 1;
        else delete newAdapters[adapterModel];
      }
      return { ...p, [camModel]: { batteries: newAdapters, lens: newLens } };
    });
  };

  // 전체 장바구니 계산
  const buildCart = () => {
    const cart = {};
    selectedCameras.forEach(cam => {
      cart[cam.modelName] = (cart[cam.modelName]||0) + 1;
      const sel = getSelection(cam.modelName);
      Object.entries(sel.batteries).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
      Object.entries(sel.lens).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
    });
    Object.entries(extraCart).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
    return cart;
  };

  // 스텝 레이블 계산
  const totalCams = selectedCameras.length;
  const getStepLabel = () => {
    if (step === 0 && camType === null) return "촬영 장비 종류 선택";
    if (step === 0) return "카메라 선택";
    if (step === 1) return totalCams > 1 ? `배터리 (${camIdx+1}번째 카메라: ${currentCam?.modelName})` : `배터리`;
    if (step === 2) return totalCams > 1 ? `렌즈 (${camIdx+1}번째 카메라: ${currentCam?.modelName})` : `렌즈`;
    if (step === 3) return "추가 액세서리";
    return "최종 확인";
  };

  const totalSteps = 2 + totalCams * 2 + 1; // 카메라 + (배터리+렌즈)*N + 액세서리 + 확인
  const currentStepNum = step === 0 ? 0 : step <= 2 ? camIdx * 2 + step : totalCams * 2 + step - 2;

  const goNext = () => {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (camIdx < selectedCameras.length - 1) { setCamIdx(i => i+1); setStep(1); }
      else setStep(3);
      return;
    }
    setStep(s => s+1);
  };
  const goPrev = () => {
    if (step === 0 && camType !== null) { setCamType(null); setSelectedCameras([]); setCameraSelections({}); return; }
    if (step === 1 && camIdx === 0) { setStep(0); return; }
    if (step === 1) { setCamIdx(i => i-1); setStep(2); return; }
    if (step === 2) { setStep(1); return; }
    if (step === 3 && selectedCameras.length > 0) { setCamIdx(selectedCameras.length-1); setStep(2); return; }
    setStep(s => s-1);
  };

  const handleSubmit = async () => {
    if (!sig) { alert("서명이 필요합니다"); return; }
    setSubmitting(true);
    const cart = buildCart();
    const items = Object.entries(cart).map(([modelName, quantity]) => {
      const e = equips.find(eq => eq.modelName === modelName);
      return { modelName, quantity, equipName: e?.itemName || "" };
    });
    await addItem("rentalRequests", {
      studentId: profile?.studentId||"", studentName: profile?.name||"",
      dept: profile?.dept||"", phone: profile?.phone||"",
      items, startDate:form.startDate, endDate:form.endDate,
      startTime:form.startTime, endTime:form.endTime,
      purpose:form.purpose, purposeDetail:form.purposeDetail,
      studentSignature: sig, status:"승인대기", createdAt:serverTimestamp(),
    });
    setDone(true); setSubmitting(false);
  };

  if (done) return (
    <div style={{ textAlign:"center", padding:"40px 20px" }}>
      <img src="/mascot/rental.png" alt="렌토리" style={{ width:160, height:160, objectFit:"contain", marginBottom:16 }} />
      <div style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>예약 신청 완료!</div>
      <div style={{ fontSize:14, fontWeight:700, color:C.teal, marginBottom:6 }}>장비대여중인 렌토리</div>
      <div style={{ fontSize:13, color:C.muted }}>관리자 승인을 기다려 주세요.</div>
    </div>
  );

  const EquipPhoto = ({ e }) => {
    const photos = e.displayPhotoUrl ? [e.displayPhotoUrl] : (e.photoUrls||[]);
    return photos[0] ? (
      <div style={{ width:52, height:52, borderRadius:8, overflow:"hidden", flexShrink:0, border:`1px solid ${C.border}` }}>
        <img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
      </div>
    ) : null;
  };

  return (
    <div>
      {/* 스텝 바 */}
      <div style={{ display:"flex", gap:3, marginBottom:8 }}>
        {Array.from({ length: Math.max(totalSteps, 3) }).map((_, i) => (
          <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i <= currentStepNum ? C.teal : C.border }} />
        ))}
      </div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:16 }}>{getStepLabel()}</div>

      {/* Step -1: 카메라 종류 선택 */}
      {step === 0 && camType === null && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/camera.png" alt="" style={{ width:72, height:72, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>어떤 촬영 장비가 필요해?</div>
              <div style={{ fontSize:12, color:C.muted }}>촬영 방식에 따라 골라봐!</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { key:"camera",    mascot:"camera.png",    label:"카메라",         desc:"미러리스, 시네마 카메라 등" },
              { key:"camcorder", mascot:"camcorder.png", label:"캠코더",         desc:"방송용 캠코더, ENG 카메라 등" },
              { key:"both",      mascot:"hi.png",        label:"카메라 + 캠코더", desc:"둘 다 필요해요" },
            ].map(opt => (
              <button key={opt.key} onClick={() => setCamType(opt.key)}
                style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:14, padding:"14px 16px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:14 }}>
                <img src={`/mascot/${opt.mascot}`} alt="" style={{ width:56, height:56, objectFit:"contain", flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:2 }}>{opt.label}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 0: 카메라 선택 (모델별 그룹화) */}
      {step === 0 && camType !== null && (() => {
        const stepTitle = camType === "camera" ? "카메라를 선택해주세요"
          : camType === "camcorder" ? "캠코더를 선택해주세요"
          : "장비를 선택해주세요";
        const stepMascot = camType === "camcorder" ? "camcorder.png" : "camera.png";

        // 모델명 기준으로 그룹화
        const grouped = Object.values(
          cameras.reduce((acc, e) => {
            const key = e.modelName;
            if (!acc[key]) acc[key] = { ...e, total:0, available:0 };
            acc[key].total++;
            if ((e.status||"대여가능") === "대여가능") acc[key].available++;
            return acc;
          }, {})
        );

        return (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <img src={`/mascot/${stepMascot}`} alt="" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>{stepTitle}</div>
                <div style={{ fontSize:12, color:C.muted }}>필요한 수량을 선택해주세요</div>
              </div>
            </div>
            {grouped.map((e) => {
              const qty       = camQty[e.modelName] || 0;
              const eqLic     = e.licenseLevel || 0;
              const isLocked  = !isProf && myLicNum < eqLic;
              const avail     = e.available;
              return (
                <Card key={e.modelName} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:isLocked?C.red:C.border}`, opacity:isLocked?0.7:1 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <EquipPhoto e={e} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2 }}>{e.modelName}</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                        {e.mount && <span style={{ fontSize:10, background:C.blueLight, color:C.navy, borderRadius:4, padding:"1px 6px" }}>{e.mount}</span>}
                        {eqLic > 0 && (
                          <span style={{ fontSize:10, background:isLocked?C.redLight:C.greenLight, color:isLocked?C.red:C.green, borderRadius:4, padding:"1px 6px", fontWeight:700 }}>
                            {isLocked ? `🔒 ${eqLic}단계 필요` : `✅ ${eqLic}단계`}
                          </span>
                        )}
                        <span style={{ fontSize:10, color:avail===0?C.red:C.muted }}>재고 {avail}/{e.total}대</span>
                      </div>
                    </div>
                    {isLocked ? (
                      <span style={{ fontSize:11, color:C.red, flexShrink:0 }}>대여 불가</span>
                    ) : avail === 0 ? (
                      <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                    ) : qty > 0 ? (
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                        <button onClick={() => setCamQty(p=>({...p,[e.modelName]:Math.max(0,qty-1)}))}
                          style={{ width:28,height:28,borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontSize:16 }}>−</button>
                        <span style={{ fontSize:16,fontWeight:800,color:C.teal,minWidth:20,textAlign:"center" }}>{qty}</span>
                        <button onClick={() => setCamQty(p=>({...p,[e.modelName]:Math.min(avail,qty+1)}))}
                          style={{ width:28,height:28,borderRadius:7,border:`1px solid ${C.teal}`,background:C.tealLight,cursor:"pointer",fontSize:16,color:C.teal }}>+</button>
                      </div>
                    ) : (
                      <Btn onClick={() => setCamQty(p=>({...p,[e.modelName]:1}))} color={C.navy} small>+ 선택</Btn>
                    )}
                  </div>
                </Card>
              );
            })}
            <Btn onClick={() => {
              // camQty 기반으로 selectedCameras 배열 생성 (수량만큼 반복)
              const selected = [];
              Object.entries(camQty).forEach(([modelName, qty]) => {
                if (qty > 0) {
                  const equip = cameras.find(e => e.modelName === modelName);
                  if (equip) for (let i=0; i<qty; i++) selected.push(equip);
                }
              });
              setSelectedCameras(selected);
              setCamIdx(0); setStep(1);
            }} color={C.navy} full disabled={Object.values(camQty).every(q=>q===0)}>
              다음 → {Object.values(camQty).some(q=>q>0) && `(${Object.values(camQty).reduce((s,q)=>s+q,0)}대 선택)`}
            </Btn>
          </div>
        );
      })()}

      {/* Step 1: 배터리 선택 */}
      {step === 1 && currentCam && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/camcorder.png" alt="" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>🔋 배터리를 선택해주세요</div>
              <div style={{ fontSize:12, color:C.muted }}>{currentCam.modelName}용 배터리예요</div>
            </div>
          </div>
          {matchedBatteries.length === 0 && <div style={{ color:C.muted, fontSize:13, marginBottom:16, padding:"20px 0", textAlign:"center" }}>등록된 배터리가 없습니다</div>}
          {matchedBatteries.map(e => {
            const qty = getSelection(currentCam.modelName).batteries[e.modelName] || 0;
            return (
              <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <EquipPhoto e={e} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                    {e.itemName && <div style={{ fontSize:11, color:C.muted }}>{e.itemName}</div>}
                  </div>
                  {qty > 0 ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={() => setBatteryQty(currentCam.modelName, e.modelName, Math.max(0, qty-1))}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                      <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                      <button onClick={() => setBatteryQty(currentCam.modelName, e.modelName, qty+1)}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                    </div>
                  ) : (
                    <Btn onClick={() => setBatteryQty(currentCam.modelName, e.modelName, 1)} color={C.navy} small>+ 선택</Btn>
                  )}
                </div>
              </Card>
            );
          })}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full>다음 →</Btn>
          </div>
        </div>
      )}

      {/* Step 2: 렌즈 선택 */}
      {step === 2 && currentCam && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/lens.png" alt="" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>🔭 렌즈를 선택해주세요</div>
              <div style={{ fontSize:12, color:C.muted }}>다른 마운트는 어댑터가 자동 추가돼요</div>
            </div>
          </div>
          {lenses.map(e => {
            const need    = needsAdapter(e);
            const adapter = need ? getAdapter(e) : null;
            const qty     = getSelection(currentCam.modelName).lens[e.modelName] || 0;
            return (
              <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <EquipPhoto e={e} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                    {e.itemName && <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{e.itemName}</div>}
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {e.mount && <span style={{ fontSize:10, background:C.blueLight, color:C.navy, borderRadius:4, padding:"1px 6px" }}>{e.mount}</span>}
                      {need && <span style={{ fontSize:10, background:C.orangeLight, color:C.orange, borderRadius:4, padding:"1px 6px" }}>⚠️ {adapter ? `${adapter.modelName} 자동추가` : "어댑터 없음"}</span>}
                    </div>
                  </div>
                  {qty > 0 ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={() => setLensQty(currentCam.modelName, e.modelName, Math.max(0,qty-1), adapter?.modelName)}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                      <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                      <button onClick={() => setLensQty(currentCam.modelName, e.modelName, qty+1, adapter?.modelName)}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                    </div>
                  ) : (
                    <Btn onClick={() => setLensQty(currentCam.modelName, e.modelName, 1, adapter?.modelName)} color={need && !adapter ? C.muted : C.navy} small disabled={need && !adapter}>
                      {need && !adapter ? "불가" : "+ 선택"}
                    </Btn>
                  )}
                </div>
              </Card>
            );
          })}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full>
              {camIdx < selectedCameras.length - 1 ? `다음 카메라 →` : "다음 →"}
            </Btn>
          </div>
        </div>
      )}

      {/* Step 3: 추가 액세서리 */}
      {step === 3 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/shrug.png" alt="" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>🎒 추가 장비가 필요한가요?</div>
              <div style={{ fontSize:12, color:C.muted }}>선택하지 않아도 괜찮아요</div>
            </div>
          </div>
          {extras.length === 0 && <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"20px 0" }}>등록된 액세서리가 없습니다</div>}
          {extras.map(e => {
            const qty = extraCart[e.modelName] || 0;
            return (
              <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <EquipPhoto e={e} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                    {e.itemName && <div style={{ fontSize:11, color:C.muted }}>{e.itemName}</div>}
                  </div>
                  {qty > 0 ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={() => setExtraCart(p => ({...p, [e.modelName]: Math.max(0,qty-1)}))}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                      <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                      <button onClick={() => setExtraCart(p => ({...p, [e.modelName]: qty+1}))}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                    </div>
                  ) : (
                    <Btn onClick={() => setExtraCart(p => ({...p, [e.modelName]: 1}))} color={C.navy} small>+ 선택</Btn>
                  )}
                </div>
              </Card>
            );
          })}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full>다음 →</Btn>
          </div>
        </div>
      )}

      {/* Step 4: 최종 확인 */}
      {step === 4 && (
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:16 }}>✅ 최종 확인</div>
          {/* 선택 장비 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>선택한 장비</div>
            {Object.entries(buildCart()).map(([modelName, qty]) => (
              <div key={modelName} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                <span style={{ color:C.text }}>{modelName}</span>
                <span style={{ fontWeight:700, color:C.navy }}>{qty}개</span>
              </div>
            ))}
          </div>
          {/* 일시 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>대여 일시 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              {[["시작일","startDate","date",today],["반납일","endDate","date",form.startDate||today]].map(([label,key,type,min]) => (
                <div key={key}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{label}</div>
                  <input type={type} value={form[key]} min={min} onChange={e => setForm(p=>({...p,[key]:e.target.value}))}
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["대여 시간","startTime","time"],["반납 시간","endTime","time"]].map(([label,key,type]) => (
                <div key={key}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{label}</div>
                  <input type={type} value={form[key]} onChange={e => setForm(p=>({...p,[key]:e.target.value}))}
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
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
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting || !form.startDate || !sig}>
              {submitting ? "신청 중..." : "✅ 신청 완료"}
            </Btn>
          </div>
        </div>
      )}

      {showSign && (
        <Modal onClose={() => setShowSign(false)} width={500}>
          <SignaturePad title="✍️ 서명" onSave={s => { setSig(s); setShowSign(false); }} onCancel={() => setShowSign(false)} />
        </Modal>
      )}
    </div>
  );
}
