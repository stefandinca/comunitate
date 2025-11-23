// =====================================================
// CORBEANCA COMMUNITY APP - Main JavaScript
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const myRealFirebaseConfig = {
    apiKey: "AIzaSyDlJySD0JWV3joNXiGOR9SXhKkffNxozMw",
    authDomain: "corbeanca-community.firebaseapp.com",
    projectId: "corbeanca-community",
    storageBucket: "corbeanca-community.firebasestorage.app",
    messagingSenderId: "1086285762362",
    appId: "1:1086285762362:web:885b97b8cf4a72c1f18a03",
    measurementId: "G-T479WRD5G2"
};

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

const app = initializeApp(activeConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLL_POSTS = 'posts';
const COLL_USERS = 'users';
const COLL_COMMENTS = 'comments';
const COLL_NOTIF = 'notifications';

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

// --- STATE MANAGEMENT ---
let currentUser = null;
let userProfile = null;
let unsubscribePosts = null;
let unsubscribeMyPosts = null;
let unsubscribeInterested = null;
let unsubscribeComments = null;
let unsubscribeNotifs = null;
let unsubscribePublicProfilePosts = null; // New subscription
let editingPostId = null;
let currentCommentingPostId = null;
let pendingAvatarBase64 = null;
let isRegisterMode = false;
let activePostType = 'sale';
let activeProfileTab = 'my-posts';

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('screen-login'),
    feed: document.getElementById('screen-feed'),
    profile: document.getElementById('screen-profile'),
    create: document.getElementById('modal-create'),
    edit: document.getElementById('modal-edit'),
    comments: document.getElementById('modal-comments'),
    notifications: document.getElementById('modal-notifications'),
    publicProfile: document.getElementById('modal-public-profile') // NEW
};

const feedContainer = document.getElementById('feed-container');
const myPostsContainer = document.getElementById('my-posts-container');
const interestedContainer = document.getElementById('interested-container');
const userDisplayName = document.getElementById('user-display-name');

// Forms
const loginForm = document.getElementById('login-form');
const createForm = document.getElementById('create-form');
const editForm = document.getElementById('edit-form');
const profileForm = document.getElementById('profile-form');
const commentForm = document.getElementById('comment-form');

// --- NAVIGATION LOGIC ---
function showScreen(screenName) {
    Object.values(screens).forEach(el => {
        if (el.id.startsWith('screen')) {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
        if (el.id.startsWith('modal')) {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    });
    document.getElementById('bottom-nav').classList.add('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.replace('text-brand-primary', 'text-gray-300'));

    if (screenName === 'login') {
        screens.login.classList.remove('hidden');
        screens.login.classList.add('flex');
    } else if (screenName === 'feed') {
        screens.feed.classList.remove('hidden');
        screens.feed.classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        document.getElementById('nav-home').classList.replace('text-gray-300', 'text-brand-primary');
        loadPosts();
    } else if (screenName === 'profile') {
        screens.profile.classList.remove('hidden');
        screens.profile.classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        document.getElementById('nav-profile').classList.replace('text-gray-300', 'text-brand-primary');
        loadUserProfile();
        switchProfileTab('my-posts');
    }
}

function toggleModal(modalId, show) {
    const el = document.getElementById(modalId);
    if (show) {
        el.classList.remove('hidden');
        el.classList.add('flex');

        if (modalId === 'modal-create') {
            const phoneInput = document.getElementById('post-phone');
            if (phoneInput && userProfile?.phone) {
                phoneInput.value = userProfile.phone;
            }
            switchPostType('sale');
        }
    } else {
        el.classList.add('hidden');
        el.classList.remove('flex');

        if (modalId === 'modal-comments') {
            if (unsubscribeComments) unsubscribeComments();
            currentCommentingPostId = null;
        }
        // Cleanup for public profile
        if (modalId === 'modal-public-profile') {
            if (unsubscribePublicProfilePosts) unsubscribePublicProfilePosts();
        }
    }
}

// --- AUTHENTICATION ---
const initAuth = async () => {
    try {
        if (shouldUseCustomToken && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        }
    } catch (error) {
        console.error("Auth init failed:", error);
    }
};
initAuth();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = getDocPath(COLL_USERS, user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            userProfile = docSnap.data();
            userDisplayName.textContent = `Salut, ${userProfile.name}!`;
            showScreen('feed');
        } else {
            userDisplayName.textContent = `Salut!`;
            showScreen('feed');
        }
        listenForNotifications();
    } else {
        currentUser = null;
        showScreen('login');
    }
});

