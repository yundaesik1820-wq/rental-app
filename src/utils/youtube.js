// YouTube URL을 임베드용 URL로 변환
// 지원 형식: watch?v=, youtu.be/, embed/, shorts/
export function youtubeEmbedUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
    /youtube\.com\/embed\/([\w-]+)/,
    /youtube\.com\/shorts\/([\w-]+)/,
    /youtube\.com\/live\/([\w-]+)/,
  ];
  for (const p of patterns) {
    const m = u.match(p);
    if (m && m[1]) return `https://www.youtube.com/embed/${m[1]}`;
  }
  return null;
}

// 유효한 YouTube URL인지 확인
export function isValidYoutubeUrl(url) {
  return youtubeEmbedUrl(url) !== null;
}
