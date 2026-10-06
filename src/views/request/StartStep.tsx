/**
 * Step 1, per assets/mocks/creative-request-interface.png: department, first and last name, email.
 *
 * The mock uses placeholder text as the only label ("FirstName", "yourname@aaalife.com"). That
 * fails 3.3.2 Labels or Instructions, because a placeholder disappears as soon as someone types and
 * is unreliable for assistive tech. Real visible labels are used instead, which is a deliberate
 * correction rather than a deviation.
 *
 * Name, email, and department are PII. They stay in this browser and are clearable from the home
 * screen.
 */
import { useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { emptyIdentity, type RequesterIdentity } from "../../lib/intake/types";

/**
 * Placeholder list. AAA Life's real group and department names have NOT been provided, so these are
 * a reasonable guess and are flagged as an open item in docs/INDEX.md. A free-text "Other" option
 * exists so nobody is blocked by a missing entry (Postel's Law).
 */
const DEPARTMENTS = [
  "Brand Creative Services",
  "Corporate Communications",
  "Marketing",
  "Digital",
  "Product",
  "Sales",
  "Member Services",
  "Underwriting",
  "Claims",
  "Legal and Compliance",
  "Finance",
  "Information Technology",
  "Human Resources",
  "Other",
] as const;

const OTHER = "Other";

interface StartStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  identity: RequesterIdentity;
  onStart: (identity: RequesterIdentity) => void;
  onCancel: () => void;
}

export default function StartStep({
  headingRef,
  identity,
  onStart,
  onCancel,
}: StartStepProps) {
  const [draft, setDraft] = useState<RequesterIdentity>(
    identity.firstName || identity.email ? identity : emptyIdentity(),
  );
  const known = (DEPARTMENTS as readonly string[]).includes(draft.department);
  const [useOther, setUseOther] = useState(Boolean(draft.department) && !known);
  const [touched, setTouched] = useState(false);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());
  const complete =
    draft.firstName.trim() !== "" &&
    draft.lastName.trim() !== "" &&
    emailLooksValid &&
    draft.department.trim() !== "";

  function update(patch: Partial<RequesterIdentity>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!complete) return;
    onStart({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      department: draft.department.trim(),
    });
  }

  const showEmailError = touched && draft.email.trim() !== "" && !emailLooksValid;

  return (
    <div className="aaa-flow-centered">
      <span className="aaa-hero-badge" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.9} focusable="false">
          <path d="M5 7h10M5 10h10M5 13h6" strokeLinecap="round" />
        </svg>
      </span>

      <h1 className="aaa-flow-heading" tabIndex={-1} ref={headingRef}>
        Start a creative request
      </h1>

      <p className="aaa-flow-sub">
        A few guided questions replace the email thread. The system drafts your creative
        brief, flags related activity, and routes it for review. Enter your name and email
        to begin.
      </p>

      <form className="aaa-form" onSubmit={submit} noValidate>
        <div className="aaa-field-group">
          <label className="aaa-label" htmlFor="department">
            Group or department
          </label>
          <select
            id="department"
            className="aaa-input"
            value={useOther ? OTHER : draft.department}
            onChange={(event) => {
              const value = event.target.value;
              if (value === OTHER) {
                setUseOther(true);
                update({ department: "" });
              } else {
                setUseOther(false);
                update({ department: value });
              }
            }}
            required
          >
            <option value="">Select your group or department</option>
            {DEPARTMENTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {useOther ? (
          <div className="aaa-field-group">
            <label className="aaa-label" htmlFor="department-other">
              Your group or department
            </label>
            <input
              id="department-other"
              className="aaa-input"
              value={draft.department}
              onChange={(event) => update({ department: event.target.value })}
              autoComplete="organization"
            />
          </div>
        ) : null}

        <div className="aaa-field-row">
          <div className="aaa-field-group">
            <label className="aaa-label" htmlFor="first-name">
              First name
            </label>
            <input
              id="first-name"
              className="aaa-input"
              value={draft.firstName}
              onChange={(event) => update({ firstName: event.target.value })}
              autoComplete="given-name"
              required
            />
          </div>
          <div className="aaa-field-group">
            <label className="aaa-label" htmlFor="last-name">
              Last name
            </label>
            <input
              id="last-name"
              className="aaa-input"
              value={draft.lastName}
              onChange={(event) => update({ lastName: event.target.value })}
              autoComplete="family-name"
              required
            />
          </div>
        </div>

        <div className="aaa-field-group">
          <label className="aaa-label" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            className="aaa-input"
            value={draft.email}
            onChange={(event) => update({ email: event.target.value })}
            placeholder="yourname@aaalife.com"
            autoComplete="email"
            aria-invalid={showEmailError || undefined}
            aria-describedby={showEmailError ? "email-error" : undefined}
            required
          />
          {/* Error text, not color alone (1.4.1). */}
          <p id="email-error" className="aaa-field-error" role="alert">
            {showEmailError ? "Enter an email address like yourname@aaalife.com." : ""}
          </p>
        </div>

        {touched && !complete ? (
          <p className="aaa-field-error" role="alert">
            Fill in your department, name, and email to continue.
          </p>
        ) : null}

        <div className="aaa-flow-actions aaa-flow-actions-center">
          <button type="submit" className="aaa-btn aaa-btn-primary">
            Start request
          </button>
        </div>
      </form>

      <p className="aaa-flow-footnote">
        <Link to="/" className="aaa-link-quiet" onClick={onCancel}>
          Back to Mission Control
        </Link>
      </p>
    </div>
  );
}
