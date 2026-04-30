# Agent PR Curator - Guía de Uso

## Descripción

El workflow `agent-pr-curator` es un meta-subagente TIER 2 que detecta y gestiona deuda técnica automáticamente:

- **PRs estancados** (>7 días sin actividad)
- **Branches Copilot huérfanas** (sin PR abierto) → **AUTO-DELETE**
- **Dependabot alerts** abiertas

## Configuración

**Archivo:** `.github/workflows/agent-pr-curator.yml`

**Schedule:** Diario a las 09:00 UTC (06:00 AR)

**Permisos:**
- `pull-requests: read`
- `issues: write`
- `contents: write` (para eliminar branches)

## Funcionalidad Auto-Delete

### Criterios de Eliminación

Una branch `copilot/*` será eliminada automáticamente si:
1. ✅ No tiene PR abierto asociado
2. ✅ No es la branch `main`
3. ✅ Comienza con prefijo `copilot/`

### Implementación

```javascript
// Líneas 47-62 de agent-pr-curator.yml
const orphanCandidates = branches.filter(b => 
  b.name !== 'main' && 
  b.name.startsWith('copilot/') &&
  !openPrBranches.has(b.name)
);

for (const branch of orphanCandidates) {
  try {
    await github.rest.git.deleteRef({
      ...repo,
      ref: `heads/${branch.name}`
    });
    deletedBranches.push(branch.name);
  } catch (e) {
    failedDeletes.push(branch.name);
  }
}
```

## Trigger Manual

### Opción 1: GitHub UI (RECOMENDADO)

1. Ir a: https://github.com/Psykostoken/gamer/actions/workflows/agent-pr-curator.yml
2. Click botón **"Run workflow"**
3. Seleccionar branch `main`
4. Click **"Run workflow"** (confirmar)

### Opción 2: GitHub CLI

```bash
gh workflow run agent-pr-curator.yml
```

### Opción 3: API REST

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/Psykostoken/gamer/actions/workflows/agent-pr-curator.yml/dispatches \
  -d '{"ref":"main"}'
```

## Comportamiento del Reporte

### Threshold de Issues

El workflow crea un issue SOLO si:
```javascript
totalDebt = stale_prs + orphan_copilot_branches_failed + dependabot_open
if (totalDebt >= 3) {
  // Crear issue
}
```

**Nota:** Las branches eliminadas exitosamente NO cuentan para el threshold.

### Formato del Issue

```markdown
# Reporte automático del agent-pr-curator

Fecha: YYYY-MM-DD

## PRs estancados (>7 días sin actividad)
- #N Title (último update YYYY-MM-DD)

## Branches Copilot huérfanas eliminadas
- ~~`copilot/branch-name`~~ ✅ eliminada

## Branches Copilot huérfanas (no se pudo eliminar)
- `copilot/branch-name`

## Dependabot alerts open
- [severity] package: summary
```

## Verificación

### Comprobar branches restantes

```bash
git ls-remote --heads origin | grep copilot
```

### Ver último run del workflow

```bash
gh run list --workflow=agent-pr-curator.yml --limit 1
```

### Ver logs del último run

```bash
gh run view --log
```

## Troubleshooting

### Error: "Could not delete branch"

**Causas posibles:**
1. Branch protegida (poco común para `copilot/*`)
2. Permisos insuficientes en el token de GitHub Actions
3. Branch ya fue eliminada en otro proceso concurrente

**Solución:**
- Las branches que fallen se reportan en la sección "no se pudo eliminar"
- Revisar manualmente y eliminar vía UI si es necesario

### El workflow no elimina branches

**Verificar:**
1. ✅ Workflow está habilitado: Settings → Actions → Workflows
2. ✅ Permisos correctos: Settings → Actions → General → Workflow permissions = "Read and write"
3. ✅ La branch realmente no tiene PR abierto

## Historial

- **2026-04-29:** Reporte inicial detectó 11 branches huérfanas (Issue #71)
- **2026-04-29:** PR #73 añadió funcionalidad auto-delete
- **2026-04-30:** PR #74 documentó el proceso y verificó funcionamiento

## Ver También

- `docs/META_SUBAGENTES_V5.md` - Doctrina completa
- `TECH_DEBT_RESOLUTION_2026-04-29.md` - Reporte de resolución
