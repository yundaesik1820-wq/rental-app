import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Modal } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import SignaturePad from "../../components/SignaturePad";
import { serverTimestamp } from "firebase/firestore";

export default function GuideReserve({ onComplete }) {
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
  const [chargerWanted, setChargerWanted] = useState({}); // {camModelName: true/false/undefined}
  const [storageWanted, setStorageWanted] = useState({});
  const [readerWanted, setReaderWanted] = useState({}); // {camModelName: true/false/undefined}
  const [showVBP, setShowVBP] = useState({}); // {camModelName: true/false} VBP 펼침 여부
  // 전체 스텝: 0=카메라선택, 1=배터리, 2=렌즈, 3=액세서리, 4=확인
  const [step, setStep]           = useState(0);

  const [extraCart, setExtraCart] = useState({});
  // 추가장비 단계별 카테고리 순서
  const EXTRA_STEPS = ["기타"]; // 추가장비는 minorCategory==="기타"인 항목만
  const [extraStepIdx, setExtraStepIdx] = useState(0); // 추가장비 내 단계
  const [sig, setSig]             = useState("");
  const [showSign, setShowSign]   = useState(false);
  const [form, setForm]           = useState({ startDate:"", endDate:"", startTime:"09:00", endTime:"18:00", purpose:"수업", purposeDetail:"" });
  const [done, setDone]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightbox,   setLightbox]   = useState(null);   // { photos, idx }
  const [equipDetail, setEquipDetail] = useState(null); // 장비 상세 보기

  const today = new Date().toISOString().slice(0,10);

  // 촬영 대분류 중 카메라/캠코더 계열
  const CAMCORDER_MINOR = ["캠코더"];
  const allCameraEquips = equips.filter(e =>
    (e.majorCategory === "촬영" &&
      ["카메라", "캠코더", "드론/액션캠"].includes(e.minorCategory)
    ) ||
    e.equipType === "camera" || e.equipType === "camcorder"
  ).filter(e => e.status !== "수리중" && !e.isSet);

  const cameras = camType === "camcorder"
    ? allCameraEquips.filter(e => e.minorCategory === "캠코더" || e.equipType === "camcorder")
    : camType === "camera"
    ? allCameraEquips.filter(e => e.minorCategory !== "캠코더" && e.equipType !== "camcorder")
    : allCameraEquips;
  const batteries = equips.filter(e => e.equipType === "battery" || e.minorCategory === "배터리");
  const chargers  = equips.filter(e => e.equipType === "charger" || e.minorCategory === "충전기/전원");
  const storages  = equips.filter(e => e.equipType === "storage" || e.minorCategory === "저장매체");
  const readers   = equips.filter(e => e.minorCategory === "카드리더기");
  const lensesRaw = equips.filter(e => (e.equipType === "lens" || ["단렌즈","줌렌즈","시네렌즈","렌즈"].includes(e.minorCategory)) && !e.isSet);
  // 렌즈 모델별 그룹화 (대표 장비 + 재고 합산)
  const lenses = Object.values(lensesRaw.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));
  const adapters = equips.filter(e => e.equipType === "adapter");
  // 추가장비: minorCategory가 "기타"인 항목만
  const extrasRaw = equips.filter(e =>
    e.minorCategory === "기타" &&
    e.status !== "수리중"
  );
  // 모델별 그룹화 (대표 장비 + 재고 합산)
  const extrasGrouped = Object.values(extrasRaw.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));

  const currentCam = selectedCameras[camIdx];

  // 현재 카메라에 맞는 배터리 (모델별 그룹화)
  const matchedBatteriesRaw = currentCam
    ? batteries.filter(b =>
        b.forCamera === currentCam.modelName ||
        (b.forCameras || []).includes(currentCam.modelName) ||
        (currentCam.batteryModel && b.modelName === currentCam.batteryModel)
      )
    : [];
  const matchedBatteries = Object.values(matchedBatteriesRaw.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));


  const needsAdapter = (lens) => currentCam && lens.mount && lens.mount !== currentCam.mount;
  const getAdapter   = (lens) => adapters.find(a => a.adapterFrom === lens.mount && a.adapterTo === currentCam?.mount);

  // 선택 헬퍼
  const getSelection = (camModel) => cameraSelections[camModel] || { batteries:{}, lens:{}, chargers:{}, storages:{}, readers:{} };

  // 현재 카메라용 선택된 배터리 모델 목록
  const selectedBatteryModels = currentCam
    ? Object.entries(getSelection(currentCam.modelName).batteries || {})
        .filter(([_, q]) => q > 0)
        .map(([m]) => m)
    : [];

  // 선택된 배터리에 호환되는 충전기 (모델별 그룹화)
  const matchedChargersRaw = selectedBatteryModels.length > 0
    ? chargers.filter(c => {
        const forBats = c.chargerForBatteries || [];
        // 신규: chargerForBatteries 우선
        if (forBats.length > 0) {
          return selectedBatteryModels.some(bm => forBats.includes(bm));
        }
        // 폴백: 구버전 chargerForCameras (호환성 유지)
        return currentCam && (
          (c.chargerForCameras || []).includes(currentCam.modelName) ||
          c.forCamera === currentCam.modelName
        );
      })
    : [];
  const matchedChargers = Object.values(matchedChargersRaw.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));

  // 현재 카메라에 맞는 저장매체 (모델별 그룹화)
  const matchedStoragesRaw = currentCam
    ? storages.filter(s =>
        s.forCamera === currentCam.modelName ||
        (s.forCameras || []).includes(currentCam.modelName)
      )
    : [];
  const matchedStorages = Object.values(matchedStoragesRaw.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));

  // 현재 카메라에 선택된 저장매체의 소분류 (타입) 목록
  const selectedStorageTypes = currentCam
    ? Object.entries(getSelection(currentCam.modelName).storages || {})
        .filter(([_, q]) => q > 0)
        .map(([modelName]) => {
          const stg = storages.find(s => s.modelName === modelName);
          return stg?.subCategory || "";
        })
        .filter(Boolean)
    : [];

  // 선택된 저장매체 타입을 읽을 수 있는 리더기 매칭
  // 리더기의 subCategory를 "/"로 split해서 각 타입과 비교
  const matchedReadersRaw = selectedStorageTypes.length > 0
    ? readers.filter(r => {
        const readerTypes = (r.subCategory || "").split("/").map(s => s.trim()).filter(Boolean);
        return readerTypes.some(rt => selectedStorageTypes.some(st =>
          rt === st || rt.includes(st) || st.includes(rt)
        ));
      })
    : [];
  const matchedReaders = Object.values(matchedReadersRaw.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));

  const setReaderQty = (camModel, rdrModel, qty) => {
    setCameraSelections(p => ({
      ...p,
      [camModel]: { ...getSelection(camModel), readers: { ...(getSelection(camModel).readers || {}), [rdrModel]: qty } }
    }));
  };

  const setStorageQty = (camModel, stgModel, qty) => {
    setCameraSelections(p => ({
      ...p,
      [camModel]: { ...getSelection(camModel), storages: { ...(getSelection(camModel).storages || {}), [stgModel]: qty } }
    }));
  };

  const setChargerQty = (camModel, chgModel, qty) => {
    setCameraSelections(p => ({
      ...p,
      [camModel]: { ...getSelection(camModel), chargers: { ...(getSelection(camModel).chargers || {}), [chgModel]: qty } }
    }));
  };

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
      const qty = camQty[cam.modelName] || 1;
      cart[cam.modelName] = (cart[cam.modelName]||0) + qty;
      const sel = getSelection(cam.modelName);
      // 배터리/렌즈는 선택한 수량 그대로 (카메라 대수와 무관)
      Object.entries(sel.batteries).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
      Object.entries(sel.chargers || {}).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
      Object.entries(sel.storages || {}).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
      Object.entries(sel.readers  || {}).forEach(([m,q]) => { if(q>0) cart[m] = (cart[m]||0)+q; });
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
    if (step === 4) return totalCams > 1 ? `카드리더기 (${camIdx+1}/${totalCams} - ${currentCam?.modelName})` : "카드리더기";
    if (step === 3) return totalCams > 1 ? `저장매체 (${camIdx+1}/${totalCams} - ${currentCam?.modelName})` : "저장매체";
    if (step === 2) return totalCams > 1 ? `충전기 (${camIdx+1}/${totalCams} - ${currentCam?.modelName})` : "충전기";
    if (step === 1) return totalCams > 1 ? `배터리 (${camIdx+1}/${totalCams} - ${currentCam?.modelName} ${camQty[currentCam?.modelName]||1}대)` : `배터리 - ${currentCam?.modelName} ${camQty[currentCam?.modelName]||1}대`;
    if (step === 5) return totalCams > 1 ? `렌즈 (${camIdx+1}/${totalCams} - ${currentCam?.modelName})` : `렌즈`;
    if (step === 6) return EXTRA_STEPS[extraStepIdx] || "추가 장비";
    if (step === 7) return "추가 장비 필요하세요?";
    return "신청";
  };

  const totalSteps = 2 + totalCams * 2 + 1; // 카메라 + (배터리+렌즈)*N + 액세서리 + 확인
  const currentStepNum = step === 0 ? 0 : step <= 3 ? camIdx * 2 + step : totalCams * 2 + step - 2;

  const goNext = () => {
    const skipLens = camType === "camcorder";
    if (step === 1) {
      setStep(2); // 배터리 → 충전기 단계로
      return;
    }
    if (step === 2) {
      // 충전기 → 저장매체 단계로
      setStep(3);
      return;
    }
    if (step === 3) {
      // 저장매체 → 카드리더기 단계로
      setStep(4);
      return;
    }
    if (step === 4) {
      // 카드리더기 → 캠코더면 다음 카메라 또는 추가장비, 아니면 렌즈
      if (skipLens) {
        if (camIdx < selectedCameras.length - 1) { setCamIdx(i => i+1); setStep(1); }
        else { setExtraStepIdx(0); setStep(6); }
      } else {
        setStep(5);
      }
      return;
    }
    if (step === 5) {
      if (camIdx < selectedCameras.length - 1) { setCamIdx(i => i+1); setStep(1); }
      else { setExtraStepIdx(0); setStep(6); }
      return;
    }
    // step 3: 카테고리별 순환 (ACC → 트라이포드 → 모니터 → 음향)
    if (step === 6) {
      if (extraStepIdx < EXTRA_STEPS.length - 1) {
        setExtraStepIdx(i => i+1);
      } else {
        setStep(7); // 추가장비 필요하세요?
      }
      return;
    }
    // step 4: 추가장비 필요 여부 → 신청서 작성
    if (step === 7) {
      onComplete && onComplete(buildCart());
      return;
    }
    setStep(s => s+1);
  };
  const goPrev = () => {
    const skipLens = camType === "camcorder";
    if (step === 0 && camType !== null) { setCamType(null); setSelectedCameras([]); setCameraSelections({}); setCamQty({}); return; }
    if (step === 1 && camIdx === 0) { setStep(0); return; }
    if (step === 1) { setCamIdx(i => i-1); setStep(skipLens ? 4 : 5); return; }
    if (step === 5) { setStep(4); return; }
    if (step === 4) { setStep(3); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setStep(1); return; }
    if (step === 6 && extraStepIdx > 0) { setExtraStepIdx(i => i-1); return; }
    if (step === 6 && extraStepIdx === 0) {
      setCamIdx(selectedCameras.length-1);
      setStep(skipLens ? 1 : 5);
      return;
    }
    if (step === 7) { setExtraStepIdx(EXTRA_STEPS.length-1); setStep(6); return; }
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
    const url = e.displayPhotoUrl || (e.photoUrls && e.photoUrls[0]) || "";
    if (!url) return <div style={{ width:52, height:52, borderRadius:8, background:C.bg, border:`1px solid ${C.border}`, flexShrink:0 }} />;
    return (
      <div style={{ width:52, height:52, borderRadius:8, overflow:"hidden", flexShrink:0, border:`1px solid ${C.border}`, cursor:"zoom-in" }}
        onClick={(ev) => { ev.stopPropagation(); setLightbox({ photos:[url], idx:0 }); }}>
        <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
      </div>
    );
  };

  // 장비 소분류 + 궁금하다면 버튼
  const EquipInfo = ({ e }) => {
    const kws = (e.keywords || "").split(",").map(s => s.trim()).filter(Boolean);
    const bundle = (e.bundledItems || e.setItems || "").split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    return (
      <div>
        <div style={{ marginTop:4, display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
          {e.minorCategory && (
            <span style={{ background:C.blueLight, color:C.blue, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>
              {e.minorCategory}
            </span>
          )}
          {kws.map((kw, i) => (
            <span key={i} style={{ background:C.tealLight, color:C.teal, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>⚡ {kw}</span>
          ))}
          <button onClick={(ev) => { ev.stopPropagation(); setEquipDetail(e); }}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"2px 8px", fontSize:10, color:C.muted, cursor:"pointer" }}>
            🔍 장비가 궁금하다면?
          </button>
        </div>
        {bundle.length > 0 && (
          <div style={{ marginTop:4, fontSize:10, color:C.muted }}>
            <span style={{ fontWeight:700, color:C.orange }}>📦 포함: </span>
            {bundle.join(" · ")}
          </div>
        )}
      </div>
    );
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
                      <EquipInfo e={e} />
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
              // 유니크 모델만 selectedCameras에 저장 (수량은 camQty로 관리)
              const uniqueSelected = [];
              const seen = new Set();
              selected.forEach(e => {
                if (!seen.has(e.modelName)) { seen.add(e.modelName); uniqueSelected.push(e); }
              });
              setSelectedCameras(uniqueSelected);
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
            <img src="/mascot/thunder.png" alt="" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>🔋 배터리를 선택해주세요</div>
              <div style={{ fontSize:12, color:C.muted }}>{currentCam.modelName} {camQty[currentCam.modelName]||1}대용 배터리예요</div>
            </div>
          </div>
          {matchedBatteries.length === 0 && <div style={{ color:C.muted, fontSize:13, marginBottom:16, padding:"20px 0", textAlign:"center" }}>등록된 배터리가 없습니다</div>}
          {(() => {
            const isVBP = (b) => (b.subCategory || "").toUpperCase().includes("VBP") || (b.subCategory || "").includes("V-Mount") || (b.subCategory || "").includes("V마운트");
            const dedicated = matchedBatteries.filter(b => !isVBP(b));
            const vbpList   = matchedBatteries.filter(b => isVBP(b));
            const vbpOpen   = showVBP[currentCam.modelName] === true;
            const renderBatteryCard = (e) => {
              const qty = getSelection(currentCam.modelName).batteries[e.modelName] || 0;
              return (
                <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <EquipPhoto e={e} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                      {e.itemName && <div style={{ fontSize:11, color:C.muted }}>{e.itemName}</div>}
                      <div style={{ fontSize:10, color:e.available===0?C.red:C.muted }}>재고 {e.available||0}개</div>
                      <EquipInfo e={e} />
                    </div>
                    {e.available === 0 ? (
                      <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                    ) : qty > 0 ? (
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <button onClick={() => setBatteryQty(currentCam.modelName, e.modelName, Math.max(0, qty-1))}
                          style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                        <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                        <button onClick={() => setBatteryQty(currentCam.modelName, e.modelName, Math.min(e.available||1, qty+1))}
                          style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                      </div>
                    ) : (
                      <Btn onClick={() => setBatteryQty(currentCam.modelName, e.modelName, 1)} color={C.navy} small>+ 선택</Btn>
                    )}
                  </div>
                </Card>
              );
            };
            return (
              <>
                {/* 전용 배터리 (VBP 외) */}
                {dedicated.length > 0 && dedicated.map(renderBatteryCard)}

                {/* VBP 펼치기 */}
                {vbpList.length > 0 && (
                  <div style={{ marginTop: dedicated.length > 0 ? 12 : 0 }}>
                    <button onClick={() => setShowVBP(p => ({ ...p, [currentCam.modelName]: !vbpOpen }))}
                      style={{ width:"100%", background:C.bg, border:`1px dashed ${C.border}`, borderRadius:10, padding:"10px 14px", fontSize:12, fontWeight:700, color:C.muted, cursor:"pointer", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                      <span>🔋 V-Mount 배터리 {vbpList.length}개 {vbpOpen ? "접기 ▲" : "펼쳐보기 ▼"}</span>
                    </button>
                    {vbpOpen && vbpList.map(renderBatteryCard)}
                  </div>
                )}
              </>
            );
          })()}
          {/* 충전기 선택 영역 */}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full>다음 →</Btn>
          </div>
        </div>
      )}

      {/* Step 2: 충전기/전원선 필요 여부 + 선택 */}
      {step === 2 && currentCam && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/shrug.png" alt="" style={{ width:80, height:80, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:4 }}>🔌 충전기/전원선이 필요한가요?</div>
              <div style={{ fontSize:12, color:C.muted }}>
                {selectedBatteryModels.length > 0
                  ? `선택한 배터리(${selectedBatteryModels.join(", ")}) 호환 충전기를 보여드려요`
                  : "배터리 충전이나 외부 전원이 필요하면 선택하세요"}
              </div>
            </div>
          </div>

          {/* 필요 여부 선택 */}
          {chargerWanted[currentCam.modelName] === undefined && (
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <Btn onClick={() => setChargerWanted(p => ({ ...p, [currentCam.modelName]: true }))} color={C.teal} full>
                ✅ 네, 필요해요
              </Btn>
              <Btn onClick={() => {
                setChargerWanted(p => ({ ...p, [currentCam.modelName]: false }));
                goNext();
              }} color={C.muted} outline full>
                ❌ 아니요, 괜찮아요
              </Btn>
            </div>
          )}

          {/* 충전기 목록 */}
          {chargerWanted[currentCam.modelName] === true && (
            <>
              {matchedChargers.length === 0 ? (
                <div style={{ background:C.bg, borderRadius:10, padding:"20px 14px", textAlign:"center", marginBottom:16, border:`1px dashed ${C.border}` }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>호환되는 충전기가 등록되어 있지 않아요</div>
                  <div style={{ fontSize:11, color:C.muted }}>관리자에게 문의해주세요</div>
                </div>
              ) : (
                matchedChargers.map(e => {
                  const qty = (getSelection(currentCam.modelName).chargers || {})[e.modelName] || 0;
                  return (
                    <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <EquipPhoto e={e} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                          <div style={{ fontSize:10, color:e.available===0?C.red:C.muted, marginTop:2 }}>재고 {e.available}/{e.total}</div>
                          <EquipInfo e={e} />
                        </div>
                        {e.available === 0 ? (
                          <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                        ) : qty > 0 ? (
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <button onClick={() => setChargerQty(currentCam.modelName, e.modelName, Math.max(0, qty-1))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                            <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                            <button onClick={() => setChargerQty(currentCam.modelName, e.modelName, Math.min(e.available||1, qty+1))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                          </div>
                        ) : (
                          <Btn onClick={() => setChargerQty(currentCam.modelName, e.modelName, 1)} color={C.navy} small>+ 선택</Btn>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
              <button onClick={() => setChargerWanted(p => ({ ...p, [currentCam.modelName]: undefined }))}
                style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", marginBottom:10, marginTop:4 }}>
                ← 다시 선택
              </button>
            </>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full
              disabled={chargerWanted[currentCam.modelName] === undefined}>
              다음 →
            </Btn>
          </div>
        </div>
      )}

      {/* Step 3: 저장매체 필요 여부 + 선택 */}
      {step === 3 && currentCam && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/shrug.png" alt="" style={{ width:80, height:80, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:4 }}>💾 저장매체(메모리카드)가 필요한가요?</div>
              <div style={{ fontSize:12, color:C.muted }}>{currentCam.modelName} 호환 저장매체를 보여드려요</div>
            </div>
          </div>

          {/* 필요 여부 선택 */}
          {storageWanted[currentCam.modelName] === undefined && (
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <Btn onClick={() => setStorageWanted(p => ({ ...p, [currentCam.modelName]: true }))} color={C.teal} full>
                ✅ 네, 필요해요
              </Btn>
              <Btn onClick={() => {
                setStorageWanted(p => ({ ...p, [currentCam.modelName]: false }));
                goNext();
              }} color={C.muted} outline full>
                ❌ 아니요, 괜찮아요
              </Btn>
            </div>
          )}

          {/* 저장매체 목록 */}
          {storageWanted[currentCam.modelName] === true && (
            <>
              {matchedStorages.length === 0 ? (
                <div style={{ background:C.bg, borderRadius:10, padding:"20px 14px", textAlign:"center", marginBottom:16, border:`1px dashed ${C.border}` }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>호환되는 저장매체가 등록되어 있지 않아요</div>
                  <div style={{ fontSize:11, color:C.muted }}>관리자에게 문의해주세요</div>
                </div>
              ) : (
                matchedStorages.map(e => {
                  const qty = (getSelection(currentCam.modelName).storages || {})[e.modelName] || 0;
                  return (
                    <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <EquipPhoto e={e} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                          <div style={{ fontSize:10, color:e.available===0?C.red:C.muted, marginTop:2 }}>재고 {e.available}/{e.total}</div>
                          <EquipInfo e={e} />
                        </div>
                        {e.available === 0 ? (
                          <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                        ) : qty > 0 ? (
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <button onClick={() => setStorageQty(currentCam.modelName, e.modelName, Math.max(0, qty-1))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                            <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                            <button onClick={() => setStorageQty(currentCam.modelName, e.modelName, Math.min(e.available||1, qty+1))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                          </div>
                        ) : (
                          <Btn onClick={() => setStorageQty(currentCam.modelName, e.modelName, 1)} color={C.navy} small>+ 선택</Btn>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
              <button onClick={() => setStorageWanted(p => ({ ...p, [currentCam.modelName]: undefined }))}
                style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", marginBottom:10, marginTop:4 }}>
                ← 다시 선택
              </button>
            </>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full
              disabled={storageWanted[currentCam.modelName] === undefined}>
              다음 →
            </Btn>
          </div>
        </div>
      )}

      {/* Step 4: 카드리더기 필요 여부 + 선택 */}
      {step === 4 && currentCam && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/shrug.png" alt="" style={{ width:80, height:80, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:4 }}>📥 카드리더기가 필요한가요?</div>
              <div style={{ fontSize:12, color:C.muted }}>
                {selectedStorageTypes.length > 0
                  ? `선택한 저장매체(${selectedStorageTypes.join(", ")}) 호환 리더기예요`
                  : "저장매체를 선택해야 호환 리더기가 표시돼요"}
              </div>
            </div>
          </div>

          {/* 필요 여부 선택 */}
          {readerWanted[currentCam.modelName] === undefined && (
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <Btn onClick={() => setReaderWanted(p => ({ ...p, [currentCam.modelName]: true }))} color={C.teal} full>
                ✅ 네, 필요해요
              </Btn>
              <Btn onClick={() => {
                setReaderWanted(p => ({ ...p, [currentCam.modelName]: false }));
                goNext();
              }} color={C.muted} outline full>
                ❌ 아니요, 괜찮아요
              </Btn>
            </div>
          )}

          {/* 카드리더기 목록 */}
          {readerWanted[currentCam.modelName] === true && (
            <>
              {matchedReaders.length === 0 ? (
                <div style={{ background:C.bg, borderRadius:10, padding:"20px 14px", textAlign:"center", marginBottom:16, border:`1px dashed ${C.border}` }}>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>호환되는 카드리더기가 등록되어 있지 않아요</div>
                  <div style={{ fontSize:11, color:C.muted }}>관리자에게 문의해주세요</div>
                </div>
              ) : (
                matchedReaders.map(e => {
                  const qty = (getSelection(currentCam.modelName).readers || {})[e.modelName] || 0;
                  return (
                    <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <EquipPhoto e={e} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                          <div style={{ fontSize:10, color:e.available===0?C.red:C.muted, marginTop:2 }}>재고 {e.available}/{e.total}</div>
                          <EquipInfo e={e} />
                        </div>
                        {e.available === 0 ? (
                          <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                        ) : qty > 0 ? (
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <button onClick={() => setReaderQty(currentCam.modelName, e.modelName, Math.max(0, qty-1))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                            <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                            <button onClick={() => setReaderQty(currentCam.modelName, e.modelName, Math.min(e.available||1, qty+1))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                          </div>
                        ) : (
                          <Btn onClick={() => setReaderQty(currentCam.modelName, e.modelName, 1)} color={C.navy} small>+ 선택</Btn>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
              <button onClick={() => setReaderWanted(p => ({ ...p, [currentCam.modelName]: undefined }))}
                style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", marginBottom:10, marginTop:4 }}>
                ← 다시 선택
              </button>
            </>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.navy} full
              disabled={readerWanted[currentCam.modelName] === undefined}>
              다음 →
            </Btn>
          </div>
        </div>
      )}

      {/* Step 2: 렌즈 선택 */}
      {step === 5 && currentCam && camType !== "camcorder" && (
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
            const avail   = e.available || ((e.status || "대여가능") === "대여가능" ? 1 : 0);
            return (
              <Card key={e.id} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <EquipPhoto e={e} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                    {e.itemName && <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{e.itemName}</div>}
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {e.mount && <span style={{ fontSize:10, background:C.blueLight, color:C.navy, borderRadius:4, padding:"1px 6px" }}>{e.mount}</span>}
                      {need && adapter && <span style={{ fontSize:10, background:C.tealLight, color:C.teal, borderRadius:4, padding:"1px 6px" }}>🔗 {adapter.modelName} 자동추가</span>}
                      {need && !adapter && <span style={{ fontSize:10, background:C.yellowLight, color:C.yellow, borderRadius:4, padding:"1px 6px" }}>⚠️ 어댑터 미등록</span>}
                      <span style={{ fontSize:10, color:avail===0?C.red:C.muted }}>재고 {avail}개</span>
                    </div>
                    <EquipInfo e={e} />
                  </div>
                  {avail === 0 ? (
                    <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                  ) : qty > 0 ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={() => setLensQty(currentCam.modelName, e.modelName, Math.max(0,qty-1), adapter?.modelName)}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                      <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                      <button onClick={() => setLensQty(currentCam.modelName, e.modelName, Math.min(avail, qty+1), adapter?.modelName)}
                        style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                    </div>
                  ) : (
                    <Btn onClick={() => setLensQty(currentCam.modelName, e.modelName, 1, adapter?.modelName)} color={C.navy} small>
                      + 선택
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

      {/* Step 3: 카테고리별 추가 장비 (ACC → 트라이포드/그립 → 모니터 → 음향) */}
      {step === 6 && (() => {
        const curCat = EXTRA_STEPS[extraStepIdx];
        const catEquips = extrasGrouped.filter(e =>
          e.minorCategory === curCat || e.majorCategory === curCat ||
          (curCat === "ACC" && (e.minorCategory === "ACC" || e.majorCategory === "ACC" || e.equipType === "acc"))
        );
        return (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <img src="/mascot/shrug.png" alt="" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:2 }}>
                  {curCat === "ACC" ? "🎒 ACC" : curCat === "트라이포드/그립" ? "🔩 트라이포드/그립" : curCat === "모니터" ? "🖥️ 모니터" : curCat === "조명" ? "💡 조명" : "🎤 음향"} 장비가 필요한가요?
                </div>
                <div style={{ fontSize:11, color:C.muted }}>
                  {extraStepIdx+1}/{EXTRA_STEPS.length} 단계 · 필요 없으면 건너뛰세요
                </div>
              </div>
            </div>
            {/* 카테고리 진행 표시 */}
            <div style={{ display:"flex", gap:4, marginBottom:12 }}>
              {EXTRA_STEPS.map((s, i) => (
                <div key={s} style={{ flex:1, height:4, borderRadius:2,
                  background: i < extraStepIdx ? C.teal : i === extraStepIdx ? C.navy : C.border }} />
              ))}
            </div>
            {catEquips.length === 0
              ? <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"20px 0" }}>등록된 {curCat} 장비가 없어요</div>
              : catEquips.map(e => {
                  const qty   = extraCart[e.modelName] || 0;
                  const avail = e.available || 0;
                  return (
                    <Card key={e.modelName} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <EquipPhoto e={e} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                          {e.itemName && <div style={{ fontSize:11, color:C.muted }}>{e.itemName}</div>}
                          <div style={{ fontSize:10, color:avail===0?C.red:C.muted }}>재고 {avail}개</div>
                          <EquipInfo e={e} />
                        </div>
                        {avail === 0 ? (
                          <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                        ) : qty > 0 ? (
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <button onClick={() => setExtraCart(p => ({...p, [e.modelName]: Math.max(0,qty-1)}))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                            <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                            <button onClick={() => setExtraCart(p => ({...p, [e.modelName]: Math.min(avail, qty+1)}))}
                              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                          </div>
                        ) : (
                          <Btn onClick={() => setExtraCart(p => ({...p, [e.modelName]: 1}))} color={C.navy} small>+ 선택</Btn>
                        )}
                      </div>
                    </Card>
                  );
                })
            }
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
              <Btn onClick={goNext} color={C.navy} full>
                {extraStepIdx < EXTRA_STEPS.length - 1 ? `다음 → ${EXTRA_STEPS[extraStepIdx+1]}` : "다음 →"}
              </Btn>
            </div>
          </div>
        );
      })()}

      {/* Step 4: 추가 장비 필요하세요? */}
      {step === 7 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <img src="/mascot/shrug.png" alt="" style={{ width:80, height:80, objectFit:"contain", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:4 }}>🎒 추가 장비가 필요한가요?</div>
              <div style={{ fontSize:12, color:C.muted }}>카테고리에 없는 다른 장비가 필요하면 추가하세요</div>
            </div>
          </div>
          {extrasGrouped.length === 0
            ? <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"20px 0" }}>추가 장비가 없습니다</div>
            : extrasGrouped.map(e => {
                const qty   = extraCart[e.modelName] || 0;
                const avail = e.available || 0;
                return (
                  <Card key={e.modelName} style={{ padding:"12px", marginBottom:8, border:`1.5px solid ${qty>0?C.teal:C.border}` }}>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <EquipPhoto e={e} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{e.modelName}</div>
                        {e.itemName && <div style={{ fontSize:11, color:C.muted }}>{e.itemName}</div>}
                        <div style={{ fontSize:10, color:avail===0?C.red:C.muted }}>재고 {avail}개</div>
                        <EquipInfo e={e} />
                      </div>
                      {avail === 0 ? (
                        <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                      ) : qty > 0 ? (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <button onClick={() => setExtraCart(p => ({...p, [e.modelName]: Math.max(0,qty-1)}))}
                            style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:16 }}>−</button>
                          <span style={{ fontSize:16, fontWeight:700, color:C.teal, minWidth:20, textAlign:"center" }}>{qty}</span>
                          <button onClick={() => setExtraCart(p => ({...p, [e.modelName]: Math.min(avail, qty+1)}))}
                            style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, cursor:"pointer", fontSize:16, color:C.teal }}>+</button>
                        </div>
                      ) : (
                        <Btn onClick={() => setExtraCart(p => ({...p, [e.modelName]: 1}))} color={C.navy} small>+ 선택</Btn>
                      )}
                    </div>
                  </Card>
                );
              })
          }
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn onClick={goPrev} color={C.muted} outline full>← 이전</Btn>
            <Btn onClick={goNext} color={C.teal} full>📋 신청서 작성</Btn>
          </div>
        </div>
      )}


      
      {showSign && (
        <Modal onClose={() => setShowSign(false)} width={500}>
          <SignaturePad title="✍️ 서명" onSave={s => { setSig(s); setShowSign(false); }} onCancel={() => setShowSign(false)} />
        </Modal>
      )}

      {/* 사진 라이트박스 */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={lightbox.photos[lightbox.idx]} alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth:"90vw", maxHeight:"80vh", objectFit:"contain", borderRadius:12 }} />
          <button onClick={() => setLightbox(null)}
            style={{ position:"absolute", top:20, right:20, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"50%", width:40, height:40, fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* 장비 상세 모달 */}
      {equipDetail && (
        <Modal onClose={() => setEquipDetail(null)} width={400}>
          <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:4 }}>{equipDetail.modelName}</div>
          {equipDetail.minorCategory && (
            <span style={{ background:C.blueLight, color:C.blue, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
              {equipDetail.minorCategory}
            </span>
          )}
          {/* 사진 */}
          {(() => {
            const photos = equipDetail.displayPhotoUrl ? [equipDetail.displayPhotoUrl] : (equipDetail.photoUrls||[]);
            return photos.length > 0 && (
              <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                {photos.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setLightbox({ photos, idx:i })}
                    style={{ width:80, height:80, objectFit:"contain", borderRadius:8, border:`1px solid ${C.border}`, cursor:"zoom-in", background:C.bg }} />
                ))}
              </div>
            );
          })()}
          {/* 스펙 정보 */}
          <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
            {equipDetail.manufacturer && (
              <div style={{ display:"flex", fontSize:12, alignItems:"baseline" }}>
                <span style={{ color:C.muted, width:74, flexShrink:0 }}>🏭 제조사</span>
                <span style={{ color:C.text, fontWeight:600, wordBreak:"break-word" }}>{equipDetail.manufacturer}</span>
              </div>
            )}
            {equipDetail.mount && (
              <div style={{ display:"flex", fontSize:12, alignItems:"baseline" }}>
                <span style={{ color:C.muted, width:74, flexShrink:0 }}>🔗 마운트</span>
                <span style={{ color:C.text, fontWeight:600, wordBreak:"break-word" }}>{equipDetail.mount}</span>
              </div>
            )}
            {equipDetail.description && (
              <div style={{ fontSize:12, color:C.text, lineHeight:1.7, background:C.bg, borderRadius:8, padding:"10px 12px", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                📝 {equipDetail.description}
              </div>
            )}
            {equipDetail.available !== undefined && (
              <div style={{ display:"flex", fontSize:12, alignItems:"baseline" }}>
                <span style={{ color:C.muted, width:74, flexShrink:0 }}>📦 재고</span>
                <span style={{ color:equipDetail.available===0?C.red:C.green, fontWeight:700 }}>{equipDetail.available}대 대여 가능</span>
              </div>
            )}
          </div>
          <div style={{ marginTop:16 }}>
            <Btn onClick={() => setEquipDetail(null)} color={C.navy} full>닫기</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
