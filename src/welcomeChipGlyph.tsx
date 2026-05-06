import type { ReactNode } from "react";
import caiChipFallbackSvg from "./assets/cai-phone/cai-chip-fallback-cai-icon.svg";
import { isOrderHelpWelcomeChipLabel } from "./chatUtils";

/** When no keyword matches — small blue Cai mark (replaces Material “pets” / paw). */
function WelcomeChipCaiFallbackGlyph() {
  return (
    <img
      className="cai-order-pick-intent__svg cai-welcome-chip-cai-fallback"
      src={caiChipFallbackSvg}
      alt=""
      width={24}
      height={24}
      decoding="async"
    />
  );
}

/** Material glyph in a welcome / intent chip (matches {@link CaiOrderPickFollowup} sizing). */
function MaterialRounded({ name }: { name: string }) {
  return (
    <span className="material-symbols-rounded cai-order-pick-intent__material" aria-hidden>
      {name}
    </span>
  );
}

function MaterialOutlined({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined cai-order-pick-intent__material" aria-hidden>
      {name}
    </span>
  );
}

/**
 * Figma 3065:29722 — left icon per prompt type (Material Symbols; matches design intent).
 * https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3065-29722
 */
export function welcomeChipGlyph(label: string): ReactNode {
  const t = label.trim().toLowerCase();

  if (/\breport an issue\b/.test(t)) {
    return <MaterialRounded name="warning" />;
  }
  if (/\bview product details\b/.test(t)) {
    return <MaterialRounded name="frame_inspect" />;
  }
  if (/\b(get help with this product|help with this product)\b/.test(t)) {
    return <MaterialRounded name="help" />;
  }
  if (/\b(start a return|return or exchange)\b/.test(t)) {
    return <MaterialOutlined name="package_2" />;
  }
  if (isOrderHelpWelcomeChipLabel(label)) {
    return <MaterialOutlined name="package_2" />;
  }
  if (/\bmanage autoship\b/.test(t)) {
    return <MaterialRounded name="sync" />;
  }
  if (/\b(deal|deals on|dig up deals)\b/.test(t)) {
    return <MaterialRounded name="sell" />;
  }
  if (/\b(toy|dig up a perfect|perfect toy)\b/.test(t)) {
    return <MaterialRounded name="auto_awesome" />;
  }
  if (/\b(care team|customer care|chat live)\b/.test(t)) {
    return <MaterialRounded name="volunteer_activism" />;
  }
  if (/\b(sniff out a package|track (a |your )?package|where'?s my package)\b/.test(t)) {
    return <MaterialOutlined name="package_2" />;
  }
  if (/^help with\b/.test(t) && !/\b(an order|this product|your order)\b/.test(t)) {
    return <MaterialRounded name="auto_awesome" />;
  }

  return <WelcomeChipCaiFallbackGlyph />;
}
