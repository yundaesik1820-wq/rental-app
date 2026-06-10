import React from "react";

/**
 * 앱 첫 실행 시 1회만 뜨는 온보딩(환영) 화면.
 * 세로 일러스트(public/onboarding.png)를 풀스크린으로 보여주고
 * 하단 "시작하기" 버튼을 누르면 닫힌다.
 */
export default function Onboarding({ onDone }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        // 노치/상태바 안전영역
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* 일러스트 영역 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          backgroundImage: "url(/onboarding.png)",
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* 시작 버튼 */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 24px calc(env(safe-area-inset-bottom, 0px) + 28px)",
        }}
      >
        <button
          onClick={onDone}
          style={{
            width: "100%",
            background: "#dc2626",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "16px",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(220,38,38,0.4)",
            fontFamily: "inherit",
          }}
        >
          시작하기
        </button>
      </div>
    </div>
  );
}
