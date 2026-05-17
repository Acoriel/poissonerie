/* ══════════════════════════════════════════════════════════════════════════════
   FIREBASE SYNC — Poissonerie PWA
   Synchronisation temps réel multi-utilisateurs via Firebase Firestore
   
   ⚠️  CONFIGURATION REQUISE :
   Remplacez les valeurs ci-dessous par votre configuration Firebase.
   Pour créer un projet Firebase gratuit :
   1. Allez sur https://console.firebase.google.com
   2. Créez un nouveau projet
   3. Activez Firestore Database (mode production)
   4. Allez dans Paramètres du projet > Vos applications > Web
   5. Copiez la configuration et remplacez les valeurs ci-dessous
   ══════════════════════════════════════════════════════════════════════════════ */

// ── CONFIGURATION FIREBASE (à remplacer) ──────────────────────────────────────

  // Import the functions you need from the SDKs you need
  
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDRnGN5YkhI9_wtjAP2LHwGjMjUrgpo_8I",
    authDomain: "poissonerie-cfd28.firebaseapp.com",
    projectId: "poissonerie-cfd28",
    storageBucket: "poissonerie-cfd28.firebasestorage.app",
    messagingSenderId: "888779339185",
    appId: "1:888779339185:web:2770c350cb4c1f22323990"
  };

  // Initialize Firebase
 // const app = initializeApp(firebaseConfig);

// Rendre accessible globalement
window.FIREBASE_CONFIG = firebaseConfig;

// ─────────────────────────────────────────────────────────────────────────────

// Nom du document Firestore dans lequel toutes les données sont stockées
const FB_DOC_ID    = 'main';
const FB_COLL      = 'poissonerie';
const FB_USERS_DOC = 'users_config';

// ── ÉTAT GLOBAL FIREBASE ──────────────────────────────────────────────────────
window.fbState = {
  initialized: false,
  connected:   false,
  syncing:     false,
  lastPush:    null,
  lastPull:    null,
  listener:    null,   // unsubscribe fonction du listener Firestore
  db:          null,
  auth:        null,
  userId:      null,
  error:       null,
};

// ── INITIALISATION FIREBASE ───────────────────────────────────────────────────
async function initFirebase() {
  try {

    // Initialisation Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }

   const db = firebase.firestore();
     console.log("DB TEST OK", db);
    const auth = firebase.auth();

    window.fbState.db = db;
    window.fbState.auth = auth;

    // Authentification anonyme
    await auth.signInAnonymously();

    auth.onAuthStateChanged(user => {
      if (user) {
        window.fbState.userId = user.uid;
        window.fbState.initialized = true;

        console.log('[Firebase] Authentifié:', user.uid);

        startFirestoreListener();
        updateSyncBadge('connected');
      }
    });

    return true;

  } catch (err) {
    console.error('[Firebase] Erreur init:', err);

    window.fbState.error = err.message;

    updateSyncBadge('error');

    return false;
  }
}

// ── LISTENER TEMPS RÉEL ───────────────────────────────────────────────────────
function startFirestoreListener() {
  cconst { db } = window.fbState;
if (!db) return;

  // Arrêter l'ancien listener s'il existe
  if (window.fbState.listener) {
    window.fbState.listener();
    window.fbState.listener = null;
  }

  const docRef = db.collection(FB_COLL).doc(FB_DOC_ID);
  let localTs  = parseInt(localStorage.getItem('poisson_local_ts') || '0');

 window.fbState.listener = docRef.onSnapshot(snapshot => {
    if (!snapshot.exists()) {
      console.log('[Firebase] Document inexistant — premier push à venir');
      return;
    }

    const data    = snapshot.data();
    const cloudTs = data._ts || 0;
    const myTs    = parseInt(localStorage.getItem('poisson_local_ts') || '0');

    // Ignorer si c'est notre propre push récent (éviter la boucle)
    if (data._pushedBy === window.fbState.userId) {
      const pushAgo = Date.now() - (data._pushTime || 0);
      if (pushAgo < 3000) {
        console.log('[Firebase] Ignorer écho de notre propre push');
        return;
      }
    }

    // Si le cloud est plus récent → mettre à jour localement
    if (cloudTs > myTs) {
      console.log('[Firebase] Données cloud plus récentes, mise à jour locale...');
      try {
        const dbData = JSON.parse(data.dbJson);
        if (dbData && dbData.ops && dbData.products) {
          window.DB = dbData;
          if (!window.DB.cats) window.DB.cats = window.DEFAULT_CATS.map(c=>({...c}));
          if (!window.DB.prods) window.DB.prods = [...window.DEFAULT_PRODS];

          // Sauvegarder localement
          localStorage.setItem(window.LS_DB, JSON.stringify(window.DB));
          localStorage.setItem('poisson_local_ts', cloudTs.toString());
          localStorage.setItem(window.LS_SAVE_DATE, new Date(cloudTs).toISOString());

          // Rafraîchir l'interface
          if (typeof recalcAllStocks === 'function') recalcAllStocks();
          if (typeof rSel === 'function') rSel();
          if (typeof rOps === 'function') rOps();
          if (typeof rTopbar === 'function') rTopbar();
          if (typeof rDash === 'function') rDash();

          window.fbState.lastPull = new Date();
          updateSyncBadge('connected');
          showSyncToast('🔄 Données mises à jour depuis le cloud');
          console.log('[Firebase] Mise à jour locale réussie (' + dbData.ops.length + ' ops)');
        }
      } catch (err) {
        console.error('[Firebase] Erreur parsing données cloud:', err);
      }
    } else {
      updateSyncBadge('connected');
    }
  }, err => {
    console.error('[Firebase] Erreur listener:', err);
    updateSyncBadge('error');
    // Tentative de reconnexion après 10s
    setTimeout(startFirestoreListener, 10000);
  });

  console.log('[Firebase] Listener temps réel actif');
}

