// 🎬 작품제작 탭 — 프로젝트 스튜디오 + 촬영도구 를 세그먼트 토글로 묶음
import { useState } from "react";
import { C } from "../../theme";
import ProjectStudio from "./projectstudio/ProjectStudio";
import FilmTools from "../../components/FilmTools";

export default function ProductionScreen({ initialView, onConsumed, onExit }) {
  // 프로젝트 배너/딥링크로 진입(initialView 존재)하면 프로젝트 탭부터
  const [seg, setSeg] = useState("project");

  return (
    <div>
      {/* 세그먼트 토글 (블루 그라데이션) */}
      <div style={{ position: "relative", display: "flex", background: "#10131d", border: "1px solid #232a3a", borderRadius: 14, padding: 5, marginBottom: 16 }}>
        <div style={{ position: "absolute", top: 5, bottom: 5, left: seg === "project" ? 5 : "50%", width: "calc(50% - 5px)", background: "linear-gradient(135deg,#3b82f6,#2563eb)", borderRadius: 10, transition: "left 0.28s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }} />
        {[["project", "프로젝트"], ["tools", "촬영도구"]].map(([v, l]) => (
          <button key={v} onClick={() => setSeg(v)}
            style={{ position: "relative", zIndex: 1, flex: 1, padding: "11px 0", background: "transparent", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", color: seg === v ? "#fff" : C.muted, transition: "color 0.2s" }}>
            {l}
          </button>
        ))}
      </div>

      {seg === "project"
        ? <ProjectStudio initialView={initialView} onConsumed={onConsumed} onExit={onExit} />
        : <FilmTools />}
    </div>
  );
}
