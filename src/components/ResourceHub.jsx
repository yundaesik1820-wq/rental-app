import { useState, useMemo } from "react";

/**
 * 📚 자료 큐레이션 (Resource Hub)
 *
 * 영상 제작용 무료 리소스 모음 (음원/효과음/LUT/폰트/스톡영상/이미지/템플릿/아이콘)
 * - 카테고리 필터 + 검색
 * - 라이선스 뱃지 (free=자유 / attr=출처표시 / signup=가입필요)
 * - 한국·글로벌 리소스 혼합
 *
 * ※ 라이선스는 변동될 수 있어 보수적으로 표기. 사용 전 각 사이트 확인 권장.
 */

const FONT_MONO   = "'Noto Sans KR', sans-serif";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const C = {
  surface: "#1a1a1a", border: "#2a2a2a",
  text: "#fafaf9", muted: "#a8a29e", mutedDim: "#71706b",
  gold: "#fbbf24", red: "#dc2626",
  green: "#22c55e", greenBg: "rgba(34,197,94,0.12)",
  goldBg: "rgba(251,191,36,0.12)",
  grayBg: "rgba(168,162,158,0.12)",
};

const CATS = [
  { k: "all",   n: "전체" },
  { k: "music", n: "🎵 음원" },
  { k: "sfx",   n: "🔊 효과음" },
  { k: "lut",   n: "🎨 LUT" },
  { k: "font",  n: "🔤 폰트" },
  { k: "video", n: "🎬 스톡영상" },
  { k: "img",   n: "🖼️ 이미지" },
  { k: "tpl",   n: "📦 템플릿" },
  { k: "icon",  n: "🎯 아이콘" },
];

const LIC = {
  free:   { label: "자유 사용",  color: C.green, bg: C.greenBg },
  attr:   { label: "출처표시",   color: C.gold,  bg: C.goldBg },
  signup: { label: "가입/확인",  color: C.muted, bg: C.grayBg },
};

// kr: 한국 리소스 표시
const RESOURCES = [
  // 🎵 음원
  { cat: "music", name: "YouTube 오디오 보관함", desc: "유튜브 크리에이터용 무료 BGM·효과음", url: "https://studio.youtube.com", lic: "attr" },
  { cat: "music", name: "Pixabay Music", desc: "상업적 사용 가능한 무료 음원, 출처표시 불필요", url: "https://pixabay.com/music/", lic: "free" },
  { cat: "music", name: "공유마당 음원", desc: "한국저작권위원회 공유 음원·국악 (CC·공공누리)", url: "https://gongu.copyright.or.kr/", lic: "attr", kr: true },
  { cat: "music", name: "Free Music Archive", desc: "CC 라이선스 음원 (곡별 조건 확인)", url: "https://freemusicarchive.org/", lic: "attr" },
  { cat: "music", name: "Bensound", desc: "무료(출처표시) BGM, 일부 유료", url: "https://www.bensound.com/", lic: "attr" },

  // 🔊 효과음
  { cat: "sfx", name: "Freesound", desc: "방대한 효과음, CC 혼재(곡별 확인 필수)", url: "https://freesound.org/", lic: "attr" },
  { cat: "sfx", name: "Pixabay 효과음", desc: "무료 효과음, 상업적 사용 가능", url: "https://pixabay.com/sound-effects/", lic: "free" },
  { cat: "sfx", name: "Zapsplat", desc: "대량 효과음, 무료(출처표시)/유료", url: "https://www.zapsplat.com/", lic: "attr" },
  { cat: "sfx", name: "Mixkit Sound Effects", desc: "무료 효과음", url: "https://mixkit.co/free-sound-effects/", lic: "free" },

  // 🎨 LUT
  { cat: "lut", name: "FreshLUTs", desc: "무료 시네마틱 LUT 모음 (라이선스 개별 확인)", url: "https://freshluts.com/", lic: "signup" },
  { cat: "lut", name: "RocketStock 무료 LUT", desc: "입문용 무료 LUT 팩 (이메일 가입)", url: "https://www.rocketstock.com/free-after-effects-templates/35-free-luts-for-color-grading-videos/", lic: "signup" },
  { cat: "lut", name: "Lutify.me 무료 샘플", desc: "무료 LUT 샘플팩 (가입)", url: "https://lutify.me/free-luts/", lic: "signup" },

  // 🔤 폰트
  { cat: "font", name: "눈누 (noonnu)", desc: "상업용 무료 한글 폰트 총집합 (폰트별 조건 확인) ★", url: "https://noonnu.cc/", lic: "attr", kr: true },
  { cat: "font", name: "Google Fonts", desc: "무료 영문·한글 웹폰트 (OFL/Apache)", url: "https://fonts.google.com/", lic: "free" },
  { cat: "font", name: "배달의민족 글꼴", desc: "우아한형제들 무료 폰트", url: "https://www.woowahan.com/fonts", lic: "attr", kr: true },
  { cat: "font", name: "공유마당 폰트", desc: "공공·기증 무료 폰트", url: "https://gongu.copyright.or.kr/", lic: "attr", kr: true },

  // 🎬 스톡영상
  { cat: "video", name: "Pexels Videos", desc: "고화질 무료 스톡 영상, 출처표시 불필요", url: "https://www.pexels.com/videos/", lic: "free" },
  { cat: "video", name: "Pixabay Video", desc: "무료 영상 클립", url: "https://pixabay.com/videos/", lic: "free" },
  { cat: "video", name: "Mixkit", desc: "무료 영상·템플릿·음원", url: "https://mixkit.co/", lic: "free" },
  { cat: "video", name: "Coverr", desc: "무료 배경 영상 클립", url: "https://coverr.co/", lic: "free" },

  // 🖼️ 이미지
  { cat: "img", name: "Unsplash", desc: "고퀄 무료 사진, 상업적 사용 가능", url: "https://unsplash.com/", lic: "free" },
  { cat: "img", name: "Pexels", desc: "무료 사진, 출처표시 불필요", url: "https://www.pexels.com/", lic: "free" },
  { cat: "img", name: "Pixabay", desc: "무료 사진·일러스트·벡터", url: "https://pixabay.com/", lic: "free" },
  { cat: "img", name: "공유마당 이미지", desc: "공공·기증 이미지 (CC 조건 확인)", url: "https://gongu.copyright.or.kr/", lic: "attr", kr: true },

  // 📦 템플릿
  { cat: "tpl", name: "Mixkit Templates", desc: "프리미어·애펙 무료 템플릿", url: "https://mixkit.co/free-premiere-pro-templates/", lic: "free" },
  { cat: "tpl", name: "Motion Array 무료", desc: "무료 템플릿·프리셋 (가입)", url: "https://motionarray.com/browse/?price=free", lic: "signup" },
  { cat: "tpl", name: "Velosofy", desc: "무료 인트로·애펙 템플릿", url: "https://velosofy.com/", lic: "signup" },

  // 🎯 아이콘·그래픽
  { cat: "icon", name: "Tabler Icons", desc: "오픈소스 무료 아이콘 (MIT, 자유)", url: "https://tabler.io/icons", lic: "free" },
  { cat: "icon", name: "Flaticon", desc: "방대한 아이콘, 무료(출처표시)/프리미엄", url: "https://www.flaticon.com/", lic: "attr" },
  { cat: "icon", name: "Icons8", desc: "아이콘·일러스트, 무료(출처표시)", url: "https://icons8.com/", lic: "attr" },
  { cat: "icon", name: "unDraw", desc: "무료 일러스트 (출처표시 불필요)", url: "https://undraw.co/", lic: "free" },
];

