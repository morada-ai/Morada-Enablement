"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isValidCategory, isValidContentType } from "@/lib/material-tags";
import type { LessonKind } from "@/lib/queries/tracks";

type PublishInput = {
  kind: "material" | "lesson";
  productId: string;
  targetId: string; // featureId for material, trackId for lesson
  title: string;
  description: string;
  upload: { path: string; ext: string; format: string } | null;
  externalUrl: string | null;
  contentType: string | null;
  category: string | null;
  status: "draft" | "published";
  publishToNovidades: boolean;
  notifySlack: boolean;
};

function inferLessonKind(upload: PublishInput["upload"], externalUrl: string | null): LessonKind {
  if (!upload) return "link";
  switch (upload.ext) {
    case "MP4":
      return "video";
    case "PPTX":
      return "deck";
    case "XLSX":
      return "template";
    default:
      return "artigo";
  }
}

function inferSourceLabel(upload: PublishInput["upload"], externalUrl: string | null): string {
  if (upload) {
    return { MP4: "Gravação interna", PPTX: "Deck enviado", XLSX: "Planilha enviada" }[upload.ext] ?? "Documento enviado";
  }
  const url = (externalUrl ?? "").toLowerCase();
  if (url.includes("drive.google")) return "Drive";
  if (url.includes("notion.so")) return "Notion";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("loom.com")) return "Loom";
  return "Link externo";
}