// ... (Existing auth/login code remains unchanged) ...
// (Keeping previous auth functions for brevity, they are correct in file context)
window.toggleAuthMode = () => {
    isRegisterMode = !isRegisterMode;
    const extraFields = document.getElementById('register-fields');
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    if (isRegisterMode) {
        extraFields.classList.remove('hidden');
        title.innerText = "Creează Cont";
        btn.innerHTML = `Înregistrează-te <span class="material-icons-round">arrow_forward</span>`;
        toggleText.innerHTML = `Ai deja cont? <span class="text-brand-primary font-bold cursor-pointer" onclick="toggleAuthMode()">Autentifică-te</span>`;
    } else {
        extraFields.classList.add('hidden');
        title.innerText = "Bine ai revenit!";
        btn.innerHTML = `Intră în cont <span class="material-icons-round">arrow_forward</span>`;
        toggleText.innerHTML = `Nu ai cont? <span class="text-brand-primary font-bold cursor-pointer" onclick="toggleAuthMode()">Înregistrează-te</span>`;
    }
}

window.loginWithGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = getDocPath(COLL_USERS, user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            const profileData = {
                name: user.displayName || 'Utilizator Google',
                email: user.email,
                phone: '',
                avatar: user.photoURL || '',
                createdAt: serverTimestamp()
            };
            await setDoc(userRef, profileData);
            userProfile = profileData;
            localStorage.setItem('user_name', profileData.name);
            showToast(`Cont creat! Bun venit, ${profileData.name}!`);
        } else {
            userProfile = docSnap.data();
            if (!userProfile.avatar && user.photoURL) {
                await updateDoc(userRef, { avatar: user.photoURL });
                userProfile.avatar = user.photoURL;
            }
            localStorage.setItem('user_name', userProfile.name);
            showToast(`Te-ai autentificat cu succes!`);
        }
    } catch (error) {
        console.error("Google Auth Error:", error);
        showToast('Eroare: ' + error.message, 'error');
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-email').value;
    const password = document.getElementById('input-password').value;
    const name = document.getElementById('input-name').value;
    const phone = document.getElementById('input-phone').value;
    const btn = document.getElementById('auth-btn');

    if (!email || !password) return showToast('Introdu email și parolă!', 'error');
    if (isRegisterMode && (!name || !phone)) return showToast('Completează datele!', 'error');

    btn.disabled = true;
    btn.innerHTML = `Se procesează...`;

    try {
        if (isRegisterMode) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const profileData = { name, phone, email, avatar: '', createdAt: serverTimestamp() };
            await setDoc(getDocPath(COLL_USERS, user.uid), profileData);
            userProfile = profileData;
            localStorage.setItem('user_name', name);
            localStorage.setItem('user_phone', phone);
            showToast(`Cont creat! Bun venit, ${name}!`);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast(`Te-ai autentificat cu succes!`);
        }
    } catch (error) {
        console.error(error);
        showToast('Eroare la autentificare.', 'error');
        btn.disabled = false;
        btn.innerHTML = isRegisterMode ? `Înregistrează-te <span class="material-icons-round">arrow_forward</span>` : `Intră în cont <span class="material-icons-round">arrow_forward</span>`;
    }
});

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            }
            img.onerror = (err) => reject(err);
        }
        reader.onerror = (err) => reject(err);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('prof-avatar-file');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const base64 = await compressImage(file);
                pendingAvatarBase64 = base64;
                document.getElementById('profile-display-avatar').src = base64;
            } catch (err) {
                showToast("Eroare la procesare img", "error");
            }
        });
    }
});

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const name = document.getElementById('prof-name').value;
    const phone = document.getElementById('prof-phone').value;
    const email = document.getElementById('prof-email').value;
    const btn = document.getElementById('btn-save-profile');
    btn.disabled = true;
    btn.innerText = 'Se salvează...';
    try {
        const newData = { name, phone, email };
        if (pendingAvatarBase64) newData.avatar = pendingAvatarBase64;
        await updateDoc(getDocPath(COLL_USERS, currentUser.uid), newData);
        userProfile = { ...userProfile, ...newData };
        localStorage.setItem('user_name', name);
        loadUserProfile();
        showToast('Profil actualizat!');
        pendingAvatarBase64 = null;
    } catch (e) {
        showToast('Eroare la salvare.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Salvează Modificările';
    }
});

