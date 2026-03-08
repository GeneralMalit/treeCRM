import type { PortalTicketSummary } from "./customerPortal";

export function safeFormatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function sortTicketsByLatest(tickets: PortalTicketSummary[]): PortalTicketSummary[] {
  return [...tickets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