const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createFeature(productId: string, name: string) {
  const { supabase } = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Dê um nome para a pasta.");

  const baseSlug = slugify(trimmed) || "pasta";
  const { data: existing } = await supabase
    .from("features")
    .select("id, position")
    .eq("product_id", productId);

  const existingIds = new Set((existing ?? []).map((f) => f.id));
  let id = `${productId}:${baseSlug}`;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${productId}:${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const nextPosition = (existing ?? []).reduce((max, f) => Math.max(max, f.position), 0) + 1;

  const { error } = await supabase.from("features").insert({
    id,
    product_id: productId,
    name: trimmed,
    position: nextPosition,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/materiais");
  revalidatePath(`/materiais/${productId}`);
  revalidatePath("/gerenciar");

  return { id, name: trimmed };
}

export async function createTrack(productId: string, featureId: string | null, name: string) {
  const { supabase } = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Dê um nome para a trilha.");

  const baseSlug = slugify(trimmed) || "trilha";
  const { data: existing } = await supabase
    .from("tracks")
    .select("id, position")
    .eq("product_id", productId);

  const existingIds = new Set((existing ?? []).map((t) => t.id));
  let id = `${productId}:${baseSlug}`;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${productId}:${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const nextPosition = (existing ?? []).reduce((max, t) => Math.max(max, t.position), 0) + 1;

  const { error } = await supabase.from("tracks").insert({
    id,
    product_id: productId,
    feature_id: featureId,
    title: trimmed,
    level: "Essencial",
    position: nextPosition,
    coming_soon: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/trilhas");
  revalidatePath("/gerenciar");
  if (featureId) {
    revalidatePath(`/materiais/${productId}/${featureId}`);
  }

  return { id, name: trimmed };
}

export async function updateTrackMeta(
  trackId: string,
  input: {
    ownerName: string;
    ownerRole: string;
    comingSoon: boolean;
    featureId: string | null;
    requiredTeams: string[];
  },
) {
  const { supabase } = await requireAdmin();

  const { data: current } = await supabase.from("tracks").select("product_id, feature_id").eq("id", trackId).single();

  const { error } = await supabase
    .from("tracks")
    .update({
      owner_name: input.ownerName.trim() || null,
      owner_role: input.ownerRole.trim() || null,
      coming_soon: input.comingSoon,
      feature_id: input.featureId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trackId);
  if (error) throw new Error(error.message);

  // Replace-all: simplest way to keep the set exactly in sync with what was
  // picked, no need to diff added/removed teams.
  const { error: deleteError } = await supabase.from("track_required_teams").delete().eq("track_id", trackId);
  if (deleteError) throw new Error(deleteError.message);
  if (input.requiredTeams.length > 0) {
    const { error: insertError } = await supabase
      .from("track_required_teams")
      .insert(input.requiredTeams.map((team) => ({ track_id: trackId, team })));
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/trilhas");
  revalidatePath(`/trilhas/${trackId}`);
  revalidatePath("/gerenciar");
  revalidatePath("/gerenciar/usuarios");
  revalidatePath("/lideranca");
  revalidatePath("/");
  if (current?.product_id && current.feature_id) {
    revalidatePath(`/materiais/${current.product_id}/${current.feature_id}`);
  }
  if (current?.product_id && input.featureId) {
    revalidatePath(`/materiais/${current.product_id}/${input.featureId}`);
  }
}

export async function deleteMaterial(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/materiais");
  revalidatePath("/gerenciar");
  revalidatePath("/");
}

export async function deleteLesson(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/trilhas");
  revalidatePath("/gerenciar");
  revalidatePath("/");
}

export async function deleteTrack(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/trilhas");
  revalidatePath("/gerenciar");
  revalidatePath("/");
}

async function notifySlackWebhook(text: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Best-effort — publishing must not fail because Slack is unreachable.
  }
}

export async function publishContent(input: PublishInput) {
  const { supabase, user } = await requireAdmin();

  if (!input.upload && !input.externalUrl) {
    throw new Error("Envie um arquivo ou cole um link.");
  }
  if (!input.title.trim()) {
    throw new Error("Título é obrigatório.");
  }

  if (input.kind === "material") {
    const contentType = input.contentType && isValidContentType(input.contentType) ? input.contentType : null;
    const category = input.category && isValidCategory(input.category) ? input.category : null;

    const { error } = await supabase.from("materials").insert({
      feature_id: input.targetId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      ext: input.upload?.ext ?? "LINK",
      format: input.upload?.format ?? "Drive",
      content_type: contentType,
      category,
      storage_path: input.upload?.path ?? null,
      external_url: input.externalUrl,
      status: input.status,
      is_highlight: input.publishToNovidades,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/materiais");
    revalidatePath(`/materiais/${input.productId}`);
    revalidatePath(`/materiais/${input.productId}/${input.targetId}`);
  } else {
    const { data: lastLesson } = await supabase
      .from("lessons")
      .select("position")
      .eq("track_id", input.targetId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("lessons").insert({
      track_id: input.targetId,
      position: (lastLesson?.position ?? 0) + 1,
      title: input.title.trim(),
      kind: inferLessonKind(input.upload, input.externalUrl),
      duration_min: 0,
      source_label: inferSourceLabel(input.upload, input.externalUrl),
      storage_path: input.upload?.path ?? null,
      external_url: input.externalUrl,
      status: input.status,
      is_highlight: input.publishToNovidades,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);

    const trackUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // A published lesson means the trilha has real content now — drop the
    // "em preparação" flag automatically instead of relying on the admin to
    // remember to flip it by hand, and stamp content_updated_at (not the
    // generic updated_at, which also moves on unrelated metadata edits) so
    // the "NOVO" badge and trilhas sort reflect genuine new content only.
    // Drafts don't count: nobody but admins can see them yet, so the banner
    // is still accurate for everyone else.
    if (input.status === "published") {
      trackUpdate.coming_soon = false;
      trackUpdate.content_updated_at = new Date().toISOString();
    }
    await supabase.from("tracks").update(trackUpdate).eq("id", input.targetId);

    revalidatePath("/trilhas");
    revalidatePath(`/trilhas/${input.targetId}`);
  }

  revalidatePath("/");
  revalidatePath("/gerenciar");

  if (input.status === "published" && input.notifySlack) {
    const label = input.kind === "material" ? "material" : "aula";
    await notifySlackWebhook(`📚 Novo ${label} publicado no Hub de Enablement: *${input.title.trim()}*`);
  }
}