function loadUserProfile() {
    if (!userProfile) return;
    document.getElementById('prof-name').value = userProfile.name || '';
    document.getElementById('prof-phone').value = userProfile.phone || '';
    document.getElementById('prof-email').value = userProfile.email || '';
    document.getElementById('prof-avatar-file').value = '';
    document.getElementById('profile-display-name').innerText = userProfile.name;
    const avatarEl = document.getElementById('profile-display-avatar');
    if (userProfile.avatar) avatarEl.src = userProfile.avatar;
    else avatarEl.src = `https://ui-avatars.com/api/?name=${userProfile.name}&background=random`;
}

// ... (Post logic remains same) ...
window.switchPostType = (type) => {
    activePostType = type;
    const saleBtn = document.getElementById('type-sale-btn');
    const eventBtn = document.getElementById('type-event-btn');
    const saleCats = document.getElementById('cats-sale');
    const eventCats = document.getElementById('cats-event');
    const priceSection = document.getElementById('section-price');
    const eventDetails = document.getElementById('section-event-details');

    if (type === 'sale') {
        saleBtn.classList.replace('bg-gray-100', 'bg-brand-primary');
        saleBtn.classList.replace('text-gray-500', 'text-white');
        eventBtn.classList.replace('bg-brand-primary', 'bg-gray-100');
        eventBtn.classList.replace('text-white', 'text-gray-500');
        saleCats.classList.remove('hidden');
        eventCats.classList.add('hidden');
        priceSection.classList.remove('hidden');
        eventDetails.classList.add('hidden');
    } else {
        eventBtn.classList.replace('bg-gray-100', 'bg-brand-primary');
        eventBtn.classList.replace('text-gray-500', 'text-white');
        saleBtn.classList.replace('bg-brand-primary', 'bg-gray-100');
        saleBtn.classList.replace('text-white', 'text-gray-500');
        eventCats.classList.remove('hidden');
        saleCats.classList.add('hidden');
        eventDetails.classList.remove('hidden');
        priceSection.classList.add('hidden');
    }
}

window.toggleEventPrice = () => {
    const isPaid = document.getElementById('event-paid').checked;
    const priceInput = document.getElementById('event-price-input');
    if (isPaid) priceInput.classList.remove('hidden');
    else priceInput.classList.add('hidden');
}

window.toggleInterest = async (postId) => {
    if (!currentUser) return showToast('Trebuie să fii autentificat!', 'error');
    const btn = document.getElementById(`interest-btn-${postId}`);
    if (btn) btn.classList.add('opacity-50');

    try {
        const postRef = getDocPath(COLL_POSTS, postId);
        const postDoc = await getDoc(postRef);
        if (!postDoc.exists()) return;

        const postData = postDoc.data();
        const interestedUsers = postData.interestedUsers || [];
        const isInterested = interestedUsers.includes(currentUser.uid);

        if (isInterested) {
            await updateDoc(postRef, {
                interestedUsers: arrayRemove(currentUser.uid),
                interestedCount: increment(-1)
            });
            showToast('Nu mai ești interesat.');
        } else {
            await updateDoc(postRef, {
                interestedUsers: arrayUnion(currentUser.uid),
                interestedCount: increment(1)
            });
            showToast('Te-ai înscris la interes.');

            // Send notification to event organizer (only if not their own event)
            if (postData.uid !== currentUser.uid) {
                await addDoc(getCollectionRef(COLL_NOTIF), {
                    recipientUid: postData.uid,
                    senderName: userProfile?.name || 'Cineva',
                    postId: postId,
                    postTitle: postData.title,
                    type: 'interest',
                    read: false,
                    timestamp: serverTimestamp()
                });
            }
        }
    } catch (e) {
        showToast('Eroare la actualizare.', 'error');
    } finally {
        if (btn) btn.classList.remove('opacity-50');
    }
}

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const authorName = userProfile?.name || 'Vecin';
    const authorPhone = document.getElementById('post-phone').value;
    const authorAvatar = userProfile?.avatar || '';
    const btn = document.getElementById('btn-submit-post');

    btn.disabled = true;
    btn.innerText = 'Se postează...';

    try {
        let formData = {
            title: document.getElementById('post-title').value,
            description: document.getElementById('post-desc').value,
            authorName,
            authorPhone,
            authorAvatar,
            uid: currentUser.uid,
            timestamp: serverTimestamp(),
            type: activePostType,
            commentCount: 0
        };

        if (activePostType === 'sale') {
            formData.price = document.getElementById('post-price').value;
            formData.category = document.querySelector('input[name="cat-sale"]:checked')?.value || 'other';
        } else {
            formData.category = document.querySelector('input[name="cat-event"]:checked')?.value || 'other';
            formData.eventDate = document.getElementById('event-date').value;
            formData.eventTime = document.getElementById('event-time').value;
            const isPaid = document.getElementById('event-paid').checked;
            formData.isFree = !isPaid;
            formData.price = isPaid ? document.getElementById('event-price-val').value : 0;
            formData.interestedCount = 0;
            formData.interestedUsers = [];
        }

        await addDoc(getCollectionRef(COLL_POSTS), formData);
        showToast('Postarea a fost publicată!');
        toggleModal('modal-create', false);
        createForm.reset();
        showScreen('feed');
    } catch (error) {
        console.error(error);
        showToast('Eroare la publicare.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Publică';
    }
});

