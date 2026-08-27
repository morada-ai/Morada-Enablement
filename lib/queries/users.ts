import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { getTracksWithLessons, computeTrackProgress, type TrackStatus } from "@/lib/queries/tracks";
import { isOverdue, isRequiredForTeam, requiredSince, type RequiredTeamRow } from "@/lib/required-tracks";

export type UserTrackProgress = {
  trackId: string;
  trackTitle: string;
  done: number;
  total: number;
};

export type DirectoryUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  team: string | null;
  jobTitle: string | null;
  role: "member" | "admin" | "leader";
  leadsTeam: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  tracks: UserTrackProgress[];
};

export type TrackSummary = {
  id: string;
  title: string;
  requiredTeams: RequiredTeamRow[];
  totalLessons: number;
};

export type UserDirectory = {
  users: DirectoryUser[];
  tracks: TrackSummary[];
};

function mostRecent(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

export async function getUserDirectory(supabase: SupabaseClient): Promise<UserDirectory> {
  const [{ data: profiles }, { data: tracksData }, { data: progressRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, team, job_title, role, leads_team, created_at, last_seen_at")
      .order("created_at", { ascending: false }),
    supabase.from("tracks").select("id, title, lessons(id), track_required_teams(team, created_at)"),
    supabase
      .from("lesson_progress")
      .select("user_id, lessons!lesson_progress_lesson_id_fkey(track_id)"),
  ]);

  const trackLessonCount = new Map<string, number>();
  const trackTitleById = new Map<string, string>();
  const trackSummaries: TrackSummary[] = [];
  for (const track of (tracksData ?? []) as any[]) {
    const totalLessons = (track.lessons ?? []).length;
    trackLessonCount.set(track.id, totalLessons);
    trackTitleById.set(track.id, track.title);
    const requiredTeams: RequiredTeamRow[] = (track.track_required_teams ?? []).map((r: any) => ({
      team: r.team,
      createdAt: r.created_at,
    }));
    trackSummaries.push({ id: track.id, title: track.title, requiredTeams, totalLessons });
  }

  const doneByUserAndTrack = new Map<string, Map<string, number>>();
  for (const row of (progressRows ?? []) as any[]) {
    const trackId = row.lessons?.track_id;
    if (!trackId) continue;
    if (!doneByUserAndTrack.has(row.user_id)) doneByUserAndTrack.set(row.user_id, new Map());
    const perTrack = doneByUserAndTrack.get(row.user_id)!;
    perTrack.set(trackId, (perTrack.get(trackId) ?? 0) + 1);
  }

  // auth.users.last_sign_in_at only updates on a fresh sign-in, not on every
  // visit, so it goes stale for long-lived sessions — proxy.ts now stamps
  // profiles.last_seen_at on real visits instead. Fall back to
  // last_sign_in_at (whichever is more recent) for users who haven't hit
  // that tracking yet. Auth lookup is best-effort since the service-role
  // key may be absent locally.
  const lastSignInById = new Map<string, string | null>();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    for (const authUser of data.users) lastSignInById.set(authUser.id, authUser.last_sign_in_at ?? null);
  } catch {
    // no-op — the directory still renders without "último acesso".
  }

  const users: DirectoryUser[] = (profiles ?? []).map((profile) => {
    const perTrack = doneByUserAndTrack.get(profile.id) ?? new Map<string, number>();
    const tracks: UserTrackProgress[] = [...perTrack.entries()].map(([trackId, done]) => ({
      trackId,
      trackTitle: trackTitleById.get(trackId) ?? trackId,
      done,
      total: trackLessonCount.get(trackId) ?? 0,
    }));

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      team: profile.team,
      jobTitle: profile.job_title,
      role: profile.role,
      leadsTeam: profile.leads_team,
      createdAt: profile.created_at,
      lastSignInAt: mostRecent(profile.last_seen_at, lastSignInById.get(profile.id) ?? null),
      tracks,
    };
  });

  return { users, tracks: trackSummaries };
}

export type UserDetailTrack = {
  trackId: string;
  title: string;
  productName: string;
  done: number;
  total: number;
  pct: number;
  status: TrackStatus;
  isRequiredForUser: boolean;
  requiredSinceIso: string | null;
  isOverdue: boolean;
};

export type UserDetail = {
  profile: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    team: string | null;
    jobTitle: string | null;
    role: "member" | "admin" | "leader";
    leadsTeam: string | null;
    createdAt: string;
    lastSignInAt: string | null;
  };
  tracks: UserDetailTrack[];
  stats: { total: number; completed: number; inProgress: number; notStarted: number; overdue: number };
};

export async function getUserDetail(supabase: SupabaseClient, userId: string): Promise<UserDetail | null> {
  const [{ data: profile }, tracks, { data: progressRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, team, job_title, role, leads_team, created_at, last_seen_at")
      .eq("id", userId)
      .maybeSingle(),
    getTracksWithLessons(supabase),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
  ]);

  if (!profile) return null;

  let lastSignInAt: string | null = null;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    lastSignInAt = data.user?.last_sign_in_at ?? null;
  } catch {
    // no-op — best-effort, same as getUserDirectory.
  }

  const completedLessonIds = new Set((progressRows ?? []).map((r) => r.lesson_id as string));

  const detailTracks: UserDetailTrack[] = tracks
    .filter((t) => t.lessons.length > 0)
    .map((t) => {
      const progress = computeTrackProgress(t, completedLessonIds);
      const requiredForUser = isRequiredForTeam(t.requiredTeams, profile.team);
      const since = requiredSince(t.requiredTeams, profile.team);
      return {
        trackId: t.id,
        title: t.title,
        productName: t.product.name,
        done: progress.done,
        total: progress.total,
        pct: progress.pct,
        status: progress.status,
        isRequiredForUser: requiredForUser,
        requiredSinceIso: since,
        isOverdue: isOverdue(since, profile.created_at, progress.done, progress.total),
      };
    });

  const stats = {
    total: detailTracks.length,
    completed: detailTracks.filter((t) => t.status === "concluida").length,
    inProgress: detailTracks.filter((t) => t.status === "andamento").length,
    notStarted: detailTracks.filter((t) => t.status === "nao_iniciada").length,
    overdue: detailTracks.filter((t) => t.isOverdue).length,
  };

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      team: profile.team,
      jobTitle: profile.job_title,
      role: profile.role,
      leadsTeam: profile.leads_team,
      createdAt: profile.created_at,
      lastSignInAt: mostRecent(profile.last_seen_at, lastSignInAt),
    },
    tracks: detailTracks,
    stats,
  };
}
