# 🔵 BaseScan — Scanner de tokens Base Chain

Scanner de nouveaux tokens sur Base Chain avec analyse de sécurité automatique (GoPlus).  
Conçu pour être utilisé depuis un téléphone uniquement, sans PC allumé en permanence.

---

## Ce que ça fait

- Scanne les nouveaux tokens sur Base Chain toutes les **30 secondes**
- Analyse chaque token via **GoPlus Security** (honeypot, mint, ownership, tax…)
- Calcule un **score de sécurité /100** et ne garde que ceux ≥ 75
- PWA installable sur l'écran d'accueil de ton téléphone
- Watchlist persistante, réglages sauvegardés dans le cloud

---

## Prérequis — Comptes à créer (tous gratuits)

| Compte | Lien | Pour quoi faire |
|--------|------|-----------------|
| **GitHub** | github.com | Héberger le code |
| **Cloudflare** | cloudflare.com | Faire tourner le scanner 24h/24 |
| **Vercel** | vercel.com | Héberger l'appli sur ton téléphone |
| **GoPlus Security** | gopluslabs.io | Analyser la sécurité des tokens |

---

## Étape 1 — Obtenir ta clé API GoPlus

1. Va sur **[gopluslabs.io](https://gopluslabs.io)**
2. Clique sur **"Get API Key"** ou **"Sign Up"**
3. Crée un compte gratuit
4. Dans le tableau de bord, copie ta clé API (ressemble à : `gp_xxxxxxxxxxxxxxxx`)
5. **Garde-la de côté**, tu en auras besoin plus tard

---

## Étape 2 — Mettre le code sur GitHub

1. Va sur **[github.com](https://github.com)** → clique **"New repository"**
2. Nomme-le `basescanner`, coche **"Private"**, clique **"Create repository"**
3. Sur ton PC, ouvre un terminal dans le dossier `basescanner/` et tape :

```bash
git init
git add .
git commit -m "Initial commit BaseScan"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/basescanner.git
git push -u origin main
```

> Remplace `TON-USERNAME` par ton nom d'utilisateur GitHub.

---

## Étape 3 — Déployer le Worker Cloudflare

### 3a. Installer les outils nécessaires

Sur ton PC, installe **Node.js** depuis [nodejs.org](https://nodejs.org) (version LTS).

Ensuite dans un terminal :

```bash
npm install -g wrangler
```

Connecte-toi à Cloudflare :

```bash
wrangler login
```

Une page s'ouvre dans le navigateur — accepte la connexion.

### 3b. Créer le namespace KV (base de données)

```bash
cd basescanner/worker
wrangler kv:namespace create "BASESCANNER_KV"
```

Tu vas voir quelque chose comme :

```
✅  Created namespace "BASESCANNER_KV"
{ binding = "KV", id = "abc123def456..." }
```

**Copie l'`id`** (la longue chaîne de caractères).

Fais la même chose pour le namespace de prévisualisation :

```bash
wrangler kv:namespace create "BASESCANNER_KV" --preview
```

Copie aussi ce `preview_id`.

### 3c. Mettre à jour wrangler.toml

Ouvre le fichier `worker/wrangler.toml` et remplace les deux lignes :

```toml
id = "REMPLACER_PAR_TON_KV_ID"
preview_id = "REMPLACER_PAR_TON_KV_PREVIEW_ID"
```

Par tes vrais IDs :

```toml
id = "abc123def456..."         # ton vrai ID KV
preview_id = "xyz789..."       # ton vrai preview ID KV
```

Sauvegarde le fichier.

### 3d. Ajouter ta clé GoPlus en secret

```bash
wrangler secret put GOPLUS_API_KEY
```

Quand il te demande la valeur, colle ta clé GoPlus et appuie sur Entrée.

### 3e. Déployer le Worker

```bash
wrangler deploy
```

Tu vas voir :

```
✅  Deployed basescanner-worker to https://basescanner-worker.TON-SOUS-DOMAINE.workers.dev
```

**Copie cette URL** — tu en auras besoin pour le frontend.

### 3f. Vérifier que ça tourne

Ouvre cette URL dans ton navigateur :

```
https://basescanner-worker.TON-SOUS-DOMAINE.workers.dev/api/health
```

Tu dois voir `{"status":"ok","ts":...}`. Si oui, le Worker tourne !

---

## Étape 4 — Déployer le frontend sur Vercel

### 4a. Connecter GitHub à Vercel

1. Va sur **[vercel.com](https://vercel.com)** → **"Sign Up"** avec ton compte GitHub
2. Clique **"New Project"**
3. Sélectionne ton repo `basescanner`
4. Dans **"Root Directory"**, clique **"Edit"** et tape : `frontend`
5. Vercel détecte automatiquement Vite — ne change rien d'autre

### 4b. Ajouter la variable d'environnement

Avant de cliquer "Deploy", dans la section **"Environment Variables"** :

| Nom | Valeur |
|-----|--------|
| `VITE_WORKER_URL` | `https://basescanner-worker.TON-SOUS-DOMAINE.workers.dev` |

> C'est l'URL que tu as copiée à l'étape 3e. **Sans slash à la fin.**

### 4c. Déployer

Clique **"Deploy"**. Vercel compile et déploie en ~2 minutes.

Tu obtiens une URL du type : `https://basescanner-abc123.vercel.app`

**Ouvre cette URL sur ton téléphone** pour vérifier que ça marche.

---

## Étape 5 — Installer la PWA sur ton téléphone

### Sur iPhone (Safari uniquement)

1. Ouvre l'URL Vercel dans **Safari** (pas Chrome, pas Firefox)
2. Appuie sur le bouton **Partager** (carré avec flèche vers le haut) en bas
3. Fais défiler vers le bas et appuie sur **"Sur l'écran d'accueil"**
4. Change le nom si tu veux → **"Ajouter"**
5. L'icône BaseScan apparaît sur ton écran d'accueil 📱

### Sur Android (Chrome)

1. Ouvre l'URL Vercel dans **Chrome**
2. Une bannière **"Ajouter à l'écran d'accueil"** devrait apparaître automatiquement
3. Si non : appuie sur les **⋮ trois points** en haut à droite → **"Ajouter à l'écran d'accueil"**
4. Confirme → l'icône BaseScan apparaît sur ton écran d'accueil 📱

---

## Étape 6 — Créer l'icône PWA

L'icône n'est pas incluse dans le code (fichier binaire). Voici comment en créer une :

1. Va sur **[favicon.io](https://favicon.io/favicon-generator/)** ou **[canva.com](https://canva.com)**
2. Crée une image carrée de 512×512 pixels avec :
   - Fond bleu foncé (`#050810`)
   - Texte "BS" ou logo de ton choix en bleu Base (`#0052FF`)
3. Exporte en PNG
4. Dans le repo GitHub, dans `frontend/public/`, télécharge les fichiers :
   - `icon-192.png` (192×192 pixels)
   - `icon-512.png` (512×512 pixels)
5. Pousse le commit → Vercel redéploie automatiquement

---

## Structure des fichiers

```
basescanner/
├── frontend/                  # PWA React (Vercel)
│   ├── public/
│   │   ├── manifest.json      # Config PWA
│   │   ├── sw.js              # Service Worker (cache offline)
│   │   └── icon-192.png       # Icône PWA (à créer — voir Étape 6)
│   ├── src/
│   │   ├── App.jsx            # Navigation 3 onglets
│   │   ├── components/
│   │   │   ├── Scanner.jsx    # Liste des tokens
│   │   │   ├── TokenCard.jsx  # Carte détaillée d'un token
│   │   │   ├── Watchlist.jsx  # Tokens suivis
│   │   │   └── Settings.jsx   # Réglages
│   │   ├── hooks/
│   │   │   ├── useScanner.js  # Polling Worker toutes les 30s
│   │   │   └── useSettings.js # Réglages persistants KV
│   │   └── index.css          # Styles globaux (thème Base Chain)
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
│
├── worker/                    # Cloudflare Worker (scanner 24h/24)
│   ├── src/
│   │   ├── index.js           # Routing HTTP + cron
│   │   ├── scanner.js         # DexScreener + orchestration
│   │   ├── scorer.js          # Analyse GoPlus + calcul score
│   │   └── kv.js              # Helpers lecture/écriture KV
│   └── wrangler.toml          # Config Cloudflare
│
└── README.md
```

---

## API REST du Worker

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/health` | Vérifie que le Worker tourne |
| `GET` | `/api/tokens` | Derniers tokens validés + stats |
| `GET` | `/api/settings` | Réglages utilisateur |
| `POST` | `/api/settings` | Met à jour les réglages |
| `GET` | `/api/watchlist` | Tokens en watchlist |
| `POST` | `/api/watchlist` | Ajoute un token |
| `DELETE` | `/api/watchlist/:addr` | Retire un token |
| `POST` | `/api/scan` | Déclenche un scan manuel |

---

## Calcul du score de sécurité (sur 100)

### Critères éliminatoires (score = 0 si l'un échoue)

| Critère | Impact |
|---------|--------|
| Honeypot détecté | ❌ Rejeté |
| Fonction Mint active | ❌ Rejeté |
| Ownership non renoncé | ❌ Rejeté |
| Tax buy ou sell > 10% | ❌ Rejeté |

### Critères pondérés

| Critère | Points |
|---------|--------|
| Liquidité lockée (Unicrypt/PinkLock) | +25 pts |
| Top 10 holders < 40% du supply | +20 pts |
| Wallet créateur < 5% du supply | +15 pts |
| Pas de fonction blacklist | +15 pts |
| Pas de proxy contract | +15 pts |
| Tax buy + sell < 5% | +10 pts |
| Tax buy + sell entre 5% et 10% | +5 pts |

**Score maximum : 100 pts — Seuil de validation : 75 pts**

---

## Dépannage

### Le Worker ne scanne pas
- Vérifie que le cron est activé : dans le dashboard Cloudflare → Workers → ton worker → "Triggers"
- Teste manuellement : `POST https://ton-worker.workers.dev/api/scan`
- Regarde les logs : `wrangler tail`

### "Worker non configuré" sur le téléphone
- Vérifie que `VITE_WORKER_URL` est bien défini dans Vercel (sans slash final)
- Redéploie si tu as changé la variable : Vercel → ton projet → "Redeploy"

### GoPlus retourne des erreurs
- Vérifie ta clé : `wrangler secret list` doit montrer `GOPLUS_API_KEY`
- Sans clé, l'API GoPlus fonctionne en mode limité — c'est suffisant pour démarrer
- Si rate limit (429), le scanner attendra le prochain cycle automatiquement

### La PWA ne s'installe pas sur iPhone
- Utilise **Safari** (pas Chrome, pas Firefox) — c'est une limitation d'Apple
- L'URL doit être en **HTTPS** (Vercel le fait automatiquement)

### Tokens filtrés mais aucun affiché
- Vérifie les réglages dans l'onglet ⚙️ (liquidité, âge, wallets)
- Le message "Marché calme" apparaît si aucun token n'est passé depuis 5 min — c'est normal

---

## Limites des offres gratuites

| Service | Limite gratuite | Usage BaseScan |
|---------|----------------|----------------|
| Cloudflare Workers | 100 000 req/jour | ~2 880 req/jour (2 scans/min) |
| Cloudflare KV | 1 000 écritures/jour | ~2 880 écritures/jour ⚠️ |
| Vercel | 100 GB bandwidth/mois | Très faible |
| GoPlus | 10 000 req/jour | ~100-200 req/jour |

> ⚠️ **KV écritures** : si le scanner tourne en continu, tu peux dépasser la limite KV.
> Solution : dans `wrangler.toml`, passe le cron à `*/2 * * * *` (toutes les 2 min) pour diviser par 2.

---

## Mises à jour

Pour mettre à jour après une modification du code :

**Worker** :
```bash
cd worker
wrangler deploy
```

**Frontend** : pousse sur GitHub → Vercel redéploie automatiquement.