// ── PUSH VERS FIRESTORE ────────────────────────────────────────────────────────
let _pushDebounceTimer = null;
async function fbPush(immediate = false) {
  if (!window.fbState.initialized || !window.fbState.db || !window._fb) return;

  // Debounce : attendre 1.5s avant de vraiment pousser (regroupe les sauvegardes rapides)
  if (!immediate) {
    clearTimeout(_pushDebounceTimer);
    _pushDebounceTimer = setTimeout(() => fbPush(true), 1500);
    return;
  }

  if (window.fbState.syncing) return;
  window.fbState.syncing = true;
  updateSyncBadge('syncing');

  try {
    const { doc, setDoc } = window._fb;
    const ts    = Date.now();
    const docRef = doc(window.fbState.db, FB_COLL, FB_DOC_ID);

    const dbJson = JSON.stringify(window.DB);
    if (dbJson.length > 900000) {
      // Firestore limite à 1MB par document
      console.warn('[Firebase] Données trop volumineuses pour un seul document Firestore');
      updateSyncBadge('error');
      window.fbState.syncing = false;
      return;
    }

    await setDoc(docRef, {
      dbJson:      dbJson,
      _ts:         ts,
      _pushedBy:   window.fbState.userId,
      _pushTime:   ts,
      _opsCount:   (window.DB.ops || []).length,
      _version:    '1.0',
    });

    localStorage.setItem('poisson_local_ts', ts.toString());
    window.fbState.lastPush = new Date();
    window.fbState.syncing  = false;
    updateSyncBadge('connected');
    console.log('[Firebase] Push réussi —', (window.DB.ops||[]).length, 'ops');
  } catch (err) {
    console.error('[Firebase] Erreur push:', err);
    window.fbState.syncing = false;
    window.fbState.error   = err.message;
    updateSyncBadge('error');
  }
}

// ── PULL MANUEL DEPUIS FIRESTORE ──────────────────────────────────────────────
async function fbPull() {
  if (!window.fbState.initialized || !window.fbState.db || !window._fb) {
    showSyncToast('❌ Firebase non connecté', true);
    return;
  }
  updateSyncBadge('syncing');
  try {
    const { doc, getDoc } = window._fb;
    const docRef  = doc(window.fbState.db, FB_COLL, FB_DOC_ID);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      showSyncToast('⚠️ Aucune donnée cloud trouvée', true);
      updateSyncBadge('connected');
      return;
    }

    const data = snapshot.data();
    const dbData = JSON.parse(data.dbJson);
    if (dbData && dbData.ops && dbData.products) {
      window.DB = dbData;
      if (!window.DB.cats) window.DB.cats = window.DEFAULT_CATS.map(c=>({...c}));
      localStorage.setItem(window.LS_DB, JSON.stringify(window.DB));
      localStorage.setItem('poisson_local_ts', (data._ts||Date.now()).toString());
      if (typeof recalcAllStocks === 'function') recalcAllStocks();
      if (typeof rSel === 'function') rSel();
      if (typeof rOps === 'function') rOps();
      if (typeof rTopbar === 'function') rTopbar();
      if (typeof rDash === 'function') rDash();
      updateSyncBadge('connected');
      showSyncToast('✅ ' + dbData.ops.length + ' opérations récupérées depuis le cloud');
    }
  } catch (err) {
    console.error('[Firebase] Erreur pull:', err);
    updateSyncBadge('error');
    showSyncToast('❌ Erreur: ' + err.message, true);
  }
}

