// 🔌 Project Studio 외부 연동 어댑터 (요청서 11·12번)
// 프로젝트 화면들은 장비/커뮤니티 API를 직접 부르지 않고 반드시 이 어댑터를 통한다.
// — 장비 예약: 실제 장비대여 시스템(equipments 컬렉션 + useCart 장바구니)에 연결됨
// — 커뮤니티 모집: MVP는 mock (미리보기 + 초안 반환까지), 실제 등록은 추후 교체

import { groupEquipments } from "../../../utils/groupEquipments";

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
 * 커뮤니티 크루 모집 어댑터 (MVP mock)
 * 실제 연동 시 communityPosts에 category "협업모집" 글을 생성하도록 이 함수만 교체.
 */
export const communityRecruitmentAdapter = {
  async createRecruitmentPost(projectId, crewRole) {
    // mock: 등록된 척 가짜 postId 반환
    return { postId: `mock_${projectId.slice(0, 6)}_${crewRole}` };
  },
};
