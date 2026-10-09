/**
 * The request queue's own configuration, modeled on Workfront's real objects.
 *
 * Workfront does not route requests with a custom-form field. It routes them with a **queue topic**
 * that carries a **routing rule**. Display Path in this app is the queue name plus the topic group
 * name (topic name only if ungrouped). The app previously expressed team routing as the
 * `A3IntakeCommunicationType` radio, which is a custom field. That is why a two-team answer was
 * awkward: a radio holds one value, while two topics with two routing rules is ordinary Workfront
 * configuration.
 *
 * Type names deliberately match the Workfront objects, including the object codes, so the contract
 * is legible to anyone who has seen the API:
 *
 *   QueueDef        QUED    the project designated as a request queue
 *   QueueTopicGroup QUETGP  an optional grouping layer, nestable in Workfront up to 10 deep
 *   QueueTopic      QUET    what a requester picks; carries the routing rule
 *   RoutingRule             one default assignee and one default team, which is Workfront's arity
 *
 * Every one of them carries a `workfrontID` that is an **empty string until a Workfront admin
 * supplies the real one**. Nothing is invented. A topic with no ID cannot be submitted against;
 * see `topicIsSubmittable`.
 *
 * This is local configuration, not a mirror of a live queue. Until the Workfront admin confirms the
 * real structure, treat every default below as a proposal. That confirmation is an open item in
 * docs/decisions/decision-log.md.
 */
import { A3_COMMUNICATION_TYPES } from "../intake/a3Schema";

export const QUEUE_CONFIG_KEY = "aaa-intake-queue-config";
export const QUEUE_CONFIG_BACKUP_KEY = "aaa-intake-queue-config-backup";

/**
 * Workfront's Request Types, as offered on a queue topic. A Workfront administrator may have renamed
 * these, which is why the value is stored rather than assumed.
 */
