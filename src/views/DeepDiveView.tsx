/**
 * Deep Dive scheduling UI. Excel on SharePoint remains the system of record.
 * `SharePointExcelScheduler` prefers `/api/deep-dive` when the proxy is connected; otherwise
 * falls back to the local stub. Live PII writes require DEEP_DIVE_LIVE_WRITE=1 (decisions 044, 046).
 */
import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DeepDiveBookedDialog } from "../components/deep-dive/DeepDiveBookedDialog";
import { DeepDiveDatePicker } from "../components/deep-dive/DeepDiveDatePicker";
import { DeepDiveMonthCalendarDialog } from "../components/deep-dive/DeepDiveMonthCalendarDialog";
import { ToolIcon } from "../components/dashboard/ToolIcon";
import {
  defaultBookableWednesday,
  describeEmptySlots,
  findQuarterMonth,
  formatMonthDayYear,
  INITIAL_QUARTER,
  meetingScheduler,
  parseDateInputValue,
  resetSlots,
  type DeepDiveAudience,
  type MeetingSlot,
  type QuarterMonth,
  type ScheduleCoverage,
} from "../lib/meetings";

const AUDIENCE_OPTIONS: readonly DeepDiveAudience[] = [
  "Full Team",
  "Leadership",
];

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSlotRange(slot: MeetingSlot): string {
  const start = new Date(slot.startsAt);
  if (Number.isNaN(start.getTime())) return slot.startsAt;
  const end = new Date(start.getTime() + slot.durationMinutes * 60_000);
  return `${formatClock(start)} – ${formatClock(end)}`;
}

function formatSlotWhen(slot: MeetingSlot): string {
  const start = new Date(slot.startsAt);
  if (Number.isNaN(start.getTime())) return formatSlotRange(slot);
  return `${formatMonthDayYear(start)} · ${formatSlotRange(slot)}`;
}

function monthForDay(ymd: string): QuarterMonth {
  const date = parseDateInputValue(ymd);
  if (date) {
    const found = findQuarterMonth(date.getFullYear(), date.getMonth());
    if (found) return found;
  }
  return INITIAL_QUARTER[0];
}

