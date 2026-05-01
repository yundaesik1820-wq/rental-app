// 장비를 모델별로 묶어서 반환하는 유틸 함수
// 개별 등록된 장비들을 학생에게 보여줄 때 사용

export function groupEquipments(equipments) {
  const map = {};
  equipments.forEach(e => {
    const key = e.modelName || e.name || "";
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        modelName:       key,
        itemName:        e.itemName        || "",
        majorCategory:   e.majorCategory   || e.category || "",
        minorCategory:   e.minorCategory   || "",
        manufacturer:    e.manufacturer    || "",
        description:     e.description     || "",
        subCategory:     e.subCategory     || "",
        img:             e.img             || "📦",
        photoUrls:       [],
        displayPhotoUrl: e.displayPhotoUrl || "",
        licenseLevel:    e.licenseLevel    || 0,
        units:           [],
        total:           0,
        available:       0,
      };
    }
    map[key].units.push(e);
    map[key].total++;
    if ((e.status || "대여가능") === "대여가능") map[key].available++;
    // 같은 모델 중 가장 높은 라이센스 단계로 설정
    if ((e.licenseLevel || 0) > map[key].licenseLevel) {
      map[key].licenseLevel = e.licenseLevel || 0;
    }
    if (!map[key].displayPhotoUrl && e.displayPhotoUrl) {
      map[key].displayPhotoUrl = e.displayPhotoUrl;
    }
    if (!map[key].description && e.description) {
      map[key].description = e.description;
    }
    // itemNo가 01인 장비 사진 우선 사용
    const ePhotos = e.photoUrls?.length > 0 ? e.photoUrls : (e.photoUrl ? [e.photoUrl] : []);
    if (ePhotos.length > 0) {
      const isFirst = (e.itemNo || "").endsWith("01") || (e.itemNo || "").endsWith("1");
      if (isFirst || map[key].photoUrls.length === 0) {
        map[key].photoUrls = ePhotos;
      }
    }
  });
  return Object.values(map).sort((a, b) => a.majorCategory.localeCompare(b.majorCategory) || a.modelName.localeCompare(b.modelName));
}
