export const REQUIRED_TRACK_DEADLINE_DAYS = 14;

export type RequiredTeamRow = { team: string; createdAt: string };

export function isRequiredForTeam(requiredTeams: RequiredTeamRow[], team: string | null): boolean {
  return requiredTeams.some((r) => r.team === "all" || (!!team && r.team === team));
}

/** The timestamp the requirement started applying to this specific person —
 * their own team's row if set, else the company-wide 'all' row. */
export function requiredSince(requiredTeams: RequiredTeamRow[], team: string | null): string | null {
  const own = team ? requiredTeams.find((r) => r.team === team) : undefined;
  if (own) return own.createdAt;
  const all = requiredTeams.find((r) => r.team === "all");
  return all ? all.createdAt : null;
}

/** Overdue = required, not complete, and more than REQUIRED_TRACK_DEADLINE_DAYS
 * since whichever came later: the requirement being set, or this person
 * gaining access — so a new hire isn't instantly overdue for something
 * that's been required for months. */
export function isOverdue(
  requiredSinceIso: string | null,
  userCreatedAtIso: string,
  done: number,
  total: number,
): boolean {
  if (!requiredSinceIso || total === 0 || done >= total) return false;
  const since = Math.max(new Date(requiredSinceIso).getTime(), new Date(userCreatedAtIso).getTime());
  const days = (Date.now() - since) / 86_400_000;
  return days > REQUIRED_TRACK_DEADLINE_DAYS;
}
