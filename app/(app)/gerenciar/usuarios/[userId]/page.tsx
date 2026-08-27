import { notFound } from "next/navigation";
import Link from "next/link";
import { IconChevronLeft } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage, Badge, Progress } from "@/niemeyer/components";
import { cn } from "@/lib/utils";
import { requireLeader } from "@/lib/auth";
import { getUserDetail } from "@/lib/queries/users";
import { formatRelative } from "@/lib/format";
import { TEAM_LABELS, isValidTeam } from "@/lib/teams";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StatTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "success" | "info" | "destructive";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <p
        className={cn(
          "font-heading text-[24px] font-semibold text-neutral-500",
          tone === "success" && "text-success-text",
          tone === "info" && "text-info-text",
          tone === "destructive" && "text-destructive-text",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { supabase, profile: viewer } = await requireLeader();

  const detail = await getUserDetail(supabase, userId);
  if (!detail) notFound();

  const seesAll = viewer.role === "admin" || viewer.leads_team === "all";
  if (!seesAll) {
    const ledTeams = viewer.leads_team?.split(",").filter(Boolean) ?? [];
    if (!detail.profile.team || !ledTeams.includes(detail.profile.team)) notFound();
  }

  const teamLabel =
    detail.profile.team && isValidTeam(detail.profile.team) ? TEAM_LABELS[detail.profile.team] : null;

  return (
    <>
      <Link
        href="/gerenciar/usuarios"
        className="flex w-fit items-center gap-1.5 text-[13px] font-bold text-neutral-600 hover:text-primary"
      >
        <IconChevronLeft className="size-4" />
        Usuários
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          {detail.profile.avatarUrl && <AvatarImage src={detail.profile.avatarUrl} alt="" />}
          <AvatarFallback>{initials(detail.profile.fullName, detail.profile.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-[24px] font-semibold tracking-tight text-foreground">
              {detail.profile.fullName ?? detail.profile.email}
            </h1>
            {detail.profile.role === "admin" && (
              <Badge variant="outline" className="shrink-0">
                Admin
              </Badge>
            )}
            {detail.profile.role === "leader" && (
              <Badge variant="secondary" className="shrink-0">
                Líder
              </Badge>
            )}
          </div>
          <p className="text-sm text-neutral-600">
            {[detail.profile.jobTitle, teamLabel].filter(Boolean).join(" · ") || detail.profile.email}
          </p>
          <p className="text-xs text-neutral-400">
            Último acesso: {detail.profile.lastSignInAt ? formatRelative(detail.profile.lastSignInAt) : "nunca"} ·
            Cadastrado {formatRelative(detail.profile.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <StatTile value={detail.stats.total} label="trilhas disponíveis" />
        <StatTile value={detail.stats.completed} label="concluídas" tone="success" />
        <StatTile value={detail.stats.inProgress} label="em andamento" tone="info" />
        <StatTile value={detail.stats.notStarted} label="ainda precisa acessar" />
        <StatTile value={detail.stats.overdue} label="atrasadas" tone="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border px-5 py-3">
          <p className="font-heading text-sm font-semibold text-foreground">Trilhas</p>
        </div>
        {detail.tracks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">Nenhuma trilha publicada ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {detail.tracks.map((track) => (
              <div key={track.trackId} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/trilhas/${track.trackId}`} className="truncate text-[13px] font-bold text-foreground hover:underline">
                      {track.title}
                    </Link>
                    {track.isRequiredForUser && (
                      <Badge variant="outline" className="shrink-0">
                        Obrigatória
                      </Badge>
                    )}
                    {track.isOverdue && (
                      <Badge variant="destructive" className="shrink-0">
                        Atrasada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {track.productName} · {track.done}/{track.total} aulas
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <Progress value={track.pct} className="h-1.5" />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-bold text-foreground">{track.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