export default function DeepDiveView() {
  const formId = useId();
  const dateId = `${formId}-date`;
  const slotSelectId = `${formId}-slot`;
  const [day, setDay] = useState(defaultBookableWednesday);
  const [viewedMonth, setViewedMonth] = useState<QuarterMonth>(() =>
    monthForDay(defaultBookableWednesday()),
  );
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [coverage, setCoverage] = useState<ScheduleCoverage | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<DeepDiveAudience | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<MeetingSlot | null>(null);
  const [monthCalOpen, setMonthCalOpen] = useState(false);

  async function refresh(forDay: string) {
    if (!parseDateInputValue(forDay)) {
      setSlots([]);
      setCoverage(null);
      setSelectedId("");
      return;
    }
    const result = await meetingScheduler.listOpenSlots(forDay);
    setSlots(result.slots);
    setCoverage(result.coverage);
    setSelectedId((current) =>
      result.slots.some((slot) => slot.id === current) ? current : "",
    );
  }

  useEffect(() => {
    void refresh(day);
  }, [day]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (audience !== "Full Team" && audience !== "Leadership") {
        setError("Choose an audience: Full Team or Leadership.");
        setBusy(false);
        return;
      }
      const result = await meetingScheduler.book({
        day,
        slotId: selectedId,
        requesterName: name,
        requesterEmail: email,
        audience,
        title: title || undefined,
        notes: notes || undefined,
      });
      setCoverage(result.coverage);
      if (!result.ok) {
        setError(result.reason);
        await refresh(day);
        return;
      }
      setSuccess(result.slot);
      setName("");
      setEmail("");
      setTitle("");
      setAudience("");
      setNotes("");
      setSelectedId("");
      await refresh(day);
    } finally {
      setBusy(false);
    }
  }

  function handleResetDemo() {
    resetSlots();
    setSuccess(null);
    setError(null);
    setSelectedId("");
    void refresh(day);
  }

  function handleDayChange(ymd: string) {
    setDay(ymd);
    setViewedMonth(monthForDay(ymd));
    setSelectedId("");
    setError(null);
  }

  const emptyText =
    coverage && day && slots.length === 0 ? describeEmptySlots(coverage) : null;
  const dayLabel = parseDateInputValue(day)
    ? formatMonthDayYear(parseDateInputValue(day)!)
    : null;

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-4">
        <Link to="/" className="aaa-btn aaa-btn-text">
          Back to Mission Control
        </Link>
      </p>

      <div className="aaa-deep-dive-title-row">
        <span className="aaa-tool-icon aaa-tile-bronze" aria-hidden="true">
          <ToolIcon icon="search" />
        </span>
        <h1 className="aaa-page-heading aaa-deep-dive-heading">Deep Dive</h1>
      </div>
      <p className="aaa-page-sub">
        Book a working session with Brand Integrated Marketing. Availability comes from the Deep
        Dive proxy when SharePoint is connected, otherwise this browser’s local demo scheduler.
        Live writes to Excel stay off until Vendor Management clears them. Sessions are Wednesdays
        only in October–December 2026.
      </p>

      <form className="aaa-form mt-8" onSubmit={handleSubmit} noValidate>
        <div className="aaa-field-group">
          <span className="aaa-label" id={`${dateId}-label`}>
            Choose a date
          </span>
          <DeepDiveDatePicker
            id={dateId}
            value={day}
            viewedMonth={viewedMonth}
            onViewedMonthChange={setViewedMonth}
            onChange={handleDayChange}
            disabled={busy}
          />
          {dayLabel ? (
            <p className="aaa-field-hint">Selected: {dayLabel}</p>
          ) : null}
        </div>

        <div className="aaa-field-group mt-4">
          <label className="aaa-label" htmlFor={slotSelectId}>
            Open time slot
          </label>
          <select
            id={slotSelectId}
            className="aaa-input"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            required
            disabled={busy || slots.length === 0}
          >
            <option value="">Choose a time slot</option>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {formatSlotRange(slot)}
              </option>
            ))}
          </select>
          <p className="aaa-field-hint">1:05 PM – 2:00 PM · 15-minute increments</p>
        </div>

        {emptyText ? (
          <p className="mt-4" role="status">
            {emptyText}
          </p>
        ) : null}

        <div className="aaa-field-group mt-4">
          <label className="aaa-label" htmlFor={`${formId}-name`}>
            Your name
          </label>
          <input
            id={`${formId}-name`}
            className="aaa-input"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="aaa-field-group mt-4">
          <label className="aaa-label" htmlFor={`${formId}-email`}>
            Work email
          </label>
          <input
            id={`${formId}-email`}
            className="aaa-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />
          <p className="aaa-field-hint">
            Stays on this device unless the Deep Dive proxy kill switch is on and Vendor Management
            has cleared a live SharePoint write (decision 046).
          </p>
        </div>

        <div className="aaa-field-group mt-4">
          <label className="aaa-label" htmlFor={`${formId}-title`}>
            Topic
          </label>
          <input
            id={`${formId}-title`}
            className="aaa-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={busy}
          />
        </div>

        <fieldset className="aaa-deep-dive-audience mt-4" disabled={busy}>
          <legend className="aaa-label aaa-deep-dive-audience-legend">Audience</legend>
          <div className="aaa-deep-dive-audience-options">
            {AUDIENCE_OPTIONS.map((option) => {
              const inputId = `${formId}-audience-${option.replace(/\s+/g, "-").toLowerCase()}`;
              return (
                <label key={option} htmlFor={inputId} className="aaa-radio-row">
                  <input
                    id={inputId}
                    type="radio"
                    name={`${formId}-audience`}
                    className="aaa-radio"
                    value={option}
                    checked={audience === option}
                    onChange={() => setAudience(option)}
                    required
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="aaa-field-group mt-4">
          <label className="aaa-label" htmlFor={`${formId}-notes`}>
            Notes (optional)
          </label>
          <textarea
            id={`${formId}-notes`}
            className="aaa-input"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="aaa-field-error mt-4" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            className="aaa-btn aaa-btn-primary"
            disabled={busy || !selectedId || !day}
          >
            {busy ? "Booking…" : "Book Deep Dive"}
          </button>
          <button
            type="button"
            className="aaa-btn aaa-btn-secondary"
            onClick={() => setMonthCalOpen(true)}
            disabled={busy}
          >
            View this month&apos;s calendar
          </button>
          <button
            type="button"
            className="aaa-btn aaa-btn-secondary"
            onClick={handleResetDemo}
            disabled={busy}
          >
            Reset demo bookings
          </button>
        </div>
      </form>

      {monthCalOpen ? (
        <DeepDiveMonthCalendarDialog
          month={viewedMonth}
          selectedYmd={day}
          onSelectDay={handleDayChange}
          onClose={() => setMonthCalOpen(false)}
        />
      ) : null}

      {success ? (
        <DeepDiveBookedDialog
          whenSummary={formatSlotWhen(success)}
          topic={success.title}
          audience={success.audience}
          onClose={() => setSuccess(null)}
        />
      ) : null}
    </main>
  );
}