export default function ResourceHub({ onBack }) {
  const [active, setActive] = useState("all");
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return RESOURCES.filter(r =>
      (active === "all" || r.cat === active) &&
      (!query || r.name.toLowerCase().includes(query) || r.desc.toLowerCase().includes(query))
    );
  }, [active, q]);

  const open = (url) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
        <button onClick={onBack}
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: C.text, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_GOTHIC, touchAction: "manipulation" }}>
          <span style={{ color: C.gold }}>←</span> 도구
        </button>
        <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>📚 RESOURCES</span>
        <div style={{ width: 60 }} />
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6, marginBottom: 10, WebkitOverflowScrolling: "touch" }}>
        {CATS.map(c => {
          const on = active === c.k;
          return (
            <button key={c.k} onClick={() => setActive(c.k)}
              style={{ padding: "8px 12px", minHeight: 36, background: on ? C.gold : C.surface, color: on ? "#0a0a0a" : C.muted, border: `1px solid ${on ? C.gold : C.border}`, borderRadius: 6, fontSize: 12, fontWeight: on ? 800 : 700, fontFamily: FONT_MONO, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, touchAction: "manipulation" }}>
              {c.n}
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 리소스 검색..."
        style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontFamily: FONT_GOTHIC, padding: "10px 12px", borderRadius: 8, outline: "none", marginBottom: 12 }} />

      {/* 라이선스 안내 */}
      <div style={{ background: "#16130d", border: `1px dashed ${C.gold}`, borderRadius: 6, padding: "9px 11px", marginBottom: 14, fontSize: 10.5, color: "#d6d3d1", lineHeight: 1.55 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: C.gold, letterSpacing: "0.2em", fontWeight: 700 }}>⚠ 라이선스 확인</span><br />
        졸업작품·상영용 등 <strong style={{ color: C.text }}>상업적 사용 시</strong> 반드시 각 사이트에서 라이선스를 확인하세요. 라이선스는 변경될 수 있어요.
      </div>

      {/* 리소스 목록 */}
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: C.mutedDim, fontSize: 13 }}>검색 결과가 없습니다</div>
      ) : (
        items.map((r, i) => {
          const lic = LIC[r.lic];
          return (
            <div key={i} onClick={() => open(r.url)}
              style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 13px", marginBottom: 7, cursor: "pointer", touchAction: "manipulation" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                  {r.name}
                  {r.kr && <span style={{ fontSize: 8, fontFamily: FONT_MONO, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 3, padding: "0 3px", fontWeight: 700 }}>KR</span>}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4, background: lic.bg, color: lic.color, whiteSpace: "nowrap", fontFamily: FONT_MONO }}>{lic.label}</span>
              <span style={{ color: C.mutedDim, fontSize: 14 }}>↗</span>
            </div>
          );
        })
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}
