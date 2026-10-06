/**
 * The Mission Control header.
 *
 * Both mocks draw a two-line lockup: a small gray eyebrow above a bold title. The desktop mock
 * (assets/mocks/main-dashboard-interface.png) also shows the AAA Life logo at the left, separated
 * by a rule; the mobile mock does not, so the logo appears from the `sm` breakpoint up.
 *
 * Copy reconciliation, per the standing copy-correction rule:
 * - The desktop mock reads "Misson Control", which is a typo and is corrected here.
 * - Neither mock's suffix ships. The desktop draws "Creative Dashboard" and the mobile abbreviates
 *   to "Creative Dash"; the title is just "Mission Control" at every breakpoint, so there is no
 *   longer a per-width variant to reconcile. Mocks are layout references, not copy decks.
 * - The eyebrow names the product, not the department. It read "Internal Creative & Content Agency",
 *   which named the team; "Creative Toolset" fits a dashboard that will hold several tools. The
 *   separator is a middle dot, not a bullet.
 *
 * The wordmark is deliberately NOT retyped beside the logo: the logo already contains "Life
 * Insurance Company", and repeating it would read as a second, unauthorized lockup.
 */
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/aaa-life-logo-2color.png";
import { useHeaderFlowStep } from "./HeaderAside";
import { FlowStepper } from "./FlowStepper";

interface HeaderProps {
  /** Empty on the home route, where the product name stands alone. */
  routeTitle: string;
}

export function Header({ routeTitle }: HeaderProps) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const flowStep = useHeaderFlowStep();

  const logoImage = (
    <img src={logo} alt="AAA Life Insurance Company" className="aaa-header-logo" />
  );

  return (
    <header className="aaa-header">
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        {isHome ? (
          <span className="hidden sm:block">{logoImage}</span>
        ) : (
          /* Off the home route the logo doubles as the way back, which is the convention users
             already expect from every other site (Jakob's Law). */
          <Link
            to="/"
            className="aaa-header-home hidden sm:block"
            aria-label="Mission Control home"
          >
            {logoImage}
          </Link>
        )}

        <span className="aaa-header-divider hidden sm:block" aria-hidden="true" />

        <div className="min-w-0">
          <p className="aaa-header-eyebrow">
            AAA Life <span aria-hidden="true">&middot;</span> Creative Toolset
          </p>
          <p className="aaa-header-title">
            Mission Control
            {routeTitle ? (
              <>
                <span className="aaa-header-sep" aria-hidden="true">
                  /
                </span>
                <span className="aaa-header-route">{routeTitle}</span>
              </>
            ) : null}
          </p>
        </div>

        {/* The request flow publishes its step and the stepper renders here. Hidden on small
            screens, where it would crowd the title; the "Step 3 of ..." label above each question
            carries the same information at every width. */}
        {flowStep ? (
          <div className="ml-auto hidden lg:block">
            <FlowStepper step={flowStep} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