// ── INDICATEUR DE SYNCHRONISATION ─────────────────────────────────────────────
function updateSyncBadge(state) {
  const dot = document.getElementById('tb-sync-dot');
  const txt = document.getElementById('tb-sync-txt');
  if (!dot || !txt) return;

  window.fbState.connected = (state === 'connected');

  const states = {
    connected: { color: '#10B981', text: 'Synchronisé' },
    syncing:   { color: '#F59E0B', text: 'Sync...' },
    error:     { color: '#EF4444', text: 'Hors ligne' },
    offline:   { color: '#6B7280', text: 'Hors ligne' },
  };
  const s = states[state] || states.offline;
  dot.style.background = s.color;
  txt.textContent      = s.text;
  txt.style.color      = s.color;

  // Animation pulse quand on sync
  if (state === 'syncing') {
    dot.style.animation = 'pulse 0.8s ease-in-out infinite';
  } else {
    dot.style.animation = '';
  }
}

// ── TOAST SYNC ────────────────────────────────────────────────────────────────
let _syncToastTimer = null;
function showSyncToast(msg, isError = false) {
  // Utiliser le toast existant de l'app si disponible
  if (typeof window.toast === 'function') {
    window.toast(msg, isError);
  } else {
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.style.background = isError ? '#B83020' : '#157A4A';
      el.classList.add('on');
      clearTimeout(_syncToastTimer);
      _syncToastTimer = setTimeout(() => el.classList.remove('on'), 3000);
    }
  }
}

// ── INTERCEPTION DE autoSave ───────────────────────────────────────────────────
// On remplace autoSave après le chargement de l'app pour y ajouter la sync Firebase
function patchAutoSave() {
  if (typeof window._originalAutoSave === 'undefined' && typeof window.autoSave === 'function') {
    window._originalAutoSave = window.autoSave;
    window.autoSave = function() {
      window._originalAutoSave.call(this);
      // Push vers Firebase après chaque save local
      fbPush(false);
    };
    console.log('[Firebase] autoSave intercepté ✓');
  }
}

