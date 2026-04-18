// zykos-stuck-alert — Supabase Edge Function
// Constitucion ZYKOS V4, Articulo XIII
// Envia alerta por email cuando paciente acumula 3 intentos fallidos consecutivos
// en el mismo nivel de un juego (error rate > 49%)

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Types
interface AlertRequest {
  patient_dni: string;
  game_slug: string;
  level: number;
  consecutive_fails: number;
  error_rates: number[];
}

interface MetricRow {
  created_at: string;
  metric_value: number | null;
  metric_data: {
    score?: number;
    duration_sec?: number;
    rt_mean_ms?: number;
    error_rate?: number;
  } | null;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate required fields
function validateInput(body: unknown): { valid: true; data: AlertRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.patient_dni || typeof obj.patient_dni !== "string") {
    return { valid: false, error: "Missing or invalid field: patient_dni (string required)" };
  }
  if (!obj.game_slug || typeof obj.game_slug !== "string") {
    return { valid: false, error: "Missing or invalid field: game_slug (string required)" };
  }
  if (typeof obj.level !== "number" || !Number.isInteger(obj.level)) {
    return { valid: false, error: "Missing or invalid field: level (integer required)" };
  }
  if (typeof obj.consecutive_fails !== "number" || !Number.isInteger(obj.consecutive_fails)) {
    return { valid: false, error: "Missing or invalid field: consecutive_fails (integer required)" };
  }
  if (!Array.isArray(obj.error_rates) || obj.error_rates.length === 0) {
    return { valid: false, error: "Missing or invalid field: error_rates (non-empty array required)" };
  }
  for (const rate of obj.error_rates) {
    if (typeof rate !== "number") {
      return { valid: false, error: "error_rates must contain only numbers" };
    }
  }

  return {
    valid: true,
    data: {
      patient_dni: obj.patient_dni,
      game_slug: obj.game_slug,
      level: obj.level,
      consecutive_fails: obj.consecutive_fails,
      error_rates: obj.error_rates,
    },
  };
}

// Format date for Spanish locale
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

