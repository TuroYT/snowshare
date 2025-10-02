#!/bin/bash

# Script pour exécuter le nettoyage des partages expirés
# Ce script compile et exécute le script TypeScript de nettoyage

set -e

echo "🚀 Démarrage du script de nettoyage des partages expirés..."

# Aller dans le répertoire du projet
cd /app

# Vérifier que les variables d'environnement nécessaires sont présentes
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: La variable d'environnement DATABASE_URL n'est pas définie"
    exit 1
fi

# Compiler et exécuter le script TypeScript avec tsx (ou ts-node)
npx tsx scripts/cleanup-expired-shares.ts

echo "✅ Script de nettoyage terminé"