// ── PANNEAU DE CONFIGURATION FIREBASE ─────────────────────────────────────────
function renderFirebaseConfigPanel() {
  const panel = document.getElementById('firebase-config-panel');
  if (!panel) return;

  const cfg = window.FIREBASE_CONFIG;
  const isConfigured = cfg.apiKey && !cfg.apiKey.includes('XXXXXXXX');
  const isConnected  = window.fbState.connected;

  panel.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="ch">
        <span class="ch-t">🔥 Synchronisation Firebase</span>
        <span class="bx ${isConnected?'bxv':'bxl'}">${isConnected?'Connecté':'Non connecté'}</span>
      </div>
      <div class="cb">
        ${isConfigured ? `
          <div class="al" style="background:var(--gn-l);border-color:var(--gn-b);color:var(--gn);margin-bottom:12px">
            ✅ Firebase configuré — synchronisation en temps réel active.<br>
            Toutes les modifications sont automatiquement partagées entre appareils.
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button class="btn bp bsm" onclick="fbPull()">⬇️ Récupérer depuis cloud</button>
            <button class="btn bs bsm" onclick="fbPush(true)">⬆️ Pousser vers cloud</button>
          </div>
          <div style="font-size:11px;color:var(--tx3)">
            <div>Projet: <b>${cfg.projectId}</b></div>
            <div>Dernier push: ${window.fbState.lastPush ? window.fbState.lastPush.toLocaleTimeString('fr-FR') : '—'}</div>
            <div>Dernier pull: ${window.fbState.lastPull ? window.fbState.lastPull.toLocaleTimeString('fr-FR') : '—'}</div>
          </div>
        ` : `
          <div class="al alw" style="margin-bottom:14px">
            ⚠️ Firebase n'est pas encore configuré. Suivez les étapes ci-dessous pour activer 
            la synchronisation en temps réel entre téléphones et PC.
          </div>
          
          <div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--rl);padding:14px;margin-bottom:14px">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px">📋 Étapes de configuration :</div>
            <div style="font-size:12px;line-height:2;color:var(--tx2)">
              <div><b>1.</b> Allez sur <a href="https://console.firebase.google.com" target="_blank" style="color:var(--bl)">console.firebase.google.com</a></div>
              <div><b>2.</b> Créez un projet gratuit</div>
              <div><b>3.</b> Activez <b>Firestore Database</b> (mode test pour commencer)</div>
              <div><b>4.</b> Allez dans ⚙️ Paramètres > Vos applications > ➕ Web</div>
              <div><b>5.</b> Copiez la configuration et collez-la dans <code style="background:var(--s3);padding:1px 5px;border-radius:4px">firebase-sync.js</code></div>
            </div>
          </div>

          <div class="al ali">
            💡 Firebase propose un plan <b>Gratuit (Spark)</b> suffisant pour cette application :<br>
            1 GB de stockage, 50K lectures/jour, 20K écritures/jour.
          </div>
        `}
      </div>
    </div>
  `;
}

// ── ENREGISTREMENT DU SERVICE WORKER (PWA) ────────────────────────────────────
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log('[PWA] Service Worker enregistré:', reg.scope);

      // Vérifier les mises à jour
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      return true;
    } catch (err) {
      console.warn('[PWA] Service Worker non enregistré:', err);
      return false;
    }
  }
  return false;
}

// ── BANNIÈRE DE MISE À JOUR ───────────────────────────────────────────────────
function showUpdateBanner() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: #1E3A5F; color: #fff; padding: 12px 20px; border-radius: 12px;
    font-size: 13px; font-weight: 600; z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,.3);
    display: flex; align-items: center; gap: 12px; white-space: nowrap;
  `;
  banner.innerHTML = `
    <span>🔄 Mise à jour disponible</span>
    <button onclick="location.reload()" style="background:#3B82F6;border:none;color:#fff;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700">
      Mettre à jour
    </button>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 15000);
}

// ── INDICATEUR OFFLINE/ONLINE ─────────────────────────────────────────────────
function initNetworkMonitor() {
  const update = () => {
    if (navigator.onLine) {
      if (window.fbState.initialized) {
        updateSyncBadge('connected');
        fbPush(true); // Re-pousser après reconnexion
      } else {
        initFirebase();
      }
    } else {
      updateSyncBadge('offline');
    }
  };

  window.addEventListener('online',  update);
  window.addEventListener('offline', () => updateSyncBadge('offline'));
}

// ── BOUTON D'INSTALLATION PWA ─────────────────────────────────────────────────
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  const existing = document.getElementById('pwa-install-btn');
  if (existing) return;

  const btn = document.createElement('button');
  btn.id    = 'pwa-install-btn';
  btn.style.cssText = `
    position: fixed; bottom: 80px; right: 16px;
    background: linear-gradient(135deg, #2563EB, #1D4ED8);
    color: #fff; border: none; border-radius: 14px;
    padding: 10px 16px; font-size: 12px; font-weight: 700;
    cursor: pointer; z-index: 500; box-shadow: 0 4px 20px rgba(37,99,235,.45);
    display: flex; align-items: center; gap: 8px;
    font-family: 'Inter', sans-serif;
    animation: slideUp 0.3s ease;
  `;
  btn.innerHTML = '📱 Installer l\'app';
  btn.onclick = async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      btn.remove();
    }
    _deferredPrompt = null;
  };
  document.body.appendChild(btn);

  // Auto-masquer après 30s
  setTimeout(() => btn.remove(), 30000);
}

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.remove();
  showSyncToast('✅ Application installée avec succès !');
});

// ── DÉMARRAGE ─────────────────────────────────────────────────────────────────
(async function startFirebaseSync() {
  // 1. Enregistrer le Service Worker (PWA)
  await registerServiceWorker();

  // 2. Moniteur réseau
  initNetworkMonitor();

  // 3. Initialiser Firebase si en ligne
  if (navigator.onLine) {
    const ok = await initFirebase();
    if (ok) {
      // Patcher autoSave après que l'app est initialisée (attendre 3s)
      setTimeout(patchAutoSave, 3000);
    }
  } else {
    updateSyncBadge('offline');
  }

  // 4. Ajouter le style pulse pour l'animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  console.log('[Firebase] Module de synchronisation chargé ✓');
})();

// ── EXPORTS GLOBAUX ───────────────────────────────────────────────────────────
window.fbPush               = fbPush;
window.fbPull               = fbPull;
window.renderFirebaseConfigPanel = renderFirebaseConfigPanel;
window.initFirebase         = initFirebase;
