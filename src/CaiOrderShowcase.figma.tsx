import figma from "@figma/code-connect/react";
import { CaiOrderSelectedDetailCard } from "./CaiOrderShowcase";
import type { CaiOrderItem } from "./chatUtils";

/** Example row aligned with Figma “Widgets Dec 1” (order card — selected / detailed). */
const demoOrderDetailed: CaiOrderItem = {
  id: "code-connect-order",
  orderNumber: "#169190358",
  summary: "Coziwow by Jaxpety Foldable Dog Car Ramp, Black, 62-in",
  status: "Delivered",
  placedAt: "2025-04-27T16:00:00.000Z",
};

figma.connect(
  CaiOrderSelectedDetailCard,
  "https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=11-4779",
  {
    example: () => <CaiOrderSelectedDetailCard o={demoOrderDetailed} />,
  }
);
