import { C } from "../theme";
import { useAuth } from "../hooks/useAuth.jsx";
import {
  Wrench, Hammer, Building2, Store, Users, GraduationCap, Share2,
  MessageSquare, Calendar, BarChart3, Megaphone, MessageCircle, Settings,
} from "lucide-react";

// 그룹별 업무 카드 정의
const GROUPS = {
  g_equip: {
    title: "장비 / 시설",
    items: [
      { id: "equip",    icon: Wrench,    label: "장비 관리",   desc: "장비 등록·수정·재고" },
      { id: "repair",   icon: Hammer,    label: "장비 수리",   desc: "수리 접수·이력 관리" },
      { id: "facility", icon: Building2, label: "시설 관리",   desc: "스튜디오·공간 예약" },
      { id: "external", icon: Store,     label: "외부 렌탈샵", desc: "제휴 업체 관리" },
    ],
  },
  g_student: {
    title: "학생",
    items: [
      { id: "students", icon: Users,         label: "학생 관리",     desc: "학생 정보·권한" },
      { id: "license",  icon: GraduationCap, label: "라이센스 관리", desc: "장비 자격 인증" },
    ],
  },
  g_sns: {
    title: "SNS",
    items: [
      { id: "sns",       icon: Share2,        label: "SNS 관리",  desc: "콘텐츠·자동화" },
      { id: "community", icon: MessageSquare, label: "에브리타임", desc: "커뮤니티 관리", everytime: true },
    ],
  },
  g_more: {
    title: "더보기",
    items: [
      { id: "calendar", icon: Calendar,      label: "캘린더 관리",   desc: "일정·대여 현황" },
      { id: "stats",    icon: BarChart3,     label: "통계 관리",     desc: "이용 통계·리포트" },
      { id: "notices",  icon: Megaphone,     label: "공지사항 관리", desc: "공지·PDF 등록" },
      { id: "inquiry",  icon: MessageCircle, label: "문의 관리",     desc: "학생 문의 답변" },
      { id: "settings", icon: Settings,      label: "설정",          desc: "앱·계정 설정" },
    ],
  },
};

export default function GroupHub({ groupId, setTab }) {
  const { profile } = useAuth();
  const group = GROUPS[groupId];
  if (!group) return null;

  // 에브리타임: 교수·교사 관리자는 숨김
  const isTeacherProf = profile?.role === "admin" &&
    (profile?.adminRole === "teacher" || profile?.adminRole === "professor");
  const items = group.items.filter((it) => !(it.everytime && isTeacherProf));

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 3 }}>{group.title}</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>관리할 업무를 선택하세요</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => setTab(it.id)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: "20px 16px", display: "flex", flexDirection: "column",
                alignItems: "flex-start", gap: 12, cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", transition: "border-color .15s",
              }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={23} color={C.navy} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, marginBottom: 3 }}>{it.label}</div>
                <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.4 }}>{it.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
