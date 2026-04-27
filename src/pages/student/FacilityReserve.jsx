import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Inp, Modal, PageTitle } from "../../components/UI";
import { addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import SignaturePad from "../../components/SignaturePad";
import { serverTimestamp } from "firebase/firestore";

const FACILITIES = [
  { id: "horizon",  name: "호리존 스튜디오", location: "1관 1층", desc: "방송 촬영용 호리존 스튜디오" },
  { id: "theater",  name: "시사실",           location: "1관 1층", desc: "시사 및 상영 공간" },
  { id: "bokja",    name: "복자 스튜디오",    location: "1관 5층", desc: "방송 제작용 스튜디오" },
];

const PURPOSES = ["수업", "과제", "동아리", "개인 프로젝트", "기타"];

export default function FacilityReserve() {
  const { profile } = useAuth();

  const [selFacility, setSelFacility] = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [showSign, setShowSign]       = useState(false);
  const [done, setDone]               = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    date:         today,
    startTime:    "",
    endTime:      "",
    purpose:      "수업",
    purposeDetail: "",
    participants:  "",
  });
  const [studentSig, setStudentSig] = useState("");
  const [errors, setErrors]         = useState({});

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.date)         e.date       = "대여일을 선택하세요";
    if (!form.startTime)    e.startTime  = "시작 시간을 입력하세요";
    if (!form.endTime)      e.endTime    = "종료 시간을 입력하세요";
    if (!form.purposeDetail) e.purposeDetail = "세부 목적을 입력하세요";
    if (!form.participants) e.participants = "참여인원 학번 및 이름을 입력하세요";
    if (!studentSig)        e.sig        = "서명이 필요합니다";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    try {
      await addItem("facilityRequests", {
        facilityId:    selFacility.id,
        facilityName:  selFacility.name,
        location:      selFacility.location,
        studentId:     profile?.studentId || "",
        studentName:   profile?.name || "",
        dept:          profile?.dept || "",
        phone:         profile?.phone || "",
        date:          form.date,
        startTime:     form.startTime,
        endTime:       form.endTime,
        purpose:       form.purpose,
        purposeDetail: form.purposeDetail,
        participants:  form.participants,
        studentSignature: studentSig,
        status:        "승인대기",
        createdAt:     serverTimestamp(),
      });
      setDone(true);
      setShowForm(false);
    } catch(e) {
      alert("신청 중 오류: " + e.message);
    }
    setSubmitting(false);
  };

  const resetAll = () => {
    setSelFacility(null); setShowForm(false); setDone(false);
    setStudentSig(""); setErrors({});
    setForm({ date: today, startTime:"", endTime:"", purpose:"수업", purposeDetail:"", participants:"" });
  };

  return (
    <div>
      <PageTitle>시설 대여 신청</PageTitle>

      {done && (
        <div style={{ background:C.greenLight, color:C.green, borderRadius:12, padding:"14px 18px", marginBottom:20, fontWeight:700, fontSize:14, border:`1px solid ${C.green}30` }}>
          ✅ 시설 대여 신청이 완료됐어요! 관리자 승인을 기다려 주세요.
        </div>
      )}

      {/* 시설 선택 카드 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14, marginBottom:24 }}>
        {FACILITIES.map(fac => (
          <Card key={fac.id}
            onClick={() => { setSelFacility(fac); setShowForm(true); setDone(false); setErrors({}); setStudentSig(""); }}
            style={{ cursor:"pointer", border:`2px solid ${selFacility?.id===fac.id ? C.teal : C.border}`, transition:"all 0.2s" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{fac.location}</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.navy, marginBottom:6 }}>{fac.name}</div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>{fac.desc}</div>
            <Btn color={C.teal} full>신청하기</Btn>
          </Card>
        ))}
      </div>

      {/* 신청 모달 */}
      {showForm && selFacility && (
        <Modal onClose={() => { setShowForm(false); setSelFacility(null); }} width={560}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:2 }}>시설 대여 신청</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
            {selFacility.location} · {selFacility.name}
          </div>

          {/* 대여자 정보 (자동입력) */}
          <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:8 }}>대여자 정보 (자동입력)</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:8, fontSize:13, color:C.text }}>
              <div><span style={{ color:C.muted }}>이름: </span>{profile?.name}</div>
              <div><span style={{ color:C.muted }}>학번: </span>{profile?.studentId}</div>
              <div><span style={{ color:C.muted }}>계열: </span>{profile?.dept}</div>
              <div><span style={{ color:C.muted }}>연락처: </span>{profile?.phone}</div>
            </div>
          </div>

          {/* 대여 일시 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>대여 일시 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:8 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>날짜</div>
                <input type="date" value={form.date} min={today}
                  onChange={e => f("date", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.date?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>시작</div>
                <input type="time" value={form.startTime}
                  onChange={e => f("startTime", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.startTime?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>종료</div>
                <input type="time" value={form.endTime}
                  onChange={e => f("endTime", e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.endTime?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>
            {(errors.date||errors.startTime||errors.endTime) && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ 대여 일시를 모두 입력하세요</div>}
          </div>

          {/* 대여 목적 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>대여 목적 *</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
              {PURPOSES.map(p => (
                <button key={p} onClick={() => f("purpose", p)}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.purpose===p?C.teal:C.border}`, background:form.purpose===p?C.tealLight:C.bg, color:form.purpose===p?C.teal:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  {p}
                </button>
              ))}
            </div>
            <textarea placeholder="세부 목적을 입력하세요 (예: OO 과목 촬영 실습)" value={form.purposeDetail}
              onChange={e => f("purposeDetail", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.purposeDetail?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:72, boxSizing:"border-box" }} />
            {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.purposeDetail}</div>}
          </div>

          {/* 참여인원 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>참여인원 학번 및 이름 기재 *</div>
            <textarea placeholder={"예:\n25237001 홍길동\n25238002 이서연"}
              value={form.participants} onChange={e => f("participants", e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.participants?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:100, boxSizing:"border-box" }} />
            {errors.participants && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.participants}</div>}
          </div>

          {/* 서명 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>신청자 서명 *</div>
            {studentSig ? (
              <div style={{ background:C.bg, borderRadius:10, padding:8, border:`1px solid ${C.border}`, position:"relative" }}>
                <img src={studentSig} alt="서명" style={{ width:"100%", height:80, objectFit:"contain" }} />
                <button onClick={() => setStudentSig("")}
                  style={{ position:"absolute", top:6, right:8, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13 }}>다시 서명</button>
              </div>
            ) : (
              <div>
                <Btn onClick={() => setShowSign(true)} color={C.muted} outline full>✍️ 서명하기</Btn>
                {errors.sig && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.sig}</div>}
              </div>
            )}
          </div>

          {/* 안내 */}
          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 시설 무단 사용 및 훼손 시 책임이 따를 수 있습니다.
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowForm(false); setSelFacility(null); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting}>
              {submitting ? "신청 중..." : "✅ 신청 완료"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* 서명 모달 */}
      {showSign && (
        <Modal onClose={() => setShowSign(false)} width={500}>
          <SignaturePad
            title="✍️ 신청자 서명"
            onSave={(sig) => { setStudentSig(sig); setShowSign(false); setErrors(p=>({...p,sig:""})); }}
            onCancel={() => setShowSign(false)}
          />
        </Modal>
      )}
    </div>
  );
}
