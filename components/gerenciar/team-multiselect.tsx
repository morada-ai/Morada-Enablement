"use client";

import { Checkbox, Label } from "@/niemeyer/components";
import { TEAM_OPTIONS, TEAM_LABELS } from "@/lib/teams";

const ALL_TEAMS_VALUE = "all";

export function TeamMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const isAll = value.includes(ALL_TEAMS_VALUE);

  function toggleTeam(team: string, checked: boolean) {
    onChange(checked ? [...value, team] : value.filter((t) => t !== team));
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Obrigatória para</label>
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex items-center gap-2 border-b border-neutral-150 pb-2.5">
          <Checkbox
            id="required-all-teams"
            checked={isAll}
            onCheckedChange={(checked) => onChange(checked === true ? [ALL_TEAMS_VALUE] : [])}
          />
          <Label htmlFor="required-all-teams" className="text-sm font-semibold">
            Todos os times
          </Label>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
          {TEAM_OPTIONS.map((team) => (
            <div key={team} className="flex items-center gap-2">
              <Checkbox
                id={`required-team-${team}`}
                checked={!isAll && value.includes(team)}
                disabled={isAll}
                onCheckedChange={(checked) => toggleTeam(team, checked === true)}
              />
              <Label htmlFor={`required-team-${team}`} className="text-[13px] font-normal text-neutral-700">
                {TEAM_LABELS[team]}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        Times marcados veem essa trilha como obrigatória e entram nos alertas de liderança se não concluírem.
      </p>
    </div>
  );
}
