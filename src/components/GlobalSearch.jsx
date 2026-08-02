import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, Store, Megaphone, Users, ClipboardList } from "lucide-react";
import { C } from "../theme";
import { useCollection } from "../hooks/useFirestore";

// 상단 헤더 통합 검색 (역할별 멀티 섹션)
//  - 학생: 장비 · 공지
//  - 관리자: 학생 · 장비 · 대여내역
// ⚠️ 이 컴포넌트는 검색이 열릴 때만 마운트됨 → useCollection 리스너도 그때만 붙고 닫으면 해제.
//    관리자 전용 컬렉션(users/rentalRequests)은 enabled:isAdmin 로 학생 땐 구독 안 함.
const CAP = 6; // 섹션당 최대 노출 (초과분은 "+N개 더")
const statusColor = (s) =>
  (s === "연체" || s === "거절됨") ? C.red
  : s === "반납완료" ? C.muted
  : C.teal;

export default function GlobalSearch({ isAdmin, onClose, onNavigate }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: notices }    = useCollection("notices",    "createdAt");
  const { data: users }      = useCollection("users",          "createdAt", { enabled: isAdmin });
  const { data: rentals }    = useCollection("rentalRequests", "createdAt", { enabled: isAdmin });

  const term = q.trim().toLowerCase();
  const hit = (...vals) => vals.some(v => String(v ?? "").toLowerCase().includes(term));

  const results = useMemo(() => {
    if (!term) return null;

    const equip = equipments.filter(e => hit(e.modelName, e.itemName, e.name, e.manufacturer));
    const notice = notices.filter(n => hit(n.title, n.content));

    const student = isAdmin
      ? users.filter(u => u.role === "student" && hit(u.name, u.studentId, u.dept))
      : [];
    const rental = isAdmin
      ? rentals.filter(r => hit(
          r.studentName, r.studentId, r.dept,
          ...(r.items || []).map(i => i.equipName || i.modelName)
        ))
      : [];

    return { equip, notice, student, rental };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, equipments, notices, users, rentals, isAdmin]);

  const go = (target) => { onNavigate(target); };

  // 섹션 렌더 헬퍼
  const Section = ({ icon: Icon, label, items, render }) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px 8px", color: C.muted, fontSize: 12, fontWeight: 800, letterSpacing: "-0.01em" }}>
          <Icon size={13} strokeWidth={2.4} />
          {label}
          <span style={{ color: C.muted, opacity: 0.7 }}>{items.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.slice(0, CAP).map(render)}
          {items.length > CAP && (
            <div style={{ padding: "6px 14px", fontSize: 11.5, color: C.muted }}>
              +{items.length - CAP}개 더 있음 — 검색어를 좁혀 보세요
            </div>
          )}
        </div>
      </div>
    );
  };

  const rowStyle = {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: "11px 14px", cursor: "pointer", textAlign: "left", color: C.text,
  };

  const total = results
    ? results.equip.length + results.notice.length + results.student.length + results.rental.length
    : 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9500, background: C.bg, display: "flex", flexDirection: "column" }}>
      {/* 검색 입력 바 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <Search size={18} color={C.muted} strokeWidth={2.2} />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={isAdmin ? "학생, 장비, 대여내역 검색" : "장비, 공지 검색"}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: C.text, fontSize: 16, fontWeight: 600, minWidth: 0,
          }}
        />
        {q && (
          <button onClick={() => { setQ(""); inputRef.current?.focus(); }} className="tap-spring"
            style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", color: C.muted }}>
            <X size={17} strokeWidth={2.4} />
          </button>
        )}
        <button onClick={onClose} className="tap-spring"
          style={{ background: "none", border: "none", padding: "4px 2px 4px 6px", cursor: "pointer", color: C.muted, fontSize: 13, fontWeight: 700 }}>
          닫기
        </button>
      </div>

      {/* 결과 */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0 }}>
        {!term && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "48px 24px", lineHeight: 1.7 }}>
            <Search size={34} color={C.muted} strokeWidth={1.8} style={{ marginBottom: 12, opacity: 0.6 }} />
            <div>{isAdmin ? "학생 · 장비 · 대여내역" : "장비 · 공지"}을(를)<br />한 번에 검색해요</div>
          </div>
        )}

        {term && total === 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "48px 24px" }}>
            "<span style={{ color: C.text, fontWeight: 700 }}>{q.trim()}</span>" 검색 결과가 없어요
          </div>
        )}

        {term && total > 0 && (
          <>
            {/* 학생 (관리자) */}
            <Section icon={Users} label="학생" items={results.student} render={u => (
              <button key={u.id} className="tap-spring" style={rowStyle}
                onClick={() => go({ tab: "students", userId: u.id })}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{u.name || "이름없음"}</span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>
                  {[u.dept, u.studentId].filter(Boolean).join(" · ")}
                </span>
              </button>
            )} />

            {/* 장비 (공통) */}
            <Section icon={Store} label="장비" items={results.equip} render={e => (
              <button key={e.id} className="tap-spring" style={rowStyle}
                onClick={() => go({ tab: "equip", equipSearch: e.modelName || e.itemName || e.name || "", equipCat: e.majorCategory })}>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.modelName || e.itemName || e.name || "이름없음"}
                </span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto", flexShrink: 0 }}>
                  {[e.manufacturer, e.majorCategory].filter(Boolean).join(" · ")}
                </span>
              </button>
            )} />

            {/* 대여내역 (관리자) */}
            <Section icon={ClipboardList} label="대여내역" items={results.rental} render={r => {
              const first = (r.items || [])[0];
              const firstName = first?.equipName || first?.modelName || "";
              const more = (r.items || []).length > 1 ? ` 외 ${(r.items).length - 1}` : "";
              return (
                <button key={r.id} className="tap-spring" style={rowStyle}
                  onClick={() => go({ tab: "rental", rentalId: r.id })}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{r.studentName || "이름없음"}</span>
                    <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {firstName}{more}
                    </span>
                  </span>
                  {r.status && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: statusColor(r.status), marginLeft: "auto", flexShrink: 0 }}>{r.status}</span>
                  )}
                </button>
              );
            }} />

            {/* 공지 (공통) */}
            <Section icon={Megaphone} label="공지" items={results.notice} render={n => (
              <button key={n.id} className="tap-spring" style={rowStyle}
                onClick={() => go({ tab: "notices", noticeId: n.id })}>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.title || "제목없음"}
                  </span>
                  {n.content && (
                    <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.content}
                    </span>
                  )}
                </span>
                {n.category && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginLeft: "auto", flexShrink: 0 }}>{n.category}</span>
                )}
              </button>
            )} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
