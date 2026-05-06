import cwaHeroUrl from "./assets/cwa-v-ingress-hero.png";

/**
 * When the model does not pass `intro` in the ```cai-vet-ingress``` JSON—warm, plain Cai voice
 * (not a second empathy paragraph; the card is the CTA).
 */
const DEFAULT_VET_CARD_INTRO =
  "If you want to go a little deeper, you can chat for free with licensed vet techs on our team, with caring, expert help when you need it.";

type Props = {
  /** Prototype: 1–23; when ≤5, wait line matches Figma (“Less than 5 seconds”). Omit → design default. */
  waitSeconds?: number;
  /**
   * From fence JSON `intro`. Omitted = {@link DEFAULT_VET_CARD_INTRO}. Empty string = do not show a line
   * (Connect with a Vet was already introduced in the prose above the card).
   */
  intro?: string;
};

function clampWaitSeconds(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.min(23, Math.max(1, Math.floor(n)));
}

function waitEmphasisLabel(seconds: number): string {
  if (seconds <= 5) return "Less than 5 seconds";
  return `${seconds} seconds`;
}

/**
 * Figma 3395:76509 — “Live vet chat” ingress card + estimated wait line.
 */
export function ConnectWithVetIngressCard({ waitSeconds: waitProp, intro }: Props) {
  const waitSeconds =
    typeof waitProp === "number" ? clampWaitSeconds(waitProp) : 5;

  /** `undefined` = default line; non-empty = custom; `""` = prose already introduced the card (no line). */
  const introLine = intro === "" ? null : (intro && intro.trim()) || DEFAULT_VET_CARD_INTRO;

  return (
    <section className="cai-vet-ingress" aria-label="Connect with a Vet">
      {introLine ? <p className="cai-vet-ingress__intro cai-text-editorial-text-2">{introLine}</p> : null}
      <div className="cai-vet-ingress__card">
        <div className="cai-vet-ingress__free">Free</div>
        <div className="cai-vet-ingress__visual">
          <img
            className="cai-vet-ingress__hero"
            src={cwaHeroUrl}
            alt=""
            width={336}
            height={336}
            decoding="async"
          />
        </div>
        <div className="cai-vet-ingress__body">
          <div className="cai-vet-ingress__copy">
            <p className="cai-vet-ingress__title">Live vet chat</p>
            <p className="cai-vet-ingress__desc">
              Chat and send pictures of what’s going on to an online vet.
            </p>
          </div>
          <p className="cai-vet-ingress__tag">Talk to next available vet</p>
        </div>
      </div>
      <p className="cai-vet-ingress__wait" aria-live="polite">
        <span className="cai-vet-ingress__wait-prefix">Estimated wait time: </span>
        <span className="cai-vet-ingress__wait-value">{waitEmphasisLabel(waitSeconds)}</span>
      </p>
    </section>
  );
}
