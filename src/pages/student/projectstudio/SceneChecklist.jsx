import { PS, locTypeLabel } from "./constants";

// 장면 다중 선택 체크리스트 (캐스팅·로케이션 모달 공용)
// scenes: 장면 배열, value: 선택된 sceneId 배열, onChange: (next) => void
export default function SceneChecklist({ scenes, value, onChange, disabled, emptyText = "시나리오에 장면이 없어요." }) {
  const sorted = [...scenes].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const toggle = (id) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  };
  if (sorted.length === 0) {
    return <div style={{ fontSize: 12, color: PS.sub, padding: "4px 0" }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
      {sorted.map(s => {
        const on = value.includes(s.id);
        return (
          <button key={s.id} onClick={() => toggle(s.id)} disabled={disabled}
            style={{
              display: "flex", alignItems: "center", gap: 8, minHeight: 42, textAlign: "left",
              background: on ? `${PS.primary}14` : PS.elev,
              border: `1px solid ${on ? PS.primary : PS.border}`, borderRadius: 10,
              color: PS.text, fontSize: 12.5, fontWeight: 700, padding: "8px 11px",
              cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
            }}>
            <span style={{
              width: 18, height: 18, borderRadius: 6, flexShrink: 0,
              background: on ? PS.primary : "transparent",
              border: `1.5px solid ${on ? PS.primary : PS.sub}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 11, fontWeight: 900,
            }}>{on ? "✓" : ""}</span>
            <span style={{ color: PS.primaryLight, flexShrink: 0 }}>S#{s.sceneNumber}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.heading || s.locationName || "(제목 없음)"}
            </span>
            <span style={{ fontSize: 10.5, color: PS.sub, flexShrink: 0 }}>
              {locTypeLabel(s.locationType)}{s.timeOfDay ? ` · ${s.timeOfDay}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
