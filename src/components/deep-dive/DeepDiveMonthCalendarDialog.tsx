/**
 * Month overview of Deep Dive Wednesdays (SharePoint-style upcoming list).
 * Past dates are muted; future Wednesdays stay selectable via the parent picker.
 */
import { useEffect, useRef } from "react";
import {
  formatWeekdayLong,
  isPastDay,
  wednesdaysInMonth,
  type QuarterMonth,
} from "../../lib/meetings/calendar";
import { toDateInputValue } from "../../lib/meetings";

export interface DeepDiveMonthCalendarDialogProps {
  month: QuarterMonth;
  selectedYmd: string;
  onSelectDay: (ymd: string) => void;
  onClose: () => void;
}

export function DeepDiveMonthCalendarDialog({
  month,
  selectedYmd,
  onSelectDay,
  onClose,
}: DeepDiveMonthCalendarDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wednesdays = wednesdaysInMonth(month.year, month.month);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      className="aaa-modal-scrim aaa-sent-dialog-scrim"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="aaa-modal aaa-deep-dive-month-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deep-dive-month-cal-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aaa-sent-dialog-body">
          <h2
            id="deep-dive-month-cal-heading"
            className="aaa-sent-dialog-heading"
            tabIndex={-1}
            ref={headingRef}
          >
            {month.label} calendar
          </h2>
          <p className="aaa-sent-dialog-copy">
            Deep Dive sessions are on Wednesdays, 1:05 PM – 2:00 PM. Past dates are shown muted.
          </p>
          <ul className="aaa-deep-dive-month-list">
            {wednesdays.map((day) => {
              const ymd = toDateInputValue(day);
              const past = isPastDay(day);
              const selected = ymd === selectedYmd;
              return (
                <li key={ymd}>
                  {past ? (
                    <span className="aaa-deep-dive-month-row is-past">
                      <span className="aaa-deep-dive-month-when">
                        {formatWeekdayLong(day)}
                      </span>
                      <span className="aaa-deep-dive-month-status">Past</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`aaa-deep-dive-month-row is-upcoming${
                        selected ? " is-selected" : ""
                      }`}
                      onClick={() => {
                        onSelectDay(ymd);
                        onClose();
                      }}
                    >
                      <span className="aaa-deep-dive-month-when">
                        {formatWeekdayLong(day)}
                      </span>
                      <span className="aaa-deep-dive-month-status">
                        {selected ? "Selected" : "Open"}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="aaa-sent-dialog-foot">
          <button type="button" className="aaa-sent-dialog-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
