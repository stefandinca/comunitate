// =====================================================
// FIREBASE INITIALIZATION
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { FIREBASE_CONFIG } from '../../config.js';

// --- FIREBASE CONFIGURATION ---
const myRealFirebaseConfig = FIREBASE_CONFIG;

let activeConfig;
let appId;
let shouldUseCustomToken = false;

if (myRealFirebaseConfig.apiKey !== "API_KEY_AICI") {
    activeConfig = myRealFirebaseConfig;
    appId = 'mamiki-live';
} else {
    const envConfig = (typeof __firebase_config !== 'undefined') ? JSON.parse(__firebase_config) : null;
    const localConfig = JSON.parse(localStorage.getItem('firebase_config') || '{}');
    activeConfig = envConfig || localConfig;
    appId = (typeof __app_id !== 'undefined') ? __app_id : 'demo-community-app';
    shouldUseCustomToken = true;
}

// Initialize Firebase
const app = initializeApp(activeConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Helper functions for collection paths
function getCollectionRef(colName) {
    if (shouldUseCustomToken) {
        return collection(db, 'artifacts', appId, 'public', 'data', colName);
    } else {
        return collection(db, colName);
    }
}

function getDocPath(colName, docId) {
    if (shouldUseCustomToken) {
        return doc(db, 'artifacts', appId, 'public', 'data', colName, docId);
    } else {
        return doc(db, colName, docId);
    }
}

export {
    app,
    auth,
    db,
    storage,
    appId,
    shouldUseCustomToken,
    getCollectionRef,
    getDocPath
};
