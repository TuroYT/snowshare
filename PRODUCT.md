# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Admin auto-hébergeur (homelab, petite équipe) : installe SnowShare via Docker, configure quotas, stockage (disque local ou S3), OAuth, branding et inscription.
- Utilisateurs de l'instance (avec compte) : créent et gèrent leurs partages de fichiers, liens et pastes, clés d'API, profil.
- Destinataires, souvent anonymes : ouvrent un lien de partage (`/f`, `/l`, `/p`), saisissent éventuellement un mot de passe, puis téléchargent, lisent ou sont redirigés.

## Product Purpose

Partager des fichiers, des liens et des pastes depuis son propre serveur, avec expiration, nombre de vues maximal, mot de passe, slug personnalisé et QR code. Succès : un partage créé en quelques secondes, un destinataire qui accède au contenu sans friction, un admin qui garde le contrôle de ses données.

## Positioning

Outil tout-en-un auto-hébergé : fichiers (upload reprenable tus pour les gros volumes, multi-fichiers, aperçus), liens raccourcis et pastes avec coloration syntaxique dans une seule application, avec quotas distincts anonymes/connectés, API REST à clés, stockage local ou S3.

## Operating Context

Déploiement Docker (amd64/arm64) avec PostgreSQL. Usage depuis navigateur desktop et mobile. Les destinataires arrivent via un lien reçu par message ou e-mail.

## Capabilities and Constraints

- Types de partage : FILE, PASTE, URL ; options communes d'expiration, vues max, mot de passe, slug (`[a-zA-Z0-9_-]{3,30}`), QR code.
- Anonymes : expiration max 7 jours, quotas réduits.
- Pastes protégés par mot de passe chiffrés avec ce mot de passe.
- Admin : comptes (e-mail/mot de passe ou OAuth), vérification e-mail, CAPTCHA, thème et branding, modèles d'e-mails, journaux.
- Interface en 6 langues (en, fr, es, de, nl, pl) ; tout texte utilisateur doit exister dans les 6 locales.
- Stack : Next.js 16, React 19, TailwindCSS 4 + MUI, composants dans `src/components/ui`.

## Brand Commitments

Nom SnowShare et logo flocon (`public/logo.svg`) par défaut ; nom, logo, favicon, couleurs, typographie et image de fond sont configurables par l'admin pour chaque instance. Le design doit donc rester pilotable par tokens/thème.

## Evidence on Hand

README, `docs/`, `public/logo.svg`, page de documentation API (`src/app/api-docs`). Aucun témoignage ni chiffre de benchmark : ne rien inventer.

## Product Principles

- Partager en peu de gestes, sans compte obligatoire.
- Le propriétaire de l'instance garde la maîtrise de ses données et de son apparence.
- Sécurité visible mais discrète : mot de passe, expiration et chiffrement expliqués simplement.
- Fonctionne partout : mobile d'abord, 6 langues, gros fichiers fiables.

## Accessibility & Inclusion

Viser WCAG 2.1 AA. Textes de longueur variable selon la langue (allemand, néerlandais) à prévoir dans les mises en page.
