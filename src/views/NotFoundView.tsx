/**
 * Unknown route.
 *
 * Worth having rather than falling through to a blank screen: once this is hosted, a stale
 * bookmark or a host with a misconfigured SPA fallback will land here, and "page not found" is a
 * far better diagnostic than an empty page.
 */
import { Link } from "react-router-dom";

export default function NotFoundView() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="aaa-page-heading">That page does not exist</h1>
      <p className="aaa-page-sub">
        The link may be out of date. Everything is reachable from Mission Control.
      </p>
      <p className="mt-6">
        <Link to="/" className="aaa-btn aaa-btn-primary">
          Back to Mission Control
        </Link>
      </p>
    </main>
  );
}
