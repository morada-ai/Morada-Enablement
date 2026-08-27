import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "./catalog";

export type LessonKind = "video" | "artigo" | "deck" | "quiz" | "template" | "link";

export type LessonRow = {
  id: string;
  track_id: string;
  position: number;
  title: string;
  kind: LessonKind;
  duration_min: number;
  source_label: string | null;
  storage_path: string | null;
  external_url: string | null;
  published_at: string;
};

export type TrackRow = {
  id: string;
  title: string;
  description: string | null;
  level: string;
  audience: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_role: string | null;
  updated_at: string;
  /** Set only when a real lesson is published (not on metadata edits) — drives the "NOVO" badge and the trilhas sort, so routine admin edits don't masquerade as new content. */
  content_updated_at: string | null;
  /** Manual flag for tracks whose lessons don't have real content behind them yet — shows an "Em breve" badge instead of the usual progress status. */
  coming_soon: boolean;
  feature_id: string | null;
  feature: { id: string; name: string } | null;
  product: Product;
  lessons: LessonRow[];
  requiredTeams: { team: string; createdAt: string }[];
};

const TRACK_SELECT = `id, title, description, level, audience, owner_id, owner_name, owner_role, updated_at, content_updated_at, coming_soon, feature_id,
       feature:features!tracks_feature_id_fkey (id, name),
       product:products!tracks_product_id_fkey (id, name, accent, description, position),
       lessons ( id, track_id, position, title, kind, duration_min, source_label, storage_path, external_url, published_at ),
       track_required_teams ( team, created_at )`;

type RawTrackRow = Omit<TrackRow, "requiredTeams"> & {
  track_required_teams: { team: string; created_at: string }[];
};

function normalizeTrack(raw: RawTrackRow): TrackRow {
  return {
    ...raw,
    lessons: [...raw.lessons].sort((a, b) => a.position - b.position),
    requiredTeams: raw.track_required_teams.map((r) => ({ team: r.team, createdAt: r.created_at })),
  };
}

export async function getTracksWithLessons(supabase: SupabaseClient): Promise<TrackRow[]> {
  const { data } = await supabase.from("tracks").select(TRACK_SELECT).order("position");

  return ((data ?? []) as unknown as RawTrackRow[]).map(normalizeTrack);
}

export async function getTrackWithLessons(
  supabase: SupabaseClient,
  trackId: string,
): Promise<TrackRow | null> {
  const { data } = await supabase
    .from("tracks")
    .select(TRACK_SELECT)
    .eq("id", trackId)
    .maybeSingle();

  if (!data) return null;
  return normalizeTrack(data as unknown as RawTrackRow);
}

export async function getCompletedLessonIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId);

  return new Set((data ?? []).map((row) => row.lesson_id as string));
}

export type LessonRating = { avgStars: number; ratingsCount: number };

export async function getLessonRatings(
  supabase: SupabaseClient,
): Promise<Map<string, LessonRating>> {
  const { data } = await supabase.from("lesson_ratings").select("lesson_id, avg_stars, ratings_count");
  const map = new Map<string, LessonRating>();
  for (const row of data ?? []) {
    map.set(row.lesson_id, { avgStars: Number(row.avg_stars), ratingsCount: row.ratings_count });
  }
  return map;
}

export type TrackStatus = "concluida" | "andamento" | "nao_iniciada";

export type TrackProgress = {
  done: number;
  total: number;
  pct: number;
  status: TrackStatus;
  nextLesson: LessonRow | null;
  durationMin: number;
};

export function computeTrackProgress(
  track: TrackRow,
  completedLessonIds: Set<string>,
): TrackProgress {
  const total = track.lessons.length;
  const done = track.lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const status: TrackStatus = pct === 100 ? "concluida" : pct > 0 ? "andamento" : "nao_iniciada";
  const nextLesson = track.lessons.find((l) => !completedLessonIds.has(l.id)) ?? null;
  const durationMin = track.lessons.reduce((sum, l) => sum + l.duration_min, 0);
  return { done, total, pct, status, nextLesson, durationMin };
}
