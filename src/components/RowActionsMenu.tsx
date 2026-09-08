import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TrackerRow } from "../lib/types";

type RowActionsMenuProps = {
  row: TrackerRow;
  index: number;
  total: number;
  onMove: (id: string, direction: -1 | 1) => void;
  onSaveRow: (row: TrackerRow) => void;
  onExportRow: (row: TrackerRow) => void;
  onRequestDelete: (id: string) => void;
};

const MENU_WIDTH = 224;

export function RowActionsMenu({
  row,
  index,
  total,
  onMove,
  onSaveRow,
  onExportRow,
  onRequestDelete,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = row.project.trim() || "Untitled deliverable";

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - trigger.bottom;
    const top =
      menuHeight > 0 && spaceBelow < menuHeight + 8
        ? Math.max(8, trigger.top - menuHeight - 4)
        : trigger.bottom + 4;
    setPosition({
      top,
      left: Math.max(
        8,
        Math.min(trigger.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      ),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    // Follow the trigger rather than closing, so scrolling the table (or the
    // browser scrolling a focused item into view) never dismisses the menu.
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function run(action: () => void) {
    action();
    close();
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
        []),
    ];
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-square min-h-11 min-w-11"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ⋯
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${label}`}
              className="tracker-menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              onKeyDown={onMenuKeyDown}
            >
              <p className="tracker-menu-title">Actions</p>
              <button
                type="button"
                role="menuitem"
                disabled={index === 0}
                onClick={() => run(() => onMove(row.id, -1))}
              >
                Move up
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={index === total - 1}
                onClick={() => run(() => onMove(row.id, 1))}
              >
                Move down
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onSaveRow(row))}
              >
                Save
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onExportRow(row))}
              >
                Export this row
              </button>
              <button
                type="button"
                role="menuitem"
                className="tracker-menu-danger"
                onClick={() => run(() => onRequestDelete(row.id))}
              >
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
