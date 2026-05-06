import figma from "@figma/code-connect/react";
import { CaiTopOfSheet } from "./CaiTopOfSheet";

figma.connect(
  CaiTopOfSheet,
  "https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=1265-67137",
  {
    example: () => <CaiTopOfSheet className="cai-tos--phone-overlay" />,
  }
);
