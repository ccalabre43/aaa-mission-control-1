/**
 * Custom Deep Dive date picker: fixed 3-month quarter (Oct–Dec 2026), Wednesdays only.
 */
import {
  formatMonthDayYear,
  INITIAL_QUARTER,
  isPastDay,
  isWednesday,
  monthGridCells,
  parseDateInputValue,
  toDateInputValue,
  type QuarterMonth,
} from "../../lib/meetings/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface DeepDiveDatePickerProps {
  id: string;
  value: string;
  viewedMonth: QuarterMonth;
  onViewedMonthChange: (month: QuarterMonth) => void;
  onChange: (ymd: string) => void;
  disabled?: boolean;
}

export function DeepDiveDatePicker({
  id,
  value,
  viewedMonth,
  onViewedMonthChange,
  onChange,
  disabled = false,
}: DeepDiveDatePickerProps) {
  const selected = parseDateInputValue(value);
  const cells = monthGridCells(viewedMonth.year, viewedMonth.month);

  return (
    <div className="aaa-deep-dive-datepicker">
      <div
        className="aaa-deep-dive-datepicker-months"
        role="tablist"
        aria-label="Deep Dive quarter"
      >
        {INITIAL_QUARTER.map((month) => {
          const active =
            month.year === viewedMonth.year && month.month === viewedMonth.month;
          return (
            <button
              key={month.label}
              type="button"
              role="tab"
              aria-selected={active}
              className={`aaa-deep-dive-datepicker-month${active ? " is-active" : ""}`}
              disabled={disabled}
              onClick={() => onViewedMonthChange(month)}
            >
              {month.label.replace(/ \d{4}$/, "")}
            </button>
          );
        })}
      </div>

      <p className="aaa-deep-dive-datepicker-caption" id={`${id}-caption`}>
        {viewedMonth.label} · Wednesdays only
      </p>

      <div
        className="aaa-deep-dive-datepicker-grid"
        role="grid"
        aria-labelledby={`${id}-caption`}
      >
        <div className="aaa-deep-dive-datepicker-weekdays" role="row">
          {WEEKDAYS.map((label) => (
            <div key={label} className="aaa-deep-dive-datepicker-weekday" role="columnheader">
              {label}
            </div>
          ))}
        </div>
        <div className="aaa-deep-dive-datepicker-weeks">
          {Array.from({ length: cells.length / 7 }, (_, week) => (
            <div key={week} className="aaa-deep-dive-datepicker-week" role="row">
              {cells.slice(week * 7, week * 7 + 7).map((cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${week}-${index}`}
                      className="aaa-deep-dive-datepicker-cell is-empty"
                      role="gridcell"
                    />
                  );
                }
                const ymd = toDateInputValue(cell);
                const wed = isWednesday(cell);
                const past = isPastDay(cell);
                const isSelected =
                  selected != null && toDateInputValue(selected) === ymd;
                const selectable = wed && !past && !disabled;

                if (!wed) {
                  return (
                    <div
                      key={ymd}
                      className="aaa-deep-dive-datepicker-cell is-other"
                      role="gridcell"
                    >
                      <span aria-hidden="true">{cell.getDate()}</span>
                    </div>
                  );
                }

                if (past) {
                  return (
                    <div
                      key={ymd}
                      className="aaa-deep-dive-datepicker-cell is-past"
                      role="gridcell"
                      aria-disabled="true"
                    >
                      <span>{cell.getDate()}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={ymd}
                    className={`aaa-deep-dive-datepicker-cell is-wed${
                      isSelected ? " is-selected" : ""
                    }`}
                    role="gridcell"
                  >
                    <button
                      type="button"
                      className="aaa-deep-dive-datepicker-day"
                      aria-label={formatMonthDayYear(cell)}
                      aria-pressed={isSelected}
                      disabled={!selectable}
                      onClick={() => onChange(ymd)}
                    >
                      {cell.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
