#!/bin/bash

# Script para trigger manual del workflow agent-pr-curator
# Elimina automáticamente las branches huérfanas de Copilot
# Note: Does not use 'set -e' because we handle conditional gh CLI availability

echo "========================================="
echo "Agent PR Curator - Manual Trigger"
echo "========================================="
echo ""

echo "Este script intentará ejecutar el workflow agent-pr-curator"
echo "que eliminará automáticamente las branches Copilot huérfanas."
echo ""

# Intentar con gh CLI
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI (gh) detectado"
    echo ""
    echo "Ejecutando workflow..."
    
    if gh workflow run agent-pr-curator.yml; then
        echo ""
        echo "✅ Workflow ejecutado exitosamente!"
        echo ""
        echo "Para ver el progreso:"
        echo "  gh run list --workflow=agent-pr-curator.yml --limit 5"
        echo ""
        echo "Para ver logs en tiempo real:"
        echo "  gh run watch"
        exit 0
    else
        echo ""
        echo "❌ Error al ejecutar workflow"
        echo "Es posible que no tengas permisos suficientes."
        echo ""
    fi
else
    echo "❌ GitHub CLI (gh) no está instalado"
    echo ""
fi

# Opción manual vía UI
echo "========================================="
echo "Instrucciones para trigger manual vía UI:"
echo "========================================="
echo ""
echo "1. Abre en tu navegador:"
echo "   https://github.com/Psykostoken/gamer/actions/workflows/agent-pr-curator.yml"
echo ""
echo "2. Click en el botón 'Run workflow' (esquina superior derecha)"
echo ""
echo "3. Selecciona branch: main"
echo ""
echo "4. Click en 'Run workflow' (botón verde)"
echo ""
echo "5. Espera ~15-30 segundos y verás el workflow en ejecución"
echo ""
echo "========================================="
echo "Verificación tras ejecución:"
echo "========================================="
echo ""
echo "Ejecuta este comando para verificar branches restantes:"
echo "  git ls-remote --heads origin | grep copilot | wc -l"
echo ""
echo "Debería mostrar solo 1 (este PR)"
echo ""
echo "Branches a eliminar:"
echo "  - copilot/address-loading-issues-games-ui"
echo "  - copilot/audit-156-fix-sensitive-backup"
echo "  - copilot/auditoria-completa-de-codigo"
echo "  - copilot/complete-audit-hep-agent-og-media"
echo "  - copilot/complete-audit-media-agent"
echo "  - copilot/continuar-zykos-gamer-v4-tareas-pendientes"
echo "  - copilot/fix-pill-organizer-levels"
echo "  - copilot/integrate-facs-zykos-engine"
echo "  - copilot/integrate-facs-zykos-engine-again"
echo "  - copilot/replace-metric-dictionary-v4-json"
echo "  - copilot/resolve-conflicts-in-agent-og-media"
echo "  - copilot/audit-185-neuro-chef-bug"
echo "  - copilot/fix-pill-organizer-levels-again"
echo "  - copilot/fixneuro-chef-185-emojis-ingredientes"
echo ""
echo "Total: 14 branches huérfanas"
echo ""