// Build HTML email body (neutral, no emojis, no diagnosis)
function buildEmailHtml(
  displayName: string,
  dni: string,
  gameSlug: string,
  level: number,
  consecutiveFails: number,
  errorRates: number[],
  metricRows: MetricRow[]
): string {
  const attemptsHtml = metricRows
    .map((row, idx) => {
      const data = row.metric_data || {};
      const score = data.score !== undefined ? data.score : "N/A";
      const duration = data.duration_sec !== undefined ? `${data.duration_sec}s` : "N/A";
      const rtMean = data.rt_mean_ms !== undefined ? `${data.rt_mean_ms}ms` : "N/A";
      const errorRate = errorRates[idx] !== undefined ? `${(errorRates[idx] * 100).toFixed(1)}%` : "N/A";
      return `<li><strong>Intento ${idx + 1}</strong> (${formatDate(row.created_at)}): score=${score}, duracion=${duration}, RT medio=${rtMean}, error rate=${errorRate}</li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Alerta ZYKOS - Paciente bloqueado</title>
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
  <h2 style="color: #222;">Alerta de progresion - Articulo XIII</h2>
  
  <p>El paciente <strong>${displayName}</strong> (DNI <strong>${dni}</strong>) ha acumulado <strong>${consecutiveFails} intentos consecutivos fallidos</strong> en el nivel <strong>${level}</strong> del juego <strong>${gameSlug}</strong>.</p>
  
  <p>Segun el Articulo XIII de la Constitucion ZYKOS V4, un intento se considera fallido cuando el error rate supera el 49%.</p>
  
  <h3 style="color: #444;">Resumen de los ultimos intentos:</h3>
  <ul>
    ${attemptsHtml}
  </ul>
  
  <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
  
  <p style="font-size: 12px; color: #666;">El sistema solo alerta. La interpretacion clinica es del profesional.</p>
  
  <p style="font-size: 11px; color: #888;">ZYKOS GAMER - Plataforma B2B de rehabilitacion cognitiva gamificada</p>
</body>
</html>`;
}

// Build plain text version
function buildEmailPlain(
  displayName: string,
  dni: string,
  gameSlug: string,
  level: number,
  consecutiveFails: number,
  errorRates: number[],
  metricRows: MetricRow[]
): string {
  const attemptsText = metricRows
    .map((row, idx) => {
      const data = row.metric_data || {};
      const score = data.score !== undefined ? data.score : "N/A";
      const duration = data.duration_sec !== undefined ? `${data.duration_sec}s` : "N/A";
      const rtMean = data.rt_mean_ms !== undefined ? `${data.rt_mean_ms}ms` : "N/A";
      const errorRate = errorRates[idx] !== undefined ? `${(errorRates[idx] * 100).toFixed(1)}%` : "N/A";
      return `- Intento ${idx + 1} (${formatDate(row.created_at)}): score=${score}, duracion=${duration}, RT medio=${rtMean}, error rate=${errorRate}`;
    })
    .join("\n");

  return `Alerta de progresion - Articulo XIII

El paciente ${displayName} (DNI ${dni}) ha acumulado ${consecutiveFails} intentos consecutivos fallidos en el nivel ${level} del juego ${gameSlug}.

Segun el Articulo XIII de la Constitucion ZYKOS V4, un intento se considera fallido cuando el error rate supera el 49%.

Resumen de los ultimos intentos:
${attemptsText}

---
El sistema solo alerta. La interpretacion clinica es del profesional.

ZYKOS GAMER - Plataforma B2B de rehabilitacion cognitiva gamificada`;
}

// Main handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate input
  const validation = validateInput(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { patient_dni, game_slug, level, consecutive_fails, error_rates } = validation.data;

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get patient display_name from zykos_users
  let displayName = patient_dni; // fallback
  try {
    const { data: userData, error: userError } = await supabase
      .from("zykos_users")
      .select("display_name")
      .eq("dni", patient_dni)
      .single();

    if (!userError && userData?.display_name) {
      displayName = userData.display_name;
    }
  } catch {
    // Keep fallback
  }

  // Get last 3 session_summary metrics for this patient/game/level
  let metricRows: MetricRow[] = [];
  try {
    const { data: metricsData } = await supabase
      .from("zykos_game_metrics")
      .select("created_at, metric_value, metric_data")
      .eq("patient_dni", patient_dni)
      .eq("game_slug", game_slug)
      .eq("metric_type", "session_summary")
      .order("created_at", { ascending: false })
      .limit(3);

    if (metricsData && Array.isArray(metricsData)) {
      metricRows = metricsData as MetricRow[];
    }
  } catch {
    // Continue with empty metrics
  }

  // Build email
  const subject = `[ZYKOS] Paciente ${displayName} (DNI ${patient_dni}) - bloqueado en nivel ${level} de ${game_slug}`;
  const htmlBody = buildEmailHtml(displayName, patient_dni, game_slug, level, consecutive_fails, error_rates, metricRows);
  const plainBody = buildEmailPlain(displayName, patient_dni, game_slug, level, consecutive_fails, error_rates, metricRows);

  // SMTP credentials
  const smtpHost = Deno.env.get("ZOHO_SMTP_HOST") ?? "smtp.zoho.com";
  const smtpPort = Number(Deno.env.get("ZOHO_SMTP_PORT") ?? "465");
  const smtpUser = Deno.env.get("ZOHO_SMTP_USER") ?? "";
  const smtpPassword = Deno.env.get("ZOHO_SMTP_PASSWORD") ?? "";
  const smtpFrom = Deno.env.get("ZOHO_SMTP_FROM") ?? "";
  const recipient = "gonzaloperezcortizo@gmail.com";

  let messageId = "";
  let smtpResult = "success";

  try {
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    const sendResult = await client.send({
      from: smtpFrom,
      to: recipient,
      subject: subject,
      content: plainBody,
      html: htmlBody,
    });

    // Try to extract message ID from result
    if (sendResult && typeof sendResult === "object" && "messageId" in sendResult) {
      messageId = String((sendResult as { messageId: string }).messageId);
    } else {
      messageId = `zykos-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    await client.close();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    smtpResult = `error: ${errorMsg}`;

    // Log to zykos_stuck_alerts_log (error case)
    try {
      await supabase.from("zykos_stuck_alerts_log").insert({
        patient_dni,
        game_slug,
        level,
        consecutive_fails,
        error_rates,
        sent_at: new Date().toISOString(),
        smtp_result: smtpResult,
        email_message_id: null,
      });
    } catch {
      // Silent fail for logging
    }

    return new Response(
      JSON.stringify({ sent: false, error: errorMsg }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Log successful send to zykos_stuck_alerts_log
  try {
    await supabase.from("zykos_stuck_alerts_log").insert({
      patient_dni,
      game_slug,
      level,
      consecutive_fails,
      error_rates,
      sent_at: new Date().toISOString(),
      smtp_result: smtpResult,
      email_message_id: messageId,
    });
  } catch {
    // Silent fail for logging — email was sent, that's what matters
  }

  return new Response(
    JSON.stringify({ sent: true, message_id: messageId, recipient }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
