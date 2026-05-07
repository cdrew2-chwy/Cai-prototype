import { useCallback, useEffect, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import type { CaiOrderItem } from "./chatUtils";
import { orderCardLocalFallbackSrc, orderCardThumbSrc } from "./chewyOrderImageFallback";
import { proxiedChewyProductImageUrl, shouldProxyChewyProductImageUrl } from "./chewyImageProxyUrl";

/** Figma 3645:47128 — generic bag + Chewy “c” when catalog image fails or is absent (recommendation cards). */
export const CAI_PRODUCT_CARD_GENERIC_FALLBACK = "/cai-product-image-generic-fallback.png";

type RefPol = ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];

/** Remote catalog image: proxied API URL first, then direct CDN on error. */
export function useChewyRemoteImageSrc(remote: string | undefined | null) {
  const trimmed = (remote ?? "").trim();
  const primary = trimmed ? (proxiedChewyProductImageUrl(trimmed) ?? trimmed) : "";
  const [src, setSrc] = useState(primary);
  const [referrerPolicy, setReferrerPolicy] = useState<RefPol>(undefined);
  const [failed, setFailed] = useState(!primary);

  useEffect(() => {
    const t = (remote ?? "").trim();
    const p = t ? (proxiedChewyProductImageUrl(t) ?? t) : "";
    setSrc(p);
    setReferrerPolicy(undefined);
    setFailed(!p);
  }, [remote]);

  const onError = useCallback(() => {
    const t = (remote ?? "").trim();
    if (!t) {
      setFailed(true);
      return;
    }
    if (shouldProxyChewyProductImageUrl(t) && src.includes("/api/chewy-product-image")) {
      setReferrerPolicy("no-referrer");
      setSrc(t);
      return;
    }
    setFailed(true);
  }, [remote, src]);

  return { src, referrerPolicy, onError, failed };
}

/** Order card thumb: proxied → direct → local `/order-fallbacks` when mapped. */
export function useOrderCardThumbImg(order: CaiOrderItem) {
  const primary = orderCardThumbSrc(order) ?? "";
  const raw = (order.imageUrl ?? "").trim();
  const local = orderCardLocalFallbackSrc(order) ?? "";
  const [src, setSrc] = useState(primary);
  const [referrerPolicy, setReferrerPolicy] = useState<RefPol>(undefined);
  const [failed, setFailed] = useState(!primary);

  useEffect(() => {
    const p = orderCardThumbSrc(order) ?? "";
    setSrc(p);
    setReferrerPolicy(undefined);
    setFailed(!p);
  }, [order.id, order.imageUrl, order.productPageUrl, order.summary]);

  const onError = useCallback(() => {
    if (raw && shouldProxyChewyProductImageUrl(raw) && src.includes("/api/chewy-product-image")) {
      setReferrerPolicy("no-referrer");
      setSrc(raw);
      return;
    }
    if (local && src !== local) {
      setReferrerPolicy(undefined);
      setSrc(local);
      return;
    }
    setFailed(true);
  }, [raw, local, src]);

  return { src, referrerPolicy, onError, failed };
}
