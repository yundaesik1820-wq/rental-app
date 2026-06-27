import { C } from "../theme";

// 풀스크린 PDF 뷰어 — url 있으면 화면 꽉 채워 표시, onClose로 닫기
export default function PdfViewer({ url, title, onClose }) {
  if (!url) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0B1220", display: "flex", flexDirection: "column",
    }}>
      {/* 상단 바 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 12px",
        paddingTop: "calc(12px + env(safe-area-inset-top))",
        background: C.surface, borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={onClose} style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "none", color: C.text,
          fontSize: 16, fontWeight: 800, cursor: "pointer", padding: "6px 6px",
        }}>
          ‹ 뒤로
        </button>
        <div style={{
          flex: 1, fontSize: 14, fontWeight: 700, color: C.navy,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title || "문서"}</div>
        <button onClick={() => window.open(url, "_blank")} style={{
          background: "none", border: `1px solid ${C.border}`, color: C.muted,
          fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "7px 11px", cursor: "pointer",
        }}>
          다운로드
        </button>
      </div>

      {/* PDF 본문 */}
      <div style={{ flex: 1, background: "#fff", position: "relative" }}>
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
          title="PDF"
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </div>
    </div>
  );
}
