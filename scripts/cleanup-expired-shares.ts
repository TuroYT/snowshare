#!/usr/bin/env node
import { PrismaClient } from '../src/generated/prisma';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Get upload directory from env or default to ./uploads
function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

async function cleanupExpiredShares() {
  console.log('🧹 Démarrage du nettoyage des partages expirés...');
  
  try {
    const now = new Date();
    
    // Récupérer les partages expirés avec les fichiers à supprimer
    const expiredShares = await prisma.share.findMany({
      where: {
        expiresAt: {
          lt: now
        }
      },
      select: {
        id: true,
        type: true,
        filePath: true,
        slug: true,
        createdAt: true,
        expiresAt: true
      }
    });

    console.log(`📊 ${expiredShares.length} partage(s) expiré(s) trouvé(s)`);

    if (expiredShares.length === 0) {
      console.log('✨ Aucun partage expiré à nettoyer');
      return;
    }

    let deletedFiles = 0;
    let deletedShares = 0;

    // Supprimer les fichiers physiques pour les partages de type FILE
    for (const share of expiredShares) {
      if (share.type === 'FILE' && share.filePath) {
        const fullFilePath = path.join(getUploadDir(), share.filePath);
        
        try {
          if (fs.existsSync(fullFilePath)) {
            fs.unlinkSync(fullFilePath);
            deletedFiles++;
            console.log(`🗑️  Fichier supprimé: ${share.filePath} (partage: ${share.slug})`);
          }
        } catch (error) {
          console.error(`❌ Erreur lors de la suppression du fichier ${share.filePath}:`, error);
        }
      }
    }

    // Supprimer les enregistrements de la base de données
    const deleteResult = await prisma.share.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });

    deletedShares = deleteResult.count;

    console.log(`✅ Nettoyage terminé:`);
    console.log(`   - ${deletedShares} partage(s) supprimé(s) de la base de données`);
    console.log(`   - ${deletedFiles} fichier(s) physique(s) supprimé(s)`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des partages expirés:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script s'il est appelé directement
if (require.main === module) {
  cleanupExpiredShares()
    .then(() => {
      console.log('🎉 Nettoyage terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Échec du nettoyage:', error);
      process.exit(1);
    });
}

export default cleanupExpiredShares;