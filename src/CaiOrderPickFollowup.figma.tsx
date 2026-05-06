import figma from "@figma/code-connect/react";
import { CaiOrderPickFollowup, SELECT_DIFFERENT_ORDER_LABEL } from "./CaiOrderPickFollowup";
import type { CaiOrderItem } from "./chatUtils";

const demoOrder: CaiOrderItem = {
  id: "code-connect-order",
  orderNumber: "#169190358",
  summary: "Coziwow by Jaxpety Foldable Dog Car Ramp, Black, 62-in",
  status: "Delivered",
  placedAt: "2025-04-27T16:00:00.000Z",
};

/** Figma “prompt” — text chip to reopen the order list. */
figma.connect(
  "https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=1-4423",
  {
    example: () => (
      <button type="button" className="cai-order-pick-flow__changeOrder">
        {SELECT_DIFFERENT_ORDER_LABEL}
      </button>
    ),
  }
);

/** Figma 3087:42971 — order-help intent chip (stack: return / issue / view product). */
figma.connect(
  "https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3087-42971",
  {
    example: () => (
      <button type="button" className="cai-prompt-chip cai-prompt-chip--rich">
        <span className="cai-prompt-chip__glyph" aria-hidden>
          <span className="material-symbols-outlined cai-order-pick-intent__material">package_2</span>
        </span>
        <span>Start a return or exchange</span>
      </button>
    ),
  }
);

/** Full post–order-tap block: confirmation, detailed card, change order, Cai asks + intent chips (Figma 3288:29321). */
figma.connect(
  CaiOrderPickFollowup,
  "https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3288-29321",
  {
    example: () => (
      <CaiOrderPickFollowup
        variant="phone"
        order={demoOrder}
        petParentName="Monique"
        petProfile="Captain — golden retriever"
        pickedAt={1_714_252_860_000}
        chatLoading={false}
        onDifferentOrder={() => {}}
        onIntentChip={() => {}}
      />
    ),
  }
);
