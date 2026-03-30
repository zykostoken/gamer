import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "./lib/db.mts";
import { getCorsHeaders } from "./lib/auth.mts";
import { isAdminSession } from "./lib/admin-roles.mts";
import { logProfessionalAction, getProfessionalFromToken } from "./lib/audit.mts";
import { createHash } from "crypto";

// ============================================================
// RECETA ELECTRÓNICA — SECURITY MODEL
// 
// 1. Auth obligatorio: solo profesionales con sesión activa
// 2. Solo admin/super_admin pueden prescribir
// 3. Cada receta genera CUIR único
// 4. Hash SHA-256 de integridad sobre el contenido completo
// 5. Audit log inmutable por cada acción
// 6. No UPDATE de contenido — solo anulación con motivo
// 7. No DELETE — nunca
// ============================================================

// Generar CUIR (Clave Única de Identificación de Receta)
// Formato: CJI-YYYYMMDD-NNNNNN (establecimiento-fecha-secuencial)
function generateCUIR(prescriptionId: number): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const seq = String(prescriptionId).padStart(6, '0');
  return `CJI-${date}-${seq}`;
}

// Hash SHA-256 de integridad del contenido de la receta
function computeIntegrityHash(data: Record<string, any>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export default async (req: Request, context: Context) => {
  const sql = getDatabase();
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }),
      { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, sessionToken } = body;

    // ── AUTH OBLIGATORIO ──
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Token de sesion requerido" }),
        { status: 401, headers: corsHeaders });
    }

    if (!(await isAdminSession(sql, sessionToken))) {
      return new Response(JSON.stringify({ error: "No autorizado — se requiere rol admin o super_admin" }),
        { status: 403, headers: corsHeaders });
    }

    const prof = await getProfessionalFromToken(sql, sessionToken);
    if (!prof) {
      return new Response(JSON.stringify({ error: "Profesional no encontrado o sesion expirada" }),
        { status: 403, headers: corsHeaders });
    }

    // Extraer IP y UA para audit
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ══════════════════════════════════════════════════════════
    // ACTION: create_prescription — CREAR RECETA ELECTRÓNICA
    // ══════════════════════════════════════════════════════════
    if (action === "create_prescription") {
      const {
        patientDni, prescriptionType, medications,
        diagnosisText, diagnosisSnomed, instructions,
        validUntil
      } = body;

      // Validaciones
      if (!patientDni || !medications || !Array.isArray(medications) || medications.length === 0) {
        return new Response(JSON.stringify({ error: "patientDni y medications[] son obligatorios" }),
          { status: 400, headers: corsHeaders });
      }

      // Validar cada medicamento
      for (const med of medications) {
        if (!med.droga || !med.dosis || !med.frecuencia) {
          return new Response(JSON.stringify({
            error: "Cada medicamento requiere: droga (nombre generico), dosis, frecuencia"
          }), { status: 400, headers: corsHeaders });
        }
      }

      // Validar tipo de receta
      const validTypes = ['general', 'archivada', 'restringida'];
      const rxType = validTypes.includes(prescriptionType) ? prescriptionType : 'general';

      // Retención según tipo (Res. 2214/2025)
      const retentionYears = rxType === 'general' ? 1 : 3;

      // Obtener datos del paciente
      const [patient] = await sql`
        SELECT id, dni, cuil, full_name, obra_social, obra_social_numero
        FROM hdd_patients WHERE dni = ${patientDni} LIMIT 1
      `;
      if (!patient) {
        return new Response(JSON.stringify({ error: "Paciente no encontrado" }),
          { status: 404, headers: corsHeaders });
      }

      // Calcular vigencia
      const validFrom = new Date().toISOString().split('T')[0];
      let validUntilDate = validUntil;
      if (!validUntilDate) {
        const d = new Date();
        if (rxType === 'restringida') d.setDate(d.getDate() + 30);
        else if (rxType === 'archivada') d.setDate(d.getDate() + 30);
        else d.setDate(d.getDate() + 30);
        validUntilDate = d.toISOString().split('T')[0];
      }

      // Datos para hash de integridad
      const hashData = {
        patientDni: patient.dni,
        patientCuil: patient.cuil || '',
        patientName: patient.full_name,
        professionalId: prof.id,
        professionalEmail: prof.email,
        professionalName: prof.fullName,
        professionalMatricula: prof.matriculaProvincial || prof.matriculaNacional || '',
        medications: medications,
        diagnosisText: diagnosisText || '',
        diagnosisSnomed: diagnosisSnomed || '',
        instructions: instructions || '',
        prescriptionType: rxType,
        validFrom: validFrom,
        validUntil: validUntilDate,
        timestamp: new Date().toISOString()
      };

      const integrityHash = computeIntegrityHash(hashData);

      // INSERT receta (inmutable)
      const [rx] = await sql`
        INSERT INTO electronic_prescriptions (
          patient_id, professional_id, prescription_type,
          medications, diagnosis_text, diagnosis_snomed,
          instructions, valid_from, valid_until, status,
          patient_cuil, patient_dni, patient_full_name,
          professional_cuil, professional_matricula_provincial,
          professional_matricula_nacional, professional_sisa_id,
          professional_specialty,
          firma_digital_hash, firma_nombre, firma_matricula,
          integrity_hash, retention_years
        ) VALUES (
          ${patient.id}, ${prof.id}, ${rxType},
          ${JSON.stringify(medications)}, ${diagnosisText || null}, ${diagnosisSnomed || null},
          ${instructions || null}, ${validFrom}, ${validUntilDate}, 'active',
          ${patient.cuil || null}, ${patient.dni}, ${patient.full_name},
          ${null}, ${prof.matriculaProvincial || null},
          ${prof.matriculaNacional || null}, ${null},
          ${prof.specialty || null},
          ${integrityHash}, ${prof.fullName},
          ${prof.matriculaProvincial || prof.matriculaNacional || ''},
          ${integrityHash}, ${retentionYears}
        )
        RETURNING id, created_at
      `;

      // Generar CUIR
      const cuirCode = generateCUIR(rx.id);
      await sql`
        UPDATE electronic_prescriptions SET cuir_code = ${cuirCode}
        WHERE id = ${rx.id}
      `;

      // Audit log inmutable
      await sql`
        INSERT INTO prescription_audit_log (
          prescription_id, action, actor_email, actor_professional_id,
          details, ip_address, user_agent, integrity_hash
        ) VALUES (
          ${rx.id}, 'CREATE', ${prof.email}, ${prof.id},
          ${JSON.stringify({
            cuir: cuirCode,
            type: rxType,
            patient_dni: patient.dni,
            medications_count: medications.length,
            valid_from: validFrom,
            valid_until: validUntilDate
          })},
          ${ipAddress}, ${userAgent}, ${integrityHash}
        )
      `;

      // Audit profesional general
      logProfessionalAction(sql, {
        professionalId: prof.id,
        professionalEmail: prof.email,
        actionType: 'prescription_create',
        resourceType: 'electronic_prescription',
        patientId: patient.id,
        patientName: patient.full_name,
        details: { cuir: cuirCode, type: rxType, medications: medications.length },
        ipAddress, userAgent,
      });

      return new Response(JSON.stringify({
        success: true,
        prescription: {
          id: rx.id,
          cuir: cuirCode,
          integrityHash,
          createdAt: rx.created_at,
          validFrom,
          validUntil: validUntilDate,
          type: rxType,
          status: 'active'
        }
      }), { status: 201, headers: corsHeaders });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: void_prescription — ANULAR RECETA
    // No se borra, no se modifica. Se marca como anulada.
    // ══════════════════════════════════════════════════════════
    if (action === "void_prescription") {
      const { prescriptionId, reason } = body;

      if (!prescriptionId || !reason || reason.trim().length < 10) {
        return new Response(JSON.stringify({
          error: "prescriptionId y reason (min 10 caracteres) son obligatorios"
        }), { status: 400, headers: corsHeaders });
      }

      const [existing] = await sql`
        SELECT id, status, cuir_code FROM electronic_prescriptions
        WHERE id = ${prescriptionId}
      `;
      if (!existing) {
        return new Response(JSON.stringify({ error: "Receta no encontrada" }),
          { status: 404, headers: corsHeaders });
      }
      if (existing.status === 'voided') {
        return new Response(JSON.stringify({ error: "Receta ya anulada" }),
          { status: 409, headers: corsHeaders });
      }

      await sql`
        UPDATE electronic_prescriptions SET
          status = 'voided',
          voided_at = now(),
          voided_by = ${prof.id},
          void_reason = ${reason.trim()}
        WHERE id = ${prescriptionId}
      `;

      // Audit inmutable
      await sql`
        INSERT INTO prescription_audit_log (
          prescription_id, action, actor_email, actor_professional_id,
          details, ip_address, user_agent,
          integrity_hash
        ) VALUES (
          ${prescriptionId}, 'VOID', ${prof.email}, ${prof.id},
          ${JSON.stringify({ reason: reason.trim(), previous_status: existing.status })},
          ${ipAddress}, ${userAgent},
          ${computeIntegrityHash({ id: prescriptionId, action: 'VOID', reason, by: prof.email, at: new Date().toISOString() })}
        )
      `;

      logProfessionalAction(sql, {
        professionalId: prof.id,
        professionalEmail: prof.email,
        actionType: 'prescription_void',
        resourceType: 'electronic_prescription',
        details: { prescriptionId, cuir: existing.cuir_code, reason },
        ipAddress, userAgent,
      });

      return new Response(JSON.stringify({ success: true, status: 'voided' }),
        { status: 200, headers: corsHeaders });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: list_prescriptions — LISTAR RECETAS DE UN PACIENTE
    // ══════════════════════════════════════════════════════════
    if (action === "list_prescriptions") {
      const { patientDni, includeVoided } = body;

      if (!patientDni) {
        return new Response(JSON.stringify({ error: "patientDni requerido" }),
          { status: 400, headers: corsHeaders });
      }

      let prescriptions;
      if (includeVoided) {
        prescriptions = await sql`
          SELECT ep.*, hp.full_name as professional_name
          FROM electronic_prescriptions ep
          LEFT JOIN healthcare_professionals hp ON ep.professional_id = hp.id
          WHERE ep.patient_dni = ${patientDni}
          ORDER BY ep.created_at DESC
        `;
      } else {
        prescriptions = await sql`
          SELECT ep.*, hp.full_name as professional_name
          FROM electronic_prescriptions ep
          LEFT JOIN healthcare_professionals hp ON ep.professional_id = hp.id
          WHERE ep.patient_dni = ${patientDni} AND ep.status != 'voided'
          ORDER BY ep.created_at DESC
        `;
      }

      // Audit de acceso
      logProfessionalAction(sql, {
        professionalId: prof.id,
        professionalEmail: prof.email,
        actionType: 'prescription_list_view',
        resourceType: 'electronic_prescription',
        details: { patientDni, count: prescriptions.length, includeVoided },
        ipAddress, userAgent,
      });

      return new Response(JSON.stringify({ success: true, prescriptions }),
        { status: 200, headers: corsHeaders });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: verify_prescription — VERIFICAR INTEGRIDAD
    // ══════════════════════════════════════════════════════════
    if (action === "verify_prescription") {
      const { prescriptionId } = body;

      if (!prescriptionId) {
        return new Response(JSON.stringify({ error: "prescriptionId requerido" }),
          { status: 400, headers: corsHeaders });
      }

      const [rx] = await sql`
        SELECT * FROM electronic_prescriptions WHERE id = ${prescriptionId}
      `;
      if (!rx) {
        return new Response(JSON.stringify({ error: "Receta no encontrada" }),
          { status: 404, headers: corsHeaders });
      }

      const [auditEntry] = await sql`
        SELECT integrity_hash FROM prescription_audit_log
        WHERE prescription_id = ${prescriptionId} AND action = 'CREATE'
        LIMIT 1
      `;

      const integrityMatch = auditEntry && rx.integrity_hash === auditEntry.integrity_hash;

      return new Response(JSON.stringify({
        success: true,
        prescription: {
          id: rx.id,
          cuir: rx.cuir_code,
          status: rx.status,
          integrityHash: rx.integrity_hash,
          auditHash: auditEntry?.integrity_hash,
          integrityVerified: integrityMatch,
          createdAt: rx.created_at,
          voidedAt: rx.voided_at,
          voidReason: rx.void_reason
        }
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Accion no reconocida" }),
      { status: 400, headers: corsHeaders });

  } catch (err: any) {
    console.error('Prescription error:', err);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: corsHeaders });
  }
};

export const config: Config = {
  path: "/api/prescriptions"
};
