import Link from "next/link";
import { IconUsers } from "@tabler/icons-react";
import { Button } from "@/niemeyer/components";
import { requireAdmin } from "@/lib/auth";
import { getProducts } from "@/lib/queries/catalog";
import { getFeedbackFeed, getOpenContentRequests, getRecentPublications } from "@/lib/queries/gerenciar";
import { GerenciarForm } from "@/components/gerenciar/gerenciar-form";
import { RecentPublications } from "@/components/gerenciar/recent-publications";
import { FeedbackFeed } from "@/components/gerenciar/feedback-feed";
import { ContentRequestsPanel } from "@/components/gerenciar/content-requests-panel";
import { PageTip } from "@/components/onboarding/page-tip";

export default async function GerenciarPage() {
  const { supabase } = await requireAdmin();

  const [products, { data: features }, { data: tracks }, recentPublications, feedback, contentRequests] =
    await Promise.all([
      getProducts(supabase),
      supabase.from("features").select("id, product_id, name").order("position"),
      supabase
        .from("tracks")
        .select("id, product_id, title, feature_id, owner_name, owner_role, coming_soon, track_required_teams(team)")
        .order("position"),
      getRecentPublications(supabase),
      getFeedbackFeed(supabase),
      getOpenContentRequests(supabase),
    ]);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Gerenciar conteúdo</h1>
          <p className="text-sm text-neutral-600">
            Suba um material para a pasta de uma feature ou publique uma aula em uma trilha. Só o time de enablement vê esta área.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/gerenciar/usuarios">
            <IconUsers className="size-4" />
            Usuários
          </Link>
        </Button>
      </div>

      <PageTip
        pageKey="gerenciar"
        title="O que você pode fazer aqui"
        description="Suba um material ou publique uma aula de trilha à esquerda. À direita, veja o feedback das aulas e as solicitações de conteúdo do time."
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <GerenciarForm
          products={products}
          features={(features ?? []).map((f) => ({ id: f.id, productId: f.product_id, name: f.name }))}
          tracks={(tracks ?? []).map((t) => ({
            id: t.id,
            productId: t.product_id,
            title: t.title,
            featureId: t.feature_id,
            ownerName: t.owner_name,
            ownerRole: t.owner_role,
            comingSoon: t.coming_soon,
            requiredTeams: (t.track_required_teams ?? []).map((r: { team: string }) => r.team),
          }))}
        />
        <div className="flex flex-col gap-5">
          <RecentPublications items={recentPublications} />
          <ContentRequestsPanel items={contentRequests} />
          <FeedbackFeed items={feedback} />
        </div>
      </div>
    </>
  );
}
