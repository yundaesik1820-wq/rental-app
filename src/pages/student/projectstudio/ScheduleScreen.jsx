import { useState } from "react";
import {
  ArrowLeft, Plus, X, CalendarDays, ChevronDown, Pencil, Trash2, Clock, MapPin, Users, Wrench, Package, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, SCENE_STATUS, sceneStatus, newShootDay } from "./constants";

// ===== 촬영일 추가/수정 모달 (backdrop 닫기 없음) =====
function DayFormModal({ day, projectId, uid, onClose }) {
  const isEdit = !!day;
  const [date, setDate]   = useState(day?.date || "");
  const [title, setTitle] = useState(day?.title || "");
  const [call, setCall]   = useState(day?.callTime || "");
  const [wrap, setWrap]   = useState(day?.wrapTime || "");
  const [notes, setNotes] = useState(day?.notes || "");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!date) { setErr("촬영 날짜를 선택해주세요."); return; }
    if (call && wrap && wrap < call) { setErr("종료 시간이 시작 시간보다 빠를 수 없어요."); return; }
    setErr("");
    setBusy(true);
    const data = { date, title: title.trim(), callTime: call, wrapTime: wrap, notes: notes.trim() };
    try {
      if (isEdit) await updateItem("shootDays", day.id, data);
      else await addItem("shootDays", { ...newShootDay({ projectId, ownerId: uid, date }), ...data });
      onClose();
    } catch (e) {
      console.warn("shootDay save error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", minHeight: 42,
    background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
    color: PS.text, fontSize: 13.5, padding: "9px 12px", outline: "none",
    fontFamily: "inherit", colorScheme: "dark",
  };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" };

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
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "촬영일 수정" : "촬영일 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>촬영 날짜 <b style={{ color: PS.primaryLight }}>*</b></span>
              <input type="date" style={inputStyle} value={date} disabled={busy}
                onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>제목 (선택)</span>
              <input style={inputStyle} value={title} maxLength={40} disabled={busy}
                placeholder="예) 1회차 — 작업실" onChange={e => setTitle(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>집합 시간</span>
              <input type="time" style={inputStyle} value={call} disabled={busy}
                onChange={e => setCall(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>종료 시간</span>
              <input type="time" style={inputStyle} value={wrap} disabled={busy}
                onChange={e => setWrap(e.target.value)} />
            </div>
          </div>
          <div>
            <span style={labelStyle}>메모</span>
            <textarea value={notes} maxLength={500} disabled={busy} rows={2}
              placeholder="차량, 식사, 주의사항 등"
              onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
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
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "촬영일 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 장면 상태 변경 시트 (촬영 보드 카드 탭) =====
function StatusSheet({ scene, onClose }) {
  const [busy, setBusy] = useState(false);
  const change = async (status) => {
    if (busy) return;
    setBusy(true);
    try { await updateItem("scenes", scene.id, { status }); onClose(); }
    catch (e) { console.warn("scene status error:", e); alert("변경에 실패했어요."); setBusy(false); }
  };
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>S#{scene.sceneNumber} 상태 변경</div>
        <div style={{ fontSize: 12, color: PS.sub, marginBottom: 14, wordBreak: "keep-all" }}>
          {scene.heading || scene.locationName}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SCENE_STATUS.map(s => {
            const on = scene.status === s.value;
            return (
              <button key={s.value} onClick={() => change(s.value)} disabled={busy}
                style={{
                  display: "flex", alignItems: "center", gap: 9, minHeight: 48,
                  background: on ? `${s.color}1A` : PS.elev,
                  border: `1px solid ${on ? s.color : PS.border}`, borderRadius: 12,
                  color: on ? s.color : PS.text, fontSize: 13.5, fontWeight: 800,
                  padding: "0 14px", cursor: "pointer", fontFamily: "inherit",
                  opacity: busy ? 0.6 : 1,
                }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                {s.label} {on && "· 현재"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== 촬영 일정 화면 — 촬영 보드 + 촬영일 =====
export default function ScheduleScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canEdit = project.ownerId === uid; // 참여 팀원은 조회만

  const opts = (extra) => uid ? { where: [["projectId", "==", project.id]], ...extra } : { enabled: false };
  const { data: scenes }     = useCollection("scenes", null, opts());
  const { data: breakdowns } = useCollection("sceneBreakdowns", null, opts());
  const { data: days, loading: daysLoading } = useCollection("shootDays", null, opts());

  const [tab, setTab] = useState("board");        // "board" | "days"
  const [statusScene, setStatusScene] = useState(null);
  const [formDay, setFormDay] = useState(null);   // null | "new" | day 객체
  const [openDay, setOpenDay] = useState(null);   // 펼친 촬영일 id
  const [assignBusy, setAssignBusy] = useState(false);

  const sortedScenes = [...scenes].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const sortedDays = [...days].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const bdOf = (sceneId) => breakdowns.find(b => b.sceneId === sceneId);
  const dayOfScene = (sceneId) => sortedDays.find(d => (d.sceneIds || []).includes(sceneId));
  const fmtDate = (d) => d ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : "";

  // 장면 ↔ 촬영일 배치 토글
  const toggleScene = async (day, sceneId) => {
    if (assignBusy || !canEdit) return;
    setAssignBusy(true);
    const cur = day.sceneIds || [];
    const next = cur.includes(sceneId) ? cur.filter(id => id !== sceneId) : [...cur, sceneId];
    try { await updateItem("shootDays", day.id, { sceneIds: next }); }
    catch (e) { console.warn("assign error:", e); alert("저장에 실패했어요."); }
    setAssignBusy(false);
  };

  const removeDay = async (day) => {
    if (!window.confirm(`${day.date} 촬영일을 삭제할까요?\n(장면 자체는 삭제되지 않아요)`)) return;
    try { await deleteItem("shootDays", day.id); }
    catch (e) { console.warn("day delete error:", e); alert("삭제에 실패했어요."); }
  };

  // 촬영일 준비물 합산 (연결된 장면 + 브레이크다운 기준)
  const daySummary = (day) => {
    const assigned = sortedScenes.filter(s => (day.sceneIds || []).includes(s.id));
    const uniq = (arr) => [...new Set(arr)];
    const cast      = uniq(assigned.flatMap(s => bdOf(s.id)?.castNames || []));
    const equipment = uniq(assigned.flatMap(s => bdOf(s.id)?.equipmentNames || []));
    const props     = uniq(assigned.flatMap(s => bdOf(s.id)?.propNames || []));
    const locations = uniq(assigned.map(s => s.locationName).filter(Boolean));
    const totalMin  = assigned.reduce((sum, s) => sum + (bdOf(s.id)?.estimatedMinutes ?? s.estimatedMinutes ?? 0), 0);
    const notReady  = assigned.filter(s => s.status === "draft");
    return { assigned, cast, equipment, props, locations, totalMin, notReady };
  };

  const backBtnStyle = {
    background: "none", border: "none", color: PS.sub, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
    padding: "8px 4px", minHeight: 44, fontFamily: "inherit",
  };

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack} style={backBtnStyle}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ margin: "6px 0 14px", fontSize: 19, fontWeight: 900 }}>촬영 일정</div>

      {/* 탭 토글 */}
      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
        {[["board", "촬영 보드"], ["days", "촬영일"]].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{
              flex: 1, minHeight: 42, borderRadius: 11, cursor: "pointer",
              background: tab === v ? PS.primary : PS.surface,
              border: `1px solid ${tab === v ? PS.primary : PS.border}`,
              color: tab === v ? "#fff" : PS.sub, fontSize: 13, fontWeight: 800, fontFamily: "inherit",
            }}>{label}</button>
        ))}
      </div>

      {/* ===== 촬영 보드 (칸반 — 카드 탭으로 상태 변경) ===== */}
      {tab === "board" && (
        sortedScenes.length === 0 ? (
          <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
            padding: "38px 20px", textAlign: "center" }}>
            <CalendarDays size={28} color={PS.sub} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>장면이 없어요</div>
            <div style={{ fontSize: 12.5, color: PS.sub }}>시나리오에서 장면을 먼저 만들어주세요.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: PS.sub, marginBottom: 10 }}>
              {canEdit ? "카드를 탭하면 상태를 바꿀 수 있어요 · 옆으로 스크롤" : "옆으로 스크롤해서 전체 상태를 볼 수 있어요"}
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", WebkitOverflowScrolling: "touch",
              margin: "0 -14px", padding: "0 14px 6px" }}>
              {SCENE_STATUS.map(st => {
                const cols = sortedScenes.filter(s => (s.status || "draft") === st.value);
                return (
                  <div key={st.value} style={{ minWidth: 210, width: 210, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: st.color }}>{st.label}</span>
                      <span style={{ fontSize: 11.5, color: PS.sub, fontWeight: 700 }}>{cols.length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8,
                      background: PS.bg, border: `1px solid ${PS.border}`, borderRadius: 13,
                      padding: 8, minHeight: 90 }}>
                      {cols.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: PS.sub, opacity: 0.55, textAlign: "center", padding: "26px 0" }}>없음</div>
                      ) : cols.map(s => {
                        const bd = bdOf(s.id);
                        const day = dayOfScene(s.id);
                        const min = bd?.estimatedMinutes ?? s.estimatedMinutes;
                        return (
                          <div key={s.id} onClick={() => canEdit && setStatusScene(s)}
                            style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 11,
                              padding: "10px 11px", cursor: canEdit ? "pointer" : "default" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4, wordBreak: "keep-all" }}>
                              <span style={{ color: PS.primaryLight }}>S#{s.sceneNumber}</span> {s.heading || s.locationName || ""}
                            </div>
                            <div style={{ fontSize: 10.5, color: PS.sub, lineHeight: 1.5 }}>
                              {s.locationName && <>📍 {s.locationName}<br /></>}
                              {(bd?.castNames?.length > 0) && <>👤 {bd.castNames.length}명 </>}
                              {min != null && <>⏱ {min}분 </>}
                              {day && <>📅 {fmtDate(day.date)}</>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {/* ===== 촬영일 ===== */}
      {tab === "days" && (
        <>
          {canEdit && (
            <button onClick={() => setFormDay("new")}
              style={{
                display: "flex", alignItems: "center", gap: 5, minHeight: 42, marginBottom: 12,
                background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
                border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
                padding: "9px 13px", cursor: "pointer", fontFamily: "inherit",
              }}>
              <Plus size={15} /> 촬영일 추가
            </button>
          )}

          {daysLoading ? (
            <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
          ) : sortedDays.length === 0 ? (
            <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
              padding: "38px 20px", textAlign: "center" }}>
              <CalendarDays size={28} color={PS.sub} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>촬영일이 없어요</div>
              <div style={{ fontSize: 12.5, color: PS.sub }}>촬영일을 만들고 장면을 배치해보세요.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {sortedDays.map(day => {
                const open = openDay === day.id;
                const sum = daySummary(day);
                return (
                  <div key={day.id}
                    style={{ background: PS.surface, border: `1px solid ${open ? PS.primary + "55" : PS.border}`,
                      borderRadius: 15, overflow: "hidden" }}>
                    {/* 헤더 */}
                    <div onClick={() => setOpenDay(open ? null : day.id)}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 14px",
                        cursor: "pointer", minHeight: 52 }}>
                      <CalendarDays size={16} color={PS.primaryLight} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>
                          {day.date} {day.title && <span style={{ fontWeight: 600, color: PS.sub }}>· {day.title}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: PS.sub, marginTop: 2 }}>
                          {(day.callTime || day.wrapTime) && `${day.callTime || "?"} ~ ${day.wrapTime || "?"} · `}
                          장면 {sum.assigned.length}개
                          {sum.totalMin > 0 && ` · 약 ${Math.floor(sum.totalMin / 60)}시간 ${sum.totalMin % 60 > 0 ? `${sum.totalMin % 60}분` : ""}`}
                        </div>
                      </div>
                      {sum.notReady.length > 0 && <AlertTriangle size={15} color={PS.warning} style={{ flexShrink: 0 }} />}
                      <ChevronDown size={15} color={PS.sub}
                        style={{ flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
                    </div>

                    {/* 펼침 */}
                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${PS.border}` }}>
                        {/* 장면 배치 */}
                        <div style={{ fontSize: 12, fontWeight: 800, color: PS.primaryLight, margin: "12px 0 7px" }}>장면 배치</div>
                        {sortedScenes.length === 0 ? (
                          <div style={{ fontSize: 12, color: PS.sub }}>시나리오에 장면이 없어요.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {sortedScenes.map(s => {
                              const inDay = (day.sceneIds || []).includes(s.id);
                              const otherDay = !inDay && dayOfScene(s.id);
                              const st = sceneStatus(s.status);
                              return (
                                <button key={s.id} onClick={() => toggleScene(day, s.id)}
                                  disabled={assignBusy}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, minHeight: 42, textAlign: "left",
                                    background: inDay ? `${PS.primary}14` : PS.elev,
                                    border: `1px solid ${inDay ? PS.primary : PS.border}`, borderRadius: 10,
                                    color: PS.text, fontSize: 12.5, fontWeight: 700, padding: "8px 11px",
                                    cursor: "pointer", fontFamily: "inherit", opacity: assignBusy ? 0.6 : 1,
                                  }}>
                                  <span style={{
                                    width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                                    background: inDay ? PS.primary : "transparent",
                                    border: `1.5px solid ${inDay ? PS.primary : PS.sub}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "#fff", fontSize: 11, fontWeight: 900,
                                  }}>{inDay ? "✓" : ""}</span>
                                  <span style={{ color: PS.primaryLight, flexShrink: 0 }}>S#{s.sceneNumber}</span>
                                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {s.heading || s.locationName || "(제목 없음)"}
                                  </span>
                                  <span style={{ fontSize: 10, color: st.color, flexShrink: 0 }}>{st.label}</span>
                                  {otherDay && <span style={{ fontSize: 10, color: PS.sub, flexShrink: 0 }}>({fmtDate(otherDay.date)})</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* 자동 합산 */}
                        {sum.assigned.length > 0 && (
                          <div style={{ marginTop: 12, background: PS.elev, borderRadius: 11, padding: "11px 12px" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: PS.primaryLight, marginBottom: 7 }}>이 날 준비물 (자동 합산)</div>
                            {[
                              [Users, "배우", sum.cast],
                              [MapPin, "장소", sum.locations],
                              [Wrench, "장비", sum.equipment],
                              [Package, "소품", sum.props],
                            ].filter(([, , arr]) => arr.length > 0).map(([Ic, label, arr]) => (
                              <div key={label} style={{ display: "flex", gap: 7, fontSize: 12, color: PS.sub, marginTop: 4, lineHeight: 1.5 }}>
                                <Ic size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span><b style={{ color: PS.text }}>{label}</b> {arr.join(", ")}</span>
                              </div>
                            ))}
                            {sum.totalMin > 0 && (
                              <div style={{ display: "flex", gap: 7, fontSize: 12, color: PS.sub, marginTop: 4 }}>
                                <Clock size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span><b style={{ color: PS.text }}>예상 촬영</b> {Math.floor(sum.totalMin / 60)}시간 {sum.totalMin % 60 > 0 ? `${sum.totalMin % 60}분` : ""}</span>
                              </div>
                            )}
                            {sum.notReady.length > 0 && (
                              <div style={{ display: "flex", gap: 7, fontSize: 12, color: PS.warning, marginTop: 6 }}>
                                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>준비 안 된 장면(미정): {sum.notReady.map(s => `S#${s.sceneNumber}`).join(", ")}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {day.notes && (
                          <div style={{ fontSize: 12, color: PS.sub, marginTop: 10, whiteSpace: "pre-wrap" }}>📝 {day.notes}</div>
                        )}

                        {/* 액션 */}
                        {canEdit && (
                        <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
                          <button onClick={() => setFormDay(day)}
                            style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 38,
                              background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                              color: PS.text, fontSize: 12, fontWeight: 700, padding: "8px 12px",
                              cursor: "pointer", fontFamily: "inherit" }}>
                            <Pencil size={13} /> 수정
                          </button>
                          <button onClick={() => removeDay(day)}
                            style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 38,
                              background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 10,
                              color: PS.danger, fontSize: 12, fontWeight: 700, padding: "8px 12px",
                              cursor: "pointer", fontFamily: "inherit" }}>
                            <Trash2 size={13} /> 삭제
                          </button>
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 모달들 */}
      {statusScene && <StatusSheet scene={statusScene} onClose={() => setStatusScene(null)} />}
      {formDay && (
        <DayFormModal day={formDay === "new" ? null : formDay}
          projectId={project.id} uid={uid} onClose={() => setFormDay(null)} />
      )}
    </div>
  );
}
