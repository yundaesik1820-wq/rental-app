import { useState, useRef } from "react";
import { C } from "../../theme";
import { Card, Btn, PageTitle, Modal } from "../../components/UI";

// ── 상수 ────────────────────────────────────────────────────────
const PROXY        = "https://corsproxy.io/?";
const CLAUDE_MODEL = "claude-sonnet-4-5";

const KIN_KEYWORDS = [
  "영상계열","한국방송예술진흥원","한예진 영상계열",
  "영상편집 취업","영상편집 진학","방송영상 학과","영상연출과","영상촬영 진로",
];
const KIN_FILTER = [
  "영상","방송","촬영","편집","연출","영화","미디어","콘텐츠","크리에이터",
  "유튜브","쇼츠","한예진","한국방송","방송영상","영상제작","영상디자인",
  "진로","학과","입시","전공","취업","대학",
];
const CAFE_CATS = [
  { label:"영상연출", query:"영상연출",         count:3 },
  { label:"영상촬영", query:"영상촬영",         count:3 },
  { label:"영상편집", query:"영상편집",         count:3 },
  { label:"유튜브",   query:"유튜브 크리에이터", count:3 },
  { label:"영화",     query:"영화 산업",        count:3 },
  { label:"디자인",   query:"영상디자인",       count:3 },
  { label:"작가",     query:"방송작가",         count:6 },
];
const ACT_TYPES  = ["수업/실습","촬영현장","행사/특강","작품발표","동아리","졸업작품"];
const TONE_OPTS  = ["친절·상세","선배 말투","전문적","핵심만"];
const TONE_MAP   = { "친절·상세":"친절하고 상세하게","선배 말투":"선배처럼 편하게","전문적":"전문적이고 신뢰감 있게","핵심만":"짧고 핵심만" };
const TABS       = [
  { id:"activity", label:"📸 재학생 활동" },
  { id:"kin",      label:"💬 지식인 답변" },
  { id:"cafe",     label:"📰 카페 스크랩" },
];

// ── 유틸 ────────────────────────────────────────────────────────
const cleanHtml = s =>
  (s||"").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
         .replace(/&gt;/g,">").replace(/&quot;/g,'"').trim();
const fmtDate = s => {
  try { return new Date(s).toLocaleDateString("ko-KR",{year:"2-digit",month:"2-digit",day:"2-digit"}); }
  catch { return ""; }
};

