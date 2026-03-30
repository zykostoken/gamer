import type { Context } from "@netlify/functions";
import postgres from "postgres";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Notion database ID (desde el dashboard creado)
const METRICS_DB_ID = "b96ad414c48d4739b908d82b020cdc00";

export default async (req: Request, context: Context) => {
  // Solo permitir POST y validar API key
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  const apiKey = authHeader?.replace("Bearer ", "");
  
  if (!apiKey || apiKey !== Netlify.env.get("SYNC_API_KEY")) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Conectar a Supabase
    const sql = postgres(Netlify.env.get("DATABASE_URL")!);

    // Obtener todas las métricas de game metrics
    const metrics = await sql`
      SELECT 
        patient_dni,
        game_slug,
        metric_type,
        metric_value,
        metric_data,
        created_at
      FROM hdd_game_metrics
      WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
    `;

    // Obtener token de Notion desde env
    const notionToken = Netlify.env.get("NOTION_INTEGRATION_TOKEN");
    if (!notionToken) {
      throw new Error("NOTION_INTEGRATION_TOKEN not configured");
    }

    // Sincronizar cada métrica a Notion
    const syncResults = [];
    
    for (const metric of metrics) {
      const metricData = metric.metric_data || {};
      
      // Construir objeto para Notion
      const notionPage = {
        parent: { database_id: METRICS_DB_ID },
        properties: {
          "Paciente DNI": {
            title: [{ text: { content: metric.patient_dni || "N/A" } }]
          },
          "Juego": {
            select: { name: metric.game_slug || "unknown" }
          },
          "Fecha": {
            date: { start: metric.created_at.toISOString() }
          },
          "Tipo Métrica": {
            select: { name: metric.metric_type || "unknown" }
          },
          "Created At": {
            date: { start: metric.created_at.toISOString() }
          }
        }
      };

      // Agregar campos específicos según tipo de métrica
      if (metric.metric_type === "clinical_analysis") {
        Object.assign(notionPage.properties, {
          "Eficacia Objetivo": { number: metricData.eficacia_objetivo || null },
          "Eficacia Plan Propio": { number: metricData.eficacia_plan_propio || null },
          "Economía Cognitiva": { number: metricData.economia_cognitiva || null },
          "Patrón Error": metricData.error_response_pattern ? {
            select: { name: metricData.error_response_pattern }
          } : null,
          "Omisiones": { number: metricData.omission_errors || null },
          "Comisiones": { number: metricData.commission_errors || null },
          "Perseveraciones": { number: metricData.perseveration_count || null },
          "Tremor Reposo": { number: metricData.tremor_reposo || null },
          "Tremor Inicio": { number: metricData.tremor_inicio || null },
          "Tremor Terminal": { number: metricData.tremor_terminal || null },
          "Dismetria Media": { number: metricData.dismetria_mean_px || null },
          "Dismetria Patrón": metricData.dismetria_pattern ? {
            select: { name: metricData.dismetria_pattern }
          } : null,
          "RT Media (ms)": { number: metricData.rt_mean_ms || null },
          "RT CV": { number: metricData.rt_cv || null },
          "Hesitaciones": { number: metricData.hesitaciones_count || null },
          "Impulsividad": { number: metricData.impulsividad_ratio || null },
          "Inhibición Motor": { number: metricData.inhibicion_motor || null },
          "Engagement": metricData.engagement_level ? {
            select: { name: metricData.engagement_level }
          } : null,
          "Frustración": metricData.frustration_signal ? {
            select: { name: metricData.frustration_signal }
          } : null
        });
      } else if (metric.metric_type === "session_complete" || metric.metric_type === "session_summary") {
        Object.assign(notionPage.properties, {
          "Score": { number: metricData.score || metric.metric_value || null },
          "Completitud": { number: metricData.completed ? 1.0 : (metricData.completeness_pct || null) },
          "Duración (min)": { number: metricData.duration_sec ? metricData.duration_sec / 60 : (metricData.duration_ms ? metricData.duration_ms / 60000 : null) },
          "Tremor Reposo": { number: metricData.tremor_reposo_px || null },
          "Tremor Inicio": { number: metricData.tremor_inicio_px || null },
          "Tremor Terminal": { number: metricData.tremor_terminal_px || null },
          "RT Media (ms)": { number: metricData.rt_mean_ms || metricData.mean_rt_ms || metricData.mean_reaction_time_ms || null },
          "RT CV": { number: metricData.rt_cv || null },
          "Omisiones": { number: metricData.omission_errors || null },
          "Comisiones": { number: metricData.commission_errors || null }
        });
      } else if (metric.metric_type === "color_eleccion") {
        Object.assign(notionPage.properties, {
          "Color Elegido": {
            rich_text: [{
              text: {
                content: `${metricData.color_name || 'N/A'} (${metricData.color_hex || ''})`
              }
            }]
          }
        });
      }

      // Limpiar nulls
      for (const key in notionPage.properties) {
        if (notionPage.properties[key] === null) {
          delete notionPage.properties[key];
        }
      }

      // Crear página en Notion
      const response = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify(notionPage)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create Notion page: ${error}`);
        syncResults.push({ patient_dni: metric.patient_dni, status: "failed", error });
      } else {
        syncResults.push({ patient_dni: metric.patient_dni, status: "success" });
      }
    }

    await sql.end();

    return new Response(JSON.stringify({
      success: true,
      synced: syncResults.filter(r => r.status === "success").length,
      failed: syncResults.filter(r => r.status === "failed").length,
      details: syncResults
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Sync error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
