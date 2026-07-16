/* ============================================================
   장비 호환성 매칭
   관리자가 장비 등록 시 넣어둔 필드로 "이 카메라에 맞는 것"을 골라낸다.
     forCamera / forCameras   : 배터리가 맞는 카메라
     batteryModel             : 카메라 문서에 적힌 전용 배터리
     chargerForBatteries      : 충전기가 맞는 배터리 (구버전 폴백: chargerForCameras)
     mount                    : 바디/렌즈 마운트 — 다르면 어댑터 필요
     adapterFrom / adapterTo  : 어댑터가 잇는 마운트
   (구 GuideReserve의 매칭 규칙을 그대로 옮긴 것)
   ============================================================ */

// 관리자 Equipment.jsx의 EQUIP_TYPE_MAP(중분류 → equipType)이 기준.
// equipType만 믿으면 안 된다 — 중분류를 직접 입력해 등록하면 "etc"로 박히고,
// 매핑 도입 전에 등록된 장비는 아예 비어 있다. 그래서 중분류로도 폴백한다.
const CAMERA_MINORS  = ["카메라", "캠코더", "드론/액션캠"];
const LENS_MINORS    = ["단렌즈", "줌렌즈", "시네렌즈", "렌즈"];
const TRIPOD_MINORS  = ["비디오삼각대", "사진삼각대", "모노포드"];

export const isLens = (e) => e.equipType === "lens" || LENS_MINORS.includes(e.minorCategory);

/* 렌즈 제조사 — 이 순서로 보여준다. 목록에 없는 제조사는 뒤에 가나다순.
   로고는 public/lens-brands/{파일명}.png (48x48, 투명배경 / 24px로 표시) */
export const LENS_BRAND_ORDER = [
  "SONY", "CANON", "XEEN CF", "SAMYANG", "TAMRON", "CARL ZEISS", "TOKINA", "SIGMA", "FUJINON", "NIKON",
];
const LENS_BRAND_LOGO = {
  "SONY":"sony", "CANON":"canon", "XEEN CF":"xeen", "SAMYANG":"samyang", "TAMRON":"tamron",
  "CARL ZEISS":"zeiss", "TOKINA":"tokina", "SIGMA":"sigma", "FUJINON":"fujinon", "NIKON":"nikon",
};
// 실제 데이터에 축약형으로 들어간 표기를 정식 명칭으로 맞춘다
const BRAND_ALIAS = {
  "CZ": "CARL ZEISS",
  "ZEISS": "CARL ZEISS",
  "XEEN": "XEEN CF",
};
export const normBrand = (m) => {
  const s = (m || "").trim().toUpperCase().replace(/\s+/g, " ");
  return BRAND_ALIAS[s] || s;
};

// 렌즈를 제조사별로 묶어 지정 순서로 정렬 → [{ brand, logo, items }]
export function groupLensesByBrand(lenses) {
  const map = {};
  lenses.forEach(e => {
    const b = normBrand(e.manufacturer) || "기타";
    (map[b] = map[b] || []).push(e);
  });
  const known = LENS_BRAND_ORDER.filter(b => map[b]);
  const rest  = Object.keys(map).filter(b => !LENS_BRAND_ORDER.includes(b)).sort((a, b) => a.localeCompare(b, "ko"));
  return [...known, ...rest].map(b => ({
    brand: b,
    logo:  LENS_BRAND_LOGO[b] ? `/lens-brands/${LENS_BRAND_LOGO[b]}.png` : null,
    items: map[b],
  }));
}

// 카메라/캠코더 계열인가 — 상세 페이지(액세서리 선택)를 띄울 대상
export const isCameraLike = (e) =>
  (e.equipType === "camera" || e.equipType === "camcorder" ||
    CAMERA_MINORS.includes(e.minorCategory)) &&
  !e.isSet;

// 같은 modelName끼리 묶고 재고를 합산 (개체 단위 문서 → 모델 단위 카드)
export function groupByModel(list) {
  return Object.values(list.reduce((acc, e) => {
    if (!acc[e.modelName]) acc[e.modelName] = { ...e, available: 0, total: 0 };
    acc[e.modelName].available += (e.available ?? ((e.status || "대여가능") === "대여가능" ? 1 : 0));
    acc[e.modelName].total     += 1;
    return acc;
  }, {}));
}

// 액세서리 갈래별로 나눔. 수리중은 전부 제외.
export function classifyAccessories(equips) {
  const live = equips.filter(e => e.status !== "수리중");
  return {
    batteries: live.filter(e => e.equipType === "battery" || e.minorCategory === "배터리"),
    chargers:  live.filter(e => e.equipType === "charger" || e.minorCategory === "충전기/전원"),
    // 저장매체와 카드리더기는 equipType이 둘 다 "storage"라 중분류로 갈라야 한다
    storages:  live.filter(e => e.minorCategory === "저장매체" || (e.equipType === "storage" && e.minorCategory !== "카드리더기")),
    readers:   live.filter(e => e.minorCategory === "카드리더기"),
    tripods:   live.filter(e => e.equipType === "tripod" || TRIPOD_MINORS.includes(e.minorCategory)),
    lenses:    groupByModel(live.filter(e => isLens(e) && !e.isSet)),
    // 렌즈 세트(XEEN CF 등) — 수량 없이 1세트 단위라 cartSets로 담는다
    lensSets:  groupByModel(live.filter(e => isLens(e) && e.isSet)),
    adapters:  live.filter(e => e.equipType === "adapter" || e.minorCategory === "렌즈어댑터"),
  };
}

// V마운트(VBP) 배터리인가 — 소분류로 판별. 전용 배터리와 나눠서 보여주려고 쓴다.
export const isVMount = (b) => {
  const s = b.subCategory || "";
  return s.toUpperCase().includes("VBP") || s.includes("V-Mount") || s.includes("V마운트");
};

// 이 카메라에 맞는 배터리
export function matchBatteries(cam, batteries) {
  if (!cam) return [];
  return groupByModel(batteries.filter(b =>
    b.forCamera === cam.modelName ||
    (b.forCameras || []).includes(cam.modelName) ||
    (cam.batteryModel && b.modelName === cam.batteryModel)
  ));
}

// 고른 배터리에 맞는 충전기. chargerForBatteries가 있으면 그걸 쓰고,
// 없으면 구버전 chargerForCameras로 폴백한다.
export function matchChargers(selectedBatteryModels, chargers, cam) {
  if (!selectedBatteryModels.length) return [];
  return groupByModel(chargers.filter(c => {
    const forBats = c.chargerForBatteries || [];
    if (forBats.length > 0) return selectedBatteryModels.some(bm => forBats.includes(bm));
    return cam && ((c.chargerForCameras || []).includes(cam.modelName) || c.forCamera === cam.modelName);
  }));
}

// 마운트가 다르면 어댑터가 필요하고, 맞는 어댑터를 찾아준다 (없으면 undefined)
// 둘 중 하나라도 마운트가 안 적혀 있으면 판정하지 않는다 — 정보가 없다고 막으면
// 마운트 미등록 장비의 렌즈가 전부 차단된다.
export const needsAdapter = (lens, cam) => !!(cam?.mount && lens.mount && lens.mount !== cam.mount);
export const findAdapter  = (lens, cam, adapters) =>
  adapters.find(a => a.adapterFrom === lens.mount && a.adapterTo === cam?.mount);

export const licenseToNum = (lic) => {
  if (!lic || lic === "없음") return 0;
  const n = parseInt(lic);
  return isNaN(n) ? 0 : n;
};