// --- PUBLIC PROFILE LOGIC (NEW) ---
window.viewUserProfile = async (targetUid) => {
    if (!targetUid) return;
    
    // 1. Show Modal & Reset
    toggleModal('modal-public-profile', true);
    document.getElementById('public-prof-name').innerText = "Se încarcă...";
    document.getElementById('public-prof-avatar').src = "";
    const postsList = document.getElementById('public-prof-posts');
    postsList.innerHTML = '<div class="text-center py-4 text-gray-400"><span class="material-icons-round animate-spin">refresh</span></div>';
    const actionsDiv = document.getElementById('public-prof-actions');
    actionsDiv.innerHTML = '';

    try {
        // 2. Fetch User Info
        const userRef = getDocPath(COLL_USERS, targetUid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('public-prof-name').innerText = data.name || "Utilizator";
            const avatarSrc = data.avatar || `https://ui-avatars.com/api/?name=${data.name}&background=random`;
            document.getElementById('public-prof-avatar').src = avatarSrc;

            // Optional: Show phone/whatsapp button if available
            if (data.phone) {
                let cleanPhone = data.phone.replace(/\D/g, ''); 
                if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1); 
                if (cleanPhone.length > 0 && !cleanPhone.startsWith('40')) cleanPhone = '40' + cleanPhone;
                
                actionsDiv.innerHTML = `
                    <a href="https://wa.me/${cleanPhone}" target="_blank" class="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-green-200 transition-colors">
                        <span class="material-icons-round text-sm">chat</span> WhatsApp
                    </a>
                `;
            }
        } else {
            document.getElementById('public-prof-name').innerText = "Utilizator necunoscut";
        }

        // 3. Fetch User Posts
        const q = query(getCollectionRef(COLL_POSTS), where('uid', '==', targetUid));
        
        // We unsubscribe from previous public profile listeners to avoid memory leaks or wrong data
        if (unsubscribePublicProfilePosts) unsubscribePublicProfilePosts();

        unsubscribePublicProfilePosts = onSnapshot(q, (snapshot) => {
            postsList.innerHTML = '';
            const posts = [];
            snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
            posts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            if (posts.length === 0) {
                postsList.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Acest utilizator nu are postări active.</div>';
                return;
            }

            posts.forEach(post => {
                // Use a simplified version of card or reuse createMyPostCard
                const card = createMyPostCard(post); // This shows "Edit/Delete" which is wrong for public view!
                // Let's fix that below by making a read-only version

                const div = document.createElement('div');
                div.className = "bg-gray-50 border border-gray-100 p-4 rounded-2xl flex justify-between items-center shadow-sm cursor-pointer hover:bg-gray-100 transition-colors";
                div.innerHTML = `
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">${post.title}</h4>
                        <div class="flex gap-2 mt-1">
                            <span class="text-xs bg-white px-2 py-0.5 rounded border text-gray-500 uppercase font-bold">${post.type === 'event' ? 'Eveniment' : 'Vânzare'}</span>
                            <span class="text-xs text-brand-primary font-bold">${post.isFree ? 'Gratuit' : (post.price + ' RON')}</span>
                        </div>
                    </div>
                    <span class="material-icons-round text-gray-400">arrow_forward</span>
                `;
                div.onclick = () => {
                    toggleModal('modal-public-profile', false);
                    openComments(post.id);
                };
                postsList.appendChild(div);
            });
        });

    } catch (error) {
        console.error("Error fetching public profile:", error);
        showToast("Eroare la încărcarea profilului", "error");
    }
};

