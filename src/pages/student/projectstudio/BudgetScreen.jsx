import { useState } from "react";
import { ArrowLeft, Plus, X, Wallet, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, BUDGET_CATEGORIES, newBudgetItem, fmtWon } from "./constants";

// ===== 예산 항목 추가/수정 모달 (backdrop 닫기 없음) =====
function BudgetFormModal({ item, projectId, uid, onClose }) {
  const isEdit = !!item;
  const [category, setCategory] = useState(item?.category || null);
  const [title, setTitle]     = useState(item?.title || "");
  const [planned, setPlanned] = useState(item?.plannedAmount ?? "");
  const [actual, setActual]   = useState(item?.actualAmount ?? "");
  const [status, setStatus]   = useState(item?.status || "planned");
  const [notes, setNotes]     = useState(item?.notes || "");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!category) { setErr("카테고리를 선택해주세요."); return; }
    if (!title.trim()) { setErr("항목 이름을 입력해주세요."); return; }
    if (planned === "" || isNaN(Number(planned)) || Number(planned) < 0) { setErr("예정 금액을 0 이상의 숫자로 입력해주세요."); return; }
    if (actual !== "" && (isNaN(Number(actual)) || Number(actual) < 0)) { setErr("실제 금액은 0 이상의 숫자로 입력해주세요."); return; }
    setErr("");
    setBusy(true);
    const data = {
      category, title: title.trim(),
      plannedAmount: Number(planned),
      actualAmount: actual === "" ? null : Number(actual),
      status, notes: notes.trim(),
    };
    try {
      if (isEdit) await updateItem("budgetItems", item.id, data);
      else await addItem("budgetItems", { ...newBudgetItem({ projectId, ownerId: uid, category }), ...data });
      onClose();
    } catch (e) {
      console.warn("budget save error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", minHeight: 42,
    background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
    color: PS.text, fontSize: 13.5, padding: "9px 12px", outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" };
  const chip = (on) => ({
    padding: "7px 11px", minHeight: 34, borderRadius: 999, cursor: "pointer",
    background: on ? PS.primary : PS.elev, border: `1px solid ${on ? PS.primary : PS.border}`,
    color: on ? "#fff" : PS.sub, fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "예산 항목 수정" : "예산 항목 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>카테고리 <b style={{ color: PS.primaryLight }}>*</b></span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {BUDGET_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} disabled={busy} style={chip(category === c)}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <span style={labelStyle}>항목 이름 <b style={{ color: PS.primaryLight }}>*</b></span>
            <input style={inputStyle} value={title} maxLength={40} disabled={busy}
              placeholder="예) 로케이션 대관비" onChange={e => setTitle(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>예정 금액(원) <b style={{ color: PS.primaryLight }}>*</b></span>
              <input type="number" min={0} step={1000} style={inputStyle} value={planned} disabled={busy}
                placeholder="예) 50000" onChange={e => setPlanned(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>실제 지출(원)</span>
              <input type="number" min={0} step={1000} style={inputStyle} value={actual} disabled={busy}
                placeholder="지출 후 입력" onChange={e => setActual(e.target.value)} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>상태</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[["planned", "예정"], ["paid", "지출 완료"]].map(([v, label]) => (
                <button key={v} onClick={() => setStatus(v)} disabled={busy}
                  style={{ ...chip(status === v), flex: 1 }}>{label}</button>
              ))}
            </div>
          </div>

          <div>
            <span style={labelStyle}>메모</span>
            <input style={inputStyle} value={notes} maxLength={100} disabled={busy}
              onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {err && (
          <div style={{ background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14 }}>{err}</div>
        )}

        <button onClick={save} disabled={busy}
          style={{ width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", marginTop: 18,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
            opacity: busy ? 0.7 : 1 }}>
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "항목 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 예산 화면 (요청서 13번 — KRW) =====
export default function BudgetScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const { data: budgetItems, loading } = useCollection(
    "budgetItems", null,
    uid ? { where: [["projectId", "==", project.id], ["ownerId", "==", uid]] } : { enabled: false }
  );

  const [formItem, setFormItem] = useState(null);   // null | "new" | item
  const [editLimit, setEditLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [busy, setBusy] = useState(false);

  const plannedSum = budgetItems.reduce((s, b) => s + (b.plannedAmount || 0), 0);
  const actualSum  = budgetItems.reduce((s, b) => s + (b.actualAmount || 0), 0);
  // 집행 기준 합계: 실제 지출이 있으면 실제, 없으면 예정 금액
  const commitSum  = budgetItems.reduce((s, b) => s + (b.actualAmount ?? b.plannedAmount ?? 0), 0);
  const limit = project.budgetLimit;
  const remaining = limit != null ? limit - commitSum : null;

  const saveLimit = async () => {
    const v = limitInput.trim();
    if (v !== "" && (isNaN(Number(v)) || Number(v) < 0)) { alert("0 이상의 숫자로 입력해주세요."); return; }
    setBusy(true);
    try {
      await updateItem("projects", project.id, { budgetLimit: v === "" ? null : Number(v) });
      setEditLimit(false);
    } catch (e) { console.warn("limit save error:", e); alert("저장에 실패했어요."); }
    setBusy(false);
  };

  const removeItem = async (b) => {
    if (!window.confirm(`"${b.title}" 항목을 삭제할까요?`)) return;
    try { await deleteItem("budgetItems", b.id); }
    catch (e) { console.warn("budget delete error:", e); alert("삭제에 실패했어요."); }
  };

  // 카테고리별 소계 (등록된 카테고리만)
  const byCategory = BUDGET_CATEGORIES
    .map(c => {
      const list = budgetItems
        .filter(b => b.category === c)
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      return {
        category: c, list,
        planned: list.reduce((s, b) => s + (b.plannedAmount || 0), 0),
        actual:  list.reduce((s, b) => s + (b.actualAmount || 0), 0),
      };
    })
    .filter(g => g.list.length > 0);

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack}
        style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit" }}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "6px 0 14px" }}>
        <div style={{ fontSize: 19, fontWeight: 900 }}>예산</div>
        <button onClick={() => setFormItem("new")}
          style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 42, flexShrink: 0,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
            padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          <Plus size={15} /> 항목 추가
        </button>
      </div>

      {/* 요약 카드 */}
      <div style={{
        background: `linear-gradient(150deg, ${PS.primary}22 0%, ${PS.surface} 55%)`,
        border: `1px solid ${PS.primary}33`, borderRadius: 16, padding: 16, marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: PS.sub, fontWeight: 700 }}>총 예산</span>
          {editLimit ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" min={0} step={10000} value={limitInput} disabled={busy} autoFocus
                onChange={e => setLimitInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveLimit(); }}
                style={{ width: 120, minHeight: 36, boxSizing: "border-box",
                  background: PS.elev, border: `1px solid ${PS.primary}`, borderRadius: 9,
                  color: PS.text, fontSize: 13, padding: "6px 10px", outline: "none", fontFamily: "inherit" }} />
              <button onClick={saveLimit} disabled={busy}
                style={{ minHeight: 36, borderRadius: 9, background: PS.primary, border: "none",
                  color: "#fff", fontSize: 12, fontWeight: 800, padding: "0 12px",
                  cursor: "pointer", fontFamily: "inherit" }}>저장</button>
            </div>
          ) : (
            <button onClick={() => { setLimitInput(limit ?? ""); setEditLimit(true); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
                color: PS.text, fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
              {limit != null ? fmtWon(limit) : "설정하기"} <Pencil size={12} color={PS.sub} />
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            ["예정 지출", fmtWon(plannedSum), PS.text],
            ["실제 지출", fmtWon(actualSum), PS.warning],
            ["남은 예산", remaining != null ? fmtWon(remaining) : "-", remaining != null && remaining < 0 ? PS.danger : PS.success],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 11, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: PS.sub, fontWeight: 700, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color, wordBreak: "keep-all" }}>{val}</div>
            </div>
          ))}
        </div>
        {remaining != null && remaining < 0 && (
          <div style={{ fontSize: 11.5, color: PS.danger, fontWeight: 700, marginTop: 8 }}>
            ⚠️ 예산을 {fmtWon(Math.abs(remaining))} 초과했어요
          </div>
        )}
      </div>

      {/* 카테고리별 목록 */}
      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : byCategory.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <Wallet size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 예산 항목이 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>장비 대여, 로케이션, 식비 등을 미리 계획해보세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {byCategory.map(g => (
            <div key={g.category}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 2px", marginBottom: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: PS.primaryLight }}>{g.category}</span>
                <span style={{ fontSize: 11.5, color: PS.sub, fontWeight: 700 }}>
                  예정 {fmtWon(g.planned)}{g.actual > 0 && ` · 실제 ${fmtWon(g.actual)}`}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {g.list.map(b => (
                  <div key={b.id}
                    style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 13,
                      padding: "11px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, wordBreak: "keep-all" }}>{b.title}</div>
                        {b.notes && <div style={{ fontSize: 11, color: PS.sub, marginTop: 2 }}>{b.notes}</div>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{fmtWon(b.plannedAmount)}</div>
                        {b.actualAmount != null && (
                          <div style={{ fontSize: 11, color: PS.warning, fontWeight: 700 }}>실제 {fmtWon(b.actualAmount)}</div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, flexShrink: 0,
                        color: b.status === "paid" ? PS.success : PS.sub,
                        background: b.status === "paid" ? `${PS.success}1A` : PS.elev,
                        border: `1px solid ${b.status === "paid" ? PS.success + "44" : PS.border}`,
                        padding: "3px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        {b.status === "paid" ? "지출" : "예정"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                      <button onClick={() => setFormItem(b)}
                        style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 32,
                          background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 9,
                          color: PS.text, fontSize: 11, fontWeight: 700, padding: "5px 10px",
                          cursor: "pointer", fontFamily: "inherit" }}>
                        <Pencil size={11} /> 수정
                      </button>
                      <button onClick={() => removeItem(b)}
                        style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 32,
                          background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 9,
                          color: PS.danger, fontSize: 11, fontWeight: 700, padding: "5px 10px",
                          cursor: "pointer", fontFamily: "inherit" }}>
                        <Trash2 size={11} /> 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {formItem && (
        <BudgetFormModal item={formItem === "new" ? null : formItem}
          projectId={project.id} uid={uid} onClose={() => setFormItem(null)} />
      )}
    </div>
  );
}
