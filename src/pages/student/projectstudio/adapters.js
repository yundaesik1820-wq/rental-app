// 🔌 Project Studio 외부 연동 어댑터
// 프로젝트 화면들은 커뮤니티 API를 직접 부르지 않고 반드시 이 어댑터를 통한다.
// — 커뮤니티 모집: 크루 메이커스(협업모집) 글로 등록

import { addItem } from "../../../hooks/useFirestore";
import { typeLabel } from "./constants";

/**
 * 커뮤니티 크루 모집 어댑터 — 실제 커뮤니티(크루 메이커스=협업모집) 글로 등록.
 * 화면은 communityPosts를 직접 만들지 않고 이 어댑터를 통한다.
 * @param profile useAuth().profile (작성자)
 */
export function createCommunityRecruitmentAdapter({ profile }) {
  return {
    /**
     * @param project 프로젝트 문서
     * @param crewRole 모집 포지션
     * @param opts { shootDate, extraDays, locations[], totalMinutes, deadline }
     * @returns { postId }
     */
    async createRecruitmentPost(project, crewRole, opts = {}) {
      const { shootDate = "", extraDays = 0, locations = [], totalMinutes = 0, deadline = "", intro: introOverride } = opts;
      // 작성자가 미리보기에서 수정한 소개글이 있으면 그걸 우선 사용
      const intro = (introOverride || "").trim()
        || (project.description || "").trim()
        || `함께 작품을 완성할 ${crewRole} 팀원을 찾고 있어요!`;
      const scheduleStr = shootDate ? `${shootDate}${extraDays > 0 ? ` 외 ${extraDays}일` : ""}` : "";
      const runtimeStr = totalMinutes > 0 ? `약 ${Math.ceil(totalMinutes / 60)}시간 촬영 예상` : "";

      const ref = await addItem("communityPosts", {
        title:       project.title,
        content:     intro,
        category:    "협업모집",
        authorId:    profile?.uid || "",
        authorName:  profile?.name || "",
        images:      [],
        // 크루 메이커스 전용 필드 (Community.jsx submitPost와 동일 스키마)
        positions:   [{ role: crewRole, count: 1 }],
        crewDirector: profile?.name || "",
        crewLogline: intro,
        crewSchedule: [scheduleStr, runtimeStr].filter(Boolean).join(" · "),
        crewPlace:   locations.join(", "),
        crewPay:     "",
        crewGenre:   typeLabel(project.type),
        deadline:    deadline || "",
        applicants:  [],
        // 반응/집계 필드 (다른 글과 동일 초기값)
        views: 0, likes: 0, likedBy: [], dislikes: 0, dislikedBy: [],
        // 출처 표시 (프로젝트 스튜디오에서 자동 생성됨을 구분)
        fromProjectId: project.id,
      });
      return { postId: ref.id };
    },
  };
}
