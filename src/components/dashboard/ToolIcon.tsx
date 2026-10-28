/**
 * The dashboard's tile glyphs, shared by home cards and the Add Tools dialog.
 *
 * Decorative by design: each sits beside a real text label. The dialog picker names choices via
 * adjacent text (or sr-only labels), never by the glyph alone.
 *
 * Concept v1 Figma exports keep their root width/height. Pass `compact` in the Add a tool picker
 * to use the 20×20 variants from node 369-4561.
 */
import type { CardIcon } from "../../lib/dashboard/cards";
import paletteSrc from "../../assets/dashboard-icons/palette.svg";
import frameSrc from "../../assets/dashboard-icons/frame-view.svg";
import magnifySrc from "../../assets/dashboard-icons/magnify.svg";
import addSrc from "../../assets/dashboard-icons/add.svg";
import chartSrc from "../../assets/dashboard-icons/chart.svg";
import briefcaseSrc from "../../assets/dashboard-icons/briefcase.svg";
import starSrc from "../../assets/dashboard-icons/star.svg";
import pickerPaletteSrc from "../../assets/dashboard-icons/picker-palette.svg";
import pickerChartSrc from "../../assets/dashboard-icons/picker-chart.svg";
import pickerBriefcaseSrc from "../../assets/dashboard-icons/picker-briefcase.svg";
import pickerStarSrc from "../../assets/dashboard-icons/picker-star.svg";

type Glyph = { src: string; width: number; height: number };

const CARD_GLYPHS: Partial<Record<CardIcon, Glyph>> = {
  palette: { src: paletteSrc, width: 40, height: 40 },
  frame: { src: frameSrc, width: 42, height: 42 },
  search: { src: magnifySrc, width: 35, height: 35 },
  plus: { src: addSrc, width: 40, height: 40 },
  chart: { src: chartSrc, width: 40, height: 40 },
  briefcase: { src: briefcaseSrc, width: 40, height: 40 },
  star: { src: starSrc, width: 20, height: 20 },
};

const PICKER_GLYPHS: Partial<Record<CardIcon, Glyph>> = {
  palette: { src: pickerPaletteSrc, width: 20, height: 20 },
  chart: { src: pickerChartSrc, width: 20, height: 20 },
  briefcase: { src: pickerBriefcaseSrc, width: 20, height: 20 },
  star: { src: pickerStarSrc, width: 20, height: 20 },
};

export function ToolIcon({
  icon,
  size = 34,
  compact = false,
}: {
  icon: CardIcon;
  size?: number;
  /** Use the 20px Figma picker assets from Add a tool. */
  compact?: boolean;
}) {
  const figma = compact ? PICKER_GLYPHS[icon] ?? CARD_GLYPHS[icon] : CARD_GLYPHS[icon];
  if (figma) {
    return (
      <img
        src={figma.src}
        alt=""
        width={figma.width}
        height={figma.height}
        aria-hidden="true"
        className="aaa-tool-glyph"
      />
    );
  }

  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    focusable: "false" as const,
  };

  if (icon === "window") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 15h10" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg
        {...common}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth={2.75} />
      </svg>
    );
  }

  const paths =
    icon === "lines"
      ? ["M5 8h14", "M5 12h14", "M5 16h9"]
      : ["M5 8h14", "M5 12h11", "M5 16h13"];
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The six-dot grip on each card's reorder handle. */
export function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      {[4, 7, 10].map((y) =>
        [5, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" />),
      )}
    </svg>
  );
}