export const REQUEST_TYPES = [
  "Bug Report",
  "Change Order",
  "Issue",
  "Request",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export function isRequestType(value: string): value is RequestType {
  return (REQUEST_TYPES as readonly string[]).includes(value);
}

/**
 * A routing rule. Workfront allows exactly one default assignee and one default team per rule -
 * "You can only have one default assignee in this field" - which is the constraint that makes a
 * both-teams request a topic-level decision rather than a rule-level one.
 */
export interface RoutingRule {
  id: string;
  /** Blank until the Workfront admin supplies the real ID. */
  workfrontID: string;
  name: string;
  description: string;
  /** Workfront's Default Assignee: an active user or job role. One only. */
  defaultAssignee: string;
  /** Workfront's Default Team. One only. */
  defaultTeam: string;
  /** Workfront's Route to Project: the project the issue is added to. */
  routeToProject: string;
}

export interface QueueTopicGroup {
  id: string;
  /** Blank until the Workfront admin supplies the real ID. */
  workfrontID: string;
  name: string;
}

export interface QueueTopic {
  id: string;
  /** Blank until the Workfront admin supplies the real ID. Gates submission. */
  workfrontID: string;
  name: string;
  /** Shown to the requester when picking a topic, per Workfront's own field description. */
  description: string;
  /** The group this topic sits under. Empty means directly under the queue, which Workfront allows. */
  groupId: string;
  /** Workfront's Default Route on the topic. */
  routingRuleId: string;
  requestType: RequestType;
  /**
   * Which answers to the team-routing question select this topic. More than one value marks the
   * both-teams topic. Empty means the topic is never chosen automatically.
   */
  communicationTypes: string[];
}

export interface QueueDef {
  id: string;
  /**
   * The Workfront project ID of the queue. A request queue IS a project in Workfront, which is why
   * this is a project ID rather than a queue ID.
   */
  workfrontProjectID: string;
  name: string;
  groups: QueueTopicGroup[];
  topics: QueueTopic[];
  routingRules: RoutingRule[];
  updatedAt: string;
}

/**
 * The proposed default structure.
 *
 * Two single-team topics plus a triage topic for the both-teams case. A request needing internal
 * communications AND marketing creative cannot be one Workfront issue routed to two teams, because a
 * routing rule holds one team. Submitting two issues was rejected: it duplicates the work, and the
 * app's own duplicate detection would then flag the pair it had just created. So a two-team answer
 * lands in a triage topic, with both teams named in the payload description.
 */
export function defaultQueueConfig(): QueueDef {
  const [corporate, brand] = A3_COMMUNICATION_TYPES;
  // Workfront IDs below were read from Production (Probe 3) against mission-control-v1.
  // queueDefID 6abae2b600041e4d9d242c3378e11903 is the search key for QUEUETOPIC; topics carry
  // their own IDs. Routing-rule Workfront IDs are still blank until an admin supplies them.
  return {
    id: "queue-a3-creative-intake",
    workfrontProjectID: "6abae2b600041e3ecb6a8da4dbe7b4a1",
    name: "A3 Creative Intake",
    groups: [
      { id: "group-creative-services", workfrontID: "", name: "Creative Services" },
    ],
    routingRules: [
      {
        id: "rule-corporate-communications",
        workfrontID: "",
        name: "Route to Corporate Communications",
        description: "Internal and corporate messaging.",
        defaultAssignee: "",
        defaultTeam: corporate,
        routeToProject: "6abae2b600041e3ecb6a8da4dbe7b4a1",
      },
      {
        id: "rule-brand-creative-services",
        workfrontID: "",
        name: "Route to Brand Creative Services",
        description: "Marketing creative.",
        defaultAssignee: "",
        defaultTeam: brand,
        routeToProject: "6abae2b600041e3ecb6a8da4dbe7b4a1",
      },
      {
        id: "rule-triage",
        workfrontID: "",
        name: "Route to triage",
        description:
          "For a request that needs both teams. A routing rule targets one team, so triage assigns the second.",
        defaultAssignee: "",
        defaultTeam: "Creative Operations",
        routeToProject: "6abae2b600041e3ecb6a8da4dbe7b4a1",
      },
    ],
    topics: [
      {
        id: "topic-corporate-communications",
        workfrontID: "6abfe6390008802ab92036dc7cdd4d0c",
        name: corporate,
        description: "Internal and corporate messaging.",
        groupId: "group-creative-services",
        routingRuleId: "rule-corporate-communications",
        requestType: "Request",
        communicationTypes: [corporate],
      },
      {
        id: "topic-brand-creative-services",
        workfrontID: "6abfe67b0008baedafb5773d36a58500",
        name: brand,
        description: "Marketing creative.",
        groupId: "group-creative-services",
        routingRuleId: "rule-brand-creative-services",
        requestType: "Request",
        communicationTypes: [brand],
      },
      {
        id: "topic-both-teams",
        workfrontID: "6abfe6ef00091f01508a0f0eac18cbd8",
        name: "Both teams - needs triage",
        description:
          "A request that needs internal communications and marketing creative. Triage assigns the second team.",
        groupId: "group-creative-services",
        routingRuleId: "rule-triage",
        requestType: "Request",
        communicationTypes: [corporate, brand],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export function findTopic(config: QueueDef, topicId: string): QueueTopic | null {
  return config.topics.find((topic) => topic.id === topicId) ?? null;
}

export function findGroup(config: QueueDef, groupId: string): QueueTopicGroup | null {
  return config.groups.find((group) => group.id === groupId) ?? null;
}

export function findRule(config: QueueDef, ruleId: string): RoutingRule | null {
  return config.routingRules.find((rule) => rule.id === ruleId) ?? null;
}

/**
 * Selects the topic for a set of chosen communication types.
 *
 * Matched on the exact set rather than on "contains", so two teams reaches the triage topic instead
 * of silently landing in whichever single-team topic happened to be listed first. That silent
 * fallback is the failure this function exists to prevent: it would route a two-team request to one
 * team and look entirely successful.
 */
export function topicForCommunicationTypes(
  config: QueueDef,
  chosen: readonly string[],
): QueueTopic | null {
  if (chosen.length === 0) return null;
  const wanted = [...chosen].sort().join("\u0000");
  return (
    config.topics.find(
      (topic) => [...topic.communicationTypes].sort().join("\u0000") === wanted,
    ) ?? null
  );
}

/**
 * Display Path: queue name, then topic group name. The queue topic name is omitted so reviewers
 * see the group title. If the topic sits directly under the queue (no group), the topic name is
 * the fallback second segment. Slash separator matches Workfront-style paths.
 */
export const PATH_SEPARATOR = " / ";

export function topicPath(config: QueueDef, topic: QueueTopic | null): string {
  if (!topic) return "";
  const group = findGroup(config, topic.groupId);
  // Prefer group title; if the topic sits directly under the queue, fall back to topic name.
  return [config.name, group?.name ?? topic.name].filter(Boolean).join(PATH_SEPARATOR);
}

/**
 * A topic can only be submitted against when Workfront can actually receive it: the queue project
 * and the topic both need real IDs. Anything less would be a POST against a guess.
 */
export function topicIsSubmittable(config: QueueDef, topic: QueueTopic | null): boolean {
  return Boolean(topic && topic.workfrontID.trim() && config.workfrontProjectID.trim());
}

export interface ConfigProblem {
  /** Topic, group, or rule id. Empty for a queue-level problem. */
  subjectId: string;
  message: string;
}

/**
 * Reports configuration problems rather than throwing, so the admin screen can explain them.
 *
 * A missing Workfront ID is reported as a problem but does not make the config unusable: the app
 * still assembles a complete payload and shows it, which is the whole point of a queue that looks
 * send-ready. It just refuses to send.
 */
export function validateQueueConfig(config: QueueDef): ConfigProblem[] {
  const problems: ConfigProblem[] = [];

  if (!config.name.trim()) {
    problems.push({ subjectId: "", message: "The queue needs a name." });
  }
  if (!config.workfrontProjectID.trim()) {
    problems.push({
      subjectId: "",
      message:
        "The queue has no Workfront project ID yet, so nothing can be submitted to Workfront. A request queue is a project in Workfront; ask the Workfront administrator for its ID.",
    });
  }
  if (config.topics.length === 0) {
    problems.push({ subjectId: "", message: "The queue needs at least one topic." });
  }

  const seenTopicIds = new Set<string>();
  for (const topic of config.topics) {
    if (seenTopicIds.has(topic.id)) {
      problems.push({ subjectId: topic.id, message: "Duplicate topic id." });
    }
    seenTopicIds.add(topic.id);

    if (!topic.name.trim()) {
      problems.push({ subjectId: topic.id, message: "A topic needs a name." });
    }
    if (!topic.workfrontID.trim()) {
      problems.push({
        subjectId: topic.id,
        // Names the topic. Three topics with no ID produced three identical lines, and a list of
        // identical problems tells the reader there is work to do without telling them where.
        message: `The topic "${topic.name || "Untitled topic"}" has no Workfront queue topic ID yet, so a request routed there cannot be submitted.`,
      });
    }
    if (topic.groupId && !findGroup(config, topic.groupId)) {
      problems.push({
        subjectId: topic.id,
        message: "This topic points at a topic group that no longer exists.",
      });
    }
    if (!topic.routingRuleId) {
      problems.push({
        subjectId: topic.id,
        message:
          "No routing rule, so a request submitted here would sit unassigned. Workfront's own guidance is that submissions without a routing rule go unnoticed.",
      });
    } else if (!findRule(config, topic.routingRuleId)) {
      problems.push({
        subjectId: topic.id,
        message: "This topic points at a routing rule that no longer exists.",
      });
    }
  }

  // Two topics claiming the same answer set makes routing non-deterministic, and
  // `topicForCommunicationTypes` would return whichever came first.
  const byTypes = new Map<string, string[]>();
  for (const topic of config.topics) {
    if (topic.communicationTypes.length === 0) continue;
    const key = [...topic.communicationTypes].sort().join("\u0000");
    byTypes.set(key, [...(byTypes.get(key) ?? []), topic.id]);
  }
  for (const [key, ids] of byTypes) {
    if (ids.length > 1) {
      problems.push({
        subjectId: ids[1],
        message: `More than one topic claims "${key.split("\u0000").join(", ")}", so routing would depend on their order. Give each topic a distinct set.`,
      });
    }
  }

  for (const rule of config.routingRules) {
    if (!rule.name.trim()) {
      problems.push({ subjectId: rule.id, message: "A routing rule needs a name." });
    }
    if (!rule.defaultTeam.trim() && !rule.defaultAssignee.trim()) {
      problems.push({
        subjectId: rule.id,
        message:
          "A routing rule needs a default team or a default assignee, or requests routed by it go to nobody.",
      });
    }
  }

  return problems;
}

/** Every answer set the requester could give that has no topic to route it. */
export function unroutedCommunicationTypes(config: QueueDef): string[][] {
  const sets: string[][] = [
    ...A3_COMMUNICATION_TYPES.map((type) => [type]),
    [...A3_COMMUNICATION_TYPES],
  ];
  return sets.filter((set) => !topicForCommunicationTypes(config, set));
}

/* ------------------------------------------------------------------ *
 * Factories
 * ------------------------------------------------------------------ */

export function createTopic(partial: Partial<QueueTopic> = {}): QueueTopic {
  return {
    id: `topic-${crypto.randomUUID().slice(0, 8)}`,
    workfrontID: "",
    name: "",
    description: "",
    groupId: "",
    routingRuleId: "",
    requestType: "Request",
    communicationTypes: [],
    ...partial,
  };
}

export function createGroup(partial: Partial<QueueTopicGroup> = {}): QueueTopicGroup {
  return {
    id: `group-${crypto.randomUUID().slice(0, 8)}`,
    workfrontID: "",
    name: "",
    ...partial,
  };
}

export function createRoutingRule(partial: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: `rule-${crypto.randomUUID().slice(0, 8)}`,
    workfrontID: "",
    name: "",
    description: "",
    defaultAssignee: "",
    defaultTeam: "",
    routeToProject: "",
    ...partial,
  };
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => text(v)).filter(Boolean) : [];
}

function normalizeGroup(value: unknown): QueueTopicGroup | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id).trim();
  if (!id) return null;
  return { id, workfrontID: text(raw.workfrontID).trim(), name: text(raw.name) };
}

function normalizeRule(value: unknown): RoutingRule | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id).trim();
  if (!id) return null;
  return {
    id,
    workfrontID: text(raw.workfrontID).trim(),
    name: text(raw.name),
    description: text(raw.description),
    defaultAssignee: text(raw.defaultAssignee),
    defaultTeam: text(raw.defaultTeam),
    routeToProject: text(raw.routeToProject),
  };
}

