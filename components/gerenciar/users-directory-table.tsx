import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/niemeyer/components";
import { formatRelative } from "@/lib/format";
import { TEAM_LABELS, isValidTeam } from "@/lib/teams";
import type { DirectoryUser } from "@/lib/queries/users";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UsersDirectoryTable({ users }: { users: DirectoryUser[] }) {
  return (
    <Table tableClassName="min-w-[900px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[2fr]">Pessoa</TableHead>
          <TableHead>Área</TableHead>
          <TableHead>Último acesso</TableHead>
          <TableHead>Cadastrado em</TableHead>
          <TableHead className="w-[2.2fr]">Trilhas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const teamLabel = user.team && isValidTeam(user.team) ? TEAM_LABELS[user.team] : null;
          return (
            <TableRow key={user.id} className="relative hover:bg-neutral-50">
              <TableCell className="max-w-[260px]">
                <Link
                  href={`/gerenciar/usuarios/${user.id}`}
                  className="absolute inset-0"
                  aria-label={`Ver detalhes de ${user.fullName ?? user.email}`}
                />
                <div className="flex items-center gap-3">
                  <Avatar>
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                    <AvatarFallback>{initials(user.fullName, user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-bold text-foreground">
                        {user.fullName ?? user.email}
                      </span>
                      {user.role === "admin" && (
                        <Badge variant="outline" className="shrink-0">
                          Admin
                        </Badge>
                      )}
                      {user.role === "leader" && (
                        <Badge variant="secondary" className="shrink-0">
                          Líder
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-neutral-500">{user.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-[13px] text-neutral-600">
                {[user.jobTitle, teamLabel].filter(Boolean).join(" · ") || "—"}
              </TableCell>
              <TableCell className="text-[13px] text-neutral-600">
                {user.lastSignInAt ? formatRelative(user.lastSignInAt) : "—"}
              </TableCell>
              <TableCell className="text-[13px] text-neutral-600">
                {formatRelative(user.createdAt)}
              </TableCell>
              <TableCell>
                {user.tracks.length === 0 ? (
                  <span className="text-xs text-neutral-400">Nenhuma trilha iniciada</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {user.tracks.map((track) => (
                      <span
                        key={track.trackId}
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-600"
                      >
                        {track.trackTitle} · {track.done}/{track.total}
                      </span>
                    ))}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
