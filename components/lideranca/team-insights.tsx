import { IconAlertTriangle, IconClockExclamation, IconMoodEmpty, IconUserOff } from "@tabler/icons-react";
import { Badge } from "@/niemeyer/components";
import type { DirectoryUser, TrackSummary } from "@/lib/queries/users";
import { isOverdue, isRequiredForTeam, requiredSince, REQUIRED_TRACK_DEADLINE_DAYS } from "@/lib/required-tracks";

const INACTIVE_DAYS = 14;

type PersonStatus = "concluida" | "andamento" | "nao_iniciada";

function personStatus(user: DirectoryUser): PersonStatus {
  if (user.tracks.some((t) => t.total > 0 && t.done >= t.total)) return "concluida";
  if (user.tracks.some((t) => t.done > 0)) return "andamento";
  return "nao_iniciada";
}

function displayName(user: DirectoryUser) {
  return user.fullName ?? user.email;
}

type TrackRow = {
  id: string;
  title: string;
  isRequiredForAnyone: boolean;
  totalPeople: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  pendingRequired: DirectoryUser[];
  overdue: DirectoryUser[];
};

function StackedBar({ completed, inProgress, notStarted }: { completed: number; inProgress: number; notStarted: number }) {
  const total = completed + inProgress + notStarted || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
      {completed > 0 && <div className="h-full bg-success" style={{ width: `${(completed / total) * 100}%` }} />}
      {inProgress > 0 && (
        <div className="h-full bg-info" style={{ width: `${(inProgress / total) * 100}%` }} />
      )}
      {notStarted > 0 && (
        <div className="h-full bg-neutral-300" style={{ width: `${(notStarted / total) * 100}%` }} />
      )}
    </div>
  );
}

function PeopleChip({ people }: { people: DirectoryUser[] }) {
  const shown = people.slice(0, 4);
  const rest = people.length - shown.length;
  return (
    <p className="mt-1 text-xs text-neutral-500">
      {shown.map(displayName).join(", ")}
      {rest > 0 ? ` e mais ${rest}` : ""}
    </p>
  );
}