// ... (Existing Listeners & Helper Functions) ...

// 1. Listen for my notifications
function listenForNotifications() {
    if (unsubscribeNotifs) unsubscribeNotifs();
    if (!currentUser) return;

    // Ensure we are querying correctly
    const q = query(getCollectionRef(COLL_NOTIF), where('recipientUid', '==', currentUser.uid));

    unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        const notifList = document.getElementById('notif-list');
        if (!notifList) return;

        notifList.innerHTML = '';

        const notifs = [];
        snapshot.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));

        // Sort locally to avoid index issues
        notifs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if (notifs.length === 0) {
            notifList.innerHTML = '<div class="text-center py-8 text-gray-400">Nu ai notificări.</div>';
        }

        notifs.forEach(n => {
            if (!n.read) unreadCount++;

            // Determine icon and message based on notification type
            let icon, iconBg, iconColor, message;
            if (n.type === 'interest') {
                icon = 'favorite';
                iconBg = 'bg-pink-100';
                iconColor = 'text-pink-600';
                message = `<span class="font-bold">${n.senderName}</span> este interesat de evenimentul tău <span class="font-bold">"${n.postTitle}"</span>.`;
            } else {
                icon = 'comment';
                iconBg = 'bg-blue-100';
                iconColor = 'text-blue-600';
                message = `<span class="font-bold">${n.senderName}</span> a comentat la postarea ta <span class="font-bold">"${n.postTitle}"</span>.`;
            }

            const div = document.createElement('div');
            div.className = `p-4 border-b border-gray-100 flex items-start gap-3 ${n.read ? 'bg-white' : 'bg-blue-50'}`;
            div.innerHTML = `
                <div class="${iconBg} p-2 rounded-full ${iconColor}">
                    <span class="material-icons-round text-sm">${icon}</span>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-800">${message}</p>
                    <p class="text-xs text-gray-400 mt-1">${new Date(n.timestamp?.seconds * 1000).toLocaleDateString('ro-RO')}</p>
                </div>
                ${!n.read ? '<div class="w-2 h-2 bg-red-500 rounded-full mt-2"></div>' : ''}
            `;

            div.onclick = async () => {
                if (!n.read) {
                    try {
                        await updateDoc(getDocPath(COLL_NOTIF, n.id), { read: true });
                    } catch (e) {
                        console.error("Err mark read", e);
                    }
                }
                toggleModal('modal-notifications', false);
                openComments(n.postId);
            };
            notifList.appendChild(div);
        });

        // Update Bell Icon
        const bellBadge = document.getElementById('notif-badge');
        if (bellBadge) {
            if (unreadCount > 0) {
                bellBadge.classList.remove('hidden');
            } else {
                bellBadge.classList.add('hidden');
            }
        }
    }, (error) => {
        console.error("Notification Listener Error:", error);
        // Silent fail or toast if critical
    });
}

// 2. Send Notification on Comment
window.openComments = (postId) => {
    if (!currentUser) return showToast('Trebuie să fii autentificat!', 'error');
    currentCommentingPostId = postId;

    const userAvatar = userProfile?.avatar || `https://ui-avatars.com/api/?name=${userProfile?.name || 'U'}&background=random`;
    document.getElementById('comment-user-avatar').src = userAvatar;

    toggleModal('modal-comments', true);

    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '<div class="text-center py-4 text-gray-400"><span class="material-icons-round animate-spin">refresh</span></div>';

    const q = query(getCollectionRef(COLL_COMMENTS), where('postId', '==', postId));

    unsubscribeComments = onSnapshot(q, (snapshot) => {
        commentsList.innerHTML = '';
        const comments = [];
        snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
        comments.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

        if (comments.length === 0) {
            commentsList.innerHTML = '<div class="text-center py-10 text-gray-400 text-sm">Fii primul care comentează! 👇</div>';
            return;
        }

        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = "flex gap-3 mb-4 animate-fade-in";
            const isMe = comment.uid === currentUser.uid;
            const avatar = comment.authorAvatar || `https://ui-avatars.com/api/?name=${comment.authorName}&background=random`;

            div.innerHTML = `
                <img src="${avatar}" class="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100 cursor-pointer hover:opacity-80" onclick="viewUserProfile('${comment.uid}')">
                <div class="flex-1">
                    <div class="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-2 inline-block max-w-[90%] ${isMe ? 'bg-blue-50 text-blue-900' : 'text-gray-800'}">
                        <p class="text-[10px] font-bold text-gray-500 mb-0.5 cursor-pointer hover:underline" onclick="viewUserProfile('${comment.uid}')">${comment.authorName}</p>
                        <p class="text-sm leading-relaxed">${comment.text}</p>
                    </div>
                    <p class="text-[10px] text-gray-300 mt-1 ml-2">${new Date(comment.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            `;
            commentsList.appendChild(div);
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    });
};

commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text || !currentCommentingPostId || !currentUser) return;

    input.value = '';

    try {
        // 1. Add Comment
        await addDoc(getCollectionRef(COLL_COMMENTS), {
            postId: currentCommentingPostId,
            text: text,
            authorName: userProfile?.name || 'Utilizator',
            authorAvatar: userProfile?.avatar || '',
            uid: currentUser.uid,
            timestamp: serverTimestamp()
        });

        // 2. Increment Count
        const postRef = getDocPath(COLL_POSTS, currentCommentingPostId);
        await updateDoc(postRef, {
            commentCount: increment(1)
        });

        // 3. Send Notification
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
            const postData = postSnap.data();

            // FOR TESTING: Removed 'if (postData.uid !== currentUser.uid)' so you can see your own notifs
            // In production, uncomment next line
            // if (postData.uid !== currentUser.uid) {
            await addDoc(getCollectionRef(COLL_NOTIF), {
                recipientUid: postData.uid,
                senderName: userProfile?.name || 'Cineva',
                postId: currentCommentingPostId,
                postTitle: postData.title,
                type: 'comment',
                read: false,
                timestamp: serverTimestamp()
            });
            // }
        }

    } catch (error) {
        console.error(error);
        showToast('Eroare la trimitere.', 'error');
    }
});

// ... (Tabs logic unchanged) ...
window.switchProfileTab = (tab) => {
    activeProfileTab = tab;
    const btnMy = document.getElementById('tab-btn-my');
    const btnInt = document.getElementById('tab-btn-int');
    const contMy = document.getElementById('my-posts-container');
    const contInt = document.getElementById('interested-container');

    if (tab === 'my-posts') {
        btnMy.classList.replace('text-gray-400', 'text-brand-primary');
        btnMy.classList.replace('border-transparent', 'border-brand-primary');
        btnInt.classList.replace('text-brand-primary', 'text-gray-400');
        btnInt.classList.replace('border-brand-primary', 'border-transparent');
        contMy.classList.remove('hidden');
        contInt.classList.add('hidden');
        loadMyPosts();
    } else {
        btnInt.classList.replace('text-gray-400', 'text-brand-primary');
        btnInt.classList.replace('border-transparent', 'border-brand-primary');
        btnMy.classList.replace('text-brand-primary', 'text-gray-400');
        btnMy.classList.replace('border-brand-primary', 'border-transparent');
        contInt.classList.remove('hidden');
        contMy.classList.add('hidden');
        loadInterestedEvents();
    }
}

function loadInterestedEvents() {
    if (unsubscribeInterested) unsubscribeInterested();
    if (!currentUser) return;

    const q = query(getCollectionRef(COLL_POSTS), where('interestedUsers', 'array-contains', currentUser.uid));
    const container = document.getElementById('interested-container');

    container.innerHTML = '<div class="text-center py-4"><span class="material-icons-round animate-spin text-gray-300">refresh</span></div>';

    unsubscribeInterested = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        const posts = [];
        snapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        posts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if (posts.length === 0) {
            container.innerHTML = `<div class="text-center py-6 text-gray-400 text-sm">Nu ai salvat niciun eveniment.</div>`;
            return;
        }
        posts.forEach(post => container.appendChild(createEventCard(post)));
    });
}

function loadPosts() {
    if (unsubscribePosts) unsubscribePosts();
    const q = query(getCollectionRef(COLL_POSTS));
    unsubscribePosts = onSnapshot(q, (snapshot) => {
        feedContainer.innerHTML = '';
        const posts = [];
        snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
        posts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if (posts.length === 0) {
            feedContainer.innerHTML = `<div class="text-center py-10 text-gray-400">Nu sunt postări încă.</div>`;
            return;
        }
        posts.forEach(post => {
            if (post.type === 'event') {
                feedContainer.appendChild(createEventCard(post));
            } else {
                feedContainer.appendChild(createPostCard(post));
            }
        });
    });
}

