/**
 * Request Queue page: reviewer Request queue tab + Executive dashboard tab.
 *
 * Requests stay on `aaa-intake-briefs`. Jobs-in-motion counts on the Executive tab still read
 * `aaa-project-tracker` from this browser; the Project tracker editor UI is not shown for now.
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RequestQueueSection } from "../components/queue/RequestQueueSection";
import { ExecutiveDashboardSection } from "../components/queue/ExecutiveDashboardSection";
import { loadRows } from "../lib/storage";
import type { TrackerRow } from "../lib/types";

type PageTab = "queue" | "executive";

const initialLoad = loadRows();

function tabFromSearch(params: URLSearchParams): PageTab {
  return params.get("tab") === "executive" ? "executive" : "queue";
}

export default function DeliverablesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageTab = tabFromSearch(searchParams);
  const [rows] = useState<TrackerRow[]>(initialLoad.rows);

  function selectTab(tab: PageTab) {
    if (tab === "executive") {
      setSearchParams({ tab: "executive" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  const pageHeading =
    pageTab === "executive"
      ? "Mission Control / Executive dashboard"
      : "Mission Control / New creative requests";

  return (
    <main id="main" className="aaa-page-shell py-6">
      <h1 className="font-display text-3xl text-secondary">{pageHeading}</h1>

      <div
        className="aaa-page-tabs"
        role="tablist"
        aria-label="Request Queue sections"
      >
        <button
          type="button"
          role="tab"
          id="tab-request-queue"
          aria-selected={pageTab === "queue"}
          aria-controls="panel-request-queue"
          className={pageTab === "queue" ? "aaa-page-tab is-active" : "aaa-page-tab"}
          onClick={() => selectTab("queue")}
        >
          Request queue
        </button>
        <button
          type="button"
          role="tab"
          id="tab-executive"
          aria-selected={pageTab === "executive"}
          aria-controls="panel-executive"
          className={
            pageTab === "executive" ? "aaa-page-tab is-active" : "aaa-page-tab"
          }
          onClick={() => selectTab("executive")}
        >
          Executive dashboard
        </button>
      </div>

      <div
        id="panel-request-queue"
        role="tabpanel"
        aria-labelledby="tab-request-queue"
        hidden={pageTab !== "queue"}
        className="aaa-page-tabpanel"
      >
        <RequestQueueSection />
      </div>

      <div
        id="panel-executive"
        role="tabpanel"
        aria-labelledby="tab-executive"
        hidden={pageTab !== "executive"}
        className="aaa-page-tabpanel"
      >
        <ExecutiveDashboardSection trackerRows={rows} dataEpoch={0} />
      </div>
    </main>
  );
}