export function TeamInsights({ users, tracks }: { users: DirectoryUser[]; tracks: TrackSummary[] }) {
  const total = users.length;
  const completed = users.filter((u) => personStatus(u) === "concluida").length;
  const inProgress = users.filter((u) => personStatus(u) === "andamento").length;
  const notStarted = total - completed - inProgress;

  const neverStarted = users.filter((u) => u.tracks.length === 0);
  const inactive = users.filter((u) => {
    if (!u.lastSignInAt) return true;
    const days = (Date.now() - new Date(u.lastSignInAt).getTime()) / 86_400_000;
    return days > INACTIVE_DAYS;
  });

  const trackRows: TrackRow[] = tracks
    .filter((t) => t.totalLessons > 0)
    .map((t) => {
      let rowCompleted = 0;
      let rowInProgress = 0;
      const pendingRequired: DirectoryUser[] = [];
      const overdue: DirectoryUser[] = [];
      for (const user of users) {
        const progress = user.tracks.find((x) => x.trackId === t.id);
        const done = progress?.done ?? 0;
        if (done >= t.totalLessons) {
          rowCompleted++;
        } else {
          if (done > 0) rowInProgress++;
          if (isRequiredForTeam(t.requiredTeams, user.team)) {
            pendingRequired.push(user);
            const since = requiredSince(t.requiredTeams, user.team);
            if (isOverdue(since, user.createdAt, done, t.totalLessons)) overdue.push(user);
          }
        }
      }
      return {
        id: t.id,
        title: t.title,
        isRequiredForAnyone: t.requiredTeams.length > 0,
        totalPeople: total,
        completed: rowCompleted,
        inProgress: rowInProgress,
        notStarted: total - rowCompleted - rowInProgress,
        pendingRequired,
        overdue,
      };
    })
    .sort(
      (a, b) =>
        (b.isRequiredForAnyone ? 1 : 0) - (a.isRequiredForAnyone ? 1 : 0) ||
        b.pendingRequired.length - a.pendingRequired.length,
    );

  const requiredAlerts = trackRows.filter((row) => row.isRequiredForAnyone && row.pendingRequired.length > 0);
  const overdueAlerts = trackRows.filter((row) => row.overdue.length > 0);

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="font-heading text-[28px] font-semibold text-success-text">{completed}</p>
          <p className="text-xs text-neutral-500">concluíram ao menos uma trilha</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="font-heading text-[28px] font-semibold text-info-text">{inProgress}</p>
          <p className="text-xs text-neutral-500">com trilha em andamento</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="font-heading text-[28px] font-semibold text-neutral-500">{notStarted}</p>
          <p className="text-xs text-neutral-500">ainda não iniciaram nenhuma</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-foreground">Engajamento do time</p>
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" />Concluíram</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-info" />Em andamento</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-neutral-300" />Não iniciaram</span>
          </div>
        </div>
        <div className="mt-3">
          <StackedBar completed={completed} inProgress={inProgress} notStarted={notStarted} />
        </div>
      </div>

      {(overdueAlerts.length > 0 || requiredAlerts.length > 0 || neverStarted.length > 0 || inactive.length > 0) && (
        <div className="flex flex-col gap-3">
          <p className="font-heading text-sm font-semibold text-foreground">Alertas</p>

          {overdueAlerts.map((row) => (
            <div key={`overdue-${row.id}`} className="flex items-start gap-3 rounded-xl border border-destructive-border bg-destructive-background p-4">
              <IconClockExclamation className="mt-0.5 size-4 shrink-0 text-destructive-text" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-destructive-text">
                  Trilha obrigatória atrasada: {row.title}
                </p>
                <p className="text-xs text-destructive-text/80">
                  {row.overdue.length} de {row.totalPeople} estão há mais de {REQUIRED_TRACK_DEADLINE_DAYS} dias sem concluir.
                </p>
                <PeopleChip people={row.overdue} />
              </div>
            </div>
          ))}

          {requiredAlerts.map((row) => (
            <div key={row.id} className="flex items-start gap-3 rounded-xl border border-destructive-border bg-destructive-background p-4">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive-text" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-destructive-text">
                  Trilha obrigatória pendente: {row.title}
                </p>
                <p className="text-xs text-destructive-text/80">
                  {row.pendingRequired.length} de {row.totalPeople} ainda não concluíram.
                </p>
                <PeopleChip people={row.pendingRequired} />
              </div>
            </div>
          ))}

          {neverStarted.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-background p-4">
              <IconMoodEmpty className="mt-0.5 size-4 shrink-0 text-warning-text" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-warning-text">
                  {neverStarted.length} {neverStarted.length === 1 ? "pessoa nunca começou" : "pessoas nunca começaram"} uma trilha
                </p>
                <PeopleChip people={neverStarted} />
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-background p-4">
              <IconUserOff className="mt-0.5 size-4 shrink-0 text-warning-text" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-warning-text">
                  {inactive.length} {inactive.length === 1 ? "pessoa sem acessar" : "pessoas sem acessar"} o hub há mais de {INACTIVE_DAYS} dias
                </p>
                <PeopleChip people={inactive} />
              </div>
            </div>
          )}
        </div>
      )}

      {trackRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <div className="border-b border-border px-5 py-3">
            <p className="font-heading text-sm font-semibold text-foreground">Progresso por trilha</p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {trackRows.map((row) => (
              <div key={row.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-foreground">{row.title}</span>
                    {row.isRequiredForAnyone && (
                      <Badge variant="outline" className="shrink-0">
                        Obrigatória
                      </Badge>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {row.completed}/{row.totalPeople} concluíram
                  </span>
                </div>
                <StackedBar completed={row.completed} inProgress={row.inProgress} notStarted={row.notStarted} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
