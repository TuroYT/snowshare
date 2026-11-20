---
name: SnowShare
description: Partage de fichiers, liens et pastes auto-hébergé, interface neutre et calme avec un accent configurable par l'admin.
colors:
  primary: "#3b82f6"
  primary-hover: "#2563eb"
  primary-dark: "#1e40af"
  secondary: "#64748b"
  secondary-hover: "#475569"
  secondary-dark: "#334155"
  background: "#fafaf9"
  surface: "#ffffff"
  surface-hover: "#f5f5f4"
  foreground: "#1c1917"
  foreground-muted: "#78716c"
  foreground-subtle: "#a8a29e"
  border: "#e7e5e4"
  border-hover: "#d6d3d1"
  destructive: "#dc2626"
  success: "#059669"
  warning: "#d97706"
  info: "#0ea5e9"
  dark-background: "#0c0a09"
  dark-surface: "#1c1917"
  dark-surface-hover: "#292524"
  dark-foreground: "#f5f5f4"
  dark-border: "#292524"
typography:
  headline:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
  title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
rounded:
  md: "6px"
  lg: "10px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-danger:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: SnowShare

## Overview

**Creative North Star: "Le Casier Silencieux"**

SnowShare est un casier bien rangé : on y dépose quelque chose, on le retrouve, et l'interface s'efface. Les neutres sont des gris chauds (famille stone), les surfaces sont séparées par des bordures fines plutôt que par des ombres, et la seule couleur vive est l'accent que l'admin de l'instance choisit.

La densité est celle d'un outil : textes de 14 px, contrôles compacts, peu d'ornements. Le thème clair et le thème sombre partagent la même structure ; seul le jeu de neutres change. L'accent par défaut est un bleu, mais il est surchargé par le branding de chaque instance, donc aucun composant ne doit supposer sa teinte.

Anti-référence confirmée : pas de SaaS bruyant, pas de dégradés décoratifs.

**Key Characteristics:**

- Neutres stone chauds, accent unique et configurable.
- Plat par défaut, bordures 1px, ombres rares.
- Compact, 14 px, interactions à 100 ms.
- Clair et sombre à parité.

## Colors

Palette retenue : neutre chaud + un accent piloté par le thème de l'instance.

### Primary

- **Accent d'instance** (#3b82f6, survol #2563eb, profond #1e40af) : boutons principaux, anneaux de focus, liens actifs. Surchargeable par l'admin via `--primary`. Les fonds teintés se dérivent par `color-mix` (arrière-plan = 5 % d'accent, teinte légère = 10 %).

### Secondary

- **Ardoise** (#64748b, survol #475569, profond #334155) : actions et éléments secondaires, surchargeable aussi.

### Neutral

- **Papier de pierre** (#fafaf9) : fond de page clair, légèrement teinté par l'accent.
- **Surface blanche** (#ffffff) : cartes, champs. Survol #f5f5f4.
- **Encre chaude** (#1c1917) : texte principal ; atténué #78716c, discret #a8a29e.
- **Filet** (#e7e5e4, survol #d6d3d1) : bordures et séparateurs.
- **Nuit de pierre** (#0c0a09) : fond sombre ; surface #1c1917, survol #292524, texte #f5f5f4, bordure #292524.
- **Sémantiques** : destructif #dc2626, succès #059669, alerte #d97706, info #0ea5e9.

### Named Rules

**The One Accent Rule.** Une seule couleur vive par écran, celle de l'instance. Les sémantiques ne servent qu'à signaler un état.

**The Themeable Rule.** Toute couleur passe par une variable CSS (`var(--primary)`, etc.), jamais en dur dans un composant.

## Typography

**Display / Body Font:** Geist Sans (repli system-ui), surchargeable par `--font-app` selon le branding.
**Mono Font:** Geist Mono pour le code des pastes et les slugs.

**Character:** une grotesque neutre et nette, sans fantaisie, qui laisse le contenu partagé au premier plan.

### Hierarchy

- **Headline** (600, 2rem à 1.5rem selon h1 à h3) : titres de page.
- **Title** (600, 1.25rem à 1.125rem) : titres de carte et de section.
- **Body** (400, 0.875rem) : texte courant et contrôles.
- **Label** (400, 0.75rem) : libellés de champ, aides, erreurs.

### Named Rules

**The Small and Sure Rule.** Le corps reste à 14 px ; la hiérarchie vient du poids et de la taille des titres, pas de la couleur.

## Layout

Interface d'outil, mobile d'abord, TailwindCSS 4. Contenus centrés en colonnes de lecture ; formulaires empilés ; espacement sur une échelle de 4 px. Les textes allemands et néerlandais, plus longs, doivent pouvoir passer à la ligne sans casser les contrôles.

## Elevation & Depth

Plat par défaut. La séparation vient de bordures 1px. Les ombres n'apparaissent que sur les cartes « elevated », modales et menus.

### Shadow Vocabulary

- **sm** (`0 1px 0 rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)`) : relief minimal.
- **md** (`0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04)`) : carte « elevated ».
- **lg** (`0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)`) : modales, menus. En sombre, opacités relevées (0.3 à 0.5).

### Named Rules

**The Flat-By-Default Rule.** Une surface au repos n'a pas d'ombre ; une bordure suffit.

## Shapes

Coins doucement arrondis : 6 px pour les contrôles (boutons, champs), 10 px pour les cartes et conteneurs. Bordures de 1px. Pas de formes décoratives ni de découpes.

## Components

### Buttons

- **Shape:** rayon 6 px, texte 14 px poids 500.
- **Primary:** fond accent, texte blanc, padding 8×16 px ; survol accent foncé.
- **Secondary:** surface avec bordure ; survol surface-hover et bordure plus marquée.
- **Ghost:** texte atténué, fond au survol seulement.
- **Danger:** fond destructif, survol par opacité 0.9.
- **Focus:** anneau 2 px de la couleur du bouton avec décalage de 2 px. Transition 100 ms. Tailles sm / md / lg ; état chargement avec spinner.

### Cards / Containers

- **Corner Style:** 10 px.
- **Background:** surface, bordure 1px (`bordered` utilise la bordure de survol).
- **Shadow Strategy:** aucune, sauf variante `elevated` (md).
- **Internal Padding:** 24 px.

### Inputs / Fields

- **Style:** fond input, bordure 1px, rayon 6 px, padding 8×12 px, libellé 12 px au-dessus.
- **Focus:** la bordure passe à la couleur du texte (pas d'anneau coloré).
- **Error / Disabled:** bordure et message destructifs ; désactivé à 50 % d'opacité.

### Autres primitives

Badge, Modal, Select, Switch, Tabs, Toast, Tooltip, Spinner et squelettes dans `src/components/ui`, tous construits sur les mêmes variables.

## Do's and Don'ts

### Do:

- **Do** utiliser les variables CSS (`var(--primary)`, `var(--border)`) pour toute couleur.
- **Do** séparer les surfaces par une bordure 1px avant de penser à une ombre.
- **Do** vérifier chaque écran en clair et en sombre, et avec l'accent par défaut et un autre.
- **Do** viser WCAG 2.1 AA, y compris le contraste de l'accent sur son fond.

### Don't:

- **Don't** utiliser de dégradés décoratifs ni d'effets de SaaS bruyant.
- **Don't** imbriquer des cartes dans des cartes.
- **Don't** introduire une couleur vive hors de l'accent d'instance.
- **Don't** coder en dur une couleur ou une police qui contournerait le branding admin.
