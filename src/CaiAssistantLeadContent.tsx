import { splitFirstSentence } from "./chatUtils";

type Variant = "phone" | "panel";

type Props = {
  text: string;
  variant: Variant;
};

/**
 * First sentence uses Figma 1117:13599 (Editorial / Heading-1-Stronger); remainder uses body copy.
 */
export function CaiAssistantLeadContent({ text, variant }: Props) {
  const { lead, rest } = splitFirstSentence(text);
  if (variant === "phone") {
    return (
      <div className="cai-msg-ai-body-stack">
        <p className="cai-msg-ai-lead cai-text-editorial-heading-1">{lead}</p>
        {rest ? (
          <div className="cai-msg-ai-body-rest cai-text-editorial-text-2 cai-msg-ai-body--muted">{rest}</div>
        ) : null}
      </div>
    );
  }
  return (
    <>
      <p className="cai-msg-ai-lead cai-text-editorial-heading-1">{lead}</p>
      {rest ? <div className="bubble-body-prose-rest">{rest}</div> : null}
    </>
  );
}
