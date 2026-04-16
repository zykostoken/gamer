import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { email, display_name, dni, user_id } = body;

    if (!email) {
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const adminEmail = Netlify.env.get("ADMIN_EMAIL") || "gonzaloperezcortizo@gmail.com";
    const smtpUser = Netlify.env.get("ZOHO_SMTP_USER");
    const smtpPass = Netlify.env.get("ZOHO_SMTP_PASS");
    const timestamp = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

    console.log(`=== NUEVO REGISTRO ZYKOS GAMER ===`);
    console.log(`Email: ${email} | Nombre: ${display_name} | DNI: ${dni} | ID: ${user_id} | Fecha: ${timestamp}`);

    // Also insert to Supabase registration events table
    const supaUrl = Netlify.env.get("SUPABASE_URL");
    const supaKey = Netlify.env.get("SUPABASE_ANON_KEY");
    if (supaUrl && supaKey) {
      await fetch(`${supaUrl}/rest/v1/zykos_registration_events`, {
        method: "POST",
        headers: {
          "apikey": supaKey,
          "Authorization": `Bearer ${supaKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ user_id, email, display_name, dni })
      }).catch(e => console.warn("Supabase insert:", e));
    }

    // Send email via Zoho SMTP if configured
    if (smtpUser && smtpPass) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: Netlify.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com",
          port: 465,
          secure: true,
          auth: { user: smtpUser, pass: smtpPass }
        });

        await transporter.sendMail({
          from: `"ZYKOS GAMER" <${smtpUser}>`,
          to: adminEmail,
          subject: `[ZYKOS] Nuevo registro: ${display_name || email}`,
          html: `<div style="font-family:system-ui;max-width:500px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:20px;text-align:center;border-radius:12px 12px 0 0;">
              <h2 style="margin:0;color:#fff;">Nuevo Registro</h2>
            </div>
            <div style="padding:24px;background:#1a1a2e;color:#e2e8f0;border-radius:0 0 12px 12px;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Nombre:</strong> ${display_name || '-'}</p>
              <p><strong>DNI:</strong> ${dni || '-'}</p>
              <p><strong>User ID:</strong> ${user_id}</p>
              <p><strong>Fecha:</strong> ${timestamp}</p>
              <p style="font-size:0.8em;color:rgba(255,255,255,0.4);margin-top:16px;">15 sesiones gratuitas asignadas.</p>
            </div>
          </div>`
        });
        console.log("[ZYKOS] Email sent to", adminEmail);
      } catch (emailErr) {
        console.error("[ZYKOS] Email error:", emailErr);
      }
    } else {
      console.log("[ZYKOS] SMTP not configured — set ZOHO_SMTP_USER and ZOHO_SMTP_PASS");
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[ZYKOS] notify-registration error:", err);
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const config: Config = {
  path: "/api/notify-registration"
};
// SMTP configured 20260331183310