function normalizeTopic(value: unknown): QueueTopic | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id).trim();
  if (!id) return null;
  const requestType = text(raw.requestType);
  return {
    id,
    workfrontID: text(raw.workfrontID).trim(),
    name: text(raw.name),
    description: text(raw.description),
    groupId: text(raw.groupId).trim(),
    routingRuleId: text(raw.routingRuleId).trim(),
    requestType: isRequestType(requestType) ? requestType : "Request",
    // Only real A3 option values survive. A hand-edited config cannot introduce a communication
    // type Workfront does not offer.
    communicationTypes: stringArray(raw.communicationTypes).filter((type) =>
      (A3_COMMUNICATION_TYPES as readonly string[]).includes(type),
    ),
  };
}

function parseConfig(rawValue: string | null): QueueDef | null {
  if (rawValue == null) return null;
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const raw = parsed as Record<string, unknown>;
    const topics = Array.isArray(raw.topics)
      ? raw.topics.map(normalizeTopic).filter((t): t is QueueTopic => t !== null)
      : [];
    // A config with no readable topic is not a config. Falling back to defaults beats presenting an
    // empty queue as if it were configured.
    if (topics.length === 0) return null;
    return {
      id: text(raw.id).trim() || "queue-a3-creative-intake",
      workfrontProjectID: text(raw.workfrontProjectID).trim(),
      name: text(raw.name) || "A3 Creative Intake",
      groups: Array.isArray(raw.groups)
        ? raw.groups.map(normalizeGroup).filter((g): g is QueueTopicGroup => g !== null)
        : [],
      topics,
      routingRules: Array.isArray(raw.routingRules)
        ? raw.routingRules.map(normalizeRule).filter((r): r is RoutingRule => r !== null)
        : [],
      updatedAt: text(raw.updatedAt) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export type QueueConfigStatus = "default" | "ok" | "recovered" | "unreadable";

export interface QueueConfigLoad {
  config: QueueDef;
  status: QueueConfigStatus;
}

/**
 * Loads the config, repairing rather than rejecting, with the same primary-plus-backup discipline as
 * the brief store. `status` is surfaced so the screen can say the configuration was recovered or
 * could not be read, instead of quietly presenting defaults as the admin's own work.
 */
export function loadQueueConfig(): QueueConfigLoad {
  const raw = readKey(QUEUE_CONFIG_KEY);
  const config = parseConfig(raw);
  if (config) return { config, status: "ok" };
  const backup = parseConfig(readKey(QUEUE_CONFIG_BACKUP_KEY));
  if (backup) return { config: backup, status: "recovered" };
  return {
    config: defaultQueueConfig(),
    status: raw == null ? "default" : "unreadable",
  };
}

export interface SaveResult {
  ok: boolean;
  reason?: string;
}

export function saveQueueConfig(config: QueueDef): SaveResult {
  const next: QueueDef = { ...config, updatedAt: new Date().toISOString() };
  const payload = JSON.stringify(next);
  try {
    localStorage.setItem(QUEUE_CONFIG_BACKUP_KEY, payload);
    localStorage.setItem(QUEUE_CONFIG_KEY, payload);
    return { ok: true };
  } catch (cause) {
    const quotaHit =
      cause instanceof DOMException &&
      (cause.name === "QuotaExceededError" ||
        cause.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      reason: quotaHit
        ? "This browser's storage is full, so the queue configuration was not saved."
        : "This browser is blocking local storage, so the queue configuration cannot be saved here.",
    };
  }
}

export function resetQueueConfig(): QueueDef {
  for (const key of [QUEUE_CONFIG_KEY, QUEUE_CONFIG_BACKUP_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing useful to do if storage is blocked */
    }
  }
  return defaultQueueConfig();
}
