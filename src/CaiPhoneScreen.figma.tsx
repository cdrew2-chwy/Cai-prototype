import figma from "@figma/code-connect/react";
import { CaiPhoneScreen } from "./CaiPhoneScreen";

figma.connect(
  CaiPhoneScreen,
  "https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=3145-47989",
  {
    example: () => (
      <CaiPhoneScreen
        phase="chat"
        chatInput=""
        onChatInputChange={() => {}}
        onSend={() => {}}
        chatLoading={false}
      >
        <p className="cai-msg-ai-body">Thread preview…</p>
      </CaiPhoneScreen>
    ),
  }
);
