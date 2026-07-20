import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowLeft, Plus, X, Wrench, Search, ShoppingCart, Trash2, Import, Minus,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCart } from "../../../hooks/useCart.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, newProjectEquipment, equipResStatus } from "./constants";
import { createEquipmentReservationAdapter } from "./adapters";

// ===== 프로젝트 장비 화면 (요청서 11번) =====
// 학교 장비 연동은 반드시 adapter를 통해서만 접근한다.
export default function EquipmentScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const { setQty, cartCount } = useCart();

  const opts = () => uid ? { where: [["projectId", "==", project.id], ["ownerId", "==", uid]] } : { enabled: false };
  const { data: items, loading } = useCollection("projectEquipments", null, opts());
  const { data: breakdowns } = useCollection("sceneBreakdowns", null, opts());
  const { data: scenes }     = useCollection("scenes", null, opts());
  const { data: equipments } = useCollection("equipments", "createdAt"); // 학교 장비 (검색용)

  const adapter = useMemo(
    () => createEquipmentReservationAdapter({ equipments, setQty }),
    [equipments, setQty]
  );

  const [showImport, setShowImport] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState(null); // null=검색 전
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const sorted = [...items].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const nameOf = (it) => it.equipmentModel || it.customName || "(이름 없음)";
  const sceneNo = (id) => scenes.find(s => s.id === id)?.sceneNumber;

  // 직접 추가
  const addCustom = async () => {
    const name = customName.trim();
    if (!name || busy) return;
    if (items.some(it => nameOf(it) === name)) { showToast("이미 목록에 있어요."); return; }
    setBusy(true);
    try {
      await addItem("projectEquipments", newProjectEquipment({ projectId: project.id, ownerId: uid, customName: name }));
      setCustomName("");
    } catch (e) { console.warn("equip add error:", e); alert("추가에 실패했어요."); }
    setBusy(false);
  };

  // 장면(브레이크다운)에서 가져오기 — 장비명별 출처 장면 수집
  const fromScenes = useMemo(() => {
    const map = {};
    for (const bd of breakdowns) {
      for (const name of bd.equipmentNames || []) {
        if (!map[name]) map[name] = new Set();
        map[name].add(bd.sceneId);
      }
    }
    return Object.entries(map).map(([name, ids]) => ({ name, sceneIds: [...ids] }));
  }, [breakdowns]);

  const importOne = async (entry) => {
    if (busy) return;
    setBusy(true);
    try {
      const exist = items.find(it => nameOf(it) === entry.name);
      if (exist) {
        await updateItem("projectEquipments", exist.id, {
          sceneIds: [...new Set([...(exist.sceneIds || []), ...entry.sceneIds])],
        });
      } else {
        await addItem("projectEquipments", {
          ...newProjectEquipment({ projectId: project.id, ownerId: uid, customName: entry.name }),
          sceneIds: entry.sceneIds,
        });
      }
      showToast(`"${entry.name}" 추가됨`);
    } catch (e) { console.warn("import error:", e); alert("가져오기에 실패했어요."); }
    setBusy(false);
  };

  // 학교 장비 검색 (adapter 경유)
  const runSearch = async () => {
    setSearching(true);
    try { setResults(await adapter.searchAvailableEquipment({ keyword })); }
    catch (e) { console.warn("search error:", e); alert("검색에 실패했어요."); }
    setSearching(false);
  };

  const addSchool = async (r) => {
    if (busy) return;
    if (items.some(it => it.equipmentModel === r.modelName)) { showToast("이미 목록에 있어요."); return; }
    setBusy(true);
    try {
      await addItem("projectEquipments", {
        ...newProjectEquipment({ projectId: project.id, ownerId: uid, equipmentModel: r.modelName }),
        reservationStatus: r.available > 0 ? "not_requested" : "unavailable",
      });
      showToast(`"${r.modelName}" 추가됨`);
    } catch (e) { console.warn("school add error:", e); alert("추가에 실패했어요."); }
    setBusy(false);
  };

  // 수량 변경
  const changeQty = async (it, delta) => {
    const q = Math.max(1, (it.quantity || 1) + delta);
    if (q === it.quantity) return;
    try { await updateItem("projectEquipments", it.id, { quantity: q }); }
    catch (e) { console.warn("qty error:", e); }
  };

  // 장바구니 담기 (adapter 경유 — 실제 대여 장바구니)
  const addToCart = async (it) => {
    if (busy || !it.equipmentModel) return;
    setBusy(true);
    try {
      const found = (await adapter.searchAvailableEquipment({ keyword: it.equipmentModel }))
        .find(r => r.modelName === it.equipmentModel);
      const avail = found?.available ?? 0;
      if (avail <= 0) {
        await updateItem("projectEquipments", it.id, { reservationStatus: "unavailable" });
        showToast("지금은 대여 가능한 수량이 없어요.");
      } else {
        const qty = Math.min(it.quantity || 1, avail);
        await adapter.addToReservationCart([{ modelName: it.equipmentModel, quantity: qty, max: avail }]);
        await updateItem("projectEquipments", it.id, { reservationStatus: "added_to_cart" });
        showToast(`장바구니에 담았어요 (${qty}개) — 장비 탭에서 신청을 마무리해줘요!`);
      }
    } catch (e) { console.warn("cart error:", e); alert("담기에 실패했어요."); }
    setBusy(false);
  };

  const removeItem = async (it) => {
    if (!window.confirm(`"${nameOf(it)}" 을(를) 목록에서 삭제할까요?`)) return;
    try { await deleteItem("projectEquipments", it.id); }
    catch (e) { console.warn("equip delete error:", e); alert("삭제에 실패했어요."); }
  };

  const actionBtn = {
    display: "flex", alignItems: "center", gap: 5, minHeight: 40,
    background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 11,
    color: PS.text, fontSize: 12.5, fontWeight: 700, padding: "9px 12px",
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  };
  const sheetStyle = {
    position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center",
  };
  const sheetInner = {
    width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
    background: PS.surface, borderRadius: "20px 20px 0 0",
    border: `1px solid ${PS.border}`, borderBottom: "none",
    padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack}
        style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit" }}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ margin: "6px 0 14px" }}>
        <div style={{ fontSize: 19, fontWeight: 900 }}>장비</div>
        <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
          {items.length}개 항목{cartCount > 0 && ` · 장바구니 ${cartCount}개`}
        </div>
      </div>

      {/* 직접 추가 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={customName} maxLength={40} disabled={busy}
          placeholder="장비 직접 추가 (예: 반사판)"
          onChange={e => setCustomName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addCustom(); }}
          style={{ flex: 1, minWidth: 0, minHeight: 44, boxSizing: "border-box",
            background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 11,
            color: PS.text, fontSize: 13.5, padding: "10px 13px", outline: "none", fontFamily: "inherit" }} />
        <button onClick={addCustom} disabled={busy || !customName.trim()}
          style={{ width: 44, minHeight: 44, flexShrink: 0, borderRadius: 11, cursor: "pointer",
            background: customName.trim() ? PS.primary : PS.surface,
            border: `1px solid ${customName.trim() ? PS.primary : PS.border}`,
            color: customName.trim() ? "#fff" : PS.sub,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={19} />
        </button>
      </div>

      {/* 액션 바 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setShowImport(true)} style={actionBtn}>
          <Import size={15} /> 장면에서 가져오기
        </button>
        <button onClick={() => { setShowSearch(true); setResults(null); setKeyword(""); }} style={actionBtn}>
          <Search size={15} /> 학교 장비 검색
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <Wrench size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 장비가 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>직접 추가하거나 장면 브레이크다운에서 가져와보세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(it => {
            const st = equipResStatus(it.reservationStatus);
            const linked = !!it.equipmentModel;
            return (
              <div key={it.id}
                style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 14,
                  padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, wordBreak: "keep-all" }}>{nameOf(it)}</div>
                    <div style={{ fontSize: 10.5, color: PS.sub, marginTop: 2 }}>
                      {linked ? "학교 장비" : "직접 입력"}
                      {(it.sceneIds || []).length > 0 &&
                        ` · ${it.sceneIds.map(id => sceneNo(id)).filter(Boolean).map(n => `S#${n}`).join(", ")}`}
                    </div>
                  </div>
                  {/* 수량 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => changeQty(it, -1)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: PS.elev,
                        border: `1px solid ${PS.border}`, color: PS.sub, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Minus size={13} />
                    </button>
                    <span style={{ minWidth: 26, textAlign: "center", fontSize: 13, fontWeight: 800 }}>{it.quantity || 1}</span>
                    <button onClick={() => changeQty(it, 1)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: PS.elev,
                        border: `1px solid ${PS.border}`, color: PS.sub, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={13} />
                    </button>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, flexShrink: 0,
                    background: `${st.color}1A`, border: `1px solid ${st.color}44`,
                    padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                  {linked && (
                    <button onClick={() => addToCart(it)} disabled={busy}
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                        background: `${PS.primary}1A`, border: `1px solid ${PS.primary}55`, borderRadius: 10,
                        color: PS.primaryLight, fontSize: 11.5, fontWeight: 800, padding: "7px 11px",
                        cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
                      <ShoppingCart size={13} /> 예약 장바구니 담기
                    </button>
                  )}
                  <button onClick={() => removeItem(it)}
                    style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                      background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 10,
                      color: PS.danger, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                      cursor: "pointer", fontFamily: "inherit" }}>
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)",
          background: "rgba(23,26,35,0.97)", border: `1px solid ${PS.border}`,
          color: PS.text, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
          padding: "10px 16px", borderRadius: 999, zIndex: 300, maxWidth: "92vw",
          overflow: "hidden", textOverflow: "ellipsis",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{toast}</div>
      )}

      {/* 장면에서 가져오기 시트 */}
      {showImport && (
        <div onClick={() => setShowImport(false)} style={sheetStyle}>
          <div onClick={e => e.stopPropagation()} style={sheetInner}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>장면에서 가져오기</span>
              <button onClick={() => setShowImport(false)}
                style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
                <X size={19} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: PS.sub, marginBottom: 14 }}>
              브레이크다운에 적어둔 장비를 프로젝트 장비 목록으로 가져와요
            </div>
            {fromScenes.length === 0 ? (
              <div style={{ fontSize: 12.5, color: PS.sub, textAlign: "center", padding: "20px 0" }}>
                브레이크다운에 장비가 없어요.<br />시나리오에서 AI 분석 또는 브레이크다운을 먼저 작성해주세요.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {fromScenes.map(entry => {
                  const added = items.some(it => nameOf(it) === entry.name);
                  return (
                    <button key={entry.name} onClick={() => !added && importOne(entry)} disabled={busy || added}
                      style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 46, textAlign: "left",
                        background: added ? PS.bg : PS.elev,
                        border: `1px solid ${PS.border}`, borderRadius: 11,
                        color: added ? PS.sub : PS.text, fontSize: 13, fontWeight: 700, padding: "9px 12px",
                        cursor: added ? "default" : "pointer", fontFamily: "inherit",
                        opacity: busy ? 0.6 : 1 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{entry.name}</span>
                      <span style={{ fontSize: 10.5, color: PS.sub, flexShrink: 0 }}>
                        {entry.sceneIds.map(id => sceneNo(id)).filter(Boolean).map(n => `S#${n}`).join(", ")}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0,
                        color: added ? PS.success : PS.primaryLight }}>
                        {added ? "추가됨 ✓" : "+ 추가"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 학교 장비 검색 시트 */}
      {showSearch && (
        <div onClick={() => setShowSearch(false)} style={sheetStyle}>
          <div onClick={e => e.stopPropagation()} style={sheetInner}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>학교 장비 검색</span>
              <button onClick={() => setShowSearch(false)}
                style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
                <X size={19} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={keyword} maxLength={30} autoFocus
                placeholder="모델명·카테고리 검색 (예: FX3, 조명)"
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") runSearch(); }}
                style={{ flex: 1, minWidth: 0, minHeight: 44, boxSizing: "border-box",
                  background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 11,
                  color: PS.text, fontSize: 13.5, padding: "10px 13px", outline: "none", fontFamily: "inherit" }} />
              <button onClick={runSearch} disabled={searching}
                style={{ minHeight: 44, borderRadius: 11, cursor: "pointer", flexShrink: 0,
                  background: PS.primary, border: "none", color: "#fff",
                  fontSize: 13, fontWeight: 800, padding: "0 16px", fontFamily: "inherit",
                  opacity: searching ? 0.6 : 1 }}>
                {searching ? "검색 중" : "검색"}
              </button>
            </div>
            {results === null ? (
              <div style={{ fontSize: 12.5, color: PS.sub, textAlign: "center", padding: "18px 0" }}>
                검색어 없이 검색하면 전체 장비가 나와요.
              </div>
            ) : results.length === 0 ? (
              <div style={{ fontSize: 12.5, color: PS.sub, textAlign: "center", padding: "18px 0" }}>
                검색 결과가 없어요.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {results.map(r => {
                  const added = items.some(it => it.equipmentModel === r.modelName);
                  return (
                    <button key={r.modelName} onClick={() => !added && addSchool(r)} disabled={busy || added}
                      style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 50, textAlign: "left",
                        background: added ? PS.bg : PS.elev,
                        border: `1px solid ${PS.border}`, borderRadius: 11,
                        color: added ? PS.sub : PS.text, padding: "9px 12px",
                        cursor: added ? "default" : "pointer", fontFamily: "inherit",
                        opacity: busy ? 0.6 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, wordBreak: "keep-all" }}>{r.modelName}</div>
                        <div style={{ fontSize: 10.5, color: PS.sub, marginTop: 2 }}>
                          {r.majorCategory}{r.licenseLevel > 0 && ` · LV${r.licenseLevel}`}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0,
                        color: r.available > 0 ? PS.success : PS.danger }}>
                        {r.available}/{r.total} 대여가능
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0,
                        color: added ? PS.success : PS.primaryLight }}>
                        {added ? "✓" : "+ 추가"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
