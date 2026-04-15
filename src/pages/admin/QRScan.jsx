import { useState, useEffect, useRef } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, PageTitle, Modal } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";
import { groupEquipments } from "../../utils/groupEquipments";

// ── QR 스캐너 (html5-qrcode CDN) ─────────────────────────
function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let scanner = null;

    const loadScript = () => new Promise((resolve, reject) => {
      if (window.Html5Qrcode) { resolve(); return; }
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });

    const start = async () => {
      try {
        await loadScript();
        scanner = new window.Html5Qrcode("qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => {
            scanner.stop().catch(() => {});
            onScan(text);
          },
          () => {}
        );
        setLoading(false);
      } catch (e) {
        setError("카메라 접근 권한이 필요합니다.\n브라우저 설정에서 카메라를 허용해주세요.");
        setLoading(false);
      }
    };

    start();
    return () => { if (scanner) scanner.stop().catch(() => {}); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>📷 QR 스캔</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>장비에 부착된 QR코드를 카메라에 비춰주세요</div>

      {error ? (
        <div style={{ background: C.redLight, color: C.red, borderRadius: 14, padding: "16px 24px", textAlign: "center", fontSize: 13, whiteSpace: "pre-line", marginBottom: 20, maxWidth: 340 }}>
          ⚠️ {error}
        </div>
      ) : (
        <div style={{ position: "relative", width: 300, height: 300 }}>
          <div id="qr-reader" style={{ width: 300, height: 300, borderRadius: 16, overflow: "hidden" }} />
          {/* 스캔 가이드 박스 */}
          {!loading && (
            <>
              <div style={{ position: "absolute", top: 20, left: 20, width: 40, height: 40, borderTop: `3px solid ${C.teal}`, borderLeft: `3px solid ${C.teal}`, borderRadius: "4px 0 0 0" }} />
              <div style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderTop: `3px solid ${C.teal}`, borderRight: `3px solid ${C.teal}`, borderRadius: "0 4px 0 0" }} />
              <div style={{ position: "absolute", bottom: 20, left: 20, width: 40, height: 40, borderBottom: `3px solid ${C.teal}`, borderLeft: `3px solid ${C.teal}`, borderRadius: "0 0 0 4px" }} />
              <div style={{ position: "absolute", bottom: 20, right: 20, width: 40, height: 40, borderBottom: `3px solid ${C.teal}`, borderRight: `3px solid ${C.teal}`, borderRadius: "0 0 4px 0" }} />
            </>
          )}
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", borderRadius: 16 }}>
              <div style={{ color: "#fff", fontSize: 14 }}>카메라 초기화 중...</div>
            </div>
          )}
        </div>
      )}

      {/* 수동 입력 옵션 */}
      <ManualInput onScan={onScan} />

      <button onClick={onClose} style={{ marginTop: 24, background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 28px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
        닫기
      </button>
    </div>
  );
}

