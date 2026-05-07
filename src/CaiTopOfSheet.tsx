/**
 * Figma: “Cai - Top of sheet” — node 1265:67137
 * https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=1265-67137
 * Sheet dismiss control (iOS down chevron): 1180:24527
 * https://www.figma.com/design/A3nyvH8N2Gx62Wfxs9opoS/CAI---Phase-3---Evolution?node-id=1180-24527
 * Sources in src/assets/cai-header/ (refresh from Figma MCP when the file updates).
 */
import { useEffect, useState } from "react";
import caiLogoSvg from "./assets/cai-header/cai-logo.svg";
import cartSvg from "./assets/cai-header/cart.svg";
import notchSvg from "./assets/cai-header/notch.svg";
import historySvg from "./assets/cai-header/history.svg";
import statusRightSvg from "./assets/cai-header/status-right.svg";
import tosSheetBackSvg from "./assets/cai-header/tos-sheet-back.svg";
import "./cai-top-of-sheet.css";

/** iOS US status bar: 12-hour, no AM/PM, hour not zero-padded (1–12), minutes two digits; updates every minute. `datetime` is 24h. */
function useStatusBarTime(): { label: string; dateTime: string } {
  const snapshot = () => {
    const d = new Date();
    const h24 = d.getHours();
    const m = d.getMinutes();
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const label = `${h12}:${String(m).padStart(2, "0")}`;
    const dateTime = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { label, dateTime };
  };

  const [value, setValue] = useState(snapshot);

  useEffect(() => {
    const tick = () => setValue(snapshot());
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return value;
}

type Props = {
  className?: string;
  /** Opens chat history bottom sheet (Figma 3426:77197). */
  onHistoryClick?: () => void;
};

export function CaiTopOfSheet({ className, onHistoryClick }: Props) {
  const statusTime = useStatusBarTime();

  return (
    <header className={`cai-tos${className ? ` ${className}` : ""}`} data-node-id="1265:67137" data-name="Cai - Top of sheet">
      <div className="cai-tos__status" data-name=".System_Status_Bar">
        <div className="cai-tos__notch" data-name="Notch">
          <img src={notchSvg} alt="" width={219} height={30} decoding="async" />
        </div>
        <div className="cai-tos__status-right" data-name="Right Side">
          <img src={statusRightSvg} alt="" width={67} height={12} decoding="async" />
        </div>
        <div className="cai-tos__time-wrap" data-name="_Time">
          <time className="cai-tos__time" dateTime={statusTime.dateTime}>
            {statusTime.label}
          </time>
        </div>
      </div>

      <div className="cai-tos__nav" data-name="Cai chat header">
        <div className="cai-tos__side cai-tos__side--left" data-name="Left actions">
          <button
            type="button"
            className="cai-tos__icon-btn cai-tos__icon-btn--sheet-back"
            aria-label="Dismiss sheet"
            data-node-id="1180:24527"
            data-name="Sheet dismiss (chevron down)"
          >
            <span className="cai-tos__icon-wrap cai-tos__icon-wrap--back">
              <img src={tosSheetBackSvg} alt="" width={24} height={24} decoding="async" />
            </span>
          </button>
        </div>

        <div className="cai-tos__logo" data-name="Cai Icon - multicolor 1">
          <img src={caiLogoSvg} alt="Cai" width={42} height={42} decoding="async" />
        </div>

        <div className="cai-tos__side cai-tos__side--right" data-name="Right actions">
          <button
            type="button"
            className="cai-tos__icon-btn"
            aria-label="Chat history"
            onClick={() => onHistoryClick?.()}
          >
            <span className="cai-tos__icon-wrap cai-tos__icon-wrap--history">
              <img src={historySvg} alt="" width={24} height={24} decoding="async" />
            </span>
          </button>
          <button type="button" className="cai-tos__icon-btn" aria-label="Cart">
            <span className="cai-tos__icon-wrap">
              <img src={cartSvg} alt="" width={20} height={20} decoding="async" />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
