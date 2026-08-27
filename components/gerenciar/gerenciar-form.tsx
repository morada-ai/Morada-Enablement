"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
} from "@/niemeyer/components";
import { cn } from "@/lib/utils";
import { createFeature, createTrack, deleteTrack, publishContent, updateTrackMeta } from "@/lib/actions/gerenciar";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, CONTENT_TYPE_LABELS, CONTENT_TYPE_OPTIONS } from "@/lib/material-tags";
import { FileUploader, type UploadedFile } from "./file-uploader";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { TeamMultiSelect } from "./team-multiselect";

export type ProductOption = { id: string; name: string };
export type FeatureOption = { id: string; productId: string; name: string };
export type TrackOption = {
  id: string;
  productId: string;
  title: string;
  featureId: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  comingSoon: boolean;
  requiredTeams: string[];
};

const NEW_FEATURE_VALUE = "__new_feature__";
const NEW_TRACK_VALUE = "__new_track__";
const NO_FEATURE_VALUE = "__no_feature__";

export function GerenciarForm({
  products,
  features,
  tracks,
}: {
  products: ProductOption[];
  features: FeatureOption[];
  tracks: TrackOption[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"material" | "lesson">("material");
  const [productId, setProductId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [contentType, setContentType] = useState("");
  const [category, setCategory] = useState("");
  const [publishToNovidades, setPublishToNovidades] = useState(true);
  const [notifySlack, setNotifySlack] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [localFeatures, setLocalFeatures] = useState<FeatureOption[]>([]);
  const [creatingFeature, setCreatingFeature] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState("");
  const [isCreatingFeature, startCreatingFeature] = useTransition();
  const [ownerNameDraft, setOwnerNameDraft] = useState("");
  const [ownerRoleDraft, setOwnerRoleDraft] = useState("");
  const [comingSoonDraft, setComingSoonDraft] = useState(false);
  const [featureIdDraft, setFeatureIdDraft] = useState(NO_FEATURE_VALUE);
  const [requiredTeamsDraft, setRequiredTeamsDraft] = useState<string[]>([]);
  const [isSavingTrackMeta, startSavingTrackMeta] = useTransition();
  const [confirmingTrackDelete, setConfirmingTrackDelete] = useState(false);
  const [localTracks, setLocalTracks] = useState<TrackOption[]>([]);
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackFeatureId, setNewTrackFeatureId] = useState(NO_FEATURE_VALUE);
  const [isCreatingTrack, startCreatingTrack] = useTransition();
  const [creatingTrackPasta, setCreatingTrackPasta] = useState(false);
  const [newTrackPastaName, setNewTrackPastaName] = useState("");
  const [isCreatingTrackPasta, startCreatingTrackPasta] = useTransition();

  const allFeatures = useMemo(() => [...features, ...localFeatures], [features, localFeatures]);
  const allTracks = useMemo(() => [...tracks, ...localTracks], [tracks, localTracks]);
  const productFeatures = useMemo(() => allFeatures.filter((f) => f.productId === productId), [allFeatures, productId]);

  const targetOptions = useMemo(
    () =>
      kind === "material"
        ? productFeatures.map((f) => ({ id: f.id, label: f.name }))
        : allTracks.filter((t) => t.productId === productId).map((t) => ({ id: t.id, label: t.title })),
    [kind, productId, productFeatures, allTracks],
  );

  const selectedTrack = kind === "lesson" ? allTracks.find((t) => t.id === targetId) ?? null : null;

  useEffect(() => {
    if (!selectedTrack) return;
    setOwnerNameDraft(selectedTrack.ownerName ?? "");
    setOwnerRoleDraft(selectedTrack.ownerRole ?? "");
    setComingSoonDraft(selectedTrack.comingSoon);
    setFeatureIdDraft(selectedTrack.featureId ?? NO_FEATURE_VALUE);
    setRequiredTeamsDraft(selectedTrack.requiredTeams);
  }, [selectedTrack]);

  function handleSaveTrackMeta() {
    if (!selectedTrack) return;
    startSavingTrackMeta(async () => {
      try {
        await updateTrackMeta(selectedTrack.id, {
          ownerName: ownerNameDraft,
          ownerRole: ownerRoleDraft,
          comingSoon: comingSoonDraft,
          featureId: featureIdDraft === NO_FEATURE_VALUE ? null : featureIdDraft,
          requiredTeams: requiredTeamsDraft,
        });
        toast("Dados da trilha atualizados.");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível salvar os dados da trilha.");
      }
    });
  }

  function handleTargetChange(value: string) {
    if (value === NEW_FEATURE_VALUE) {
      setCreatingFeature(true);
      return;
    }
    if (value === NEW_TRACK_VALUE) {
      setCreatingTrack(true);
      return;
    }
    setTargetId(value);
  }

  function handleCreateFeature() {
    if (!newFeatureName.trim() || !productId) return;
    startCreatingFeature(async () => {
      try {
        const created = await createFeature(productId, newFeatureName);
        setLocalFeatures((prev) => [...prev, { id: created.id, productId, name: created.name }]);
        setTargetId(created.id);
        setCreatingFeature(false);
        setNewFeatureName("");
        toast(`Pasta "${created.name}" criada.`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível criar a pasta.");
      }
    });
  }

  function handleCreateTrackPasta() {
    if (!newTrackPastaName.trim() || !productId) return;
    startCreatingTrackPasta(async () => {
      try {
        const created = await createFeature(productId, newTrackPastaName);
        setLocalFeatures((prev) => [...prev, { id: created.id, productId, name: created.name }]);
        setNewTrackFeatureId(created.id);
        setCreatingTrackPasta(false);
        setNewTrackPastaName("");
        toast(`Pasta "${created.name}" criada.`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível criar a pasta.");
      }
    });
  }

  function handleCreateTrack() {
    if (!newTrackName.trim() || !productId) return;
    const featureId = newTrackFeatureId === NO_FEATURE_VALUE ? null : newTrackFeatureId;
    startCreatingTrack(async () => {
      try {
        const created = await createTrack(productId, featureId, newTrackName);
        setLocalTracks((prev) => [
          ...prev,
          { id: created.id, productId, title: created.name, featureId, ownerName: null, ownerRole: null, comingSoon: true, requiredTeams: [] },
        ]);
        setTargetId(created.id);
        setCreatingTrack(false);
        setNewTrackName("");
        setNewTrackFeatureId(NO_FEATURE_VALUE);
        toast(`Trilha "${created.name}" criada.`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível criar a trilha.");
      }
    });
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setUploadedFile(null);
    setExternalUrl("");
    setContentType("");
    setCategory("");
    setPublishToNovidades(true);
    setNotifySlack(true);
  }

  function handleSubmit(status: "draft" | "published") {
    if (!productId || !targetId) {
      toast(kind === "material" ? "Escolha o produto e a pasta da feature." : "Escolha o produto e a trilha.");
      return;
    }
    if (!title.trim()) {
      toast("Dê um título ao conteúdo.");
      return;
    }
    if (!uploadedFile && !externalUrl.trim()) {
      toast("Envie um arquivo ou cole um link.");
      return;
    }

    startTransition(async () => {
      try {
        await publishContent({
          kind,
          productId,
          targetId,
          title,
          description,
          upload: uploadedFile ? { path: uploadedFile.path, ext: uploadedFile.ext, format: uploadedFile.format } : null,
          externalUrl: externalUrl.trim() || null,
          contentType: kind === "material" ? contentType || null : null,
          category: kind === "material" ? category || null : null,
          status,
          publishToNovidades,
          notifySlack,
        });
        toast(status === "published" ? "Publicado no hub." : "Rascunho salvo.");
        resetForm();
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-xs">
      <div>
        <p className="mb-2 text-sm font-bold text-foreground">O que você está subindo?</p>
        <div className="flex gap-2">
          {(["material", "lesson"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setKind(option);
                setTargetId("");
                setCreatingFeature(false);
                setCreatingTrack(false);
                setCreatingTrackPasta(false);
              }}
              className={cn(
                "flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors",
                kind === option
                  ? "border-primary bg-primary font-bold text-primary-foreground"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              {option === "material" ? "Material" : "Aula de trilha"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Produto</label>
          <Select
            value={productId}
            onValueChange={(value) => {
              setProductId(value);
              setTargetId("");
              setCreatingFeature(false);
              setCreatingTrack(false);
              setCreatingTrackPasta(false);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha o produto" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-neutral-600">
            {kind === "material" ? "Pasta da feature" : "Trilha"}
          </label>
          <Select value={targetId} onValueChange={handleTargetChange} disabled={!productId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={productId ? "Escolha" : "Escolha o produto primeiro"} />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
              {kind === "material" && (
                <SelectItem value={NEW_FEATURE_VALUE} className="font-bold text-primary">
                  + Criar nova pasta
                </SelectItem>
              )}
              {kind === "lesson" && (
                <SelectItem value={NEW_TRACK_VALUE} className="font-bold text-primary">
                  + Criar nova trilha
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {creatingFeature && (
            <div className="mt-2 flex items-center gap-2">
              <input
                autoFocus
                value={newFeatureName}
                onChange={(e) => setNewFeatureName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFeature()}
                placeholder="Nome da nova pasta"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                size="sm"
                isLoading={isCreatingFeature}
                disabled={!newFeatureName.trim()}
                onClick={handleCreateFeature}
              >
                Criar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isCreatingFeature}
                onClick={() => {
                  setCreatingFeature(false);
                  setNewFeatureName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
          {creatingTrack && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
              <input
                autoFocus
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                placeholder="Nome da nova trilha"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-neutral-500">
                  Pasta (conecta a trilha aos materiais dessa feature)
                </label>
                <Select
                  value={newTrackFeatureId}
                  onValueChange={(value) => {
                    if (value === NEW_FEATURE_VALUE) {
                      setCreatingTrackPasta(true);
                      return;
                    }
                    setNewTrackFeatureId(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FEATURE_VALUE}>Sem pasta específica</SelectItem>
                    {productFeatures.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_FEATURE_VALUE} className="font-bold text-primary">
                      + Criar nova pasta
                    </SelectItem>
                  </SelectContent>
                </Select>
                {creatingTrackPasta && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      autoFocus
                      value={newTrackPastaName}
                      onChange={(e) => setNewTrackPastaName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTrackPasta()}
                      placeholder="Nome da nova pasta"
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <Button
                      size="sm"
                      isLoading={isCreatingTrackPasta}
                      disabled={!newTrackPastaName.trim()}
                      onClick={handleCreateTrackPasta}
                    >
                      Criar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isCreatingTrackPasta}
                      onClick={() => {
                        setCreatingTrackPasta(false);
                        setNewTrackPastaName("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isCreatingTrack}
                  onClick={() => {
                    setCreatingTrack(false);
                    setNewTrackName("");
                    setNewTrackFeatureId(NO_FEATURE_VALUE);
                    setCreatingTrackPasta(false);
                    setNewTrackPastaName("");
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" isLoading={isCreatingTrack} disabled={!newTrackName.trim()} onClick={handleCreateTrack}>
                  Criar trilha
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Release de agosto — peso por corretor"
          className="h-10 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {selectedTrack && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-neutral-50 p-4">
          <p className="text-xs font-bold text-neutral-600">Sobre a trilha &ldquo;{selectedTrack.title}&rdquo;</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Responsável</label>
              <input
                value={ownerNameDraft}
                onChange={(e) => setOwnerNameDraft(e.target.value)}
                placeholder="Nome de alguém do time"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Cargo / time</label>
              <input
                value={ownerRoleDraft}
                onChange={(e) => setOwnerRoleDraft(e.target.value)}
                placeholder="Ex: Enablement · Vendas"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Pasta</label>
            <Select value={featureIdDraft} onValueChange={setFeatureIdDraft}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FEATURE_VALUE}>Sem pasta específica</SelectItem>
                {productFeatures.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-neutral-500">
              Conecta a trilha aos materiais dessa pasta — aparece um link entre as duas telas.
            </p>
          </div>
          <TeamMultiSelect value={requiredTeamsDraft} onChange={setRequiredTeamsDraft} />
          <ToggleRow
            label="Trilha em preparação"
            hint="Mostra o aviso 'em preparação' na trilha. Desligue quando o conteúdo estiver pronto de verdade."
            checked={comingSoonDraft}
            onCheckedChange={setComingSoonDraft}
          />
          <div className="flex justify-between">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmingTrackDelete(true)}
            >
              Excluir trilha
            </Button>
            <Button size="sm" variant="outline" isLoading={isSavingTrackMeta} onClick={handleSaveTrackMeta}>
              Salvar dados da trilha
            </Button>
          </div>
        </div>
      )}

      {selectedTrack && (
        <ConfirmDeleteDialog
          open={confirmingTrackDelete}
          onOpenChange={setConfirmingTrackDelete}
          title="Excluir trilha?"
          description={`"${selectedTrack.title}" e todas as suas aulas serão removidas do hub para sempre, junto com o progresso e as avaliações do time. Essa ação não pode ser desfeita.`}
          onConfirm={async () => {
            await deleteTrack(selectedTrack.id);
            toast("Trilha excluída.");
            setTargetId("");
            router.refresh();
          }}
        />
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Descrição</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Uma linha sobre o que é e quando usar."
          className="min-h-[72px]"
        />
      </div>

      {kind === "material" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Tipo de conteúdo</label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {CONTENT_TYPE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Categoria</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {CATEGORY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Arquivo</label>
        <FileUploader
          pathPrefix={`${productId || "geral"}/${targetId || "sem-pasta"}`}
          onChange={setUploadedFile}
          disabled={!!externalUrl.trim()}
        />
        <div className="my-3 flex items-center gap-3 text-xs text-neutral-400">
          <div className="h-px flex-1 bg-neutral-200" />
          ou
          <div className="h-px flex-1 bg-neutral-200" />
        </div>
        <input
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="Cole um link do Drive, Notion, YouTube ou Loom"
          disabled={!!uploadedFile}
          className="h-10 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <ToggleRow
          label="Publicar em Novidades no hub"
          hint="Aparece no feed de novidades da Home enquanto estiver recente."
          checked={publishToNovidades}
          onCheckedChange={setPublishToNovidades}
        />
        <ToggleRow
          label="Avisar o time no Slack"
          hint="Envia um aviso para o canal configurado ao publicar."
          checked={notifySlack}
          onCheckedChange={setNotifySlack}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" disabled={isPending} onClick={() => handleSubmit("draft")}>
          Salvar rascunho
        </Button>
        <Button isLoading={isPending} onClick={() => handleSubmit("published")}>
          Publicar no hub
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[13px] font-bold text-foreground">{label}</p>
        <p className="text-xs text-neutral-500">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  );
}
