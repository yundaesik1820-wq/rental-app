import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db } from "../../firebase";
import { auth } from "../../firebase";
import { C } from "../../theme";
import { Card, Btn, PageTitle } from "../../components/UI";
import { useAuth } from "../../hooks/useAuth.jsx";
import { APP_VERSION, compareVersions } from "../../appVersion";

const DEFAULTS = { maxDays: 7, maxSimultaneous: 2, startHour: 9, endHour: 18 };

// config/appVersion 편집 폼의 빈 값 (문서에 없는 필드는 저장하지 않음)
const VER_EMPTY = {
  latestVersionIos: "", latestVersionAndroid: "",
  minVersionIos: "",    minVersionAndroid: "",
  enabled: true,        message: "",
};
const isVerFormat = (v) => /^\d+(\.\d+)*$/.test(v.trim());

export default function Settings({ isSuper = true }) {
  const { user } = useAuth();
  const [form, setForm]       = useState(DEFAULTS);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  // 비밀번호 변경
  const [pwForm, setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwMsg,  setPwMsg]    = useState(null); // { type: "success"|"error", text }
  const [pwLoading, setPwLoading] = useState(false);

  const changePassword = async () => {
    const { current, next, confirm } = pwForm;
    if (!current || !next || !confirm) return setPwMsg({ type:"error", text:"모든 항목을 입력해주세요." });
    if (next.length < 6)              return setPwMsg({ type:"error", text:"새 비밀번호는 6자 이상이어야 합니다." });
    if (next !== confirm)             return setPwMsg({ type:"error", text:"새 비밀번호가 일치하지 않습니다." });
    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setPwMsg({ type:"success", text:"비밀번호가 변경됐습니다!" });
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      const msg =
        e.code === "auth/wrong-password"    ? "현재 비밀번호가 틀렸습니다." :
        e.code === "auth/weak-password"     ? "비밀번호가 너무 간단합니다. 6자 이상으로 설정해주세요." :
        e.code === "auth/too-many-requests" ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." :
        "오류가 발생했습니다. 다시 시도해주세요.";
      setPwMsg({ type:"error", text: msg });
    } finally {
      setPwLoading(false);
      setTimeout(() => setPwMsg(null), 4000);
    }
  };

  /* ── 앱 버전 관리 (config/appVersion) ── */
  const [ver, setVer]         = useState(VER_EMPTY);
  const [verRaw, setVerRaw]   = useState(null);   // 문서 원본 (레거시 필드 보존용)
  const [verMsg, setVerMsg]   = useState(null);   // { type, text }
  const [verBusy, setVerBusy] = useState(false);

  useEffect(() => {
    if (!isSuper) return;
    getDoc(doc(db, "config", "appVersion"))
      .then(snap => {
        const d = snap.exists() ? snap.data() : {};
        setVerRaw(d);
        setVer({
          // 플랫폼 전용 값이 없으면 기존 공용 값을 초기값으로 (저장하면 플랫폼별로 분리됨)
          latestVersionIos:     d.latestVersionIos     || d.latestVersion || "",
          latestVersionAndroid: d.latestVersionAndroid || d.latestVersion || "",
          minVersionIos:        d.minVersionIos        || d.minVersion    || "",
          minVersionAndroid:    d.minVersionAndroid    || d.minVersion    || "",
          enabled:              d.enabled !== false,
          message:              d.message || "",
        });
      })
      .catch(() => setVerRaw({}));
  }, [isSuper]);

  // 이 기준선을 저장하면 지금 배포된 번들(APP_VERSION)이 잠기는지
  const locksNow = (v) => v && isVerFormat(v) && compareVersions(APP_VERSION, v) < 0;
  const willLock = ver.enabled && (locksNow(ver.minVersionIos) || locksNow(ver.minVersionAndroid));

  const saveVer = async () => {
    const bad = ["latestVersionIos","latestVersionAndroid","minVersionIos","minVersionAndroid"]
      .find(k => ver[k].trim() && !isVerFormat(ver[k]));
    if (bad) { setVerMsg({ type:"error", text:"버전은 1.0.12 같은 숫자·점 형식으로 입력해주세요." }); return; }
    setVerBusy(true);
    try {
      // 입력한 값만 반영 — 빈 칸은 건드리지 않아 iosUrl 등 기존 필드가 보존됨
      const payload = { enabled: ver.enabled, message: ver.message.trim(), updatedAt: serverTimestamp() };
      for (const k of ["latestVersionIos","latestVersionAndroid","minVersionIos","minVersionAndroid"]) {
        if (ver[k].trim()) payload[k] = ver[k].trim();
      }
      await setDoc(doc(db, "config", "appVersion"), payload, { merge: true });
      setVerMsg({ type:"success", text:"앱 버전 설정이 저장됐습니다." });
    } catch (e) {
      setVerMsg({ type:"error", text: e.code === "permission-denied"
        ? "권한이 없습니다. Firestore 규칙(config 쓰기 권한)이 게시됐는지 확인해주세요."
        : "저장 실패: " + (e.message || "오류") });
    }
    setVerBusy(false);
    setTimeout(() => setVerMsg(null), 5000);
  };

  useEffect(() => {
    getDoc(doc(db, "settings", "rules"))
      .then(snap => {
        if (snap.exists()) setForm({ ...DEFAULTS, ...snap.data() });
        setLoading(false);
      })
      .catch(() => setLoading(false)); // 권한 오류 등에서도 로딩 해제
  }, []);

  const save = async () => {
    await setDoc(doc(db, "settings", "rules"), { ...form, updatedAt: serverTimestamp() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ color: C.muted, padding: 40 }}>로딩 중...</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>설정 · 대여 규칙</PageTitle>

      {saved && (
        <div style={{ background: C.greenLight, color: C.green, borderRadius: 12, padding: "12px 18px", marginBottom: 20, border: `1px solid ${C.green}30`, fontWeight: 700, fontSize: 14 }}>
          ✅ 설정이 저장됐습니다!
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>📅 최대 대여 기간</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[1, 3, 5, 7, 14].map(d => (
            <button key={d} onClick={() => setForm(p => ({ ...p, maxDays: d }))} style={{
              flex: 1, background: form.maxDays === d ? C.navy : C.bg,
              color: form.maxDays === d ? C.bg : C.muted,
              border: `1.5px solid ${form.maxDays === d ? C.navy : C.border}`,
              borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>{d}일</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>학생이 한 번에 대여할 수 있는 최대 기간</div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>🔢 동시 대여 최대 개수</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[1, 2, 3, 5].map(n => (
            <button key={n} onClick={() => setForm(p => ({ ...p, maxSimultaneous: n }))} style={{
              flex: 1, background: form.maxSimultaneous === n ? C.blue : C.bg,
              color: form.maxSimultaneous === n ? C.bg : C.muted,
              border: `1.5px solid ${form.maxSimultaneous === n ? C.blue : C.border}`,
              borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>{n}개</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>학생 1명이 동시에 빌릴 수 있는 최대 장비 수</div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>🕐 운영 시간</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>시작 시간</div>
            <select value={form.startHour} onChange={e => setForm(p => ({ ...p, startHour: +e.target.value }))}
              style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}>
              {[7,8,9,10].map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          <div style={{ color: C.muted, fontSize: 20, paddingTop: 20 }}>~</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>종료 시간</div>
            <select value={form.endHour} onChange={e => setForm(p => ({ ...p, endHour: +e.target.value }))}
              style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}>
              {[17,18,19,20,21,22].map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <div style={{ background: C.blueLight, borderRadius: 10, padding: "10px 14px", marginTop: 14, fontSize: 13, color: C.blue }}>
          현재 설정: 평일 {form.startHour}:00 ~ {form.endHour}:00
        </div>
      </Card>

      <Btn onClick={save} color={C.navy} full>설정 저장</Btn>

      {/* 비밀번호 변경 */}
      <Card style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 18 }}>🔐 비밀번호 변경</div>

        {pwMsg && (
          <div style={{ background: pwMsg.type === "success" ? C.greenLight : C.redLight,
            color: pwMsg.type === "success" ? C.green : C.red,
            borderRadius: 10, padding: "10px 14px", marginBottom: 14,
            border: `1px solid ${pwMsg.type === "success" ? C.green : C.red}30`,
            fontWeight: 600, fontSize: 13 }}>
            {pwMsg.type === "success" ? "✅ " : "⚠️ "}{pwMsg.text}
          </div>
        )}

        {[
          { key: "current", label: "현재 비밀번호" },
          { key: "next",    label: "새 비밀번호 (6자 이상)" },
          { key: "confirm", label: "새 비밀번호 확인" },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
            <input
              type="password"
              value={pwForm[key]}
              onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && changePassword()}
              placeholder={label}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`,
                borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13,
                fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
            />
          </div>
        ))}

        <Btn onClick={changePassword} color={C.purple} full disabled={pwLoading}>
          {pwLoading ? "변경 중..." : "🔐 비밀번호 변경"}
        </Btn>
      </Card>

      {/* 앱 버전 관리 — config/appVersion. 전체 권한 관리자만 */}
      {isSuper && (
        <Card style={{ marginTop: 32, marginBottom: 40 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>📦 앱 버전 관리</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 18 }}>
            현재 실행 중인 번들 <b style={{ color: C.text }}>{APP_VERSION}</b> · iOS와 Android는 심사 시차가 있어 따로 관리합니다.<br />
            빈 칸으로 두면 해당 항목은 저장하지 않습니다.
          </div>

          {verMsg && (
            <div style={{ background: verMsg.type === "success" ? C.greenLight : C.redLight,
              color: verMsg.type === "success" ? C.green : C.red,
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              border: `1px solid ${verMsg.type === "success" ? C.green : C.red}30`,
              fontWeight: 600, fontSize: 13, lineHeight: 1.6 }}>
              {verMsg.type === "success" ? "✅ " : "⚠️ "}{verMsg.text}
            </div>
          )}

          {/* 최신 버전 — 학생 설정 › 업데이트 확인에서 비교하는 값 */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>최신 버전</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>학생 설정 › 업데이트 확인에서 이 값과 비교합니다 (앱을 막지는 않음)</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[["latestVersionIos", "iOS"], ["latestVersionAndroid", "Android"]].map(([k, label]) => (
              <div key={k} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
                <input value={ver[k]} onChange={e => setVer(p => ({ ...p, [k]: e.target.value }))} placeholder="1.0.12"
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
          </div>

          {/* 강제 업데이트 */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>강제 업데이트 기준선</div>
              <button onClick={() => setVer(p => ({ ...p, enabled: !p.enabled }))}
                style={{ width:48, height:22, minWidth:48, minHeight:22, padding:0, boxSizing:"border-box", borderRadius:11, border:"none", cursor:"pointer", background: ver.enabled ? C.red : "#2A2A31", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:0, left: ver.enabled ? 26 : 0, width:22, height:22, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
              이 버전보다 낮은 앱은 <b style={{ color: C.text }}>화면이 잠기고</b> 스토어로만 이동할 수 있습니다. 웹은 항상 최신이라 영향 없음.
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 12, opacity: ver.enabled ? 1 : 0.45 }}>
              {[["minVersionIos", "iOS"], ["minVersionAndroid", "Android"]].map(([k, label]) => (
                <div key={k} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
                  <input value={ver[k]} onChange={e => setVer(p => ({ ...p, [k]: e.target.value }))} placeholder="비워두면 잠그지 않음"
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${locksNow(ver[k]) && ver.enabled ? C.red : C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
            </div>

            {willLock && (
              <div style={{ background: C.redLight, border: `1px solid ${C.red}40`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 12.5, color: C.red, fontWeight: 700, lineHeight: 1.6 }}>
                ⚠️ 이대로 저장하면 지금 배포된 <b>{APP_VERSION}</b> 앱이 잠깁니다.<br />
                <span style={{ fontWeight: 500 }}>새 빌드가 스토어에 올라간 뒤에 설정하세요.</span>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>잠금 화면 안내 문구</div>
            <textarea value={ver.message} onChange={e => setVer(p => ({ ...p, message: e.target.value }))}
              placeholder={"비워두면 기본 문구가 표시됩니다.\n예) 대여 기능이 개선되었습니다. 최신 버전으로 업데이트해 주세요."}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box", marginBottom:16 }} />
          </div>

          <Btn onClick={saveVer} color={willLock ? C.red : C.navy} full disabled={verBusy || verRaw === null}>
            {verBusy ? "저장 중..." : verRaw === null ? "불러오는 중..." : willLock ? "⚠️ 잠금을 적용하고 저장" : "버전 설정 저장"}
          </Btn>
        </Card>
      )}
    </div>
  );
}
