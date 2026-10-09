/**
 * The dashboard's tile glyphs, lifted out of `HomeView` so the card component, the Add Tools dialog's
 * icon picker, and the hero badge all draw the same shapes.
 *
 * Decorative by design: each sits beside a real text label, so announcing it would only repeat the
 * label to a screen reader. The picker in the dialog is the one place a glyph needs a name, and it
 * gets that from the radio's own label rather than from here.
 */
import type { CardIcon } from "../../lib/dashboard/cards";

/** Default 40×40 so glyphs fill the colored tile squares in the Figma comps. */
export function ToolIcon({
  icon,
  size = 40,
}: {
  icon: CardIcon;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
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
  if (icon === "palette") {
    // Matches assets/mocks/icon-palette.png: full-bleed kidney + thumb hole, four wells.
    const paletteSize = Math.max(size, 44);
    return (
      <svg
        width={paletteSize}
        height={paletteSize}
        viewBox="0 0 64 64"
        aria-hidden
        focusable="false"
        fill="none"
      >
        <path
          d="M32 6C19.3 6 9 15.8 9 28.2c0 8.2 4.5 15.1 11.4 19.1.8 4.8 4.4 8.5 9.1 9.7.8.2 1.5-.4 1.5-1.2V49c0-.9.5-1.6 1.3-2 7.2-3.2 12.2-10.2 12.2-18.8C44.5 15.3 39.2 6 32 6Z"
          stroke="currentColor"
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
        <circle cx="43" cy="36" r="5.2" stroke="currentColor" strokeWidth={3.5} />
        <circle cx="20.5" cy="24" r="3.5" fill="currentColor" />
        <circle cx="31.5" cy="17.5" r="3.5" fill="currentColor" />
        <circle cx="43" cy="21.5" r="3.5" fill="currentColor" />
        <circle cx="46" cy="31" r="3.5" fill="currentColor" />
      </svg>
    );
  }
  if (icon === "chat") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path
          d="M4.25 5.25h11.5a1.25 1.25 0 0 1 1.25 1.25v6a1.25 1.25 0 0 1-1.25 1.25H9.1L6.25 16.1V13.75H4.25A1.25 1.25 0 0 1 3 12.5v-6a1.25 1.25 0 0 1 1.25-1.25Z"
          strokeLinejoin="round"
        />
        <path d="M7.25 9.25h.01M10 9.25h.01M12.75 9.25h.01" strokeLinecap="round" strokeWidth={2.4} />
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
