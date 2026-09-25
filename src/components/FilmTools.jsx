// 🎞️ 촬영도구 허브 — 작품제작 탭에서 사용 (원래 Community 안에 있던 tools 룸을 추출)
// 각 도구는 독립 컴포넌트(onBack만 받음). 여기서 그리드로 고르고 선택된 도구를 전체화면으로 띄운다.
import { useState } from "react";
import { C } from "../theme";
import CinemaSlate from "./CinemaSlate";
import ExposureLive from "./ExposureLive";
import ExposureCalc from "./ExposureCalc";
import DofCalc from "./DofCalc";
import ColorTemp from "./ColorTemp";
import FovCalc from "./FovCalc";
import ScripterTool from "./ScripterTool";
import SunSeeker from "./SunSeeker";
import ResourceHub from "./ResourceHub";

// key → 이미지 (public/film-tools/*.png), Community 의 FILM_TOOL_BOXES 와 동일
const FILM_TOOL_BOXES = [
  { key: "slate",         img: "/film-tools/slate.png",         label: "슬레이트" },
  { key: "scripter",      img: "/film-tools/scripter.png",      label: "스크립터" },
  { key: "live-exposure", img: "/film-tools/live-exposure.png", label: "라이브 노출" },
  { key: "exposure-calc", img: "/film-tools/exposure-calc.png", label: "노출 계산기" },
  { key: "dof",           img: "/film-tools/dof.png",           label: "심도 계산기" },
  { key: "color-temp",    img: "/film-tools/color-temp.png",    label: "색온도" },
  { key: "fov",           img: "/film-tools/fov.png",           label: "화각 계산기" },
  { key: "sun",           img: "/film-tools/sun.png",           label: "태양 위치" },
  { key: "resources",     img: "/film-tools/resources.png",     label: "자료실" },
];

export default function FilmTools() {
  const [tool, setTool] = useState(null);
  const back = () => setTool(null);

  if (tool === "slate")         return <CinemaSlate onBack={back} />;
  if (tool === "live-exposure") return <ExposureLive onBack={back} />;
  if (tool === "exposure-calc") return <ExposureCalc onBack={back} />;
  if (tool === "dof")           return <DofCalc onBack={back} />;
  if (tool === "color-temp")    return <ColorTemp onBack={back} />;
  if (tool === "fov")           return <FovCalc onBack={back} />;
  if (tool === "scripter")      return <ScripterTool C={C} onBack={back} />;
  if (tool === "sun")           return <SunSeeker onBack={back} />;
  if (tool === "resources")     return <ResourceHub onBack={back} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 2px" }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#fbbf24" }}>🎞️ 촬영도구</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>촬영에 필요한 도구를 골라 쓰세요</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 10,
      }}>
        {FILM_TOOL_BOXES.map(t => (
          <button key={t.key} className="tap-spring" onClick={() => setTool(t.key)}
            aria-label={t.label}
            style={{
              aspectRatio: "2 / 1", width: "100%", borderRadius: 14, overflow: "hidden",
              cursor: "pointer", padding: 0, border: "1px solid rgba(255,255,255,0.07)",
              background: "#17171c",
            }}>
            <img loading="lazy" decoding="async" src={t.img} alt={t.label}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={e => { e.currentTarget.style.opacity = 0; }} />
          </button>
        ))}
      </div>
    </div>
  );
}
