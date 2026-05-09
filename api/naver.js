export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { endpoint, query, display, sort } = req.query;
  if (!endpoint || !query) return res.status(400).json({ error: "missing params" });

  const url = `https://openapi.naver.com/v1/search/${endpoint}.json?query=${encodeURIComponent(query)}&display=${display||10}&sort=${sort||"date"}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id":     process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
      },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
