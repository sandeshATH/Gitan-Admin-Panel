export const PLAN_OPTIONS = ["Starter", "Growth", "Enterprise", "Custom"] as const;
export type ClientPlan = (typeof PLAN_OPTIONS)[number];

export const STATUS_OPTIONS = [
  "Active",
  "Pending",
  "Trial",
  "Churn Risk",
  "Offboarded",
] as const;
export type ClientStatus = (typeof STATUS_OPTIONS)[number];
