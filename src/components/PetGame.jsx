import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { C } from "../theme";

/* ============================================================
   펫 키우기 (다마고치) — 1단계 MVP
   저장: users/{uid}.pet (계정당 1마리)
   알 → 유년기(baby) → 성장기(juvenile) → 성체(adult)
   ============================================================ */

const SPECIES = ["dog", "cat", "dragon", "fox", "otter", "penguin"];
const SPECIES_KR = { dog:"강아지", cat:"고양이", dragon:"용", fox:"여우", otter:"수달", penguin:"펭귄" };

// 등급: 확률 + 경험치 보너스
const RARITY = {
  common: { kr:"일반", color:"#9ca3af", bonus:1.0,  weight:60 },
  rare:   { kr:"레어", color:"#378add", bonus:1.2,  weight:25 },
  epic:   { kr:"에픽", color:"#9d4edd", bonus:1.5,  weight:12 },
  legend: { kr:"전설", color:"#fbbf24", bonus:2.0,  weight:3  },
};

// 단계별 누적 EXP 요구치
const STAGE_REQ = { egg:100, baby:400, juvenile:1200 }; // 다음 단계로 가는 누적 기준
const STAGE_ORDER = ["egg", "baby", "juvenile", "adult"];
const STAGE_KR = { egg:"알", baby:"유년기", juvenile:"성장기", adult:"성체" };

const QUEST_MAX = 5;       // 각 퀘스트 하루 5회
const QUEST_EXP = 10;      // 성공 시 기본 경험치
const QUIZ_EXP  = 30;      // 오늘의 퀴즈 정답 시 기본 경험치
const QUEST_SUCCESS = 0.9; // 90% 성공

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

function rollRarity() {
  const total = Object.values(RARITY).reduce((s,r)=>s+r.weight,0);
  let n = Math.random() * total;
  for (const [key, r] of Object.entries(RARITY)) { if ((n -= r.weight) < 0) return key; }
  return "common";
}
const rollSpecies = () => SPECIES[Math.floor(Math.random() * SPECIES.length)];

// 현재 단계 계산 (누적 exp 기준)
function stageFromExp(exp) {
  if (exp < STAGE_REQ.egg) return "egg";
  if (exp < STAGE_REQ.baby) return "baby";
  if (exp < STAGE_REQ.juvenile) return "juvenile";
  return "adult";
}
// 다음 단계까지 진행률
function stageProgress(exp) {
  const stage = stageFromExp(exp);
  if (stage === "egg")      return { cur: exp, need: STAGE_REQ.egg, base: 0 };
  if (stage === "baby")     return { cur: exp - STAGE_REQ.egg, need: STAGE_REQ.baby - STAGE_REQ.egg, base: STAGE_REQ.egg };
  if (stage === "juvenile") return { cur: exp - STAGE_REQ.baby, need: STAGE_REQ.juvenile - STAGE_REQ.baby, base: STAGE_REQ.baby };
  return { cur: 1, need: 1, base: 0 }; // adult = 만렙
}

// ── 성체 레벨 시스템 ──
const MAX_LEVEL = 100;
const ADULT_BASE = STAGE_REQ.juvenile; // 성체 진입 누적 EXP (= 1200)
// Lv.N → N+1 필요 EXP = 200 + (N-1)*60  (점증)
function levelReq(level) { return 200 + (level - 1) * 60; }
// 성체 진입 후 쌓은 EXP(adultExp)로 현재 레벨 + 진행도 계산
function levelFromAdultExp(adultExp) {
  let lvl = 1, remain = adultExp;
  while (lvl < MAX_LEVEL) {
    const req = levelReq(lvl);
    if (remain < req) break;
    remain -= req; lvl++;
  }
  if (lvl >= MAX_LEVEL) return { level: MAX_LEVEL, cur: 0, need: 0, max: true };
  return { level: lvl, cur: remain, need: levelReq(lvl), max: false };
}

// ── 배틀 스탯 계산 (레벨 + 등급 기반) ──
function petLevel(pet) {
  if (!pet || stageFromExp(pet.exp) !== "adult") return 1;
  return levelFromAdultExp(pet.exp - ADULT_BASE).level;
}
function battleStats(pet) {
  const lvl = petLevel(pet);
  const bonus = RARITY[pet.rarity]?.bonus || 1;
  return {
    maxHp: Math.round((60 + lvl * 8) * (0.9 + bonus * 0.1)),  // 등급 높을수록 체력↑
    atk:   Math.round((12 + lvl * 2) * (0.9 + bonus * 0.1)),  // 등급 높을수록 공격↑
    level: lvl,
  };
}
const rngBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 펫 이미지 경로
function petImg(pet) {
  if (!pet) return null;
  const stage = stageFromExp(pet.exp);
  if (stage === "egg") return `/pets/egg_${pet.rarity}.png`;
  return `/pets/${pet.species}_${stage}.png`;
}

/* ============================================================
   홈 화면 요약 카드 (푸른 박스 아래에 들어감)
   ============================================================ */
