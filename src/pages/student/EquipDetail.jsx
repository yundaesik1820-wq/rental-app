import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Empty, Modal } from "../../components/UI";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCart } from "../../hooks/useCart.jsx";
import {
  classifyAccessories, matchBatteries, matchChargers, needsAdapter, findAdapter, decideAdapter,
  groupByModel, licenseToNum, isVMount, groupLensesByBrand,
} from "../../utils/equipCompat";

/* ============================================================
   장비 상세 — 카메라/캠코더를 고르면 호환 액세서리를 함께 담는다.
   배민 메뉴 상세처럼 한 페이지에서 필요한 것만 고르고 마지막에 장바구니로.
   담기 결과는 { modelName: qty } 평평한 맵 → 그대로 cart에 merge된다.
   ============================================================ */
export default function EquipDetail({ cam, equipments, onBack }) {
  const { profile } = useAuth();
  const { cart, setCart, setCartSets } = useCart();
  const myLic = licenseToNum(profile?.license);
  const isProf = profile?.role === "professor" || profile?.role === "admin";

  const [qty, setQty] = useState(1);
  // 갈래별 { modelName: qty } — 삼각대/그립은 장비 목록에서 따로 담는다
  const [sel, setSel] = useState({ lens:{}, batteries:{}, chargers:{}, storages:{}, readers:{} });
  const [open, setOpen] = useState({});          // 펼친 섹션 { lens: true }
  const toggle = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  const [vbpOpen, setVbpOpen] = useState(false); // V마운트 배터리 펼침
  const [selSets, setSelSets] = useState({});    // 고른 렌즈 세트 { modelName: true }
  const [openBrand, setOpenBrand] = useState({});// 펼친 렌즈 제조사
  const [askAdapter, setAskAdapter] = useState(false); // "어댑터 하나 더?" 모달
  const toggleBrand = (b) => setOpenBrand(p => ({ ...p, [b]: !p[b] }));

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
  // 렌즈는 단품 + 세트를 합쳐 제조사별로 (SONY → CANON → XEEN CF → ...)
  const lensBrands = groupLensesByBrand([...acc.lenses, ...acc.lensSets]);

  // 렌즈는 마운트가 달라도 어댑터가 있으면 담을 수 있다. 어댑터가 없으면 담기 차단.
  const setLens = (lens, q) => {
    const max = lens.available || 0;
    const v = Math.max(0, Math.min(q, max));
    setSel(p => ({ ...p, lens: { ...p.lens, [lens.modelName]: v } }));
  };

  // 어댑터는 고른 렌즈 전체에서 파생시킨다 — 렌즈마다 붙였다 떼면, 같은 어댑터를 쓰는
  // 다른 렌즈가 남아 있는데도 지워진다. 판정 규칙은 equipCompat.decideAdapter에.
  const pickedLenses = Object.entries(sel.lens)
    .filter(([, q]) => q > 0)
    .map(([m]) => acc.lenses.find(l => l.modelName === m))
    .filter(Boolean);
  const plan = decideAdapter(pickedLenses, cam, acc.adapters, cart);

  // 담기 — 어댑터를 하나 더 담을지 물어봐야 하는 상황이면 모달을 먼저 띄운다
  const handleAdd = () => {
    if (plan.askExtra) { setAskAdapter(true); return; }
    commitAdd(false);
  };

  // 최종 담기 — 단품(본품·액세서리·자동 어댑터)은 cart로, 렌즈 세트는 cartSets로
  const commitAdd = (extraAdapter) => {
    const out = { [cam.modelName]: qty };
    Object.values(sel).forEach(group => {
      Object.entries(group).forEach(([m, q]) => { if (q > 0) out[m] = (out[m] || 0) + q; });
    });
    setCart(prev => {
      const next = { ...prev };
      Object.entries(out).forEach(([m, q]) => { next[m] = (next[m] || 0) + q; });
      // 어댑터만은 누적(+)이 아니라 목표 수량으로 못박는다 — 같은 상세에 두 번 들어와도 안 쌓인다.
      // 추가분은 askExtra(inCart < stock)를 통과해야만 오므로 재고를 넘지 않는다.
      if (plan.auto) next[plan.auto.modelName] = 1;
      else if (extraAdapter && plan.adapter) next[plan.adapter.modelName] = plan.inCart + 1;
      return next;
    });
    const sets = Object.entries(selSets).filter(([, on]) => on);
    if (sets.length > 0) {
      setCartSets(prev => {
        const next = { ...prev };
        sets.forEach(([m]) => { next[m] = true; });
        return next;
      });
    }
    onBack();
  };

  const pickedCount = Object.values(sel).reduce(
    (n, g) => n + Object.values(g).filter(q => q > 0).length, 0
  ) + (plan.auto ? 1 : 0) + Object.values(selSets).filter(Boolean).length;

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
    // 렌즈는 세트도 함께 센다 (세트는 sel이 아니라 selSets에 있음)
    const picked = Object.values(sel[id] || {}).filter(q => q > 0).length
      + (id === "lens" ? Object.values(selSets).filter(Boolean).length : 0);
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
        {lensBrands.length === 0 ? (
          <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>등록된 렌즈가 없어요</div>
        ) : lensBrands.map(g => {
          const isOpen = !!openBrand[g.brand];
          const picked = g.items.filter(e => e.isSet ? selSets[e.modelName] : (sel.lens[e.modelName] || 0) > 0).length;
          return (
            <div key={g.brand} style={{ marginBottom:6 }}>
              <button onClick={() => toggleBrand(g.brand)}
                style={{ display:"flex", alignItems:"center", gap:8, width:"100%", background:C.bg,
                  border:`1px solid ${isOpen ? C.teal : C.border}`, borderRadius:10, padding:"9px 12px",
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                {g.logo && (
                  <img src={g.logo} alt="" width={24} height={24}
                    style={{ objectFit:"contain", flexShrink:0 }}
                    onError={ev => { ev.currentTarget.style.display = "none"; }} />
                )}
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{g.brand}</span>
                <span style={{ fontSize:11, color:C.muted }}>{g.items.length}종</span>
                {picked > 0 && (
                  <span style={{ background:C.tealLight, color:C.teal, borderRadius:20, padding:"1px 7px", fontSize:10, fontWeight:800 }}>{picked}</span>
                )}
                <span style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div style={{ marginTop:6 }}>
                  {g.items.map(e => {
                    // 렌즈 세트(XEEN CF 등) — 수량 없이 1세트 토글
                    if (e.isSet) {
                      const on = !!selSets[e.modelName];
                      const setList = (e.setItems || "").split("\n").filter(Boolean);
                      return (
                        <div key={e.modelName} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, border:`1px solid ${on ? C.teal : C.border}`, borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.text }}>
                              {e.modelName} <span style={{ fontSize:10, color:C.purple, fontWeight:800 }}>SET</span>
                            </div>
                            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                              {e.available}세트 가능{setList.length > 0 ? ` · 구성 ${setList.length}개` : ""}
                            </div>
                          </div>
                          {e.available === 0 ? (
                            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>재고 없음</span>
                          ) : (
                            <button onClick={() => setSelSets(p => ({ ...p, [e.modelName]: !p[e.modelName] }))}
                              style={{ background:on ? C.teal : "transparent", color:on ? "#fff" : C.teal,
                                border:`1px solid ${C.teal}`, borderRadius:8, padding:"5px 12px",
                                fontSize:11, fontWeight:800, cursor:"pointer", flexShrink:0, fontFamily:"inherit" }}>
                              {on ? "담김" : "담기"}
                            </button>
                          )}
                        </div>
                      );
                    }
                    const need = needsAdapter(e, cam);
                    const ad = need ? findAdapter(e, cam, acc.adapters) : null;
                    const adInCart = ad ? (cart[ad.modelName] || 0) : 0;
                    // 어댑터가 등록돼 있지 않거나, 있어도 재고가 0이면 이 렌즈는 못 쓴다.
                    // 이미 장바구니에 담아둔 어댑터가 있으면 남은 재고가 0이어도 쓸 수 있다.
                    const block =
                      need && !ad ? `마운트 불일치 (${e.mount} → ${cam.mount}) · 어댑터 없음`
                      : ad && adInCart === 0 && (ad.available || 0) === 0 ? `${ad.modelName} 어댑터가 전부 대여중이에요`
                      : null;
                    if (block) return (
                      <div key={e.modelName} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", marginBottom:6, opacity:0.5 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{e.modelName}</div>
                          <div style={{ fontSize:11, color:C.red, marginTop:2 }}>{block}</div>
                        </div>
                      </div>
                    );
                    return <Row key={e.modelName} e={e} group="lens"
                      note={ad ? (adInCart > 0 ? "이미 담은 어댑터로 사용해요" : `${ad.modelName} 어댑터 자동 포함`) : undefined} />;
                  })}
                </div>
              )}
            </div>
          );
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

      {/* 어댑터가 이미 장바구니에 있을 때 — 바디를 여러 대 동시에 쓰면 하나 더 필요할 수 있다 */}
      {askAdapter && plan.adapter && (
        <Modal onClose={() => setAskAdapter(false)} width={340}>
          <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:10 }}>어댑터가 추가로 필요하신가요?</div>
          <div style={{ fontSize:13, color:C.muted, lineHeight:1.65, marginBottom:20 }}>
            {plan.adapter.modelName} 어댑터는 장바구니에 이미 {plan.inCart}개 있어요.<br />
            바디 여러 대에 동시에 물리실 거면 추가로 담아주세요.
            <div style={{ marginTop:8, fontSize:12, color:C.teal, fontWeight:700 }}>
              남은 수량 {plan.stock - plan.inCart}개
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn full outline color={C.muted} onClick={() => commitAdd(false)}>아니오</Btn>
            <Btn full color={C.teal} text="#fff" onClick={() => commitAdd(true)}>네, 추가</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