function loadMyPosts() {
    if (unsubscribeMyPosts) unsubscribeMyPosts();
    if (!currentUser) return;
    const q = query(getCollectionRef(COLL_POSTS));
    unsubscribeMyPosts = onSnapshot(q, (snapshot) => {
        myPostsContainer.innerHTML = '';
        const posts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid === currentUser.uid) posts.push({ id: doc.id, ...data });
        });
        posts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        if (posts.length === 0) {
            myPostsContainer.innerHTML = `<div class="text-center py-6 text-gray-400 text-sm">Nu ai publicat nimic încă.</div>`;
            return;
        }
        posts.forEach(post => myPostsContainer.appendChild(createMyPostCard(post)));
    });
}

window.deletePost = async (id) => {
    if (!confirm('Sigur vrei să ștergi?')) return;
    try {
        await deleteDoc(getDocPath(COLL_POSTS, id));
        showToast('Șters.');
    } catch (e) {
        showToast('Eroare', 'error');
    }
};

window.openEditModal = (id, title, price, desc) => {
    editingPostId = id;
    document.getElementById('edit-title').value = title;
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-desc').value = desc;
    toggleModal('modal-edit', true);
}

function createPostCard(post) {
    const categoryConfig = {
        'kids': { icon: 'child_friendly', color: 'bg-blue-100 text-blue-600' },
        'home': { icon: 'chair', color: 'bg-orange-100 text-orange-600' },
        'fashion': { icon: 'checkroom', color: 'bg-pink-100 text-pink-600' },
        'tech': { icon: 'devices', color: 'bg-purple-100 text-purple-600' },
        'other': { icon: 'auto_awesome', color: 'bg-gray-100 text-gray-600' }
    };
    const conf = categoryConfig[post.category] || categoryConfig['other'];
    const article = document.createElement('article');
    article.className = "bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4 animate-fade-in";

    const date = post.timestamp ? new Date(post.timestamp.seconds * 1000).toLocaleDateString('ro-RO') : '';
    const avatarSrc = post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
    const commentCount = post.commentCount || 0;

    let cleanPhone = (post.authorPhone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('40')) cleanPhone = '40' + cleanPhone;
    const waHref = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Salut, pt anunțul: ' + post.title)}` : 'javascript:void(0)';
    const waStyle = cleanPhone ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed';

    article.innerHTML = `
        <div class="${conf.color.replace('text-', 'bg-').replace('100', '50')} px-4 py-2 flex items-center gap-2 text-sm font-bold ${conf.color.split(' ')[1]}">
            <span class="material-icons-round text-sm">${conf.icon}</span>
            <span>Vânzare</span>
        </div>
        <div class="p-4">
            <div class="flex items-center gap-3 mb-3 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors" onclick="viewUserProfile('${post.uid}')">
                <img src="${avatarSrc}" class="w-8 h-8 rounded-full object-cover bg-gray-100">
                <div>
                    <p class="font-bold text-sm text-gray-800 hover:underline">${post.authorName}</p>
                    <p class="text-xs text-gray-400">${date}</p>
                </div>
            </div>
            <h3 class="font-bold text-lg mb-1 leading-tight">${post.title}</h3>
            <p class="text-gray-500 text-sm mb-3 line-clamp-3">${post.description}</p>
            <div class="flex justify-between items-center mt-4">
                <span class="font-extrabold text-xl text-brand-primary">${post.price} RON</span>
                <div class="flex gap-2">
                    <button onclick="openComments('${post.id}')" class="bg-gray-50 text-gray-600 px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-gray-100">
                        <span class="material-icons-round text-sm">chat_bubble_outline</span>
                        ${commentCount > 0 ? commentCount : ''}
                    </button>
                    <a href="${waHref}" target="${cleanPhone ? '_blank' : ''}" class="${waStyle} px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 transition-colors">
                        <span class="material-icons-round text-sm">chat</span> WhatsApp
                    </a>
                </div>
            </div>
        </div>
    `;
    return article;
}