function ManualInput({ onScan }) {
  const [show, setShow]   = useState(false);
  const [val, setVal]     = useState("");
  return (
    <div style={{ marginTop: 20, textAlign: "center" }}>
      {!show ? (
        <button onClick={() => setShow(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          QR코드를 직접 입력할게요
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="EQUIP-0001 또는 장비ID"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && val && onScan(val)}
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", width: 220 }}
            autoFocus
          />
          <button onClick={() => val && onScan(val)} style={{ background: C.teal, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>확인</button>
        </div>
      )}
    </div>
  );
}

// ── 스캔 결과 카드 ────────────────────────────────────────
function ScanResult({ equip, units, requests, onAction, onReset }) {
  // 이 장비 모델과 관련된 승인된 신청
  const related = requests.filter(r =>
    r.status === "승인됨" &&
    r.items?.some(i => i.modelName === equip.modelName || i.equipName === equip.modelName)
  );
  // 현재 대여중인 신청
  const renting = requests.filter(r =>
    r.status === "대여중" &&
    r.items?.some(i => i.modelName === equip.modelName || i.equipName === equip.modelName)
  );

  const unitStatus = units[0]?.status || "대여가능";
  const availCount = units.filter(u => u.status === "대여가능").length;
  const totalCount = units.length;

  return (
    <div>
      {/* 장비 정보 */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, #2D4A9B)`, borderRadius: 16, padding: "20px 22px", marginBottom: 20, color: "#fff" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>QR 스캔 완료 ✅</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{equip.modelName}</div>
        {equip.itemName && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{equip.itemName}</div>}
        {equip.majorCategory && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{equip.majorCategory} · {equip.manufacturer}</div>}
        <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: availCount === 0 ? "#FCA5A5" : "#6EE7B7" }}>{availCount}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>대여가능</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalCount}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>전체 보유</div>
          </div>
        </div>
      </div>

      {/* 출고 처리 — 승인됨 신청 */}
      {related.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 10 }}>📤 출고 처리 (승인됨)</div>
          {related.map(r => (
            <Card key={r.id} style={{ border: `2px solid ${C.green}40` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.studentName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{r.studentId} · {r.dept}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>📅 {r.startDate} {r.startTime} ~ {r.endDate} {r.endTime}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>목적: {r.purpose} — {r.purposeDetail}</div>
                  <div style={{ marginTop: 6 }}>
                    {r.items?.filter(i => i.modelName === equip.modelName || i.equipName === equip.modelName).map((item, i) => (
                      <span key={i} style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {item.modelName || item.equipName} × {item.quantity}대
                      </span>
                    ))}
                  </div>
                </div>
                <Badge label={r.status} />
              </div>
              <Btn onClick={() => onAction(r, "출고")} color={C.green} full>📤 출고 처리</Btn>
            </Card>
          ))}
        </div>
      )}

      {/* 반납 처리 — 대여중 신청 */}
      {renting.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 10 }}>📥 반납 처리 (대여중)</div>
          {renting.map(r => (
            <Card key={r.id} style={{ border: `2px solid ${C.blue}40` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.studentName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{r.studentId} · {r.dept}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>반납예정: {r.endDate} {r.endTime}</div>
                </div>
                <Badge label={r.status} />
              </div>
              <Btn onClick={() => onAction(r, "반납")} color={C.teal} full>📥 반납 처리</Btn>
            </Card>
          ))}
        </div>
      )}

      {related.length === 0 && renting.length === 0 && (
        <div style={{ background: C.yellowLight, borderRadius: 14, padding: "20px", textAlign: "center", marginBottom: 20, border: `1px solid ${C.yellow}30` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>관련 신청 없음</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>이 장비에 대한 승인된 대여 신청이 없습니다</div>
        </div>
      )}

      <Btn onClick={onReset} color={C.navy} full>🔄 다시 스캔</Btn>
    </div>
  );
}

// ── 확인 모달 ─────────────────────────────────────────────
function ConfirmModal({ request, actionType, equip, onConfirm, onClose }) {
  const isCheckout = actionType === "출고";
  return (
    <Modal onClose={onClose} width={440}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>{isCheckout ? "📤" : "📥"}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{isCheckout ? "출고 처리" : "반납 처리"}</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>아래 내용을 확인 후 처리해주세요</div>
      </div>

      <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.muted }}>장비</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{equip.modelName}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.muted }}>대여자</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{request.studentName}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.muted }}>학번</span>
          <span style={{ fontSize: 13, color: C.text }}>{request.studentId}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}>
          <span style={{ fontSize: 13, color: C.muted }}>기간</span>
          <span style={{ fontSize: 13, color: C.text }}>{request.startDate} ~ {request.endDate}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={onClose} color={C.muted} outline full>취소</Btn>
        <Btn onClick={onConfirm} color={isCheckout ? C.green : C.teal} full>
          {isCheckout ? "✅ 출고 확인" : "✅ 반납 확인"}
        </Btn>
      </div>
    </Modal>
  );
}

