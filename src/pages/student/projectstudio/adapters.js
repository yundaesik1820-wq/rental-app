// 🔌 Project Studio 외부 연동 어댑터 (요청서 11·12번)
// 프로젝트 화면들은 장비/커뮤니티 API를 직접 부르지 않고 반드시 이 어댑터를 통한다.
// — 장비 예약: 실제 장비대여 시스템(equipments 컬렉션 + useCart 장바구니)에 연결됨
// — 커뮤니티 모집: MVP는 mock (미리보기 + 초안 반환까지), 실제 등록은 추후 교체

import { groupEquipments } from "../../../utils/groupEquipments";
import { addItem } from "../../../hooks/useFirestore";
import { typeLabel } from "./constants";

/**
 * 장비 예약 어댑터
 * @param equipments useCollection("equipments") 결과 (실시간)
 * @param setQty     useCart().setQty — 장바구니 담기
 */
export function createEquipmentReservationAdapter({ equipments, setQty }) {
  return {
    /** 학교 장비 검색 — 모델 단위로 재고/라이선스 반환 */
    async searchAvailableEquipment({ keyword = "" }) {
      const kw = keyword.trim().toLowerCase();
      return groupEquipments(equipments)
        .filter(g => !kw
          || g.modelName.toLowerCase().includes(kw)
          || (g.itemName || "").toLowerCase().includes(kw)
          || (g.majorCategory || "").toLowerCase().includes(kw))
        .map(g => ({
          modelName: g.modelName,
          itemName: g.itemName,
          majorCategory: g.majorCategory,
          available: g.available,
          total: g.total,
          licenseLevel: g.licenseLevel,
        }));
    },

    /** 예약 장바구니에 담기 — 기존 배민식 장바구니(cart)로 들어감 */
    async addToReservationCart(items) {
      for (const it of items) {
        setQty(it.modelName, it.quantity, it.max);
      }
    },
  };
}

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
      const { shootDate = "", extraDays = 0, locations = [], totalMinutes = 0, deadline = "" } = opts;
      const intro = (project.description || "").trim() || `함께 작품을 완성할 ${crewRole} 팀원을 찾고 있어요!`;
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
