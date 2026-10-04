/**
 * Manage the request queue: its topics, topic groups, and routing rules.
 *
 * Deliberately a sibling of Manage questions rather than part of it. Questions decide what is asked;
 * this decides where the answer goes. Merging them would put a Workfront administrator's concerns in
 * the same screen as a marketing lead's.
 *
 * No mock exists, so this reuses the Manage questions patterns and is flagged for design review
 * rather than treated as designed.
 *
 * The screen's real job is making a missing Workfront ID impossible to overlook. Every topic starts
 * with an empty `workfrontID` because the app never invents one, and a topic without it cannot be
 * submitted against. That is stated per topic and summarized at the top, so an administrator does not
 * discover it from a requester who has already finished a brief.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { A3_COMMUNICATION_TYPES } from "../lib/intake/a3Schema";
import {
  REQUEST_TYPES,
  createGroup,
  createRoutingRule,
  createTopic,
  defaultQueueConfig,
  findGroup,
  findRule,
  isRequestType,
  loadQueueConfig,
  resetQueueConfig,
  saveQueueConfig,
  topicPath,
  unroutedCommunicationTypes,
  validateQueueConfig,
  type QueueDef,
  type QueueTopic,
  type RoutingRule,
} from "../lib/workfront/queueConfig";
import {
  fetchWorkfrontHealth,
  type WorkfrontProxyHealth,
} from "../lib/workfront/proxyHealth";

export default function ManageQueueView() {
  const initial = useMemo(() => loadQueueConfig(), []);
  const [config, setConfig] = useState<QueueDef>(initial.config);
  const [health, setHealth] = useState<WorkfrontProxyHealth | null>(null);
  const [status, setStatus] = useState(
    initial.status === "recovered"
      ? "Recovered the queue configuration from the local backup copy."
      : initial.status === "unreadable"
        ? "The saved queue configuration could not be read, so the proposed defaults are shown. Nothing was overwritten - saving will replace it."
        : "",
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkfrontHealth(controller.signal).then(setHealth);
    return () => controller.abort();
  }, []);

  const problems = validateQueueConfig(config);
  const unrouted = unroutedCommunicationTypes(config);
  const readyTopics = config.topics.filter((topic) => topic.workfrontID.trim()).length;

  function patch(next: Partial<QueueDef>) {
    setConfig((current) => ({ ...current, ...next }));
  }

  function patchTopic(id: string, next: Partial<QueueTopic>) {
    setConfig((current) => ({
      ...current,
      topics: current.topics.map((topic) =>
        topic.id === id ? { ...topic, ...next } : topic,
      ),
    }));
  }

  function patchRule(id: string, next: Partial<RoutingRule>) {
    setConfig((current) => ({
      ...current,
      routingRules: current.routingRules.map((rule) =>
        rule.id === id ? { ...rule, ...next } : rule,
      ),
    }));
  }

  function save() {
    // Warns rather than refuses. A half-configured queue is the normal state while an administrator
    // waits on IDs from Workfront, and losing their typing to a validation gate would be worse than
    // letting them save work in progress.
    const result = saveQueueConfig(config);
    if (!result.ok) {
      setStatus(result.reason ?? "The queue configuration was not saved.");
      return;
    }
    setStatus(
      problems.length > 0
        ? `Saved with ${problems.length} ${problems.length === 1 ? "problem" : "problems"} still open. Nothing can be sent to Workfront until they are resolved.`
        : "Saved.",
    );
  }

  /** Toggles one communication type on a topic. Stored as a set, matched as a set. */
  function toggleType(topic: QueueTopic, type: string) {
    const has = topic.communicationTypes.includes(type);
    patchTopic(topic.id, {
      communicationTypes: has
        ? topic.communicationTypes.filter((item) => item !== type)
        : [...topic.communicationTypes, type],
    });
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="aaa-page-heading">Manage the request queue</h1>
      <p className="aaa-page-sub">
        A queue topic is what routes a request in Workfront, and its position under the queue and
        its topic group is the Path shown in the Request Queue. Requesters never pick a topic - it is
        derived from their team answer.
      </p>

      <div className="aaa-notice">
        {health?.connected && health.project ? (
          <p>
            The Workfront proxy can reach {health.project.name} ({health.project.ID}). Topic IDs
            below were confirmed against that queue; live submit is still off until dual-write is
            enabled. {readyTopics} of {config.topics.length}{" "}
            {config.topics.length === 1 ? "topic has" : "topics have"} a Workfront ID.
          </p>
        ) : (
          <p>
            The Workfront proxy is not connected yet
            {health?.error ? ` (${health.error})` : ""}. Until health succeeds, treat queue IDs as
            local configuration only — this app does not invent Workfront identifiers. A request can
            be assembled and reviewed but not transmitted. {readyTopics} of {config.topics.length}{" "}
            {config.topics.length === 1 ? "topic has" : "topics have"} an ID.
          </p>
        )}
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
      {status ? <p className="aaa-page-status">{status}</p> : null}

      {/*
        Amber, not red, and no role="alert".
        
        Red is reserved for a final submit action and genuine errors, and a missing Workfront ID is
        neither - it is the expected state of a queue nobody has connected yet. Rendering the normal
        case in red taught an administrator to ignore the color, which is exactly what makes a real
        error invisible later. `role="alert"` is wrong for the same reason: it interrupts a screen
        reader on arrival to announce something that has not changed.
      */}
      {problems.length > 0 ? (
        <section className="aaa-attention" aria-labelledby="queue-problems-heading">
          <h2 id="queue-problems-heading" className="aaa-attention-heading">
            Still to be configured
          </h2>
          <ul className="aaa-attention-list" role="list">
            {problems.map((problem) => (
              <li key={`${problem.subjectId}-${problem.message}`}>{problem.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        An answer set with no topic is the one gap that breaks intake rather than merely delaying it:
        the requester finishes the flow, the queue shows "Not routed yet", and nobody is assigned.
        Kept separate from the list above because it is a hole in the routing table rather than a
        value waiting on Workfront.
      */}
      {unrouted.length > 0 ? (
        <section className="aaa-attention" aria-labelledby="queue-unrouted-heading">
          <h2 id="queue-unrouted-heading" className="aaa-attention-heading">
            These answers have no topic to route them
          </h2>
          <ul className="aaa-attention-list" role="list">
            {unrouted.map((set) => (
              <li key={set.join("|")}>{set.join(" and ")}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="aaa-question-admin" aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="aaa-question-admin-target">
          The queue
        </h2>

        <div className="aaa-field-group">
          <label className="aaa-label" htmlFor="queue-name">
            Queue name
          </label>
          <input
            id="queue-name"
            className="aaa-input"
            value={config.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
          <p className="aaa-field-hint">
            Shown as the first segment of every Path.
          </p>
        </div>

        <div className="aaa-field-group">
          <label className="aaa-label" htmlFor="queue-project-id">
            Workfront project ID
          </label>
          <input
            id="queue-project-id"
            className="aaa-input"
            value={config.workfrontProjectID}
            onChange={(event) => patch({ workfrontProjectID: event.target.value })}
            placeholder="Ask your Workfront administrator"
          />
          <p className="aaa-field-hint">
            A request queue is a project in Workfront, so this is a project ID. Without it nothing
            can be submitted, whatever the topics say.
          </p>
        </div>
      </section>

      <h2 className="aaa-page-subheading">Topic groups</h2>
      <p className="aaa-page-sub">
        Optional. A group adds a segment between the queue and the topic in the Path.
      </p>

      <ul className="aaa-question-admin-list" role="list">
        {config.groups.map((group) => (
          <li key={group.id} className="aaa-question-admin">
            <div className="aaa-field-group">
              <label className="aaa-label" htmlFor={`group-name-${group.id}`}>
                Group name
              </label>
              <input
                id={`group-name-${group.id}`}
                className="aaa-input"
                value={group.name}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    groups: current.groups.map((item) =>
                      item.id === group.id ? { ...item, name: event.target.value } : item,
                    ),
                  }))
                }
              />
            </div>
            <div className="aaa-field-group">
              <label className="aaa-label" htmlFor={`group-wfid-${group.id}`}>
                Workfront topic group ID
              </label>
              <input
                id={`group-wfid-${group.id}`}
                className="aaa-input"
                value={group.workfrontID}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    groups: current.groups.map((item) =>
                      item.id === group.id
                        ? { ...item, workfrontID: event.target.value }
                        : item,
                    ),
                  }))
                }
                placeholder="Blank until supplied"
              />
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="aaa-btn aaa-btn-secondary mt-4"
        onClick={() =>
          patch({ groups: [...config.groups, createGroup({ name: "New group" })] })
        }
      >
        Add a topic group
      </button>

      <h2 className="aaa-page-subheading">Queue topics</h2>

      <ul className="aaa-question-admin-list" role="list">
        {config.topics.map((topic) => {
          const rule = findRule(config, topic.routingRuleId);
          const group = findGroup(config, topic.groupId);
          return (
            <li key={topic.id} className="aaa-question-admin">
              <div className="aaa-question-admin-head">
                <span className="aaa-question-admin-target">
                  {topic.name || "Untitled topic"}
                  {topic.workfrontID.trim() ? null : (
                    <span className="aaa-badge aaa-badge-locked">No Workfront ID</span>
                  )}
                  {topic.communicationTypes.length > 1 ? (
                    <span className="aaa-badge aaa-badge-custom">Triage</span>
                  ) : null}
                </span>
              </div>

              <p className="aaa-field-hint">
                Path: {topicPath(config, topic)}
                {group ? "" : " (directly under the queue)"}
              </p>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`topic-name-${topic.id}`}>
                  Topic name
                </label>
                <input
                  id={`topic-name-${topic.id}`}
                  className="aaa-input"
                  value={topic.name}
                  onChange={(event) => patchTopic(topic.id, { name: event.target.value })}
                />
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`topic-desc-${topic.id}`}>
                  Description
                </label>
                <input
                  id={`topic-desc-${topic.id}`}
                  className="aaa-input"
                  value={topic.description}
                  onChange={(event) =>
                    patchTopic(topic.id, { description: event.target.value })
                  }
                />
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`topic-wfid-${topic.id}`}>
                  Workfront queue topic ID
                </label>
                <input
                  id={`topic-wfid-${topic.id}`}
                  className="aaa-input"
                  value={topic.workfrontID}
                  onChange={(event) =>
                    patchTopic(topic.id, { workfrontID: event.target.value })
                  }
                  placeholder="Blank until supplied"
                />
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`topic-group-${topic.id}`}>
                  Topic group
                </label>
                <select
                  id={`topic-group-${topic.id}`}
                  className="aaa-input"
                  value={topic.groupId}
                  onChange={(event) =>
                    patchTopic(topic.id, { groupId: event.target.value })
                  }
                >
                  <option value="">Directly under the queue</option>
                  {config.groups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`topic-rule-${topic.id}`}>
                  Routing rule
                </label>
                <select
                  id={`topic-rule-${topic.id}`}
                  className="aaa-input"
                  value={topic.routingRuleId}
                  onChange={(event) =>
                    patchTopic(topic.id, { routingRuleId: event.target.value })
                  }
                >
                  <option value="">None</option>
                  {config.routingRules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {rule ? (
                  <p className="aaa-field-hint">
                    Goes to {rule.defaultTeam || "no team"}
                    {rule.defaultAssignee ? `, assigned to ${rule.defaultAssignee}` : ""}.
                  </p>
                ) : (
                  <p className="aaa-field-hint">
                    Without a routing rule, a request submitted here sits unassigned.
                  </p>
                )}
              </div>

              <div className="aaa-field-group">
                <label className="aaa-label" htmlFor={`topic-type-${topic.id}`}>
                  Request type
                </label>
                <select
                  id={`topic-type-${topic.id}`}
                  className="aaa-input"
                  value={topic.requestType}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isRequestType(value)) patchTopic(topic.id, { requestType: value });
                  }}
                >
                  {REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/*
                Checkboxes, not a select: choosing two is the whole point of the triage topic, and
                the match is on the exact set so two here never collapses to one.
              */}
              <fieldset className="aaa-field-group">
                <legend className="aaa-label">Routes these team answers here</legend>
                {A3_COMMUNICATION_TYPES.map((type) => (
                  <label key={type} className="aaa-checkbox-row">
                    <input
                      type="checkbox"
                      className="aaa-checkbox"
                      checked={topic.communicationTypes.includes(type)}
                      onChange={() => toggleType(topic, type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
                <p className="aaa-field-hint">
                  Matched on the exact set. Checking both sends only the requests that named both
                  teams here, not either one on its own.
                </p>
              </fieldset>

              <div className="aaa-question-admin-actions">
                <button
                  type="button"
                  className="aaa-btn-text-danger"
                  onClick={() =>
                    patch({
                      topics: config.topics.filter((item) => item.id !== topic.id),
                    })
                  }
                >
                  Remove
                  <span className="sr-only"> topic {topic.name}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="aaa-btn aaa-btn-secondary mt-4"
        onClick={() =>
          patch({ topics: [...config.topics, createTopic({ name: "New topic" })] })
        }
      >
        Add a topic
      </button>

      <h2 className="aaa-page-subheading">Routing rules</h2>
      <p className="aaa-page-sub">
        Workfront allows one default assignee and one default team per rule. That single-team limit is
        why a request naming both teams needs a triage topic rather than a two-team rule.
      </p>

      <ul className="aaa-question-admin-list" role="list">
        {config.routingRules.map((rule) => (
          <li key={rule.id} className="aaa-question-admin">
            <div className="aaa-field-group">
              <label className="aaa-label" htmlFor={`rule-name-${rule.id}`}>
                Rule name
              </label>
              <input
                id={`rule-name-${rule.id}`}
                className="aaa-input"
                value={rule.name}
                onChange={(event) => patchRule(rule.id, { name: event.target.value })}
              />
            </div>

            <div className="aaa-field-group">
              <label className="aaa-label" htmlFor={`rule-team-${rule.id}`}>
                Default team
              </label>
              <input
                id={`rule-team-${rule.id}`}
                className="aaa-input"
                value={rule.defaultTeam}
                onChange={(event) =>
                  patchRule(rule.id, { defaultTeam: event.target.value })
                }
              />
            </div>

            <div className="aaa-field-group">
              <label className="aaa-label" htmlFor={`rule-assignee-${rule.id}`}>
                Default assignee
              </label>
              <input
                id={`rule-assignee-${rule.id}`}
                className="aaa-input"
                value={rule.defaultAssignee}
                onChange={(event) =>
                  patchRule(rule.id, { defaultAssignee: event.target.value })
                }
              />
              <p className="aaa-field-hint">
                A user or a job role. One only, per Workfront.
              </p>
            </div>

            <div className="aaa-field-group">
              <label className="aaa-label" htmlFor={`rule-wfid-${rule.id}`}>
                Workfront routing rule ID
              </label>
              <input
                id={`rule-wfid-${rule.id}`}
                className="aaa-input"
                value={rule.workfrontID}
                onChange={(event) =>
                  patchRule(rule.id, { workfrontID: event.target.value })
                }
                placeholder="Blank until supplied"
              />
            </div>

            <div className="aaa-question-admin-actions">
              <button
                type="button"
                className="aaa-btn-text-danger"
                onClick={() =>
                  patch({
                    routingRules: config.routingRules.filter(
                      (item) => item.id !== rule.id,
                    ),
                  })
                }
              >
                Remove
                <span className="sr-only"> rule {rule.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="aaa-btn aaa-btn-secondary mt-4"
        onClick={() =>
          patch({
            routingRules: [
              ...config.routingRules,
              createRoutingRule({ name: "New rule" }),
            ],
          })
        }
      >
        Add a routing rule
      </button>

      <div className="aaa-admin-footer">
        <button type="button" className="aaa-btn aaa-btn-primary" onClick={save}>
          Save changes
        </button>
        <button
          type="button"
          className="aaa-btn-text"
          onClick={() => {
            setConfig(resetQueueConfig());
            setStatus(
              `Reset to the proposed defaults: ${defaultQueueConfig().topics.length} topics, no Workfront IDs.`,
            );
          }}
        >
          Reset to defaults
        </button>
        <Link to="/deliverables" className="aaa-link-quiet">
          Back to the Request Queue
        </Link>
      </div>
    </main>
  );
}
