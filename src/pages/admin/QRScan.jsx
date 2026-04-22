import { useState, useEffect, useRef } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, PageTitle, Modal } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";
import { groupEquipments } from "../../utils/groupEquipments";

// ── 확인 모달 ─────────────────────────────────────────────
function ConfirmModal({ request, actionType, modelName, onConfirm, onClose }) {
  const isOut = actionType === "출고";
  return (
    <Modal onClose={onClose} width={420}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{isOut ? "📤" : "📥"}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{isOut ? "출고 처리" : "반납 처리"}</div>
      </div>
      <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
        {[
          ["장비",     modelName],
          ["대여자",   request.studentName],
          ["학번",     request.studentId],
          ["계열",     request.dept],
          ["기간",     `${request.startDate} ${request.startTime || ""} ~ ${request.endDate} ${request.endTime || ""}`],
          ["목적",     request.purpose],
        ].map(([k, v]) => v && (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.muted }}>{k}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={onClose} color={C.muted} outline full>취소</Btn>
        <Btn onClick={onConfirm} color={isOut ? C.green : C.teal} full>
          {isOut ? "✅ 출고 확인" : "✅ 반납 확인"}
        </Btn>
      </div>
    </Modal>
  );
}

// ── 메인 ──────────────────────────────────────────────────
export default function QRScan() {
  const { data: equipments } = useCollection("equipments",    "createdAt");
  const { data: requests }   = useCollection("rentalRequests","createdAt");
  const { data: equipments } = useCollection("equipments","createdAt");

  const inputRef = useRef(null);
  const [qrInput, setQrInput]   = useState("");
  const [result, setResult]     = useState(null);   // { modelName, related, renting }
  const [confirm, setConfirm]   = useState(null);   // { request, actionType }
  const [toast, setToast]       = useState(null);   // { msg, ok }
  const [history, setHistory]   = useState([]);

  const grouped = groupEquipments(equipments);

  // 페이지 진입 시 자동 포커스
  useEffect(() => { inputRef.current?.focus(); }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // QR 입력 파싱
  const parseQR = (text) => {
    const t = text.trim();

    // 1) 물품번호로 직접 검색 (가장 우선)
    const byItemNo = equipments.find(e => e.itemNo && e.itemNo.trim() === t);
    if (byItemNo) return byItemNo.modelName;

    // 2) Firestore 문서 ID로 검색
    const byId = equipments.find(e => e.id === t);
    if (byId) return byId.modelName;

    // 3) "EQUIP-xxxx:모델명" 형식 파싱
    const match = t.match(/EQUIP[-_]?([\w-]+)[:\s](.+)/i);
    if (match) {
      const idPart   = match[1];
      const namePart = match[2].trim();
      const byMatchId = equipments.find(e => e.id === idPart || (e.itemNo && e.itemNo.trim() === idPart));
      if (byMatchId) return byMatchId.modelName;
      const byMatchName = grouped.find(g => g.modelName === namePart);
      if (byMatchName) return byMatchName.modelName;
    }

    // 4) 모델명 직접 일치
    const byModel = grouped.find(g => g.modelName.trim() === t);
    if (byModel) return byModel.modelName;

    // 5) 부분 일치
    const byPartial = grouped.find(g => t.includes(g.modelName) || g.modelName.includes(t));
    if (byPartial) return byPartial.modelName;

    return null;
  };

  const handleScan = (raw) => {
    const modelName = parseQR(raw);
    if (!modelName) {
      showToast("⚠️ 등록된 장비를 찾을 수 없습니다", false);
      return;
    }
    const related = requests.filter(r =>
      r.status === "승인됨" &&
      r.items?.some(i => i.modelName === modelName || i.equipName === modelName)
    );
    const renting = requests.filter(r =>
      r.status === "대여중" &&
      r.items?.some(i => i.modelName === modelName || i.equipName === modelName)
    );
    setResult({ modelName, related, renting });
  };

  const handleKeyDown = (e) => {
    // QR 리더기는 Enter로 입력을 마침
    if (e.key === "Enter" && qrInput.trim()) {
      handleScan(qrInput.trim());
      setQrInput("");
    }
  };

  const handleAction = (request, actionType) => {
    setConfirm({ request, actionType, modelName: result.modelName });
  };

  const handleConfirm = async () => {
    const { request, actionType, modelName } = confirm;
    const newStatus = actionType === "출고" ? "대여중" : "반납완료";
    await updateItem("rentalRequests", request.id, { status: newStatus });
    // 반납 시 재고 복구
    if (actionType === "반납" && request.items) {
      const modelQty = {};
      request.items.forEach(item => {
        const key = item.modelName || item.equipName || "";
        if (key) modelQty[key] = (modelQty[key] || 0) + (item.quantity || 1);
      });
      for (const [mn, qty] of Object.entries(modelQty)) {
        const units = equipments.filter(e => (e.modelName || e.name) === mn);
        let remaining = qty;
        for (const unit of units) {
          if (remaining <= 0) break;
          const cur = unit.available ?? 0;
          const newVal = Math.min(unit.total || 0, cur + 1);
          if (newVal !== cur) {
            await updateItem("equipments", unit.id, { available: newVal });
            remaining--;
          }
        }
      }
    }
    const msg = `${actionType === "출고" ? "📤" : "📥"} ${request.studentName} — ${modelName} ${actionType} 완료`;
    setHistory(p => [{ msg, time: new Date().toLocaleTimeString(), ok: true }, ...p].slice(0, 10));
    showToast(msg);
    setConfirm(null);
    setResult(null);
    inputRef.current?.focus();
  };

  const model = result ? grouped.find(g => g.modelName === result.modelName) : null;

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>📷 QR 스캔 — 출고 / 반납</PageTitle>

      {/* 토스트 */}
      {toast && (
        <div style={{ background: toast.ok ? C.greenLight : C.redLight, color: toast.ok ? C.green : C.red, borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontWeight: 700, fontSize: 14, border: `1px solid ${toast.ok ? C.green : C.red}30` }}>
          {toast.msg}
        </div>
      )}

      {/* QR 입력창 */}
      <Card style={{ marginBottom: 20, border: `2px solid ${C.blue}40` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
          🔫 QR 리더기로 장비를 스캔하세요
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          이 입력창에 포커스가 있으면 리더기로 스캔 시 자동으로 인식됩니다
        </div>
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            value={qrInput}
            onChange={e => setQrInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="QR 스캔 대기 중... (여기를 클릭 후 스캔)"
            style={{
              display: "block", width: "100%", background: C.bg,
              border: `2px solid ${C.blue}`,
              borderRadius: 10, color: C.text,
              padding: "12px 16px", fontSize: 14,
              fontFamily: "monospace", outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
          {qrInput && (
            <button
              onClick={() => { handleScan(qrInput); setQrInput(""); }}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >확인</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          💡 리더기가 없으면 직접 입력 후 Enter 또는 확인 버튼
        </div>
      </Card>

      {/* 스캔 결과 */}
      {result && model && (
        <div>
          {/* 장비 정보 */}
          <div style={{ background: `linear-gradient(135deg,${C.navy},#2D4A9B)`, borderRadius: 16, padding: "18px 22px", marginBottom: 20, color: "#fff" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>스캔된 장비</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{model.modelName}</div>
            {model.itemName && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{model.itemName}</div>}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{model.majorCategory} · {model.manufacturer}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: model.available === 0 ? "#FCA5A5" : "#6EE7B7" }}>{model.available}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>대여가능</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{model.total}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>전체 보유</div>
              </div>
            </div>
          </div>

          {/* 출고 — 승인됨 */}
          {result.related.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 10 }}>📤 출고 처리 가능</div>
              {result.related.map(r => (
                <Card key={r.id} style={{ border: `2px solid ${C.green}40` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.studentName}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{r.studentId} · {r.dept}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>📅 {r.startDate} {r.startTime} ~ {r.endDate} {r.endTime}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>목적: {r.purpose}</div>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.items?.map((item, i) => (
                          <span key={i} style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                            {item.modelName || item.equipName} × {item.quantity}대
                          </span>
                        ))}
                      </div>
                    </div>
                    <Badge label={r.status} />
                  </div>
                  <Btn onClick={() => handleAction(r, "출고")} color={C.green} full>📤 출고 처리</Btn>
                </Card>
              ))}
            </div>
          )}

          {/* 반납 — 대여중 */}
          {result.renting.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 10 }}>📥 반납 처리 가능</div>
              {result.renting.map(r => (
                <Card key={r.id} style={{ border: `2px solid ${C.teal}40` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.studentName}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{r.studentId} · {r.dept}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>반납 예정: {r.endDate} {r.endTime}</div>
                    </div>
                    <Badge label={r.status} />
                  </div>
                  <Btn onClick={() => handleAction(r, "반납")} color={C.teal} full>📥 반납 처리</Btn>
                </Card>
              ))}
            </div>
          )}

          {result.related.length === 0 && result.renting.length === 0 && (
            <div style={{ background: C.yellowLight, borderRadius: 14, padding: "24px", textAlign: "center", marginBottom: 16, border: `1px solid ${C.yellow}30` }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>관련 신청 없음</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>이 장비에 대한 승인된 대여 신청이 없습니다</div>
            </div>
          )}

          <Btn onClick={() => { setResult(null); setTimeout(() => inputRef.current?.focus(), 100); }} color={C.navy} full>
            🔄 다시 스캔
          </Btn>
        </div>
      )}

      {/* 최근 처리 내역 */}
      {!result && history.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 12 }}>📋 최근 처리 내역</div>
          {history.map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize: 13, color: C.text }}>{h.msg}</span>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{h.time}</span>
            </div>
          ))}
        </Card>
      )}

      {/* 확인 모달 */}
      {confirm && (
        <ConfirmModal
          request={confirm.request}
          actionType={confirm.actionType}
          modelName={confirm.modelName}
          onConfirm={handleConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