// ── 메인 ──────────────────────────────────────────────────
export default function QRScan() {
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: requests }   = useCollection("rentalRequests", "createdAt");

  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null); // { equip, units }
  const [confirm, setConfirm]       = useState(null); // { request, actionType }
  const [toast, setToast]           = useState("");
  const [history, setHistory]       = useState([]); // 최근 처리 내역

  const grouped = groupEquipments(equipments);

  const handleScan = (text) => {
    setScanning(false);
    // QR 형식: "EQUIP-0001:PXW-Z150" 또는 "EQUIP-{id}:{name}"
    const match = text.match(/EQUIP[-_]?(\w+)[:\s]?(.+)?/i);
    let found = null;

    if (match) {
      const idPart   = match[1];
      const namePart = match[2]?.trim() || "";
      // id로 개별 장비 찾기
      const unit = equipments.find(e => e.id === idPart);
      if (unit) {
        const model = grouped.find(g => g.modelName === unit.modelName);
        found = { equip: model || { modelName: unit.modelName, itemName: unit.itemName, majorCategory: unit.majorCategory, manufacturer: unit.manufacturer }, units: equipments.filter(e => e.modelName === unit.modelName) };
      } else if (namePart) {
        // 모델명으로 찾기
        const model = grouped.find(g => g.modelName === namePart || g.modelName.includes(namePart));
        if (model) found = { equip: model, units: equipments.filter(e => e.modelName === model.modelName) };
      }
    }

    if (!found) {
      // 마지막 시도: 전체 텍스트로 모델명 검색
      const model = grouped.find(g => text.includes(g.modelName) || g.modelName.includes(text.replace(/EQUIP[-_:\s\d]*/i, "").trim()));
      if (model) found = { equip: model, units: equipments.filter(e => e.modelName === model.modelName) };
    }

    if (found) {
      setScanResult(found);
    } else {
      setToast("⚠️ 등록된 장비를 찾을 수 없습니다: " + text);
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handleAction = (request, actionType) => {
    setConfirm({ request, actionType });
  };

  const handleConfirm = async () => {
    const { request, actionType } = confirm;
    const newStatus = actionType === "출고" ? "대여중" : "반납완료";
    await updateItem("rentalRequests", request.id, { status: newStatus });

    const msg = actionType === "출고"
      ? `✅ ${request.studentName} 출고 처리 완료`
      : `✅ ${request.studentName} 반납 처리 완료`;

    setHistory(p => [{ msg, time: new Date().toLocaleTimeString(), type: actionType }, ...p].slice(0, 10));
    setConfirm(null);
    setScanResult(null);
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>📷 QR 스캔 — 출고 / 반납</PageTitle>

      {/* 토스트 */}
      {toast && (
        <div style={{ background: toast.startsWith("⚠️") ? C.redLight : C.greenLight, color: toast.startsWith("⚠️") ? C.red : C.green, borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontWeight: 700, fontSize: 14, border: `1px solid ${toast.startsWith("⚠️") ? C.red : C.green}30` }}>
          {toast}
        </div>
      )}

      {!scanResult ? (
        <>
          {/* 스캔 버튼 */}
          <div
            onClick={() => setScanning(true)}
            style={{ background: `linear-gradient(135deg, ${C.navy}, #2D4A9B)`, borderRadius: 20, padding: "40px 0", textAlign: "center", cursor: "pointer", marginBottom: 20, transition: "opacity 0.2s" }}
          >
            <div style={{ fontSize: 56, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>QR 코드 스캔</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>장비의 QR 코드를 스캔하여 출고 / 반납 처리</div>
          </div>

          {/* 최근 처리 내역 */}
          {history.length > 0 && (
            <Card>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 12 }}>📋 최근 처리 내역</div>
              {history.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{h.type === "출고" ? "📤" : "📥"}</span>
                    <span style={{ fontSize: 13, color: C.text }}>{h.msg.replace("✅ ", "")}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.muted }}>{h.time}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      ) : (
        <ScanResult
          equip={scanResult.equip}
          units={scanResult.units}
          requests={requests}
          onAction={handleAction}
          onReset={() => setScanResult(null)}
        />
      )}

      {/* QR 스캐너 */}
      {scanning && <QRScanner onScan={handleScan} onClose={() => setScanning(false)} />}

      {/* 확인 모달 */}
      {confirm && (
        <ConfirmModal
          request={confirm.request}
          actionType={confirm.actionType}
          equip={scanResult?.equip || {}}
          onConfirm={handleConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