export function PetHomeCard({ uid, onOpen }) {
  const [pet, setPet] = useState(undefined); // undefined=로딩, null=없음

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      setPet(snap.exists() && snap.data().pet ? snap.data().pet : null);
    } catch (e) { setPet(null); }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  if (pet === undefined) return null; // 로딩 중엔 안 보임

  // 펫 없음 → 알 받기 유도 카드
  if (!pet) {
    return (
      <div onClick={onOpen}
        style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"14px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
        <div style={{ width:56, height:56, background:C.bg, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>🥚</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.text }}>나만의 펫 키우기</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>알을 받아 부화시켜보세요!</div>
        </div>
        <div style={{ fontSize:12, color:"#fff", background:C.navy, borderRadius:8, padding:"7px 12px", fontWeight:700 }}>시작</div>
      </div>
    );
  }

  const stage = stageFromExp(pet.exp);
  const prog = stageProgress(pet.exp);
  const rarity = RARITY[pet.rarity] || RARITY.common;
  const pct = Math.min(100, Math.round((prog.cur / prog.need) * 100));
  const label = stage === "egg"
    ? `${rarity.kr} 알`
    : `${pet.name || SPECIES_KR[pet.species]}`;

  return (
    <div onClick={onOpen}
      style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
      <div style={{ width:60, height:60, background:C.bg, border:`2px solid ${rarity.color}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
        <img src={petImg(pet)} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", imageRendering:"pixelated" }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</span>
          <span style={{ fontSize:10, color:rarity.color, border:`1px solid ${rarity.color}`, borderRadius:4, padding:"1px 5px", flexShrink:0 }}>{rarity.kr}</span>
        </div>
        <div style={{ fontSize:11, color:C.muted, margin:"5px 0 4px" }}>
          {stage === "adult" ? "다 자랐어요! 🎉" : `${STAGE_KR[stage]} · ${prog.cur} / ${prog.need} EXP`}
        </div>
        <div style={{ height:6, background:C.bg, borderRadius:3, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", background:rarity.color }} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   전체화면 오버레이 — 펫 상세 + 퀘스트
   ============================================================ */
export function PetOverlay({ uid, onClose, friends = [] }) {
  const [pet, setPet] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);     // {msg, good}
  const [naming, setNaming] = useState(false);   // 부화 직후 이름짓기
  const [nameInput, setNameInput] = useState("");
  const [justHatched, setJustHatched] = useState(null); // 부화 연출용 species
  const [battlePick, setBattlePick] = useState(false);  // 상대 선택 모달
  const [battleOpp, setBattleOpp] = useState(null);     // 선택된 상대 {uid, name, pet}
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [quiz, setQuiz] = useState(undefined);          // 오늘의 퀴즈 (undefined=로딩, null=없음)
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizPick, setQuizPick] = useState(null);       // 고른 보기 인덱스
  const [quizResult, setQuizResult] = useState(null);   // {correct, answer}

  const load = useCallback(async () => {
    const snap = await getDoc(doc(db, "users", uid));
    const p = snap.exists() && snap.data().pet ? snap.data().pet : null;
    setPet(p);
    // 오늘의 퀴즈 로드
    try {
      const qs = await getDoc(doc(db, "quizzes", todayStr()));
      setQuiz(qs.exists() ? qs.data() : null);
    } catch (e) { setQuiz(null); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  // 오늘 퀴즈 이미 풀었는지 (pet에 기록)
  const quizDoneToday = pet && pet.lastQuizDate === todayStr();

  // 퀴즈 정답 제출
  const submitQuiz = async () => {
    if (quizPick == null || !quiz || busy) return;
    setBusy(true);
    const correct = quizPick === quiz.answer;
    const bonus = RARITY[pet.rarity]?.bonus || 1;
    const gain = correct ? Math.round(QUIZ_EXP * bonus) : 0;

    const prevStage = stageFromExp(pet.exp);
    const newExp = pet.exp + gain;
    const newStage = stageFromExp(newExp);

    let updated = { ...pet, exp:newExp, lastQuizDate: todayStr() };
    // 퀴즈로 부화하는 경우도 처리
    let hatched = false;
    if (prevStage === "egg" && newStage !== "egg" && !pet.species) {
      updated.species = rollSpecies();
      hatched = true;
    }
    await updateDoc(doc(db, "users", uid), { pet: updated });
    setPet(updated);
    setQuizResult({ correct, answer: quiz.answer });
    setBusy(false);

    if (hatched) {
      setTimeout(() => { setQuizOpen(false); setJustHatched(updated.species); setNaming(true); }, 1400);
    } else if (newStage !== prevStage) {
      setTimeout(() => { setQuizOpen(false); showToast(`${STAGE_KR[newStage]}(으)로 성장했어요! 🎉`); }, 1400);
    }
  };

  const showToast = (msg, good=true) => { setToast({ msg, good }); setTimeout(()=>setToast(null), 1800); };

  // 오늘 퀘스트 횟수 (날짜 바뀌면 0)
  const questUsed = (p, key) => (p.lastQuestDate === todayStr() ? (p.quests?.[key] || 0) : 0);

  // 알 받기
  const getEgg = async () => {
    setBusy(true);
    const newPet = {
      rarity: rollRarity(), species: null, name: null,
      exp: 0, bornAt: Date.now(), lastQuestDate: todayStr(), quests: { feed:0, play:0 },
    };
    await updateDoc(doc(db, "users", uid), { pet: newPet }).catch(async () => {
      await setDoc(doc(db, "users", uid), { pet: newPet }, { merge:true });
    });
    setPet(newPet);
    setBusy(false);
    showToast(`${RARITY[newPet.rarity].kr} 알을 받았어요!`);
  };

  // 퀘스트 실행 (feed/play)
  const doQuest = async (key) => {
    if (busy || !pet) return;
    const used = questUsed(pet, key);
    if (used >= QUEST_MAX) { showToast("오늘은 다 했어요!", false); return; }
    setBusy(true);

    const success = Math.random() < QUEST_SUCCESS;
    const bonus = RARITY[pet.rarity]?.bonus || 1;
    const gain = success ? Math.round(QUEST_EXP * bonus) : 0;

    const prevStage = stageFromExp(pet.exp);
    const newExp = pet.exp + gain;
    const newStage = stageFromExp(newExp);

    const sameDay = pet.lastQuestDate === todayStr();
    const quests = sameDay ? { ...pet.quests } : { feed:0, play:0 };
    quests[key] = (quests[key] || 0) + 1;

    let updated = { ...pet, exp:newExp, lastQuestDate:todayStr(), quests };

    // 알 → 부화 (egg에서 baby로 넘어가는 순간 종 결정)
    let hatched = false;
    if (prevStage === "egg" && newStage !== "egg" && !pet.species) {
      updated.species = rollSpecies();
      hatched = true;
    }

    await updateDoc(doc(db, "users", uid), { pet: updated });
    setPet(updated);
    setBusy(false);

    if (hatched) {
      setJustHatched(updated.species);
      setNaming(true);
    } else if (newStage !== prevStage) {
      showToast(`${STAGE_KR[newStage]}(으)로 성장했어요! 🎉`);
    } else {
      showToast(success ? `+${gain} EXP!` : (key==="feed"?"딴청 부려서 실패…":"안 놀아줬어요…"), success);
    }
  };

  // 이름 저장
  const saveName = async () => {
    const nm = nameInput.trim();
    if (!nm) return;
    const updated = { ...pet, name: nm };
    await updateDoc(doc(db, "users", uid), { pet: updated });
    setPet(updated);
    setNaming(false);
    setNameInput("");
    showToast(`${nm} 탄생! 🎉`);
  };

  // 놓아주기 (확인 2번)
  const releaseStep1 = () => {
    const nm = pet?.name || (pet?.species ? SPECIES_KR[pet.species] : "이 알");
    if (!window.confirm(`정말 ${nm}을(를) 놓아줄까요?\n되돌릴 수 없어요.`)) return;
    if (!window.confirm(`마지막 확인이에요.\n${nm}을(를) 정말 놓아주면 처음부터 다시 시작해요. 진행할까요?`)) return;
    releaseConfirm();
  };
  const releaseConfirm = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", uid), { pet: null });
      setPet(null);
      showToast("펫을 놓아줬어요. 새 알을 받을 수 있어요.");
    } catch (e) { showToast("실패했어요", false); }
    setBusy(false);
  };

  if (pet === undefined) {
    return <Overlay onClose={onClose}><div style={{ color:C.muted, padding:40 }}>불러오는 중...</div></Overlay>;
  }

  // 펫 없음 → 알 받기
  if (!pet) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:64, marginBottom:16 }}>🥚</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>알을 받아볼까요?</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:24, lineHeight:1.6 }}>
            어떤 등급의 알이 나올지 몰라요.<br/>밥을 주고 놀아주며 부화시켜보세요!
          </div>
          <button onClick={getEgg} disabled={busy}
            style={{ background:C.navy, color:"#fff", border:"none", borderRadius:12, padding:"14px 40px", fontSize:15, fontWeight:800, cursor:"pointer" }}>
            {busy ? "..." : "알 받기"}
          </button>
        </div>
      </Overlay>
    );
  }

  const stage = stageFromExp(pet.exp);
  const prog = stageProgress(pet.exp);
  const rarity = RARITY[pet.rarity] || RARITY.common;
  const pct = Math.min(100, Math.round((prog.cur / prog.need) * 100));
  const feedUsed = questUsed(pet, "feed");
  const playUsed = questUsed(pet, "play");
  // 성체 레벨 (성체 진입 누적 EXP 초과분 기준)
  const lv = stage === "adult" ? levelFromAdultExp(pet.exp - ADULT_BASE) : null;
  const lvPct = lv && !lv.max ? Math.min(100, Math.round((lv.cur / lv.need) * 100)) : 100;

  return (
    <Overlay onClose={onClose}>
      {/* 이름짓기 모달 */}
      {naming && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:20, padding:20 }}>
          <div style={{ background:C.surface, borderRadius:18, padding:"28px 24px", maxWidth:320, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:56, marginBottom:8 }}>🎉</div>
            <div style={{ width:96, height:96, margin:"0 auto 12px" }}>
              <img src={`/pets/${justHatched}_baby.png`} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", imageRendering:"pixelated" }} />
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:4 }}>
              {SPECIES_KR[justHatched]}(이)가 태어났어요!
            </div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>이름을 지어주세요</div>
            <input value={nameInput} onChange={e=>setNameInput(e.target.value)} maxLength={12} placeholder="펫 이름"
              style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"11px 14px", fontSize:15, textAlign:"center", outline:"none", boxSizing:"border-box", marginBottom:14, fontFamily:"inherit" }} />
            <button onClick={saveName} disabled={!nameInput.trim()}
              style={{ width:"100%", background:nameInput.trim()?C.navy:C.border, color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:14, fontWeight:800, cursor:nameInput.trim()?"pointer":"default" }}>
              결정!
            </button>
          </div>
        </div>
      )}

      {/* 오늘의 퀴즈 모달 */}
      {quizOpen && quiz && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:25, padding:18 }}>
          <div style={{ background:C.surface, borderRadius:18, padding:"22px 20px", maxWidth:380, width:"100%", maxHeight:"86%", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:13, fontWeight:800, color:C.purple }}>📚 오늘의 퀴즈</span>
              <button onClick={() => setQuizOpen(false)} style={{ background:"none", border:"none", color:C.muted, fontSize:18, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text, lineHeight:1.5, marginBottom:16 }}>{quiz.question}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {quiz.options.map((opt, i) => {
                let bg = C.bg, bd = C.border, tc = C.text;
                if (quizResult) {
                  if (i === quizResult.answer) { bg = C.greenLight; bd = C.green; tc = C.green; }
                  else if (i === quizPick) { bg = C.redLight; bd = C.red; tc = C.red; }
                } else if (i === quizPick) { bg = C.purpleLight; bd = C.purple; tc = C.purple; }
                return (
                  <button key={i} onClick={() => !quizResult && setQuizPick(i)} disabled={!!quizResult}
                    style={{ textAlign:"left", background:bg, border:`1.5px solid ${bd}`, borderRadius:10, padding:"12px 14px", fontSize:14, color:tc, fontWeight: (quizPick===i||quizResult&&i===quizResult.answer)?700:400, cursor: quizResult?"default":"pointer", fontFamily:"inherit", display:"flex", gap:8 }}>
                    <span style={{ fontWeight:800, flexShrink:0 }}>{["①","②","③","④","⑤"][i]}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {!quizResult ? (
              <button onClick={submitQuiz} disabled={quizPick==null || busy}
                style={{ width:"100%", marginTop:16, background: quizPick!=null?C.purple:C.border, color:"#fff", border:"none", borderRadius:10, padding:"13px 0", fontSize:15, fontWeight:800, cursor: quizPick!=null?"pointer":"default" }}>
                제출하기
              </button>
            ) : (
              <div style={{ marginTop:16, textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:800, color: quizResult.correct?C.green:C.red, marginBottom:10 }}>
                  {quizResult.correct ? "정답이에요! 🎉" : "아쉬워요, 오답이에요"}
                </div>
                <button onClick={() => setQuizOpen(false)}
                  style={{ background:C.navy, color:"#fff", border:"none", borderRadius:10, padding:"11px 30px", fontSize:14, fontWeight:800, cursor:"pointer" }}>
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ padding:"8px 20px 32px", textAlign:"center" }}>
        {/* 펫 이미지 */}
        <div style={{ width:180, height:180, margin:"10px auto 0", background:C.bg, border:`3px solid ${rarity.color}`, borderRadius:24, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
          <img src={petImg(pet)} alt="" style={{ width:"86%", height:"86%", objectFit:"contain", imageRendering:"pixelated" }} />
        </div>

        {/* 이름/종/등급 */}
        <div style={{ marginTop:16 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20, fontWeight:800, color:C.text }}>
              {stage === "egg" ? `${rarity.kr} 알` : (pet.name || SPECIES_KR[pet.species])}
            </span>
            <span style={{ fontSize:12, color:rarity.color, border:`1px solid ${rarity.color}`, borderRadius:5, padding:"2px 7px" }}>{rarity.kr}</span>
            {stage === "adult" && lv && (
              <span style={{ fontSize:12, color:"#fff", background:rarity.color, borderRadius:5, padding:"2px 8px", fontWeight:800 }}>Lv.{lv.level}</span>
            )}
          </div>
          {stage !== "egg" && (
            <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>{SPECIES_KR[pet.species]} · {stage === "adult" ? "성체" : STAGE_KR[stage]}</div>
          )}
        </div>

        {/* 경험치 바 */}
        <div style={{ maxWidth:300, margin:"18px auto 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, marginBottom:5 }}>
            <span>{stage === "adult" ? (lv.max ? "만렙!" : `Lv.${lv.level} → ${lv.level+1}`) : `다음 단계까지`}</span>
            <span>{stage === "adult" ? (lv.max ? "🏆" : `${lv.cur} / ${lv.need}`) : `${prog.cur} / ${prog.need}`}</span>
          </div>
          <div style={{ height:10, background:C.bg, borderRadius:5, overflow:"hidden" }}>
            <div style={{ width:`${stage==="adult"?lvPct:pct}%`, height:"100%", background:rarity.color, transition:"width .4s" }} />
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>총 경험치 {pet.exp} · 보너스 ×{rarity.bonus}</div>
        </div>

        {/* 퀘스트 버튼 */}
        <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:28 }}>
          <QuestBtn label="🍖 밥주기" used={feedUsed} max={QUEST_MAX} onClick={()=>doQuest("feed")} disabled={busy} color={C.navy} />
          <QuestBtn label="🎾 놀아주기" used={playUsed} max={QUEST_MAX} onClick={()=>doQuest("play")} disabled={busy} color={C.teal} />
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:14, lineHeight:1.6 }}>
          매일 자정에 횟수가 충전돼요.<br/>밥과 놀이로 경험치를 모아 성장시켜요!
        </div>

        {/* 오늘의 퀴즈 */}
        <div style={{ marginTop:24, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
          {quiz === undefined ? null : !quiz ? (
            <div style={{ fontSize:13, color:C.muted }}>📚 오늘의 퀴즈가 아직 없어요</div>
          ) : quizDoneToday ? (
            <div style={{ fontSize:13, color:C.muted }}>✅ 오늘의 퀴즈를 완료했어요!</div>
          ) : (
            <button onClick={() => { setQuizOpen(true); setQuizPick(null); setQuizResult(null); }}
              style={{ background:C.purple, color:"#fff", border:"none", borderRadius:14, padding:"14px 28px", fontSize:15, fontWeight:800, cursor:"pointer" }}>
              📚 오늘의 퀴즈 풀기 <span style={{ fontSize:12, opacity:0.85 }}>(+{Math.round(QUIZ_EXP*(RARITY[pet.rarity]?.bonus||1))} EXP)</span>
            </button>
          )}
        </div>

        {/* 배틀 (성체부터) — 토대 */}
        {stage !== "egg" && (
          <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
            <button
              onClick={() => {
                if (stage !== "adult") { showToast("성체가 된 이후부터 친구와 배틀이 가능해요!", false); return; }
                if (battleRemaining(pet) <= 0) { showToast("오늘 배틀 횟수를 다 썼어요! (하루 5회)", false); return; }
                setBattlePick(true);
              }}
              style={{ background: stage === "adult" ? C.red : C.border, color:"#fff", border:"none", borderRadius:14, padding:"13px 28px", fontSize:15, fontWeight:800, cursor:"pointer", opacity: stage === "adult" ? 1 : 0.55 }}>
              ⚔️ 배틀하기
            </button>
            {stage !== "adult" && (
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>성체가 되면 친구와 배틀할 수 있어요</div>
            )}
            {stage === "adult" && (
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>오늘 {battleRemaining(pet)}회 배틀 가능 · 친구를 골라 도전하세요!</div>
            )}
          </div>
        )}

        {/* 놓아주기 */}
        <div style={{ marginTop:28 }}>
          <button onClick={releaseStep1}
            style={{ background:"none", border:"none", color:C.muted, fontSize:12, textDecoration:"underline", cursor:"pointer" }}>
            펫 놓아주기
          </button>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{ position:"absolute", bottom:40, left:"50%", transform:"translateX(-50%)", background:toast.good?C.navy:C.red, color:"#fff", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:700, zIndex:30, whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* 배틀 상대 선택 모달 */}
      {battlePick && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:28, padding:18 }}>
          <div style={{ background:C.surface, borderRadius:18, padding:"20px 18px", maxWidth:340, width:"100%", maxHeight:"80%", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:15, fontWeight:800, color:C.text }}>⚔️ 누구랑 배틀할까요?</span>
              <button onClick={() => setBattlePick(false)} style={{ background:"none", border:"none", color:C.muted, fontSize:18, cursor:"pointer" }}>✕</button>
            </div>
            {friends.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"20px 0" }}>아직 친구가 없어요.<br/>친구를 추가하고 배틀해보세요!</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {friends.map(f => (
                  <button key={f.uid} disabled={loadingOpp}
                    onClick={async () => {
                      setLoadingOpp(true);
                      try {
                        const s = await getDoc(doc(db, "users", f.uid));
                        const op = s.exists() && s.data().pet ? s.data().pet : null;
                        if (!op) { showToast(`${f.name}님은 아직 펫이 없어요`, false); setLoadingOpp(false); return; }
                        if (stageFromExp(op.exp) !== "adult") { showToast(`${f.name}님의 펫이 아직 성체가 아니에요`, false); setLoadingOpp(false); return; }
                        setBattleOpp({ uid: f.uid, name: f.name, pet: op });
                        setBattlePick(false);
                      } catch (e) { showToast("불러오기 실패", false); }
                      setLoadingOpp(false);
                    }}
                    style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.text, flex:1 }}>{f.name}</span>
                    <span style={{ fontSize:11, color:C.muted }}>{f.sid}</span>
                    <span style={{ fontSize:12, color:C.red, fontWeight:800 }}>도전 →</span>
                  </button>
                ))}
              </div>
            )}
            {loadingOpp && <div style={{ fontSize:12, color:C.muted, textAlign:"center", marginTop:10 }}>상대 펫 불러오는 중...</div>}
          </div>
        </div>
      )}

      {/* 배틀 화면 */}
      {battleOpp && (
        <BattleScreen uid={uid} myPet={pet} oppPet={battleOpp.pet} oppName={battleOpp.name}
          onClose={() => { setBattleOpp(null); load(); }} />
      )}
    </Overlay>
  );
}

/* ───────── 공통 조각 ───────── */
function Overlay({ children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9600, background:C.bg, display:"flex", flexDirection:"column",
      paddingTop:"calc(env(safe-area-inset-top, 0px) + 0px)" }}>
      <div style={{ flexShrink:0, padding:"calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px", display:"flex", alignItems:"center", borderBottom:`1px solid ${C.border}`, background:C.surface }}>
        <button onClick={onClose} style={{ background:"transparent", border:"none", color:C.text, fontSize:15, fontWeight:700, cursor:"pointer" }}>← 닫기</button>
        <div style={{ flex:1, textAlign:"center", fontSize:15, fontWeight:800, color:C.text, marginRight:48 }}>나의 펫</div>
      </div>
      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", position:"relative" }}>
        {children}
      </div>
    </div>
  );
}

function QuestBtn({ label, used, max, onClick, disabled, color }) {
  const done = used >= max;
  return (
    <button onClick={onClick} disabled={disabled || done}
      style={{ background: done ? C.border : color, color:"#fff", border:"none", borderRadius:14, padding:"14px 20px", fontSize:14, fontWeight:800, cursor: done?"default":"pointer", opacity: done?0.5:1, minWidth:120 }}>
      <div>{label}</div>
      <div style={{ fontSize:11, fontWeight:600, marginTop:4, opacity:0.9 }}>{max - used} / {max} 남음</div>
    </button>
  );
}


/* ============================================================
   외부(에브리타임 등)에서 펫 경험치 적립 — 도배 방지 포함
   activity: "post"(+15, 하루 3회) | "comment"(+5, 하루 5회)
   조용히 실패해도 됨(펫 없으면 무시). 성공 시 적립된 EXP 반환.
   ============================================================ */
const ACTIVITY = {
  post:    { exp: 15, dailyMax: 3 },
  comment: { exp: 5,  dailyMax: 5 },
};
export async function grantPetExp(uid, activity) {
  if (!uid || !ACTIVITY[activity]) return 0;
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists() || !snap.data().pet) return 0;  // 펫 없으면 무시
    const pet = snap.data().pet;
    // 알 단계에서는 활동 경험치 미적립 (부화는 밥/놀기/퀴즈로만 → 종 결정+이름짓기 UI 보장)
    if (stageFromExp(pet.exp || 0) === "egg" || !pet.species) return 0;
    const today = todayStr();
    const conf = ACTIVITY[activity];

    // 오늘 적립 횟수 (날짜 바뀌면 리셋)
    const log = (pet.actLog && pet.actLog.date === today) ? { ...pet.actLog } : { date: today, post: 0, comment: 0 };
    if ((log[activity] || 0) >= conf.dailyMax) return 0;   // 일일 한도 초과 → 적립 안 함
    log[activity] = (log[activity] || 0) + 1;

    const bonus = RARITY[pet.rarity]?.bonus || 1;
    const gain = Math.round(conf.exp * bonus);
    const updated = { ...pet, exp: (pet.exp || 0) + gain, actLog: log };
    // 알 단계에서 활동만으로 부화하지는 않게 — 부화는 밥/놀기/퀴즈에서만 처리하므로
    // 여기선 종 결정 로직 없이 exp만 적립 (egg면 exp만 쌓이고 다음 밥/퀴즈 때 부화 트리거)
    await updateDoc(ref, { pet: updated });
    return gain;
  } catch (e) {
    return 0;  // 조용히 실패
  }
}


/* ============================================================
   친구 펫 보기 (읽기 전용) + 하트 누르기
   친구 펫 데이터는 users/{friendUid}.pet 에서 읽음 (읽기 권한 있음)
   하트는 pet.hearts(총합) + pet.heartedBy(누른 사람 uid 배열)로 관리
   ============================================================ */
export function FriendPetCard({ friendUid, myUid, friendName, myPet }) {
  const [pet, setPet] = useState(undefined);
  const [hearting, setHearting] = useState(false);
  const [battling, setBattling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", friendUid));
        setPet(snap.exists() && snap.data().pet ? snap.data().pet : null);
      } catch (e) { setPet(null); }
    })();
  }, [friendUid]);

  if (pet === undefined) return <div style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>펫 불러오는 중...</div>;
  if (!pet) return <div style={{ fontSize:12, color:C.muted, padding:"10px 0", textAlign:"center" }}>아직 펫이 없어요</div>;

  const stage = stageFromExp(pet.exp);
  const rarity = RARITY[pet.rarity] || RARITY.common;
  const hearts = pet.hearts || 0;
  const heartedBy = pet.heartedBy || [];
  const iHearted = heartedBy.includes(myUid);
  const label = stage === "egg" ? `${rarity.kr} 알` : (pet.name || SPECIES_KR[pet.species]);

  const toggleHeart = async () => {
    if (hearting || !myUid || myUid === friendUid) return;  // 본인 펫엔 못 누름
    setHearting(true);
    try {
      const ref = doc(db, "users", friendUid);
      const newHeartedBy = iHearted ? heartedBy.filter(u => u !== myUid) : [...heartedBy, myUid];
      const newHearts = newHeartedBy.length;
      await updateDoc(ref, { "pet.hearts": newHearts, "pet.heartedBy": newHeartedBy });
      setPet(p => ({ ...p, hearts: newHearts, heartedBy: newHeartedBy }));
    } catch (e) {}
    setHearting(false);
  };

  // 배틀 가능 조건: 나/상대 모두 성체 + 본인 펫 아님
  const myAdult = myPet && stageFromExp(myPet.exp) === "adult";
  const opAdult = stage === "adult";
  const canBattle = myUid !== friendUid && myAdult && opAdult;
  const remain = myPet ? battleRemaining(myPet) : 0;

  const startBattle = () => {
    if (myUid === friendUid) return;
    if (!myAdult) { alert("내 펫이 성체가 되어야 배틀할 수 있어요!"); return; }
    if (!opAdult) { alert("상대 펫이 아직 성체가 아니에요!"); return; }
    if (remain <= 0) { alert("오늘 배틀 횟수를 다 썼어요! (하루 5회)"); return; }
    setBattling(true);
  };

  return (
    <>
      <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:56, height:56, background:C.surface, border:`2px solid ${rarity.color}`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
          <img src={petImg(pet)} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", imageRendering:"pixelated" }} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:13, fontWeight:800, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</span>
            <span style={{ fontSize:10, color:rarity.color, border:`1px solid ${rarity.color}`, borderRadius:4, padding:"1px 5px", flexShrink:0 }}>{rarity.kr}</span>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>
            {stage === "egg" ? "부화 전" : `${SPECIES_KR[pet.species]} · ${stage === "adult" ? `성체 Lv.${petLevel(pet)}` : STAGE_KR[stage]}`} · ❤️ {hearts}
          </div>
        </div>
        <button onClick={toggleHeart} disabled={hearting}
          style={{ background: iHearted ? C.redLight : "transparent", border:`1.5px solid ${iHearted ? C.red : C.border}`, borderRadius:10, padding:"8px 12px", fontSize:16, cursor:"pointer", flexShrink:0, lineHeight:1 }}
          title={iHearted ? "하트 취소" : "하트 주기"}>
          {iHearted ? "❤️" : "🤍"}
        </button>
      </div>

      {/* 배틀 신청 버튼 */}
      <button onClick={startBattle}
        style={{ width:"100%", marginTop:8, background: canBattle ? C.red : C.border, color:"#fff", border:"none", borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:800, cursor:"pointer", opacity: canBattle ? 1 : 0.55 }}>
        ⚔️ 배틀 신청 {canBattle && remain > 0 ? `(오늘 ${remain}회 남음)` : ""}
      </button>
      {!opAdult && <div style={{ fontSize:11, color:C.muted, marginTop:4, textAlign:"center" }}>상대 펫이 성체가 되면 배틀할 수 있어요</div>}
      {opAdult && !myAdult && <div style={{ fontSize:11, color:C.muted, marginTop:4, textAlign:"center" }}>내 펫이 성체가 되면 배틀할 수 있어요</div>}

      {battling && (
        <BattleScreen uid={myUid} myPet={myPet} oppPet={pet} oppName={friendName}
          onClose={() => setBattling(false)} />
      )}
    </>
  );
}


/* ============================================================
   배틀 화면 (턴제) — 성체끼리 비동기 배틀
   props: uid(나), myPet, oppPet, oppName, onClose(결과반영)
   ============================================================ */
const BATTLE_MAX = 5;       // 하루 배틀 횟수
const SPECIAL_MAX = 2;      // 배틀당 필살기 횟수
const CRIT_RATE = 0.15;     // 크리티컬 확률
const SPECIAL_HIT = 0.65;   // 필살기 명중률

export function BattleScreen({ uid, myPet, oppPet, oppName, onClose }) {
  const myStat0 = battleStats(myPet);
  const opStat0 = battleStats(oppPet);

  const [myHp, setMyHp] = useState(myStat0.maxHp);
  const [opHp, setOpHp] = useState(opStat0.maxHp);
  const [turn, setTurn] = useState(1);
  const [log, setLog] = useState(["배틀 시작! 행동을 선택하세요."]);
  const [special, setSpecial] = useState(SPECIAL_MAX);
  const [myGuard, setMyGuard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(null);   // null | "win" | "lose" | "flee"
  const [rewardMsg, setRewardMsg] = useState("");

  const myName = myPet.name || SPECIES_KR[myPet.species];
  const opName2 = oppPet.name || SPECIES_KR[oppPet.species];

  const addLog = (line) => setLog(prev => [...prev.slice(-3), line]);

  // 데미지 계산 (운빨: ±20% 범위 + 크리티컬)
  const calcDamage = (atk, guard) => {
    let dmg = Math.round(atk * (rngBetween(80, 120) / 100));
    let crit = Math.random() < CRIT_RATE;
    if (crit) dmg = Math.round(dmg * 2);
    if (guard) dmg = Math.round(dmg / 2);
    return { dmg: Math.max(1, dmg), crit };
  };

  // 상대(친구 펫) AI 턴
  const enemyTurn = (curMyHp) => {
    const r = Math.random();
    let opGuard = false;
    if (r < 0.7) {
      // 공격
      const { dmg, crit } = calcDamage(opStat0.atk, myGuard);
      const after = Math.max(0, curMyHp - dmg);
      setMyHp(after);
      addLog(`${opName2}의 공격! ${myName} ${dmg} 데미지${crit ? " (크리티컬!)" : ""}`);
      setMyGuard(false);
      if (after <= 0) { finish("lose"); return; }
    } else if (r < 0.9) {
      addLog(`${opName2}이(가) 방어 자세!`);
      opGuard = true;
    } else {
      // 필살기
      if (Math.random() < SPECIAL_HIT) {
        const { dmg } = calcDamage(opStat0.atk * 2, myGuard);
        const after = Math.max(0, curMyHp - dmg);
        setMyHp(after);
        addLog(`${opName2}의 필살기! ${myName} ${dmg} 데미지 ✨`);
        setMyGuard(false);
        if (after <= 0) { finish("lose"); return; }
      } else {
        addLog(`${opName2}의 필살기가 빗나갔어요!`);
      }
    }
    setTurn(t => t + 1);
    setBusy(false);
    return opGuard;
  };

  // 내 행동
  const act = (type) => {
    if (busy || over) return;
    setBusy(true);

    if (type === "flee") { finish("flee"); return; }

    if (type === "attack") {
      const { dmg, crit } = calcDamage(myStat0.atk, false);
      const after = Math.max(0, opHp - dmg);
      setOpHp(after);
      addLog(`${myName}의 공격! ${opName2} ${dmg} 데미지${crit ? " (크리티컬!)" : ""}`);
      if (after <= 0) { finish("win"); return; }
      setTimeout(() => enemyTurn(myHp), 700);
    } else if (type === "guard") {
      setMyGuard(true);
      addLog(`${myName}이(가) 방어 자세를 취했어요!`);
      setTimeout(() => enemyTurn(myHp), 700);
    } else if (type === "special") {
      if (special <= 0) { addLog("필살기를 다 썼어요!"); setBusy(false); return; }
      setSpecial(s => s - 1);
      if (Math.random() < SPECIAL_HIT) {
        const { dmg } = calcDamage(myStat0.atk * 2, false);
        const after = Math.max(0, opHp - dmg);
        setOpHp(after);
        addLog(`${myName}의 필살기 적중! ${opName2} ${dmg} 데미지 ✨`);
        if (after <= 0) { finish("win"); return; }
      } else {
        addLog(`${myName}의 필살기가 빗나갔어요…`);
      }
      setTimeout(() => enemyTurn(myHp), 700);
    }
  };

  // 배틀 종료 + 보상/전적 반영
  const finish = async (result) => {
    setOver(result);
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const pet = snap.data().pet;
      const today = todayStr();
      const bdate = pet.lastBattleDate === today;
      let patch = {
        "pet.lastBattleDate": today,
        "pet.battleCount": (bdate ? (pet.battleCount || 0) : 0) + 1,
      };
      if (result === "win") {
        const bonus = RARITY[pet.rarity]?.bonus || 1;
        const lvlDiff = Math.max(0, opStat0.level - myStat0.level);
        const gain = Math.round((50 + lvlDiff * 3) * bonus);
        patch["pet.exp"] = (pet.exp || 0) + gain;
        patch["pet.battleWin"] = (pet.battleWin || 0) + 1;
        setRewardMsg(`승리! +${gain} EXP 획득 🎉`);
      } else if (result === "lose") {
        patch["pet.battleLose"] = (pet.battleLose || 0) + 1;
        setRewardMsg("패배… 다음엔 이길 수 있어요!");
      } else {
        setRewardMsg("배틀에서 도망쳤어요.");
      }
      await updateDoc(doc(db, "users", uid), patch);
    } catch (e) {}
    setBusy(false);
  };

  const HpBar = ({ pet, name, hp, max, level, color, side }) => (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
      <div style={{ width:54, height:54, background:"#0f1320", border:`2px solid ${color}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
        <img src={petImg(pet)} alt="" style={{ width:"90%", height:"90%", objectFit:"contain", imageRendering:"pixelated" }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3, color:"#e8eaf0" }}>
          <span style={{ fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name} <span style={{ color }}>Lv.{level}</span></span>
          <span style={{ color:"#8b90a8", flexShrink:0 }}>{hp} / {max}</span>
        </div>
        <div style={{ height:9, background:"#0f1320", borderRadius:5, overflow:"hidden" }}>
          <div style={{ width:`${Math.max(0,(hp/max)*100)}%`, height:"100%", background: hp/max > 0.3 ? "#1d9e75" : "#e24b4a", transition:"width .4s" }} />
        </div>
      </div>
    </div>
  );

  const opColor = RARITY[oppPet.rarity]?.color || "#9ca3af";
  const myColor = RARITY[myPet.rarity]?.color || "#9ca3af";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9700, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ maxWidth:380, width:"100%", background:"#161b2e", borderRadius:18, padding:"16px 14px", color:"#e8eaf0" }}>
        <div style={{ textAlign:"center", fontSize:12, color:"#8b90a8", marginBottom:12 }}>⚔️ 배틀 · {turn}턴째</div>

        <HpBar pet={oppPet} name={`${opName2} (상대)`} hp={opHp} max={opStat0.maxHp} level={opStat0.level} color={opColor} side="op" />
        <div style={{ textAlign:"center", fontSize:11, color:"#8b90a8", margin:"10px 0" }}>─ VS ─</div>
        <HpBar pet={myPet} name={`${myName} (나)`} hp={myHp} max={myStat0.maxHp} level={myStat0.level} color={myColor} side="my" />

        <div style={{ background:"#0f1320", borderRadius:10, padding:"10px 12px", fontSize:12, lineHeight:1.7, color:"#b8bcd0", margin:"14px 0", minHeight:74 }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {!over ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            <button onClick={() => act("attack")} disabled={busy}
              style={{ background:"#2D4A9B", color:"#fff", border:"none", borderRadius:12, padding:"13px 0", fontSize:14, fontWeight:700, cursor:"pointer", opacity:busy?0.6:1 }}>🗡️ 공격</button>
            <button onClick={() => act("guard")} disabled={busy}
              style={{ background:"#1d9e75", color:"#fff", border:"none", borderRadius:12, padding:"13px 0", fontSize:14, fontWeight:700, cursor:"pointer", opacity:busy?0.6:1 }}>🛡️ 방어</button>
            <button onClick={() => act("special")} disabled={busy || special<=0}
              style={{ background:"#9d4edd", color:"#fff", border:"none", borderRadius:12, padding:"13px 0", fontSize:14, fontWeight:700, cursor:"pointer", opacity:(busy||special<=0)?0.5:1 }}>✨ 필살기 ({special})</button>
            <button onClick={() => act("flee")} disabled={busy}
              style={{ background:"#3a3f55", color:"#e8eaf0", border:"none", borderRadius:12, padding:"13px 0", fontSize:14, fontWeight:700, cursor:"pointer", opacity:busy?0.6:1 }}>💨 도망</button>
          </div>
        ) : (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:6, color: over==="win"?"#5dcaa5":over==="lose"?"#f09595":"#b8bcd0" }}>
              {over==="win" ? "🏆 승리!" : over==="lose" ? "😢 패배" : "💨 도망쳤어요"}
            </div>
            <div style={{ fontSize:13, color:"#b8bcd0", marginBottom:16 }}>{rewardMsg}</div>
            <button onClick={onClose}
              style={{ background:"#2D4A9B", color:"#fff", border:"none", borderRadius:12, padding:"12px 36px", fontSize:14, fontWeight:800, cursor:"pointer" }}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}

// 오늘 배틀 가능 횟수 조회용 헬퍼
export function battleRemaining(pet) {
  if (!pet) return BATTLE_MAX;
  const used = pet.lastBattleDate === todayStr() ? (pet.battleCount || 0) : 0;
  return Math.max(0, BATTLE_MAX - used);
}
