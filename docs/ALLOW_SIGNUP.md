# Configuration de l'inscription (ALLOW_SIGNUP)

Cette fonctionnalité permet de désactiver les nouvelles inscriptions sur SnowShare.

## Configuration

### Variable d'environnement

Définissez la variable d'environnement `ALLOW_SIGNUP` :

- `ALLOW_SIGNUP=true` : Les inscriptions sont **autorisées** (par défaut)
- `ALLOW_SIGNUP=false` : Les inscriptions sont **désactivées**

### Docker Compose

Dans le fichier `docker-compose.yml`, modifiez la section environment :

```yaml
environment:
  # ... autres variables ...
  ALLOW_SIGNUP: false  # Désactive les inscriptions
```

### Variables locales

Pour le développement local, créez un fichier `.env.local` :

```bash
ALLOW_SIGNUP=false
```

## Comportement

### Quand ALLOW_SIGNUP=false :

1. **Navigation** : Les boutons "S'inscrire" disparaissent de la barre de navigation (desktop et mobile)

2. **Page d'inscription** : L'accès direct à `/auth/signup` affiche un message d'erreur et redirige vers la connexion

3. **Traductions** : Les messages d'erreur sont traduits dans toutes les langues supportées :
   - 🇫🇷 Français : "Inscription désactivée"
   - 🇬🇧 Anglais : "Sign up disabled"  
   - 🇪🇸 Espagnol : "Registro deshabilitado"
   - 🇩🇪 Allemand : "Registrierung deaktiviert"

### Quand ALLOW_SIGNUP=true (par défaut) :

- Comportement normal : tous les boutons d'inscription sont visibles
- La page `/auth/signup` fonctionne normalement

## Cas d'usage

Cette fonctionnalité est utile pour :
- **Installations privées** : Limiter l'accès à un groupe fermé d'utilisateurs
- **Maintenance** : Désactiver temporairement les inscriptions
- **Contrôle d'accès** : Permettre seulement aux administrateurs de créer des comptes

## Redémarrage requis

⚠️ **Important** : Après modification de la variable d'environnement, vous devez redémarrer l'application :

```bash
# Avec Docker Compose
docker-compose down && docker-compose up -d

# En local
npm run build && npm start
```