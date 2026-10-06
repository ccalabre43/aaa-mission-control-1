/**
 * The dashboard's tile glyphs, lifted out of `HomeView` so the card component, the Add Tools dialog's
 * icon picker, and the hero badge all draw the same shapes.
 *
 * Decorative by design: each sits beside a real text label, so announcing it would only repeat the
 * label to a screen reader. The picker in the dialog is the one place a glyph needs a name, and it
 * gets that from the radio's own label rather than from here.
 */
import type { CardIcon } from "../../lib/dashboard/cards";

export function ToolIcon({ icon }: { icon: CardIcon }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    "aria-hidden": true as const,
    focusable: "false" as const,
  };
  if (icon === "plus") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "window") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4.5" width="14" height="11" rx="1.5" />
        <path d="M6 12h8" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "search") {
    // Centered lens + short 45° handle, matching the orange badge reference.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="9" cy="9" r="4.5" />
        <path d="M12.25 12.25L15.75 15.75" strokeLinecap="round" />
      </svg>
    );
  }
  // "lines" and "document" differ only in line length, matching the mock's two glyphs.
  const paths =
    icon === "lines"
      ? ["M5 7h10", "M5 10h10", "M5 13h6"]
      : ["M5 7h10", "M5 10h7", "M5 13h9"];
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.9}>
      {paths.map((d) => (
        <path key={d} d={d} strokeLinecap="round" />
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
