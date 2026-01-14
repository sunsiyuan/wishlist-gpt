import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/daily
 * Unified daily cron endpoint that runs all daily tasks sequentially.
 * 
 * Tasks executed in order:
 * 1. /api/metrics/daily - User behavior daily report
 * 2. /api/cron/enrich - Enrichment retries
 * 3. /api/cron/system-health - System health report
 * 
 * Each task runs independently - failures in one task don't block others.
 */
export async function GET(request: NextRequest) {
  // Verify Cron Secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.BASE_URL || request.nextUrl.origin;
  const results: Record<string, { ok: boolean; error?: string; data?: unknown }> = {};

  // Task 1: Daily metrics
  try {
    const metricsResponse = await fetch(`${baseUrl}/api/metrics/daily`, {
      method: "GET",
      headers: {
        Authorization: authHeader || "",
      },
    });
    const metricsData = await metricsResponse.json();
    results.metrics = {
      ok: metricsResponse.ok,
      data: metricsData,
      error: metricsResponse.ok ? undefined : metricsData.error || `HTTP ${metricsResponse.status}`,
    };
  } catch (error) {
    results.metrics = {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Task 2: Enrichment
  try {
    const enrichResponse = await fetch(`${baseUrl}/api/cron/enrich`, {
      method: "GET",
      headers: {
        Authorization: authHeader || "",
      },
    });
    const enrichData = await enrichResponse.json();
    results.enrich = {
      ok: enrichResponse.ok,
      data: enrichData,
      error: enrichResponse.ok ? undefined : enrichData.error || `HTTP ${enrichResponse.status}`,
    };
  } catch (error) {
    results.enrich = {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Task 3: System health
  try {
    const healthResponse = await fetch(`${baseUrl}/api/cron/system-health`, {
      method: "GET",
      headers: {
        Authorization: authHeader || "",
      },
    });
    const healthData = await healthResponse.json();
    results.systemHealth = {
      ok: healthResponse.ok,
      data: healthData,
      error: healthResponse.ok ? undefined : healthData.error || `HTTP ${healthResponse.status}`,
    };
  } catch (error) {
    results.systemHealth = {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const allOk = Object.values(results).every((r) => r.ok);
  const status = allOk ? 200 : 207; // 207 Multi-Status if any task failed

  return NextResponse.json(
    {
      ok: allOk,
      executed_at: new Date().toISOString(),
      results,
    },
    { status },
  );
}
