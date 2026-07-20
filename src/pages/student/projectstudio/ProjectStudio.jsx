import { useState, useEffect } from "react";
import { Plus, Clapperboard, ChevronRight, ChevronDown, Archive, ArchiveRestore } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, updateItem } from "../../../hooks/useFirestore";
import { Spinner } from "../../../components/UI";
import { PS, typeLabel, typeIcon, stageLabel } from "./constants";
import ProjectCreate from "./ProjectCreate";
import ProjectDashboard from "./ProjectDashboard";
import ScriptScreen from "./ScriptScreen";
import ShotsScreen from "./ShotsScreen";
import ScheduleScreen from "./ScheduleScreen";
import CrewScreen from "./CrewScreen";
import EquipmentScreen from "./EquipmentScreen";
import BudgetScreen from "./BudgetScreen";

// 🎬 Project Studio 진입점 — view: "list" | "create" | 프로젝트 id
// initialView: 커뮤니티 배너 진입 시 "create" (App.jsx에서 전달, onConsumed로 소비)
export default function ProjectStudio({ initialView, onConsumed }) {
  const { user } = useAuth();
  const uid = user?.uid;

  // orderBy+where 복합 인덱스를 피하려고 orderField null → 클라에서 정렬
  const { data: ownProjects, loading } = useCollection(
    "projects", null,
    uid ? { where: [["ownerId", "==", uid]] } : { enabled: false }
  );
  // 팀원으로 추가돼 참여 중인 프로젝트 (memberIds)
  const { data: joinedProjects } = useCollection(
    "projects", null,
    uid ? { where: [["memberIds", "array-contains", uid]] } : { enabled: false }
  );
  // 병합 (내 프로젝트 우선, id 중복 제거)
  const projects = [...ownProjects, ...joinedProjects.filter(p => !ownProjects.some(o => o.id === p.id))];

  const [view, setView] = useState(initialView === "create" ? "create" : "list");
  const [shotsSceneId, setShotsSceneId] = useState(null); // "이 장면으로 콘티 만들기" 진입 시 초기 장면
  const [showArchived, setShowArchived] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  useEffect(() => { if (initialView && onConsumed) onConsumed(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byNewest = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  const active   = projects.filter(p => p.status !== "archived").sort(byNewest);
  const archived = projects.filter(p => p.status === "archived" && p.ownerId === uid).sort(byNewest);

  const restore = async (p) => {
    if (restoringId) return;
    setRestoringId(p.id);
    try {
      await updateItem("projects", p.id, { status: "active" });
    } catch (e) {
      console.warn("project restore error:", e);
      alert("복구에 실패했어요.");
    }
    setRestoringId(null);
  };

  if (view === "create") {
    return <ProjectCreate onBack={() => setView("list")} onCreated={(id) => setView(id)} />;
  }
  // 서브 화면 ("script:" | "shots:" | "schedule:" | "crew:" | "equipment:" | "budget:" + 프로젝트 id)
  if (typeof view === "string" && /^(script|shots|schedule|crew|equipment|budget):/.test(view)) {
    const [screen, pid] = [view.split(":")[0], view.split(":")[1]];
    const project = projects.find(p => p.id === pid);
    if (!project && loading) return <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>;
    if (!project) {
      return (
        <div style={{ padding: "40px 16px", textAlign: "center", color: PS.sub, fontSize: 14 }}>
          프로젝트를 찾을 수 없어요.
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setView("list")}
              style={{ background: PS.surface, border: `1px solid ${PS.border}`, color: PS.text,
                borderRadius: 10, padding: "10px 18px", minHeight: 44, fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit" }}>
              목록으로
            </button>
          </div>
        </div>
      );
    }
    if (screen === "shots") {
      return <ShotsScreen project={project} initialSceneId={shotsSceneId}
        onBack={() => { setShotsSceneId(null); setView(pid); }} />;
    }
    if (screen === "schedule") {
      return <ScheduleScreen project={project} onBack={() => setView(pid)} />;
    }
    if (screen === "crew") {
      return <CrewScreen project={project} onBack={() => setView(pid)} />;
    }
    if (screen === "equipment") {
      return <EquipmentScreen project={project} onBack={() => setView(pid)} />;
    }
    if (screen === "budget") {
      return <BudgetScreen project={project} onBack={() => setView(pid)} />;
    }
    return <ScriptScreen project={project} onBack={() => setView(pid)}
      onOpenShots={(scene) => { setShotsSceneId(scene.id); setView("shots:" + pid); }} />;
  }
  if (view !== "list") {
    const project = projects.find(p => p.id === view);
    // 로딩 중엔 스피너 (생성 직후 스냅샷 도착 전 "없음" 오판 방지)
    if (!project && loading) return <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>;
    return <ProjectDashboard project={project} onBack={() => setView("list")}
      onOpenScript={() => setView("script:" + project.id)}
      onOpenShots={() => { setShotsSceneId(null); setView("shots:" + project.id); }}
      onOpenSchedule={() => setView("schedule:" + project.id)}
      onOpenMenuScreen={(key) => setView(key + ":" + project.id)} />;
  }

  // ===== 목록 =====
  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "10px 0 16px" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900 }}>내 프로젝트</div>
          <div style={{ fontSize: 12.5, color: PS.sub, marginTop: 3 }}>아이디어부터 완성까지 한 곳에서</div>
        </div>
        <button onClick={() => setView("create")}
          style={{
            display: "flex", alignItems: "center", gap: 5, minHeight: 44,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800,
            padding: "10px 14px", cursor: "pointer", fontFamily: "inherit",
            boxShadow: `0 3px 14px ${PS.primary}50`, whiteSpace: "nowrap",
          }}>
          <Plus size={16} /> 새 프로젝트
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>
      ) : active.length === 0 ? (
        <div style={{
          background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "40px 20px", textAlign: "center",
        }}>
          <Clapperboard size={30} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 5 }}>아직 프로젝트가 없어요</div>
          <div style={{ fontSize: 13, color: PS.sub, marginBottom: 18 }}>첫 작품 아이디어를 프로젝트로 만들어보세요.</div>
          <button onClick={() => setView("create")}
            style={{
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", borderRadius: 12, color: "#fff", fontSize: 13.5, fontWeight: 800,
              padding: "12px 20px", minHeight: 46, cursor: "pointer", fontFamily: "inherit",
              boxShadow: `0 3px 14px ${PS.primary}50`,
            }}>
            새 프로젝트 시작
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.map(p => {
            const Ic = typeIcon(p.type);
            const progress = Math.max(0, Math.min(100, p.progress || 0));
            return (
              <div key={p.id} onClick={() => setView(p.id)}
                style={{
                  background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 16,
                  padding: "15px 16px", cursor: "pointer",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Ic size={14} color={PS.primaryLight} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: PS.primaryLight }}>
                    {typeLabel(p.type)} · {stageLabel(p.stage)}
                  </span>
                  {p.ownerId !== uid && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: PS.success,
                      background: `${PS.success}1A`, border: `1px solid ${PS.success}44`,
                      padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>
                      참여 중
                    </span>
                  )}
                  <ChevronRight size={15} color={PS.sub} style={{ marginLeft: "auto" }} />
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 10, wordBreak: "keep-all" }}>{p.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: PS.elev, overflow: "hidden" }}>
                    <div style={{
                      width: `${progress}%`, height: "100%", borderRadius: 999,
                      background: `linear-gradient(90deg, ${PS.primary}, ${PS.primaryLight})`,
                    }} />
                  </div>
                  <span style={{ fontSize: 11.5, color: PS.sub, fontWeight: 700 }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 보관된 프로젝트 (접기 섹션 — 복구 가능) */}
      {!loading && archived.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setShowArchived(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 7, width: "100%", minHeight: 44,
              background: "none", border: "none", color: PS.sub, cursor: "pointer",
              fontSize: 13, fontWeight: 700, padding: "8px 2px", fontFamily: "inherit",
            }}>
            <Archive size={15} />
            보관된 프로젝트 {archived.length}개
            <ChevronDown size={15} style={{
              marginLeft: "auto", transition: "transform .15s",
              transform: showArchived ? "rotate(180deg)" : "none",
            }} />
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {archived.map(p => (
                <div key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 14,
                    padding: "12px 14px", opacity: restoringId === p.id ? 0.55 : 0.85,
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: PS.sub, wordBreak: "keep-all" }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: PS.sub, marginTop: 2, opacity: 0.7 }}>
                      {typeLabel(p.type)} · {stageLabel(p.stage)}
                    </div>
                  </div>
                  <button onClick={() => restore(p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, minHeight: 40, flexShrink: 0,
                      background: `${PS.primary}1A`, border: `1px solid ${PS.primary}55`,
                      borderRadius: 10, color: PS.primaryLight, cursor: "pointer",
                      fontSize: 12, fontWeight: 700, padding: "8px 12px", fontFamily: "inherit",
                    }}>
                    <ArchiveRestore size={14} /> 복구
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
