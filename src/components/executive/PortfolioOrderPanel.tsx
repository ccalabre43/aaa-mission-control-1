/**
 * Portfolio Optimization order for TEST PORTFOLIO - CHRIS.
 * Drag / keyboard / Move up-down + Apply order (mirrors Workfront Set Priority).
 * Separate from Request Queue P1–P3 Task urgency (decision 052).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyPortfolioOrder,
  fetchPortfolioProjects,
  type WorkfrontPortfolioProject,
} from "../../lib/workfront/proxyClient";
import {
  fetchWorkfrontHealth,
  type WorkfrontProxyHealth,
} from "../../lib/workfront/proxyHealth";
import { buildPortfolioRanks } from "../../lib/workfront/priorityMap";

function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="4" cy="3" r="1.25" fill="currentColor" />
      <circle cx="10" cy="3" r="1.25" fill="currentColor" />
      <circle cx="4" cy="7" r="1.25" fill="currentColor" />
      <circle cx="10" cy="7" r="1.25" fill="currentColor" />
      <circle cx="4" cy="11" r="1.25" fill="currentColor" />
      <circle cx="10" cy="11" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function PortfolioOrderPanel() {
  const [health, setHealth] = useState<WorkfrontProxyHealth | null>(null);
  const [projects, setProjects] = useState<WorkfrontPortfolioProject[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [coverage, setCoverage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [refocus, setRefocus] = useState<{ id: string; tick: number } | null>(null);
  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const gripRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await fetchPortfolioProjects();
    setCoverage(result.coverage);
    if (!result.ok) {
      setProjects([]);
      setSavedOrder([]);
      setError(result.error ?? "Could not load portfolio projects.");
      setLoading(false);
      return;
    }
    setProjects(result.projects);
    setSavedOrder(result.projects.map((project) => project.ID));
    setStatus(
      result.projects.length === 0
        ? "No projects returned for this portfolio."
        : `Loaded ${result.projects.length} project${result.projects.length === 1 ? "" : "s"} from Workfront.`,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkfrontHealth(controller.signal).then(setHealth);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!refocus) return;
    gripRefs.current.get(refocus.id)?.focus();
  }, [refocus]);

  const orderedIds = projects.map((project) => project.ID);
  const pending =
    orderedIds.length > 0 &&
    (orderedIds.length !== savedOrder.length ||
      orderedIds.some((id, index) => id !== savedOrder[index]));

  function announce(message: string) {
    setStatus(message);
    if (liveRef.current) liveRef.current.textContent = message;
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = projects.findIndex((project) => project.ID === fromId);
    const to = projects.findIndex((project) => project.ID === toId);
    if (from < 0 || to < 0) return;
    setProjects((current) => moveIndex(current, from, to));
    announce(`Moved ${projects[from]?.name ?? "project"} to position ${to + 1}.`);
  }

  function step(id: string, delta: -1 | 1) {
    const index = projects.findIndex((project) => project.ID === id);
    if (index < 0) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= projects.length) {
      announce("Already at the end of the list.");
      return;
    }
    setProjects((current) => moveIndex(current, index, nextIndex));
    setRefocus({ id, tick: Date.now() });
    announce(
      `Moved ${projects[index]?.name ?? "project"} to position ${nextIndex + 1} of ${projects.length}.`,
    );
  }

  async function applyOrder() {
    if (!pending || applying) return;
    const wantLive = Boolean(health?.connected && health.liveSubmit);
    if (!wantLive) {
      setError(
        health?.connected
          ? "Live submit is off (WORKFRONT_LIVE_SUBMIT). Order is pending in this browser only."
          : "Workfront proxy is not connected. Order cannot be applied.",
      );
      return;
    }
    const ranks = buildPortfolioRanks(orderedIds);
    const confirmed = window.confirm(
      [
        `Apply Portfolio Optimization order for ${ranks.length} project${ranks.length === 1 ? "" : "s"}?`,
        "",
        "This writes project portfolioPriority (the # column in Portfolio Optimization), not Task urgency (P1–P3).",
      ].join("\n"),
    );
    if (!confirmed) {
      announce("Apply order cancelled. Pending local order kept.");
      return;
    }
    setApplying(true);
    setError("");
    const result = await applyPortfolioOrder({
      orderedProjectIds: orderedIds,
      confirmLive: true,
    });
    setApplying(false);
    if (!result.ok) {
      setError(result.error);
      announce("Apply order failed. Pending local order kept.");
      return;
    }
    setSavedOrder(orderedIds);
    setProjects((current) =>
      current.map((project, index) => ({
        ...project,
        portfolioPriority: index + 1,
      })),
    );
    setCoverage(result.coverage);
    announce(`Order saved: ${result.count} project${result.count === 1 ? "" : "s"}.`);
  }

  return (
    <section className="aaa-exec-portfolio-order" aria-labelledby="exec-portfolio-order-heading">
      <div className="aaa-exec-portfolio-order-head">
        <div>
          <h3 id="exec-portfolio-order-heading" className="aaa-exec-table-title">
            Portfolio Optimization order
          </h3>
          <p className="aaa-exec-table-note" role="note">
            Drag rows or use Move up / Move down, then Apply order — same pattern as Workfront
            Set Priority. Ranks {projects.length} project
            {projects.length === 1 ? "" : "s"} in TEST PORTFOLIO - CHRIS
            {pending ? " (order changed — Apply to update Workfront)" : ""}.
          </p>
        </div>
        <div className="aaa-exec-portfolio-order-actions">
          <button
            type="button"
            className="aaa-btn aaa-btn-secondary"
            onClick={() => void load()}
            disabled={loading || applying}
          >
            {loading ? "Loading…" : "Refresh from Workfront"}
          </button>
          <button
            type="button"
            className="aaa-btn aaa-btn-primary"
            onClick={() => void applyOrder()}
            disabled={!pending || applying || loading}
          >
            {applying ? "Applying…" : "Apply order"}
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" ref={liveRef} />
      {status ? (
        <p className="aaa-exec-portfolio-order-status" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="aaa-exec-portfolio-order-error" role="alert">
          {error}
        </p>
      ) : null}
      {coverage ? (
        <p className="aaa-exec-table-note" role="note">
          {coverage}
        </p>
      ) : null}

      {projects.length === 0 && !loading ? (
        <p className="aaa-exec-caption">
          No portfolio projects to order. Set WORKFRONT_PORTFOLIO_ID on the proxy when the Portfolio
          ID for TEST PORTFOLIO - CHRIS is known.
        </p>
      ) : (
        <div className="aaa-exec-table-wrap">
          <table className="aaa-exec-data-table aaa-exec-portfolio-order-table">
            <thead>
              <tr>
                <th scope="col" className="aaa-exec-portfolio-order-grip-col">
                  <span className="sr-only">Reorder</span>
                </th>
                <th scope="col">#</th>
                <th scope="col">Project</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project, index) => {
                const armed = armedId === project.ID;
                const isOver =
                  dropTargetId === project.ID && draggingId !== project.ID;
                return (
                  <tr
                    key={project.ID}
                    className={[
                      isOver ? "aaa-exec-portfolio-order-row-over" : "",
                      armed ? "aaa-exec-portfolio-order-row-armed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragOver={(event) => {
                      if (draggingId) event.preventDefault();
                    }}
                    onDragEnter={() => {
                      if (draggingId) setDropTargetId(project.ID);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingId) reorder(draggingId, project.ID);
                      setDraggingId(null);
                      setDropTargetId(null);
                    }}
                  >
                    <td>
                      <span className="aaa-exec-portfolio-order-reorder">
                        <button
                          type="button"
                          className="aaa-exec-portfolio-order-handle"
                          ref={(node) => {
                            if (node) gripRefs.current.set(project.ID, node);
                            else gripRefs.current.delete(project.ID);
                          }}
                          aria-pressed={armed}
                          aria-label={`Reorder ${project.name}, position ${index + 1} of ${projects.length}`}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", project.ID);
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingId(project.ID);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropTargetId(null);
                          }}
                          onClick={() =>
                            setArmedId((current) =>
                              current === project.ID ? null : project.ID,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              step(project.ID, -1);
                            } else if (event.key === "ArrowDown") {
                              event.preventDefault();
                              step(project.ID, 1);
                            } else if (event.key === " " || event.key === "Enter") {
                              event.preventDefault();
                              setArmedId((current) =>
                                current === project.ID ? null : project.ID,
                              );
                            }
                          }}
                        >
                          <GripIcon />
                        </button>
                        {armed ? (
                          <span className="aaa-exec-portfolio-order-moves">
                            <button
                              type="button"
                              className="aaa-btn aaa-btn-secondary"
                              disabled={index === 0}
                              onClick={() => step(project.ID, -1)}
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              className="aaa-btn aaa-btn-secondary"
                              disabled={index === projects.length - 1}
                              onClick={() => step(project.ID, 1)}
                            >
                              Move down
                            </button>
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td>{index + 1}</td>
                    <td>{project.name}</td>
                    <td>{project.status ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
