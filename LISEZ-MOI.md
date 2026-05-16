# 🐟 Poissonerie PWA — Guide d'Installation

## Ce qui a été créé

```
poissonerie-pwa/
├── index.html        ← Application principale (à héberger)
├── manifest.json     ← Manifeste PWA (installable)
├── sw.js             ← Service Worker (mode offline)
├── firebase-sync.js  ← Module synchronisation temps réel
├── icon-192.png      ← Icône application
├── icon-512.png      ← Icône application HD
└── LISEZ-MOI.md      ← Ce fichier
```

---

## 📱 Installation sur Téléphone et PC

### L'application doit être hébergée en ligne (HTTPS)

#### Option 1 — GitHub Pages (GRATUIT, recommandé)
1. Créez un compte sur https://github.com
2. Créez un dépôt public nommé `poissonerie`
3. Uploadez tous les fichiers du dossier
4. Allez dans Settings → Pages → Source: main branch
5. Votre app sera disponible sur `https://VOTRE-PSEUDO.github.io/poissonerie`

#### Option 2 — Netlify Drop (GRATUIT, le plus simple)
1. Allez sur https://app.netlify.com/drop
2. Glissez-déposez le dossier entier
3. Votre app est en ligne en 30 secondes !

#### Option 3 — Votre propre hébergement
- Copiez tous les fichiers sur votre serveur web (Apache, Nginx...)
- L'URL doit être en HTTPS pour que la PWA fonctionne

---

## 🔥 Configuration Firebase (Synchronisation Temps Réel)

### Étape 1 — Créer un projet Firebase (GRATUIT)
1. Allez sur https://console.firebase.google.com
2. Cliquez "Créer un projet"
3. Donnez-lui un nom, désactivez Google Analytics si souhaité
4. Cliquez "Continuer"

### Étape 2 — Activer Firestore
1. Dans le menu, cliquez "Firestore Database"
2. Cliquez "Créer une base de données"
3. Choisissez "Mode test" (pendant le développement)
4. Sélectionnez une région proche (europe-west1 pour l'Afrique de l'Ouest)

### Étape 3 — Récupérer la configuration
1. Cliquez ⚙️ Paramètres du projet
2. Descendez jusqu'à "Vos applications"
3. Cliquez sur l'icône Web (</>)
4. Nommez l'app "Poissonerie"
5. Copiez le bloc `firebaseConfig`

### Étape 4 — Mettre à jour firebase-sync.js
Ouvrez `firebase-sync.js` et remplacez le bloc `FIREBASE_CONFIG` :

```javascript
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",        // ← Votre vraie clé
  authDomain:        "mon-projet.firebaseapp.com",
  projectId:         "mon-projet",
  storageBucket:     "mon-projet.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123...:web:abc..."
};
```

### Étape 5 — Sécurité Firestore (IMPORTANT)
Après les tests, mettez à jour les règles dans Firebase Console :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /poissonerie/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📲 Comment Installer sur les Appareils

### Sur Android (Chrome)
1. Ouvrez l'URL de l'app dans Chrome
2. Un bandeau "Installer l'application" apparaît en bas
3. Appuyez sur "Installer"
4. L'icône 🐟 apparaît sur votre écran d'accueil

### Sur iPhone/iPad (Safari)
1. Ouvrez l'URL dans Safari
2. Appuyez sur le bouton Partager (□↑)
3. Faites défiler et choisissez "Sur l'écran d'accueil"
4. Confirmez

### Sur PC Windows/Mac (Chrome ou Edge)
1. Ouvrez l'URL dans Chrome/Edge
2. Dans la barre d'adresse, cherchez l'icône 💻
3. Ou allez dans Menu (⋮) → "Installer Poissonerie"
4. Confirmez l'installation

---

## 👥 Utilisation Multi-Utilisateurs

Une fois Firebase configuré :
- **Tous les appareils** qui ouvrent la même URL partagent les mêmes données
- Les modifications sont **synchronisées en temps réel** (< 1 seconde)
- Si quelqu'un fait une vente sur son téléphone, les autres voient la mise à jour immédiatement
- Si un appareil est hors ligne, il se synchronise automatiquement à la reconnexion

### Gestion des utilisateurs dans l'app
- Dans l'app → Paramètres → Utilisateurs
- Créez des comptes avec des niveaux d'accès différents
- Admin : accès complet
- Vendeur : saisie uniquement
- Lecture : consultation uniquement

---

## ⚡ Fonctionnement Hors Ligne

L'application fonctionne **même sans internet** grâce au Service Worker :
- Toutes les pages sont mises en cache
- Les saisies se font localement
- La synchronisation reprend dès que la connexion revient

---

## 📊 Limites du Plan Gratuit Firebase

Plan Spark (Gratuit) — amplement suffisant pour une poissonerie :
- 1 Go de stockage
- 50 000 lectures / jour
- 20 000 écritures / jour
- 1 Go de bande passante / mois

Pour une utilisation commerciale intensive, le plan Blaze (pay-as-you-go) coûte environ 0.06$ / 100K lectures.

