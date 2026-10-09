/**
 * Resolving which queue topic routes a brief.
 *
 * Two sources, in priority order, and the difference between them is reported rather than hidden:
 *
 * 1. `brief.queueTopicId`, set at the Generating step. This is a recorded fact.
 * 2. Derived from `A3IntakeCommunicationType` when no id was stored. This is an inference.
 *
 * Every brief saved before queue topics existed falls into case 2. Showing those an empty Path would
 * look like a bug, and silently showing a derived Path as though it were recorded would overstate
 * what the app knows. So `RoutedTopic.source` travels with the result and the queue labels it.
 *
 * Kept out of storage.ts deliberately: storage has no access to the queue config, and giving it one
 * would mean a brief's stored shape depended on admin configuration loaded at a different time.
 */
import { parseOptionValues } from "../intake/a3Schema";
import type { IntakeBrief } from "../intake/types";
import {
  findRule,
  findTopic,
  topicForCommunicationTypes,
  topicPath,
  type QueueDef,
  type QueueTopic,
  type RoutingRule,
} from "./queueConfig";

export type RouteSource = "recorded" | "derived" | "none";

export interface RoutedTopic {
  topic: QueueTopic | null;
  rule: RoutingRule | null;
  /** Queue / group (or topic name if ungrouped), ready for Path display. Empty when unrouted. */
  path: string;
  source: RouteSource;
}

/** The communication types a brief actually carries, validated against the real option list. */
export function communicationTypesFor(brief: IntakeBrief): string[] {
  return parseOptionValues(brief.a3.A3IntakeCommunicationType);
}

/**
 * The topic id to store for a brief, from its answers. Used at the Generating step.
 *
 * Returns null when the answer set matches no topic, which is a real state rather than an error: an
 * admin can leave a combination unrouted, and `validateQueueConfig` reports it.
 */
export function queueTopicIdFor(config: QueueDef, brief: IntakeBrief): string | null {
  return topicForCommunicationTypes(config, communicationTypesFor(brief))?.id ?? null;
}

export function routeFor(config: QueueDef, brief: IntakeBrief): RoutedTopic {
  const recorded = brief.queueTopicId ? findTopic(config, brief.queueTopicId) : null;
  if (recorded) {
    return {
      topic: recorded,
      rule: findRule(config, recorded.routingRuleId),
      path: topicPath(config, recorded),
      source: "recorded",
    };
  }

  const derived = topicForCommunicationTypes(config, communicationTypesFor(brief));
  if (derived) {
    return {
      topic: derived,
      rule: findRule(config, derived.routingRuleId),
      path: topicPath(config, derived),
      source: "derived",
    };
  }

  return { topic: null, rule: null, path: "", source: "none" };
}

/**
 * What the Path column shows. Never blank, because a blank cell in a Workfront-shaped table reads as
 * a rendering failure rather than as missing configuration.
 */
export function pathLabel(route: RoutedTopic): string {
  if (route.source === "none") return "Not routed yet";
  return route.path;
}

/**
 * A sentence naming why a route is what it is, per the auditable-recommendation guardrail. A route
 * decides which team receives the work, so the reason it was chosen has to be inspectable.
 */
export function routeExplanation(route: RoutedTopic): string {
  switch (route.source) {
    case "recorded":
      return "Routed by the queue topic recorded when this request was assembled.";
    case "derived":
      return "No topic was recorded on this request, so the route was derived from its Communication Type answer.";
    default:
      return "No queue topic matches this request's Communication Type answer, so nothing would route it. Add a topic for that combination in the queue settings.";
  }
}
