import Link from "next/link";
import { AuroraEvaluationDetailView } from "@/components/aurora-evaluation-detail";
import { currentAuroraAccess } from "@/lib/aurora/access";
import { getAuroraEvaluationDetail } from "@/lib/aurora/review";
import { getSession } from "@/lib/session";

export default async function AuroraEvaluationPage({
  params,
}: {
  params: Promise<{ evaluationId: string }>;
}) {
  const { evaluationId } = await params;
  const access = currentAuroraAccess(await getSession());
  const detail = access.ok ? await getAuroraEvaluationDetail(evaluationId) : undefined;
  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Intelligence / Evaluation</span>
          <h1>{detail?.evaluation.productName ?? "Evaluation detail"}</h1>
          <p>{detail ? detail.evaluation.createdAt : evaluationId}</p>
        </div>
        <Link className="admin-button ghost" href="/admin/intelligence">Back to Intelligence</Link>
      </div>
      {!access.ok ? (
        <section className="admin-panel">
          <h2>Pilot access unavailable</h2>
          <p>This route requires the enabled pilot, an ADMIN session, and allowlist membership.</p>
        </section>
      ) : detail ? (
        <AuroraEvaluationDetailView initialDetail={detail} />
      ) : (
        <section className="admin-panel">
          <h2>Evaluation not found</h2>
          <p>No immutable Aurora evaluation exists for this exact identifier.</p>
        </section>
      )}
    </section>
  );
}
