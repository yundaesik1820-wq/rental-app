import { createContext, useContext, useState } from "react";

/* ============================================================
   장바구니 — 장비 목록(EquipList)에서 담고 주문서(Reserve)에서 신청
   cart     : { modelName: qty }   단품
   cartSets : { modelName: true }  세트 (수량 개념 없음, 1세트씩)
   화면을 옮겨도 유지되도록 Reserve 로컬 state에서 여기로 올림.
   ⚠️ 라이선스/재고 검증은 담는 쪽과 제출 시점(Reserve)에서 각각 처리한다.
      여기는 순수 저장소라 검증하지 않음.
   ============================================================ */
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart]         = useState({});
  const [cartSets, setCartSets] = useState({});

  // max(가용 수량)로 상한을 물려 담기 — 0이면 사실상 제거
  const setQty = (modelName, qty, max) => {
    const c = Math.max(0, Math.min(qty, max));
    setCart(p => ({ ...p, [modelName]: c }));
  };

  const clearCart = () => { setCart({}); setCartSets({}); };

  // 담은 총 개수 = 단품 수량 합 + 세트 개수
  const cartCount =
    Object.values(cart).reduce((a, b) => a + b, 0) +
    Object.values(cartSets).filter(Boolean).length;

  return (
    <CartContext.Provider value={{ cart, setCart, cartSets, setCartSets, setQty, clearCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
