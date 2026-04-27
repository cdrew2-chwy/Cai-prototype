import { useMemo } from "react";
import connectWithVetCardUrl from "./assets/connect-with-vet-card.svg";

/**
 * When the model does not pass `intro` in the ```cai-vet-ingress``` JSON—warm, plain Cai voice
 * (not a second empathy paragraph; the card is the CTA).
 */
const DEFAULT_VET_CARD_INTRO =
  "If you want to go a little deeper, you can chat for free with licensed vet techs on our team, with caring, expert help when you need it.";

type Props = {
  /** Prototype: 1–23; always under 24 seconds. Omit → random per mount. */
  waitSeconds?: number;
  /**
   * From fence JSON `intro`. Omitted = {@link DEFAULT_VET_CARD_INTRO}. Empty string = do not show a line
   * (Connect with a Vet was already introduced in the prose above the card).
   */
  intro?: string;
};

function clampWaitSeconds(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.min(23, Math.max(1, Math.floor(n)));
}

/**
 * Figma “Fast, expert advice” card (exact SVG) + optional contextual intro + wait line.
 */
export function ConnectWithVetIngressCard({ waitSeconds: waitProp, intro }: Props) {
  const waitSeconds = useMemo(() => {
    if (typeof waitProp === "number") return clampWaitSeconds(waitProp);
    return Math.floor(Math.random() * 23) + 1;
  }, [waitProp]);

  /** `undefined` = default line; non-empty = custom; `""` = prose already introduced the card (no line). */
  const introLine = intro === "" ? null : (intro && intro.trim()) || DEFAULT_VET_CARD_INTRO;

  return (
    <section className="cai-vet-ingress" aria-label="Connect with a Vet">
      {introLine ? <p className="cai-vet-ingress__intro cai-text-editorial-text-2">{introLine}</p> : null}
      <img
        src={connectWithVetCardUrl}
        alt=""
        className="cai-vet-ingress__card"
        width={358}
        height={176}
        decoding="async"
      />
      <p className="cai-vet-ingress__wait" aria-live="polite">
        Estimated wait time: {waitSeconds} seconds
      </p>
    </section>
  );
}
