import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Empty } from "../../components/UI";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  classifyAccessories, matchBatteries, matchChargers,
  needsAdapter, findAdapter, groupByModel, licenseToNum, isVMount,
} from "../../utils/equipCompat";

/* ============================================================
   장비 상세 — 카메라/캠코더를 고르면 호환 액세서리를 함께 담는다.
   배민 메뉴 상세처럼 한 페이지에서 필요한 것만 고르고 마지막에 장바구니로.
   담기 결과는 { modelName: qty } 평평한 맵 → 그대로 cart에 merge된다.
   ============================================================ */
export default function EquipDetail({ cam, equipments, onBack, onAdd }) {
  const { profile } = useAuth();
  const myLic = licenseToNum(profile?.license);
  const isProf = profile?.role === "professor" || profile?.role === "admin";

  const [qty, setQty] = useState(1);
  // 갈래별 { modelName: qty } — 삼각대/그립은 장비 목록에서 따로 담는다
  const [sel, setSel] = useState({ lens:{}, batteries:{}, chargers:{}, storages:{}, readers:{} });
  const [adapters, setAdapters] = useState({}); // 렌즈 때문에 자동으로 붙는 어댑터
  const [open, setOpen] = useState({});          // 펼친 섹션 { lens: true }
  const toggle = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  const [vbpOpen, setVbpOpen] = useState(false); // V마운트 배터리 펼침

  const acc = classifyAccessories(equipments);
  const camAvail = cam.available ?? 1;

  const pick = (group, model, q, max) => {
    const v = Math.max(0, Math.min(q, max));
    setSel(p => ({ ...p, [group]: { ...p[group], [model]: v } }));
  };

  const selectedBatteryModels = Object.entries(sel.batteries).filter(([, q]) => q > 0).map(([m]) => m);
  const matchedBatteries = matchBatteries(cam, acc.batteries);
  // 전용 배터리를 위에, V마운트는 접어서 아래에
  const dedicatedBatteries = matchedBatteries.filter(b => !isVMount(b));
  const vbpBatteries       = matchedBatteries.filter(isVMount);
  const matchedChargers  = matchChargers(selectedBatteryModels, acc.chargers, cam);
  const storages = groupByModel(acc.storages);
  const readers  = groupByModel(acc.readers);

  // 렌즈는 마운트가 달라도 어댑터가 있으면 담을 수 있다. 어댑터가 없으면 담기 차단.
  const setLens = (lens, q) => {
    const max = lens.available || 0;
    const v = Math.max(0, Math.min(q, max));
    setSel(p => ({ ...p, lens: { ...p.lens, [lens.modelName]: v } }));
    if (needsAdapter(lens, cam)) {
      const ad = findAdapter(lens, cam, acc.adapters);
      if (ad) {
        setAdapters(p => {
          const next = { ...p };
          if (v > 0) next[ad.modelName] = 1; else delete next[ad.modelName];
          return next;
        });
      }
    }
  };

  // 최종 담기 — 본품 + 고른 액세서리 + 자동 어댑터를 한 맵으로
  const handleAdd = () => {
    const out = { [cam.modelName]: qty };
    Object.values(sel).forEach(group => {
      Object.entries(group).forEach(([m, q]) => { if (q > 0) out[m] = (out[m] || 0) + q; });
    });
    Object.entries(adapters).forEach(([m, q]) => { out[m] = (out[m] || 0) + q; });
    onAdd(out);
    onBack();
  };

  const pickedCount = Object.values(sel).reduce(
    (n, g) => n + Object.values(g).filter(q => q > 0).length, 0
  ) + Object.keys(adapters).length;

  // 액세서리 한 줄 (수량 조절)
  const Row = ({ e, group, note }) => {
    const q = (group === "lens" ? sel.lens : sel[group])[e.modelName] || 0;
    const max = e.available || 0;
    const eqLic = e.licenseLevel || 0;
    const locked = !isProf && myLic < eqLic;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.modelName}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
            {max}개 가능{note ? ` · ${note}` : ""}
          </div>
        </div>
        {locked ? (
          <span style={{ fontSize:11, color:C.red, fontWeight:600, flexShrink:0 }}>🔒 Lv.{eqLic}</span>
        ) : max === 0 ? (
          <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            <button onClick={() => group === "lens" ? setLens(e, q-1) : pick(group, e.modelName, q-1, max)}
              style={{ width:26, height:26, borderRadius:6, border:`1px solid ${C.border}`, background:C.surface, color:C.text, cursor:"pointer", fontSize:14, fontWeight:700 }}>−</button>
            <span style={{ fontSize:14, fontWeight:800, color: q>0?C.teal:C.muted, minWidth:18, textAlign:"center" }}>{q}</span>
            <button onClick={() => group === "lens" ? setLens(e, q+1) : pick(group, e.modelName, q+1, max)}
              style={{ width:26, height:26, borderRadius:6, border:`1px solid ${C.teal}`, background:C.tealLight, color:C.teal, cursor:"pointer", fontSize:14, fontWeight:700 }}>+</button>
          </div>
        )}
      </div>
    );
  };

  // 접힌 상태가 기본. 고른 개수는 접혀 있어도 보이게.
  const Section = ({ id, title, desc, children }) => {
    const isOpen = !!open[id];
    const picked = Object.values(sel[id] || {}).filter(q => q > 0).length;
    return (
      <div style={{ marginTop:10 }}>
        <button onClick={() => toggle(id)}
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%", background:C.surface,
            border:`1px solid ${isOpen ? C.teal : C.border}`, borderRadius:12, padding:"12px 14px",
            cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
          <span style={{ fontSize:14, fontWeight:800, color:C.text }}>{title}</span>
          {picked > 0 && (
            <span style={{ background:C.tealLight, color:C.teal, borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:800 }}>
              {picked}종
            </span>
          )}
          <span style={{ marginLeft:"auto", fontSize:12, color:C.muted }}>{isOpen ? "▲" : "▼"}</span>
        </button>
        {isOpen && (
          <div style={{ padding:"10px 2px 2px" }}>
            {desc && <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{desc}</div>}
            {children}
          </div>
        )}
      </div>
    );
  };

  const photos = cam.displayPhotoUrl ? [cam.displayPhotoUrl] : (cam.photoUrls || []);

  return (
    <div style={{ paddingBottom:90 }}>
      <button onClick={onBack}
        style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.muted, fontSize:13, cursor:"pointer", marginBottom:14 }}>
        ← 장비 목록
      </button>

      {/* 본품 */}
      <Card style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          {photos.length > 0 && (
            <div style={{ width:72, height:72, borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
              <img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
            </div>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{cam.modelName}</div>
            {cam.manufacturer && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{cam.manufacturer}</div>}
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
              {camAvail}대 가능{cam.mount ? ` · ${cam.mount} 마운트` : ""}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12 }}>
          <span style={{ fontSize:12, color:C.muted, marginRight:"auto" }}>수량</span>
          <button onClick={() => setQty(Math.max(1, qty-1))}
            style={{ width:30, height:30, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, color:C.text, cursor:"pointer", fontSize:16, fontWeight:700 }}>−</button>
          <span style={{ fontSize:18, fontWeight:800, color:C.teal, minWidth:26, textAlign:"center" }}>{qty}</span>
          <button onClick={() => setQty(Math.min(camAvail, qty+1))}
            style={{ width:30, height:30, borderRadius:7, border:`1px solid ${C.teal}`, background:C.tealLight, color:C.teal, cursor:"pointer", fontSize:16, fontWeight:700 }}>+</button>
        </div>
      </Card>

      <Section id="lens" title="🔭 렌즈" desc="마운트가 다르면 어댑터가 자동으로 함께 담겨요">
        {acc.lenses.length === 0
          ? <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>등록된 렌즈가 없어요</div>
          : acc.lenses.map(e => {
              const need = needsAdapter(e, cam);
              const ad = need ? findAdapter(e, cam, acc.adapters) : null;
              if (need && !ad) return (
                <div key={e.modelName} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", marginBottom:6, opacity:0.5 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{e.modelName}</div>
                    <div style={{ fontSize:11, color:C.red, marginTop:2 }}>마운트 불일치 ({e.mount} → {cam.mount}) · 어댑터 없음</div>
                  </div>
                </div>
              );
              return <Row key={e.modelName} e={e} group="lens" note={ad ? `${ad.modelName} 어댑터 자동 포함` : undefined} />;
            })}
      </Section>

      <Section id="batteries" title="🔋 배터리" desc={`${cam.modelName}에 맞는 배터리만 보여요`}>
        {matchedBatteries.length === 0 ? (
          <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>등록된 호환 배터리가 없어요</div>
        ) : (
          <>
            {/* 전용 배터리 먼저 */}
            {dedicatedBatteries.length === 0 && (
              <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>전용 배터리는 없어요</div>
            )}
            {dedicatedBatteries.map(e => <Row key={e.modelName} e={e} group="batteries" />)}

            {/* V마운트는 접어둔다 — 목록이 길고 대부분 전용을 쓴다 */}
            {vbpBatteries.length > 0 && (
              <>
                <button onClick={() => setVbpOpen(o => !o)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%",
                    background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"9px 12px",
                    fontSize:12, fontWeight:700, color:C.muted, cursor:"pointer", fontFamily:"inherit",
                    marginTop: dedicatedBatteries.length > 0 ? 4 : 0 }}>
                  V마운트 배터리 {vbpBatteries.length}종 {vbpOpen ? "▲" : "▼"}
                </button>
                {vbpOpen && (
                  <div style={{ marginTop:6 }}>
                    {vbpBatteries.map(e => <Row key={e.modelName} e={e} group="batteries" />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Section>

      <Section id="chargers" title="🔌 충전기" desc={selectedBatteryModels.length === 0 ? "배터리를 먼저 고르면 맞는 충전기가 떠요" : "고른 배터리에 맞는 충전기예요"}>
        {selectedBatteryModels.length === 0
          ? <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>배터리를 먼저 골라주세요</div>
          : matchedChargers.length === 0
          ? <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>맞는 충전기가 없어요</div>
          : matchedChargers.map(e => <Row key={e.modelName} e={e} group="chargers" />)}
      </Section>

      <Section id="storages" title="💾 저장매체">
        {storages.length === 0
          ? <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>등록된 저장매체가 없어요</div>
          : storages.map(e => <Row key={e.modelName} e={e} group="storages" />)}
      </Section>

      <Section id="readers" title="🔎 카드리더기">
        {readers.length === 0
          ? <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>등록된 카드리더기가 없어요</div>
          : readers.map(e => <Row key={e.modelName} e={e} group="readers" />)}
      </Section>

      {/* 담기 바 */}
      <div style={{ position:"fixed", left:0, right:0, bottom:78, padding:"0 16px", zIndex:400 }}>
        <button onClick={handleAdd}
          style={{ width:"100%", background:C.teal, color:"#fff", border:"none", borderRadius:14,
            padding:"14px 18px", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            boxShadow:"0 6px 20px rgba(0,0,0,0.35)" }}>
          <span>{cam.modelName} {qty}대{pickedCount > 0 ? ` + 액세서리 ${pickedCount}종` : ""}</span>
          <span>장바구니에 담기 ›</span>
        </button>
      </div>
    </div>
  );
}