async function naverSearch(endpoint, query, display) {
  const params = new URLSearchParams({ endpoint, query, display, sort:"date" });
  const res  = await fetch("/api/naver?" + params.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.items || [];
}

async function callClaude(messages) {
  const res  = await fetch("/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model:CLAUDE_MODEL, max_tokens:1000, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  if (!res.ok)    throw new Error("API 오류 " + res.status);
  return data.content?.[0]?.text || "";
}

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

// ── 공통 컴포넌트 ────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>{children}</div>
);

const CopyBtn = ({ tag, text, copied, onCopy, label="복사" }) => (
  <button onClick={() => onCopy(tag, text)} style={{
    background: copied===tag ? C.greenLight : C.bg,
    color:      copied===tag ? C.green : C.muted,
    border:`1px solid ${copied===tag ? C.green : C.border}`,
    borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:600,
    cursor:"pointer", fontFamily:"inherit", transition:"all .15s",
  }}>{copied===tag ? "✓ 복사됨" : label}</button>
);

const ChipGroup = ({ options, value, onChange }) => (
  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
    {options.map(opt => (
      <button key={opt} onClick={() => onChange(opt)} style={{
        padding:"5px 14px", borderRadius:20, fontSize:12, fontFamily:"inherit", cursor:"pointer",
        border:`1.5px solid ${value===opt ? C.navy : C.border}`,
        background: value===opt ? C.navy : C.bg,
        color:      value===opt ? "#fff"  : C.muted,
        fontWeight: value===opt ? 700 : 400,
        transition:"all .15s",
      }}>{opt}</button>
    ))}
  </div>
);

const FieldBox = ({ children, mono }) => (
  <div style={{
    background:C.bg, border:`1px solid ${C.border}`, borderRadius:10,
    padding:"12px 14px", fontSize:13, color:C.text, lineHeight:1.75,
    whiteSpace:"pre-wrap", wordBreak:"break-all",
    fontFamily: mono ? "monospace" : "inherit",
  }}>{children}</div>
);

// ════════════════════════════════════════════════════════════════
// 탭 1 — 재학생 활동
// ════════════════════════════════════════════════════════════════
function ActivityTab() {
  const [actType,   setActType]   = useState("수업/실습");
  const [memo,      setMemo]      = useState("");
  const [imgB64,    setImgB64]    = useState(null);
  const [imgType,   setImgType]   = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const { copied, copy } = useCopy();
  const fileRef = useRef();

  const handleFile = file => {
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      setPreview(e.target.result);
      const [,b64] = e.target.result.split(",");
      setImgB64(b64); setImgType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    setLoading(true); setResult(null);
    const memoLine = memo ? ("\n추가 정보: " + memo) : "";
    const prompt = "한국방송예술진흥원(한예진) 영상계열 재학생 활동 게시판에 올릴 글을 작성해줘.\n"
      + "활동 유형: " + actType + memoLine + "\n"
      + "[제목]\n(간결하고 생동감 있는 제목, 20자 이내, 이모지 1개 포함)\n"
      + "[본문]\n(3~5문장. 영상계열 재학생 시각에서 현장감 있게. 마지막에 해시태그 5개: #한예진 #한국방송예술진흥원 #영상계열 포함 2개 추가)\n"
      + "위 형식 그대로만 출력해줘.";
    try {
      const text = await callClaude([{ role:"user", content:[
        { type:"image", source:{ type:"base64", media_type:imgType, data:imgB64 } },
        { type:"text",  text: prompt }
      ]}]);
      const tM = text.match(/\[제목\]\s*([\s\S]*?)\s*\[본문\]/);
      const bM = text.match(/\[본문\]\s*([\s\S]*)/);
      setResult({ title: tM?.[1]?.trim()||"", body: bM?.[1]?.trim()||text });
    } catch(e) {
      alert("AI 오류: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start" }}>
      {/* 왼쪽 */}
      <Card>
        <SectionLabel>사진 업로드</SectionLabel>
        <div
          onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          style={{ border:`1.5px dashed ${preview ? C.navy : C.border}`, borderRadius:10,
            background:C.bg, cursor:"pointer", overflow:"hidden",
            minHeight: preview ? "auto" : 100, display:"flex", alignItems:"center", justifyContent:"center",
            marginBottom:14, transition:"border .2s" }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
            onChange={e => handleFile(e.target.files[0])} />
          {preview
            ? <img src={preview} alt="미리보기" style={{ width:"100%", maxHeight:180, objectFit:"cover", display:"block" }} />
            : <div style={{ textAlign:"center", padding:"24px 16px" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>🖼️</div>
                <div style={{ fontSize:13, color:C.muted }}>클릭하거나 드래그로 사진 업로드</div>
              </div>
          }
        </div>

        <div style={{ background:C.blueLight, borderRadius:8, padding:"6px 12px", marginBottom:14,
          fontSize:12, color:C.blue, fontWeight:600 }}>📍 영상계열 고정</div>

        <SectionLabel>활동 유형</SectionLabel>
        <div style={{ marginBottom:14 }}>
          <ChipGroup options={ACT_TYPES} value={actType} onChange={setActType} />
        </div>

        <SectionLabel>추가 메모 <span style={{ fontWeight:400, color:C.muted }}>(선택 · AI 글쓰기 힌트)</span></SectionLabel>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="예: 1학기 야외촬영 실습, 한강 로케이션…"
          style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`,
            borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit",
            outline:"none", resize:"none", height:64, boxSizing:"border-box", marginBottom:14 }} />

        <Btn onClick={generate} color={C.navy} full disabled={!imgB64||loading}>
          {loading ? "⏳ AI 생성 중..." : "✨ AI 글 생성"}
        </Btn>
      </Card>

      {/* 오른쪽 */}
      <Card>
        <SectionLabel>생성 결과</SectionLabel>
        {!result && !loading && (
          <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:"40px 0" }}>
            사진을 올리고 AI 글 생성을 누르세요
          </div>
        )}
        {loading && (
          <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:"40px 0" }}>
            ⏳ 사진 분석 중...
          </div>
        )}
        {result && (
          <>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <SectionLabel>제목</SectionLabel>
                <CopyBtn tag="title" text={result.title} copied={copied} onCopy={copy} />
              </div>
              <FieldBox>{result.title}</FieldBox>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <SectionLabel>본문</SectionLabel>
                <CopyBtn tag="body" text={result.body} copied={copied} onCopy={copy} />
              </div>
              <FieldBox>{result.body}</FieldBox>
            </div>
            <Btn color={C.green} full onClick={() => copy("all", result.title+"\n\n"+result.body)}>
              {copied==="all" ? "✓ 복사됨" : "📋 제목 + 본문 전체 복사"}
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 탭 2 — 지식인
// ════════════════════════════════════════════════════════════════
function KinTab({ cid, csec }) {
  const [questions, setQuestions] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [tone,      setTone]      = useState("친절·상세");
  const [fetching,  setFetching]  = useState(false);
  const [genLoading,setGenLoading]= useState(false);
  const [answer,    setAnswer]    = useState("");
  const { copied, copy } = useCopy();

  const fetchAll = async () => {
    
    setFetching(true); setQuestions([]); setSelected(null); setAnswer("");
    const seen = new Set(), all = [];
    for (const kw of KIN_KEYWORDS) {
      try {
        const items = await naverSearch("kin", kw, 15);
        for (const item of items) {
          const url   = item.link||"";
          const title = cleanHtml(item.title||"");
          if (seen.has(url)||!KIN_FILTER.some(k=>title.includes(k))) continue;
          seen.add(url);
          all.push({ keyword:kw, title, date:item.pubDate||"", url });
        }
      } catch {}
    }
    all.sort((a,b) => new Date(b.date)-new Date(a.date));
    setQuestions(all);
    setFetching(false);
  };

  const generate = async () => {
    setGenLoading(true); setAnswer("");
    const text = await callClaude([{ role:"user", content:
      `너는 한국방송예술진흥원(한예진) 관계자야. 아래 질문에 답변을 작성해줘.
[질문] ${selected.title}
[가이드] 톤: ${TONE_MAP[tone]} / 영상·방송 진로 관련이면 한예진 자연스럽게 소개 / 4년제 학사, 32년 전통, 수능·내신 미반영, 방송계 취업 우수 / 광고처럼 보이지 않게 / 500자 이내
답변만 바로 시작해줘.`
    }]).catch(e => { alert("오류: "+e.message); return ""; });
    setAnswer(text);
    setGenLoading(false);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:16, alignItems:"start" }}>
      {/* 목록 */}
      <div>
        <Card style={{ marginBottom:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <SectionLabel>질문 목록</SectionLabel>
            <span style={{ fontSize:11, color:C.muted }}>{questions.length}개</span>
          </div>
          <Btn onClick={fetchAll} color={C.blue} full disabled={fetching}>
            {fetching ? "⏳ 수집 중..." : "🔍 질문 자동 수집"}
          </Btn>
        </Card>
        <div style={{ marginTop:8, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", background:"#fff" }}>
          {!questions.length
            ? <div style={{ padding:"24px 16px", textAlign:"center", fontSize:13, color:C.muted, lineHeight:1.8 }}>
                API 키 설정 후<br/>질문 수집을 눌러주세요
              </div>
            : questions.map((q,i) => (
              <div key={i} onClick={() => { setSelected(q); setAnswer(""); }}
                style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, cursor:"pointer",
                  background: selected===q ? C.blueLight : "#fff",
                  borderLeft: `3px solid ${selected===q ? C.blue : "transparent"}`,
                  transition:"background .15s" }}>
                <div style={{ fontSize:10, color:C.blue, fontWeight:700, marginBottom:2 }}>{q.keyword}</div>
                <div style={{ fontSize:12, color:C.text, lineHeight:1.4, marginBottom:2 }}>{q.title}</div>
                <div style={{ fontSize:10, color:C.muted }}>{fmtDate(q.date)}</div>
              </div>
            ))
          }
        </div>
      </div>

      {/* 오른쪽 */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <Card>
          {selected
            ? <>
                <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:8, lineHeight:1.5 }}>{selected.title}</div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ background:C.blueLight, color:C.blue, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:600 }}>{selected.keyword}</span>
                  <a href={selected.url} target="_blank" rel="noreferrer"
                    style={{ fontSize:12, color:C.blue, textDecoration:"none", fontWeight:600 }}>지식인에서 보기 →</a>
                </div>
              </>
            : <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:"8px 0" }}>← 왼쪽에서 질문을 선택하세요</div>
          }
        </Card>

        <Card>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, fontWeight:600, color:C.text }}>답변 톤</span>
            <ChipGroup options={TONE_OPTS} value={tone} onChange={setTone} />
          </div>
          <Btn onClick={generate} color={C.navy} full disabled={!selected||genLoading}>
            {genLoading ? "⏳ 작성 중..." : "✨ 답변 생성"}
          </Btn>

          {answer && (
            <div style={{ marginTop:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <SectionLabel>생성된 답변</SectionLabel>
                <CopyBtn tag="ans" text={answer} copied={copied} onCopy={copy} />
              </div>
              <FieldBox>{answer}</FieldBox>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <Btn color={C.green} full onClick={() => { copy("ans2",answer); selected && window.open(selected.url,"_blank"); }}>
                  {copied==="ans2" ? "✓ 복사됨" : "📋 복사 + 지식인 열기"}
                </Btn>
                <Btn color={C.muted} outline onClick={generate}>🔄</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 탭 3 — 카페
// ════════════════════════════════════════════════════════════════
function CafeTab({ cid, csec }) {
  const [articles,  setArticles]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [fetching,  setFetching]  = useState(false);
  const [progress,  setProgress]  = useState({ step:0, label:"" });
  const { copied, copy } = useCopy();

  const fetchAll = async () => {
    
    setFetching(true); setArticles([]); setSelected(null);
    const all = [];
    for (let i=0; i<CAFE_CATS.length; i++) {
      const cat = CAFE_CATS[i];
      setProgress({ step:i+1, label:`[${i+1}/${CAFE_CATS.length}] ${cat.label} 수집 중...` });
      try {
        const items = await naverSearch("news", cat.query, cat.count, cid, csec);
        for (const item of items) {
          all.push({
            cat:   cat.label,
            title: cleanHtml(item.title||""),
            desc:  cleanHtml(item.description||""),
            url:   item.originallink||item.link,
            date:  item.pubDate||"",
          });
        }
      } catch {}
    }
    setArticles(all);
    setFetching(false);
    setProgress({ step:0, label:"" });
  };

  const catGroups = CAFE_CATS
    .map(c => ({ ...c, items: articles.filter(a => a.cat===c.label) }))
    .filter(c => c.items.length);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:16, alignItems:"start" }}>
      {/* 왼쪽 목록 */}
      <div>
        <Card style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <SectionLabel>기사 목록</SectionLabel>
            <span style={{ fontSize:11, color:C.muted }}>{articles.length}/24</span>
          </div>
          <Btn onClick={fetchAll} color={C.green} full disabled={fetching}>
            {fetching ? "⏳ 수집 중..." : "📰 기사 자동 수집"}
          </Btn>
          {fetching && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{progress.label}</div>
              <div style={{ height:5, background:C.border, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", background:C.green, borderRadius:3,
                  width:`${(progress.step/CAFE_CATS.length)*100}%`, transition:"width .3s" }} />
              </div>
            </div>
          )}
        </Card>
        <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", background:"#fff" }}>
          {!catGroups.length
            ? <div style={{ padding:"24px 16px", textAlign:"center", fontSize:13, color:C.muted, lineHeight:1.8 }}>
                API 키 설정 후<br/>기사 수집을 눌러주세요
              </div>
            : catGroups.map(cat => (
              <div key={cat.label}>
                <div style={{ padding:"6px 14px", background:C.bg, borderBottom:`1px solid ${C.border}`,
                  fontSize:11, fontWeight:700, color:C.navy, display:"flex", justifyContent:"space-between" }}>
                  {cat.label} <span style={{ color:C.muted, fontWeight:400 }}>{cat.items.length}개</span>
                </div>
                {cat.items.map((art,j) => (
                  <div key={j} onClick={() => setSelected(art)}
                    style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, cursor:"pointer",
                      background: selected===art ? C.greenLight : "#fff",
                      borderLeft: `3px solid ${selected===art ? C.green : "transparent"}`,
                      transition:"background .15s" }}>
                    <div style={{ fontSize:12, color:C.text, lineHeight:1.4, marginBottom:2 }}>{art.title}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{fmtDate(art.date)}</div>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      </div>

      {/* 오른쪽 포스트 */}
      <Card>
        {!selected
          ? <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:"40px 0", lineHeight:1.8 }}>
              ← 왼쪽에서 기사를 선택하면<br/>카페 포스트가 자동으로 완성됩니다
            </div>
          : <>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
                <span style={{ background:C.greenLight, color:C.green, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{selected.cat}</span>
                <span style={{ fontSize:11, color:C.muted }}>{fmtDate(selected.date)}</span>
                <a href={selected.url} target="_blank" rel="noreferrer"
                  style={{ fontSize:12, color:C.blue, textDecoration:"none", fontWeight:600 }}>원문 보기 →</a>
              </div>

              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <SectionLabel>카페 제목</SectionLabel>
                  <CopyBtn tag="ctitle" text={selected.title} copied={copied} onCopy={copy} />
                </div>
                <FieldBox>{selected.title}</FieldBox>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <SectionLabel>카페 본문</SectionLabel>
                  <CopyBtn tag="cbody" text={selected.desc+"\n\n"+selected.url} copied={copied} onCopy={copy} />
                </div>
                <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"12px 14px", fontSize:13, color:C.text, lineHeight:1.75,
                  whiteSpace:"pre-wrap", wordBreak:"break-all", minHeight:140 }}>
                  {selected.desc}
                  {"\n\n"}
                  <span style={{ color:C.blue }}>{selected.url}</span>
                </div>
              </div>

              <Btn color={C.green} full
                onClick={() => copy("call", selected.title+"\n\n"+selected.desc+"\n\n"+selected.url)}>
                {copied==="call" ? "✓ 복사됨" : "📋 제목 + 본문 전체 복사"}
              </Btn>
            </>
        }
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 메인
// ════════════════════════════════════════════════════════════════
export default function SNSManager() {
  const [tab,       setTab]       = useState("activity");
  const [showModal, setShowModal] = useState(false);
  const [inputId,   setInputId]   = useState("");
  const [inputSec,  setInputSec]  = useState("");
  const [cid,       setCid]       = useState("");
  const [csec,      setCsec]      = useState("");

  const saveKey = () => { setCid(inputId.trim()); setCsec(inputSec.trim()); setShowModal(false); };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>SNS 관리</PageTitle>
        {tab!=="activity" && (
          <Btn onClick={() => setShowModal(true)} color={cid ? C.green : C.muted} outline small>
            {cid ? "✅ API 키 설정됨" : "🔑 API 키 설정"}
          </Btn>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display:"flex", gap:4, marginBottom:20, background:C.bg,
        border:`1px solid ${C.border}`, borderRadius:12, padding:4, alignSelf:"flex-start",
        width:"fit-content" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"8px 20px", borderRadius:9, border:"none", fontSize:13, fontWeight:600,
            fontFamily:"inherit", cursor:"pointer", transition:"all .15s",
            background: tab===t.id ? C.navy : "transparent",
            color:      tab===t.id ? "#fff"  : C.muted,
          }}>{t.label}</button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {tab==="activity" && <ActivityTab />}
      {tab==="kin"      && <KinTab  cid={cid} csec={csec} />}
      {tab==="cafe"     && <CafeTab cid={cid} csec={csec} />}

      {/* API 키 모달 */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} width={440}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>🔑 네이버 API 키 설정</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:18, lineHeight:1.7 }}>
            지식인·카페 탭 공통 키입니다.<br/>한 번만 입력하면 됩니다.
          </div>
          {[["Client ID","text",inputId,setInputId,"네이버 Client ID"],
            ["Client Secret","password",inputSec,setInputSec,"네이버 Client Secret"]
          ].map(([label,type,val,set,ph]) => (
            <div key={label} style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>{label}</div>
              <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`,
                  borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13,
                  fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
          ))}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <Btn onClick={() => setShowModal(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={saveKey} color={C.navy} full disabled={!inputId.trim()||!inputSec.trim()}>저장</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