function createEventCard(post) {
    const categoryConfig = {
        'workshop': { icon: 'brush', label: 'Workshop' },
        'playdate': { icon: 'toys', label: 'Playdate' },
        'culture': { icon: 'theater_comedy', label: 'Cultură' },
        'sport': { icon: 'sports_soccer', label: 'Sport' },
        'other': { icon: 'event', label: 'Eveniment' }
    };
    const conf = categoryConfig[post.category] || categoryConfig['other'];
    const article = document.createElement('article');
    article.className = "bg-white rounded-3xl shadow-sm border border-purple-100 overflow-hidden mb-4 animate-fade-in";

    const avatarSrc = post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
    const interestedCount = post.interestedCount || 0;
    const commentCount = post.commentCount || 0;
    const isInterested = (post.interestedUsers || []).includes(currentUser?.uid);

    const eventDateObj = new Date(post.eventDate);
    const dateStr = eventDateObj.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'long' });
    const priceDisplay = post.isFree ? "Gratuit" : `${post.price} RON`;
    const btnClass = isInterested ? "bg-purple-600 text-white shadow-md transform scale-105" : "bg-purple-50 text-purple-700 hover:bg-purple-100";
    const btnIcon = isInterested ? "favorite" : "favorite_border";

    article.innerHTML = `
        <div class="bg-purple-50 px-4 py-2 flex items-center justify-between text-sm font-bold text-purple-700">
            <div class="flex items-center gap-2">
                <span class="material-icons-round text-sm">${conf.icon}</span>
                <span>${conf.label}</span>
            </div>
            <span class="text-xs bg-white px-2 py-0.5 rounded-md border border-purple-100">${priceDisplay}</span>
        </div>
        <div class="p-4">
            <div class="flex items-center gap-3 mb-3 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors" onclick="viewUserProfile('${post.uid}')">
                <img src="${avatarSrc}" class="w-8 h-8 rounded-full object-cover bg-gray-100">
                <div>
                    <p class="font-bold text-sm text-gray-800 hover:underline">${post.authorName}</p>
                    <p class="text-xs text-gray-400">Organizator</p>
                </div>
            </div>
            <h3 class="font-bold text-lg mb-1 leading-tight">${post.title}</h3>
            <div class="flex gap-4 my-3">
                <div class="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 w-full">
                    <span class="material-icons-round text-purple-400">calendar_today</span>
                    <div class="leading-tight">
                        <p class="text-xs text-gray-400 font-bold uppercase">Când?</p>
                        <p class="text-sm font-bold capitalize">${dateStr}, ${post.eventTime}</p>
                    </div>
                </div>
            </div>
            <p class="text-gray-500 text-sm mb-4 line-clamp-3">${post.description}</p>
            <div class="flex justify-between items-center mt-2 border-t border-gray-50 pt-3">
                <div class="flex items-center gap-1 text-xs text-gray-500 font-bold">
                    <button onclick="openComments('${post.id}')" class="flex items-center gap-1 hover:text-brand-primary transition-colors p-1">
                        <span class="material-icons-round text-sm">chat_bubble_outline</span>
                        ${commentCount > 0 ? commentCount : ''}
                    </button>
                    <span class="mx-1 text-gray-300">|</span>
                    <span class="material-icons-round text-sm text-pink-400">group</span>
                    <span id="interest-count-${post.id}">${interestedCount}</span>
                </div>
                <button id="interest-btn-${post.id}" onclick="toggleInterest('${post.id}')" class="${btnClass} px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-200">
                    <span class="material-icons-round text-sm">${btnIcon}</span>
                    Interesat
                </button>
            </div>
        </div>
    `;
    return article;
}

function createMyPostCard(post) {
    const div = document.createElement('div');
    div.className = "bg-white border border-gray-100 p-4 rounded-2xl flex justify-between items-center shadow-sm";
    div.innerHTML = `
        <div class="flex-1">
            <h4 class="font-bold text-gray-800">${post.title}</h4>
            <p class="text-xs text-gray-400 mt-1 uppercase font-bold">${post.type === 'event' ? 'Eveniment' : 'Vânzare'}</p>
        </div>
        <div class="flex gap-2">
            <button onclick="deletePost('${post.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                <span class="material-icons-round text-sm">delete</span>
            </button>
        </div>
    `;
    return div;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-gray-800' : 'bg-red-500';
    toast.className = `fixed top-4 left-1/2 transform -translate-x-1/2 ${bg} text-white px-6 py-3 rounded-full shadow-xl text-sm font-semibold z-[100] transition-all duration-300 opacity-0 translate-y-[-10px]`;
    toast.innerText = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-y-[-10px]'));
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-10px]');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.toggleModal = toggleModal;
window.showScreen = showScreen;
window.logout = () => {
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_phone');
    signOut(auth).then(() => window.location.reload());
};