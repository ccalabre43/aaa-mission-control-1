/**
 * Router shell.
 *
 * Mission Control is a dashboard with room for tools that do not exist yet, so routes are declared
 * in one place and each tool owns a view. The Request Queue keeps its own route rather than being
 * absorbed into the home page.
 *
 * The route table doubles as the header's title source, so a new tool cannot ship with an untitled
 * header.
 */
import { Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { HeaderAsideProvider } from "./components/HeaderAside";
import HomeView from "./views/HomeView";
import DeliverablesView from "./views/DeliverablesView";
import RequestSummaryView from "./views/RequestSummaryView";
import RequestFlowView from "./views/request/RequestFlowView";
import ManageQuestionsView from "./views/ManageQuestionsView";
import ManageQueueView from "./views/ManageQueueView";
import NotFoundView from "./views/NotFoundView";

export interface RouteMeta {
  path: string;
  /** Shown next to the logo. Home shows the product name alone. */
  title: string;
  /** Document title, for the browser tab and history. */
  documentTitle: string;
}

export const ROUTES: RouteMeta[] = [
  { path: "/", title: "", documentTitle: "Mission Control" },
  {
    /* The request mocks title this screen "New creative request". */
    path: "/request",
    title: "New creative request",
    documentTitle: "New creative request",
  },
  /*
   * The path stays `/deliverables` while the label reads "Request Queue". Renaming the route would
   * break existing links and both probe scripts for no user-visible gain; it is a tracked follow-up
   * in .cursor/plans/request-queue.md.
   */
  { path: "/deliverables", title: "Request Queue", documentTitle: "Request Queue" },
  {
    path: "/deliverables/requests",
    title: "New creative requests",
    documentTitle: "New creative requests",
  },
  {
    path: "/settings/questions",
    title: "Manage Questions",
    documentTitle: "Manage Questions",
  },
  {
    path: "/settings/queue",
    title: "Manage Queue",
    documentTitle: "Manage Queue",
  },
];

function metaFor(pathname: string): RouteMeta {
  // Longest match wins, so /request/step keeps the Creative Request title.
  const match = [...ROUTES]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (route) =>
        route.path === pathname ||
        (route.path !== "/" && pathname.startsWith(`${route.path}/`)),
    );
  return match ?? { path: pathname, title: "Not found", documentTitle: "Not found" };
}

export default function App() {
  const { pathname } = useLocation();
  const meta = metaFor(pathname);

  // Kept in sync here rather than in each view, so a route cannot ship without a document title.
  // 2.4.2 Page Titled: a single-page app does not update this on its own.
  document.title = `${meta.documentTitle} - AAA Life`;

  return (
    <HeaderAsideProvider>
      <div className="flex min-h-screen flex-col bg-base-100 text-base-content">
        {/* 2.4.1 Bypass Blocks. Visible only on focus. */}
        <a href="#main" className="aaa-skip-link">
          Skip to main content
        </a>
        <Header routeTitle={meta.title} />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/request" element={<RequestFlowView />} />
            <Route path="/deliverables" element={<DeliverablesView />} />
            <Route
              path="/deliverables/requests/:briefId"
              element={<RequestSummaryView />}
            />
            <Route path="/settings/questions" element={<ManageQuestionsView />} />
            <Route path="/settings/queue" element={<ManageQueueView />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </div>
      </div>
    </HeaderAsideProvider>
  );
}
