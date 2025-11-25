// =====================================================
// CORBEANCA COMMUNITY APP - Main JavaScript
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { FIREBASE_CONFIG, GOOGLE_MAPS_API_KEY } from './config.js';

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

const app = initializeApp(activeConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const COLL_POSTS = 'posts';
const COLL_USERS = 'users';
const COLL_COMMENTS = 'comments';
const COLL_NOTIF = 'notifications';
const COLL_CONVERSATIONS = 'conversations';
const COLL_MESSAGES = 'messages';

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

function timeAgo(timestamp) {
    const now = new Date();
    const seconds = Math.floor((now - timestamp) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) {
        return Math.floor(interval) + " ani";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        return Math.floor(interval) + " luni";
    }
    interval = seconds / 86400;
    if (interval > 1) {
        return Math.floor(interval) + " zile";
    }
    interval = seconds / 3600;
    if (interval > 1) {
        return Math.floor(interval) + "h";
    }
    interval = seconds / 60;
    if (interval > 1) {
        return Math.floor(interval) + "m";
    }
    return Math.floor(seconds) + "s";
}

// --- CONSTANTS ---
const POSTS_PER_PAGE = 20;

// --- STATE MANAGEMENT ---
let currentUser = null;
let userProfile = null;
let unsubscribePosts = null;
let unsubscribeMyPosts = null;
let unsubscribeInterested = null;
let unsubscribeComments = null;
let unsubscribeNotifs = null;
let unsubscribeConversations = null;
let unsubscribeMessages = null;
let currentConversationId = null;
let currentChatUserId = null;

// --- HELPER FUNCTIONS ---
function isSuperAdmin() {
    return userProfile && userProfile.role === 'super-admin';
}

function makeLinksClickable(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">${url}</a>`;
    });
}
let unsubscribePublicProfilePosts = null;
let editingPostId = null;
let currentCommentingPostId = null;
let currentViewingPostId = null;
let pendingAvatarFile = null;
let pendingPostImageFile = null;
let pendingEditPostImageFile = null;
let isRegisterMode = false;
let activePostType = 'sale';
let activeProfileTab = 'my-posts';

// Pagination state
let lastVisiblePost = null;
let hasMorePosts = true;
let isLoadingMorePosts = false;
let allPostsCache = []; // Store all loaded posts

// Filter state
let activeFilter = 'all'; // 'all', 'sale', 'borrow', 'event', 'local', 'business', 'recommendation'
let isSearching = false;
let searchHistory = [];

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('screen-login'),
    feed: document.getElementById('screen-feed'),
    profile: document.getElementById('screen-profile'),
    admin: document.getElementById('screen-admin'),
    messages: document.getElementById('screen-messages'),
    create: document.getElementById('modal-create'),
    edit: document.getElementById('modal-edit'),
    comments: document.getElementById('modal-comments'),
    notifications: document.getElementById('modal-notifications'),
    publicProfile: document.getElementById('modal-public-profile'),
    locationPicker: document.getElementById('modal-location-picker'),
    postDetails: document.getElementById('modal-post-details'),
    conversation: document.getElementById('modal-conversation')
};

const feedContainer = document.getElementById('feed-container');
const myPostsContainer = document.getElementById('my-posts-container');
const interestedContainer = document.getElementById('interested-container');
const userDisplayName = document.getElementById('user-display-name');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchHistoryContainer = document.getElementById('search-history');
const conversationsContainer = document.getElementById('conversations-container');
const messagesContainer = document.getElementById('messages-container');



// Forms
const loginForm = document.getElementById('login-form');
const createForm = document.getElementById('create-form');
const editForm = document.getElementById('edit-form');
const profileForm = document.getElementById('profile-form');
const commentForm = document.getElementById('comment-form');
const messageForm = document.getElementById('message-form');

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

    // Reset all nav buttons to inactive state
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.add('opacity-60');
        b.classList.remove('opacity-100');
    });

    if (screenName === 'login') {
        screens.login.classList.remove('hidden');
        screens.login.classList.add('flex');
        document.getElementById('input-email').focus();
    } else if (screenName === 'feed') {
        screens.feed.classList.remove('hidden');
        screens.feed.classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        const navHome = document.getElementById('nav-home');
        navHome.classList.remove('opacity-60');
        navHome.classList.add('opacity-100');
        loadPosts();
        setupInfiniteScroll();
    } else if (screenName === 'profile') {
        screens.profile.classList.remove('hidden');
        screens.profile.classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        const navProfile = document.getElementById('nav-profile');
        navProfile.classList.remove('opacity-60');
        navProfile.classList.add('opacity-100');
        loadUserProfile();
        switchProfileTab('my-posts');
    } else if (screenName === 'messages') {
        screens.messages.classList.remove('hidden');
        screens.messages.classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        const navMessages = document.getElementById('nav-messages');
        navMessages.classList.remove('opacity-60');
        navMessages.classList.add('opacity-100');
        loadConversations();
    } else if (screenName === 'admin') {
        if (!isSuperAdmin()) {
            showToast('Acces interzis!', 'error');
            showScreen('feed');
            return;
        }
        screens.admin.classList.remove('hidden');
        screens.admin.classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        const navAdmin = document.getElementById('nav-admin');
        navAdmin.classList.remove('opacity-60');
        navAdmin.classList.add('opacity-100');
        loadAdminDashboard();
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
            clearCreateImage();
        }
        if (modalId === 'modal-edit' && !show) {
             clearEditImage();
        }
    } else {
        el.classList.add('hidden');
        el.classList.remove('flex');

        if (modalId === 'modal-comments') {
            if (unsubscribeComments) unsubscribeComments();
            currentCommentingPostId = null;
        }
        if (modalId === 'modal-public-profile') {
            if (unsubscribePublicProfilePosts) unsubscribePublicProfilePosts();
        }
        if (modalId === 'modal-conversation') {
            if (unsubscribeMessages) unsubscribeMessages();
            currentConversationId = null;
            currentChatUserId = null;
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
            document.getElementById('header-user-avatar').src = userProfile.avatar || `https://ui-avatars.com/api/?name=${userProfile.name}&background=random`;

            // Show/hide admin nav button based on role
            const adminNavBtn = document.getElementById('nav-admin');
            if (isSuperAdmin()) {
                adminNavBtn.classList.remove('hidden');
                adminNavBtn.classList.add('flex');
            } else {
                adminNavBtn.classList.add('hidden');
                adminNavBtn.classList.remove('flex');
            }

            showScreen('feed');
        } else {
            userDisplayName.textContent = `Salut!`;
            showScreen('feed');
        }
        listenForNotifications();
        listenForUnreadMessages();
    } else {
        currentUser = null;
        showScreen('login');
    }
});

// --- AUTH HANDLERS ---
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
        document.getElementById('input-name').focus();
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
            const profileData = { name, phone, email, avatar: '', role: 'user', createdAt: serverTimestamp() };
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

// --- IMAGE UTILS ---
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            }
            img.onerror = (err) => reject(err);
        }
        reader.onerror = (err) => reject(err);
    });
}


async function uploadImage(file, path) {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
        url: downloadURL,
        path: snapshot.ref.fullPath
    };
}

// Image Handlers
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('prof-avatar-file');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const compressedFile = await compressImage(file);
                pendingAvatarFile = compressedFile;
                document.getElementById('profile-display-avatar').src = URL.createObjectURL(compressedFile);
            } catch (err) {
                showToast("Eroare la procesare img", "error");
            }
        });
    }
    
    const postImageInput = document.getElementById('post-image');
    if (postImageInput) {
        postImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            try {
                const compressedFile = await compressImage(file);
                pendingPostImageFile = compressedFile;
                document.getElementById('post-image-preview').src = URL.createObjectURL(compressedFile);
                document.getElementById('post-image-preview-container').classList.remove('hidden');
            } catch (err) {
                console.error(err);
                showToast("Eroare procesare imagine", "error");
            }
        });
    }

    const editPostImageInput = document.getElementById('edit-post-image');
    if (editPostImageInput) {
        editPostImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            try {
                const compressedFile = await compressImage(file);
                pendingEditPostImageFile = compressedFile;
                document.getElementById('edit-image-preview').src = URL.createObjectURL(compressedFile);
                document.getElementById('edit-image-preview-container').classList.remove('hidden');
            } catch (err) {
                console.error(err);
                showToast("Eroare procesare imagine", "error");
            }
        });
    }

    const postCategory = document.getElementById('post-category');
    if(postCategory) {
        postCategory.addEventListener('change', (e) => {
            const type = e.target.value;
            const priceSection = document.getElementById('section-price');
            const eventDetails = document.getElementById('section-event-details');
            const businessDetails = document.getElementById('section-business-details');

            priceSection.classList.add('hidden');
            eventDetails.classList.add('hidden');
            businessDetails.classList.add('hidden');

            if (type === 'event') {
                eventDetails.classList.remove('hidden');
            } else if (type === 'afaceri-locale') {
                businessDetails.classList.remove('hidden');
            } else if (type === 'sale' || type === 'borrow') {
                priceSection.classList.remove('hidden');
            }
        });
    }

    const postCategoryFilterMobile = document.getElementById('post-category-filter-mobile');
    if(postCategoryFilterMobile) {
        postCategoryFilterMobile.addEventListener('change', (e) => {
            const type = e.target.value;
            filterPosts(type);
        });
    }

    // Search functionality
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchInput.addEventListener('focus', renderSearchHistory);
    searchInput.addEventListener('blur', () => {
        // Delay hiding to allow click on history item
        setTimeout(() => {
            searchHistoryContainer.classList.add('hidden');
        }, 100);
    });

    loadSearchHistory();

    function handleSearch(e) {
        const query = e.target.value.trim();
        if (query.length > 0) {
            clearSearchBtn.classList.remove('hidden');
            searchHistoryContainer.classList.add('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
            renderSearchHistory();
        }
        performSearch(query);
    }

    function clearSearch() {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        performSearch('');
        renderSearchHistory();
    }

    async function performSearch(query) {
        if (query.length === 0) {
            isSearching = false;
            renderPosts(allPostsCache);
            return;
        }

        isSearching = true;
        const lowerCaseQuery = query.toLowerCase();

        // Filter posts
        const filteredPosts = allPostsCache.filter(post => {
            const titleMatch = post.title.toLowerCase().includes(lowerCaseQuery);
            const descriptionMatch = post.description.toLowerCase().includes(lowerCaseQuery);
            const authorMatch = post.authorName.toLowerCase().includes(lowerCaseQuery);
            return titleMatch || descriptionMatch || authorMatch;
        });

        // Search users
        const usersSnapshot = await getDocs(getCollectionRef(COLL_USERS));
        const matchedUsers = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.name && userData.name.toLowerCase().includes(lowerCaseQuery)) {
                matchedUsers.push({ id: doc.id, ...userData });
            }
        });

        renderSearchResults(filteredPosts, matchedUsers);
        if(query.length > 2) saveSearchQuery(query);
    }

    function renderSearchResults(posts, users) {
        feedContainer.innerHTML = '';

        // Render users section if there are matches
        if (users.length > 0) {
            const usersSection = document.createElement('div');
            usersSection.className = 'mb-6';
            usersSection.innerHTML = `
                <h3 class="text-lg font-bold mb-3 px-2" style="color: var(--text-primary);">
                    <span class="material-icons-round text-sm align-middle mr-2" style="color: var(--neon-cyan);">people</span>
                    Utilizatori (${users.length})
                </h3>
            `;

            const usersGrid = document.createElement('div');
            usersGrid.className = 'grid grid-cols-1 gap-3 mb-6';

            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.className = 'glass-card p-4 flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] neon-glow';
                userCard.onclick = () => viewUserProfile(user.id);

                const avatar = user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`;

                userCard.innerHTML = `
                    <div class="w-12 h-12 rounded-full p-0.5 flex-shrink-0" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));">
                        <img src="${avatar}" class="w-full h-full rounded-full object-cover" style="border: 2px solid var(--carbon);">
                    </div>
                    <div class="flex-1">
                        <h4 class="font-bold" style="color: var(--text-primary);">${user.name}</h4>
                        <p class="text-xs" style="color: var(--text-tertiary);">Membru comunitate</p>
                    </div>
                    <span class="material-icons-round" style="color: var(--text-secondary);">arrow_forward</span>
                `;

                usersGrid.appendChild(userCard);
            });

            usersSection.appendChild(usersGrid);
            feedContainer.appendChild(usersSection);
        }

        // Render posts section
        if (posts.length > 0) {
            const postsSection = document.createElement('div');
            postsSection.innerHTML = `
                <h3 class="text-lg font-bold mb-3 px-2" style="color: var(--text-primary);">
                    <span class="material-icons-round text-sm align-middle mr-2" style="color: var(--neon-cyan);">article</span>
                    Postări (${posts.length})
                </h3>
            `;
            feedContainer.appendChild(postsSection);

            posts.forEach(post => {
                if (post.type === 'event') {
                    feedContainer.appendChild(createEventCard(post));
                } else {
                    feedContainer.appendChild(createPostCard(post));
                }
            });
        }

        // Show no results message
        if (posts.length === 0 && users.length === 0) {
            feedContainer.innerHTML = `
                <div class="text-center py-16">
                    <span class="material-icons-round text-6xl mb-4" style="color: var(--text-tertiary);">search_off</span>
                    <p class="text-sm font-semibold" style="color: var(--text-secondary);">Niciun rezultat găsit</p>
                </div>
            `;
        }
    }

    function saveSearchQuery(query) {
        searchHistory = searchHistory.filter(q => q !== query);
        searchHistory.unshift(query);
        if (searchHistory.length > 5) {
            searchHistory.pop();
        }
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    }

    function loadSearchHistory() {
        const history = localStorage.getItem('searchHistory');
        if (history) {
            searchHistory = JSON.parse(history);
        }
    }

    function renderSearchHistory() {
        searchHistoryContainer.innerHTML = '';
        if (searchHistory.length === 0) {
            searchHistoryContainer.classList.add('hidden');
            return;
        }

        searchHistoryContainer.classList.remove('hidden');
        const ul = document.createElement('ul');
        ul.className = 'py-2';

        searchHistory.forEach(query => {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer';
            li.textContent = query;
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                searchInput.value = query;
                performSearch(query);
                searchHistoryContainer.classList.add('hidden');
            });
            ul.appendChild(li);
        });
        searchHistoryContainer.appendChild(ul);
    }
});

window.clearCreateImage = () => {
    pendingPostImageFile = null;
    document.getElementById('post-image').value = '';
    document.getElementById('post-image-preview').src = '';
    document.getElementById('post-image-preview-container').classList.add('hidden');
};

window.clearEditImage = () => {
    pendingEditPostImageFile = null;
    document.getElementById('edit-post-image').value = '';
    document.getElementById('edit-image-preview').src = '';
    document.getElementById('edit-image-preview-container').classList.add('hidden');
};

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const name = document.getElementById('prof-name').value;
    const phone = document.getElementById('prof-phone').value;
    const email = document.getElementById('prof-email').value;
    const btn = document.getElementById('btn-save-profile');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round animate-spin">refresh</span> Se salvează...';
    try {
        const newData = { name, phone, email };
        if (pendingAvatarFile) {
            if (userProfile.avatarPath) {
                const oldRef = ref(storage, userProfile.avatarPath);
                await deleteObject(oldRef);
            }
            const { url, path } = await uploadImage(pendingAvatarFile, `avatars/${currentUser.uid}`);
            newData.avatar = url;
            newData.avatarPath = path;
        }
        if (selectedAddress && selectedLat && selectedLng) {
            newData.location = {
                address: selectedAddress,
                lat: selectedLat,
                lng: selectedLng
            };
        }
        await updateDoc(getDocPath(COLL_USERS, currentUser.uid), newData);
        userProfile = { ...userProfile, ...newData };
        localStorage.setItem('user_name', name);
        loadUserProfile();
        showToast('Profil actualizat!');
        pendingAvatarFile = null;
    } catch (e) {
        showToast('Eroare la salvare.', 'error');
        console.error(e);
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
    // Update selectedLocation with user profile's location
    if (userProfile.location) {
        selectedAddress = userProfile.location.address;
        selectedLat = userProfile.location.lat;
        selectedLng = userProfile.location.lng;
    }
}

// --- DATA LOADING FUNCTIONS (Restored) ---

window.filterPosts = function(filterType) {
    activeFilter = filterType;

    // Update category card UI
    document.querySelectorAll('.category-card').forEach(card => {
        const cardFilter = card.getAttribute('data-filter');
        if (cardFilter === filterType) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Reload posts with filter
    loadPosts();
};

function loadPosts() {
    if (unsubscribePosts) unsubscribePosts();

    // Reset pagination state
    lastVisiblePost = null;
    hasMorePosts = true;
    allPostsCache = [];

    // Build query with optional filter
    let q;
    if (activeFilter === 'all') {
        q = query(
            getCollectionRef(COLL_POSTS),
            orderBy('timestamp', 'desc'),
            limit(POSTS_PER_PAGE)
        );
    } else {
        q = query(
            getCollectionRef(COLL_POSTS),
            where('type', '==', activeFilter),
            orderBy('timestamp', 'desc'),
            limit(POSTS_PER_PAGE)
        );
    }

    unsubscribePosts = onSnapshot(q, (snapshot) => {
        feedContainer.innerHTML = '';
        allPostsCache = [];

        snapshot.forEach(doc => {
            const post = { id: doc.id, ...doc.data(), _doc: doc };
            allPostsCache.push(post);
        });

        // Store last visible document for pagination
        if (snapshot.docs.length > 0) {
            lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        }

        // Check if there might be more posts
        hasMorePosts = snapshot.docs.length === POSTS_PER_PAGE;

        if (allPostsCache.length === 0) {
            feedContainer.innerHTML = `<div class="text-center py-10 text-gray-400">Nu sunt postări încă.</div>`;
            return;
        }

        renderPosts(allPostsCache);
        showLoadMoreButton();
    });
}

function renderPosts(posts) {
    // Clear container but keep load more button if it exists
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.remove();

    if (posts.length === 0) {
        feedContainer.innerHTML = `<div class="text-center py-10 text-gray-400">Niciun rezultat găsit.</div>`;
        return;
    }

    feedContainer.innerHTML = ''; // Clear the container before rendering posts

    posts.forEach(post => {
        if (post.type === 'event') {
            feedContainer.appendChild(createEventCard(post));
        } else {
            feedContainer.appendChild(createPostCard(post));
        }
    });

    if (!isSearching) {
        showLoadMoreButton();
    }
}

function showLoadMoreButton() {
    // Remove existing button first
    const existingBtn = document.getElementById('load-more-btn');
    if (existingBtn) existingBtn.remove();

    if (!hasMorePosts) return;

    const loadMoreBtn = document.createElement('div');
    loadMoreBtn.id = 'load-more-btn';
    loadMoreBtn.className = 'flex justify-center py-6';
    loadMoreBtn.innerHTML = `
        <button onclick="loadMorePosts()" class="bg-brand-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-brand-primary-dark transition-colors flex items-center gap-2">
            <span id="load-more-text">Încarcă mai multe</span>
            <span class="material-icons-round">expand_more</span>
        </button>
    `;
    feedContainer.appendChild(loadMoreBtn);
}

// Optional: Infinite scroll detection
let scrollListener = null;

function setupInfiniteScroll() {
    // Remove existing listener if any
    if (scrollListener) {
        feedContainer.removeEventListener('scroll', scrollListener);
    }

    scrollListener = () => {
        const scrollableParent = document.getElementById('screen-feed');
        if (!scrollableParent) return;

        const scrollTop = scrollableParent.scrollTop;
        const scrollHeight = scrollableParent.scrollHeight;
        const clientHeight = scrollableParent.clientHeight;

        // Trigger load when user is 200px from bottom
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            if (!isLoadingMorePosts && hasMorePosts) {
                loadMorePosts();
            }
        }
    };

    const scrollableParent = document.getElementById('screen-feed');
    if (scrollableParent) {
        scrollableParent.addEventListener('scroll', scrollListener);
    }
}

window.loadMorePosts = async () => {
    if (isLoadingMorePosts || !hasMorePosts || !lastVisiblePost) return;

    isLoadingMorePosts = true;
    const loadMoreText = document.getElementById('load-more-text');
    if (loadMoreText) {
        loadMoreText.innerHTML = '<span class="material-icons-round animate-spin inline-block">refresh</span>';
    }

    try {
        let q;
        if (activeFilter === 'all') {
            q = query(
                getCollectionRef(COLL_POSTS),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisiblePost),
                limit(POSTS_PER_PAGE)
            );
        } else {
            q = query(
                getCollectionRef(COLL_POSTS),
                where('type', '==', activeFilter),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisiblePost),
                limit(POSTS_PER_PAGE)
            );
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty || snapshot.docs.length < POSTS_PER_PAGE) {
            hasMorePosts = false;
        }

        if (snapshot.docs.length > 0) {
            lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];

            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data(), _doc: doc };
                allPostsCache.push(post);

                if (post.type === 'event') {
                    // Insert before load more button
                    const loadMoreBtn = document.getElementById('load-more-btn');
                    if (loadMoreBtn) {
                        feedContainer.insertBefore(createEventCard(post), loadMoreBtn);
                    } else {
                        feedContainer.appendChild(createEventCard(post));
                    }
                } else {
                    const loadMoreBtn = document.getElementById('load-more-btn');
                    if (loadMoreBtn) {
                        feedContainer.insertBefore(createPostCard(post), loadMoreBtn);
                    } else {
                        feedContainer.appendChild(createPostCard(post));
                    }
                }
            });
        }

        if (!hasMorePosts) {
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) loadMoreBtn.remove();

            const endMessage = document.createElement('div');
            endMessage.className = 'text-center py-6 text-gray-400 text-sm';
            endMessage.innerHTML = '✓ Toate postările au fost încărcate';
            feedContainer.appendChild(endMessage);
        } else {
            showLoadMoreButton();
        }

    } catch (error) {
        console.error('Error loading more posts:', error);
        showToast('Eroare la încărcare', 'error');
        hasMorePosts = true; // Allow retry
    } finally {
        isLoadingMorePosts = false;
        if (loadMoreText) {
            loadMoreText.textContent = 'Încarcă mai multe';
        }
    }
};

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
        }
    } catch (e) {
        showToast('Eroare la actualizare.', 'error');
    } finally {
        if (btn) btn.classList.remove('opacity-50');
    }
}

window.toggleLike = async (postId) => {
    if (!currentUser) return showToast('Trebuie să fii autentificat!', 'error');
    const btn = document.getElementById(`like-btn-${postId}`);
    if (btn) btn.classList.add('opacity-50');

    try {
        const postRef = getDocPath(COLL_POSTS, postId);
        const postDoc = await getDoc(postRef);
        if (!postDoc.exists()) return;

        const postData = postDoc.data();
        const likedUsers = postData.likedUsers || [];
        const isLiked = likedUsers.includes(currentUser.uid);

        if (isLiked) {
            await updateDoc(postRef, {
                likedUsers: arrayRemove(currentUser.uid),
                likeCount: increment(-1)
            });
        } else {
            await updateDoc(postRef, {
                likedUsers: arrayUnion(currentUser.uid),
                likeCount: increment(1)
            });
        }
    } catch (e) {
        showToast('Eroare la actualizare.', 'error');
    } finally {
        if (btn) btn.classList.remove('opacity-50');
    }
}

window.toggleSave = async (postId) => {
    if (!currentUser) return showToast('Trebuie să fii autentificat!', 'error');
    const btn = document.getElementById(`save-btn-${postId}`);
    if (btn) btn.classList.add('opacity-50');

    try {
        const postRef = getDocPath(COLL_POSTS, postId);
        const postDoc = await getDoc(postRef);
        if (!postDoc.exists()) return;

        const postData = postDoc.data();
        const savedUsers = postData.savedUsers || [];
        const isSaved = savedUsers.includes(currentUser.uid);

        if (isSaved) {
            await updateDoc(postRef, {
                savedUsers: arrayRemove(currentUser.uid)
            });
            showToast('Postarea a fost eliminată din salvate.');
        } else {
            await updateDoc(postRef, {
                savedUsers: arrayUnion(currentUser.uid)
            });
            showToast('Postarea a fost salvată.');
        }
    } catch (e) {
        showToast('Eroare la salvare.', 'error');
    } finally {
        if (btn) btn.classList.remove('opacity-50');
    }
}

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const type = document.getElementById('post-category').value;
    if ((type === 'interes-local' || type === 'afaceri-locale') && !isSuperAdmin()) {
        return showToast('Nu ai permisiunea de a posta in aceasta sectiune.', 'error');
    }

    const authorName = userProfile?.name || 'Vecin';
    const authorPhone = document.getElementById('post-phone').value;
    const authorAvatar = userProfile?.avatar || '';
    const btn = document.getElementById('btn-submit-post');

    btn.disabled = true;
    btn.innerText = 'Se postează...';

    try {
        const newPostRef = doc(getCollectionRef(COLL_POSTS));
        const postId = newPostRef.id;

        let imageUrl = null;
        let imagePath = null;
        if (pendingPostImageFile) {
            const { url, path } = await uploadImage(pendingPostImageFile, `posts/${postId}/image`);
            imageUrl = url;
            imagePath = path;
        }

        let formData = {
            title: document.getElementById('post-title').value,
            description: document.getElementById('post-desc').value,
            authorName,
            authorPhone,
            authorAvatar,
            uid: currentUser.uid,
            timestamp: serverTimestamp(),
            type: type,
            commentCount: 0,
            image: imageUrl,
            imagePath: imagePath
        };

        if (formData.type === 'sale') {
            formData.price = document.getElementById('post-price').value;
        } else if (formData.type === 'event') {
            formData.eventDate = document.getElementById('event-date').value;
            formData.eventTime = document.getElementById('event-time').value;
            const isPaid = document.getElementById('event-paid').checked;
            formData.isFree = !isPaid;
            formData.price = isPaid ? document.getElementById('event-price-val').value : 0;
            formData.eventLocation = document.getElementById('event-location').value;
            if (selectedAddress && selectedLat && selectedLng) {
                formData.eventLocationDetails = {
                    address: selectedAddress,
                    lat: selectedLat,
                    lng: selectedLng
                };
            }
            formData.interestedCount = 0;
            formData.interestedUsers = [];
        } else if (formData.type === 'afaceri-locale') {
            formData.businessName = document.getElementById('business-name').value;
            formData.businessHours = document.getElementById('business-hours').value;
        }

        await setDoc(newPostRef, formData);
        showToast('Postarea a fost publicată!');
        toggleModal('modal-create', false);
        createForm.reset();
        showScreen('feed');
        pendingPostImageFile = null;
    } catch (error) {
        console.error(error);
        showToast('Eroare la publicare.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Publică';
    }
});

// --- PROFILE TABS ---
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

// --- COMMENTS & NOTIFICATIONS LOGIC ---
function listenForNotifications() {
    if (unsubscribeNotifs) unsubscribeNotifs();
    if (!currentUser) return;

    const q = query(getCollectionRef(COLL_NOTIF), where('recipientUid', '==', currentUser.uid));

    unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        const notifList = document.getElementById('notif-list');
        if (!notifList) return;

        notifList.innerHTML = '';

        const notifs = [];
        snapshot.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));
        notifs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if (notifs.length === 0) {
            notifList.innerHTML = '<div class="text-center py-8 text-gray-400">Nu ai notificări.</div>';
        }

        notifs.forEach(n => {
            if (!n.read) unreadCount++;
            const div = document.createElement('div');
            div.className = `p-4 border-b border-gray-100 flex items-start gap-3 ${n.read ? 'bg-white' : 'bg-blue-50'}`;
            div.innerHTML = `
                <div class="bg-blue-100 p-2 rounded-full text-blue-600">
                    <span class="material-icons-round text-sm">comment</span>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-800"><span class="font-bold">${n.senderName}</span> a comentat la postarea ta <span class="font-bold">"${n.postTitle}"</span>.</p>
                    <p class="text-xs text-gray-400 mt-1">acum ${timeAgo(new Date(n.timestamp?.seconds * 1000))}</p>
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

        const bellBadge = document.getElementById('notif-badge');
        if (bellBadge) {
            if (unreadCount > 0) {
                bellBadge.classList.remove('hidden');
            } else {
                bellBadge.classList.add('hidden');
            }
        }
    });
}

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
                    <div class="flex items-center gap-2 mt-1 ml-2">
                        <p class="text-[10px] text-gray-300">acum ${timeAgo(new Date(comment.timestamp?.seconds * 1000))}</p>
                        ${isSuperAdmin() ? `<button onclick="adminDeleteComment('${postId}', '${comment.id}')" class="text-[10px] text-red-500 hover:text-red-700 font-bold ml-2">Delete</button>` : ''}
                    </div>
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
        await addDoc(getCollectionRef(COLL_COMMENTS), {
            postId: currentCommentingPostId,
            text: text,
            authorName: userProfile?.name || 'Utilizator',
            authorAvatar: userProfile?.avatar || '',
            uid: currentUser.uid,
            timestamp: serverTimestamp()
        });

        const postRef = getDocPath(COLL_POSTS, currentCommentingPostId);
        await updateDoc(postRef, {
            commentCount: increment(1)
        });

        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
            const postData = postSnap.data();
            await addDoc(getCollectionRef(COLL_NOTIF), {
                recipientUid: postData.uid,
                senderName: userProfile?.name || 'Cineva',
                postId: currentCommentingPostId,
                postTitle: postData.title,
                type: 'comment',
                read: false,
                timestamp: serverTimestamp()
            });
        }

    } catch (error) {
        console.error(error);
        showToast('Eroare la trimitere.', 'error');
    }
});

// Handle edit form submission
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingPostId) return;

        const btn = document.getElementById('btn-update-post');
        btn.disabled = true;
        btn.innerText = 'Se actualizează...';

        try {
            const postRef = getDocPath(COLL_POSTS, editingPostId);
            const postSnap = await getDoc(postRef);

            if (!postSnap.exists()) {
                showToast('Postarea nu a fost găsită', 'error');
                return;
            }

            const post = postSnap.data();
            const updateData = {
                title: document.getElementById('edit-title').value,
                description: document.getElementById('edit-desc').value
            };
            
            if (pendingEditPostImageFile) {
                if (post.imagePath) {
                    const oldRef = ref(storage, post.imagePath);
                    await deleteObject(oldRef);
                }
                const { url, path } = await uploadImage(pendingEditPostImageFile, `posts/${editingPostId}/image`);
                updateData.image = url;
                updateData.imagePath = path;
            }

            if (post.type === 'event') {
                updateData.eventDate = document.getElementById('edit-event-date').value;
                updateData.eventTime = document.getElementById('edit-event-time').value;
                updateData.eventLocation = document.getElementById('edit-event-location').value;
                if (selectedAddress && selectedLat && selectedLng) {
                    updateData.eventLocationDetails = {
                        address: selectedAddress,
                        lat: selectedLat,
                        lng: selectedLng
                    };
                }

                const isPaid = document.getElementById('edit-event-paid').checked;
                updateData.isFree = !isPaid;
                updateData.price = isPaid ? document.getElementById('edit-event-price-val').value : 0;
            } else {
                updateData.price = document.getElementById('edit-price').value;
            }

            await updateDoc(postRef, updateData);
            showToast('Postarea a fost actualizată!');
            toggleModal('modal-edit', false);
            editingPostId = null;
            pendingEditPostImageFile = null;
        } catch (error) {
            console.error('Error updating post:', error);
            showToast('Eroare la actualizare', 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Actualizează';
        }
    });
}

window.openEditModal = async (postId) => {
    editingPostId = postId;
    clearEditImage(); 

    try {
        const postRef = getDocPath(COLL_POSTS, postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            showToast('Postarea nu a fost găsită', 'error');
            return;
        }

        const post = postSnap.data();

        document.getElementById('edit-title').value = post.title || '';
        document.getElementById('edit-desc').value = post.description || '';
        
        if (post.image) {
            document.getElementById('edit-image-preview').src = post.image;
            document.getElementById('edit-image-preview-container').classList.remove('hidden');
        }

        const saleFields = document.getElementById('edit-sale-fields');
        const eventFields = document.getElementById('edit-event-fields');

        if (post.type === 'event') {
            saleFields.classList.add('hidden');
            eventFields.classList.remove('hidden');

            document.getElementById('edit-event-date').value = post.eventDate || '';
            document.getElementById('edit-event-time').value = post.eventTime || '';
            document.getElementById('edit-event-location').value = post.eventLocation || '';
            
            if (post.eventLocationDetails) {
                selectedAddress = post.eventLocationDetails.address;
                selectedLat = post.eventLocationDetails.lat;
                selectedLng = post.eventLocationDetails.lng;
            } else {
                selectedAddress = post.eventLocation || 'Corbeanca, Romania';
                selectedLat = 44.6293;
                selectedLng = 26.0469;
            }

            if (post.isFree) {
                document.getElementById('edit-event-free').checked = true;
                document.getElementById('edit-event-price-input').classList.add('hidden');
            } else {
                document.getElementById('edit-event-paid').checked = true;
                document.getElementById('edit-event-price-input').classList.remove('hidden');
                document.getElementById('edit-event-price-val').value = post.price || '';
            }
            
            document.getElementById('edit-event-paid').onclick = () => {
                document.getElementById('edit-event-price-input').classList.remove('hidden');
            };
            document.getElementById('edit-event-free').onclick = () => {
                document.getElementById('edit-event-price-input').classList.add('hidden');
            };

        } else {
            saleFields.classList.remove('hidden');
            eventFields.classList.add('hidden');
            document.getElementById('edit-price').value = post.price || '';
        }

        toggleModal('modal-edit', true);
    } catch (error) {
        console.error('Error loading post for edit:', error);
        showToast('Eroare la încărcare', 'error');
    }
};

window.viewUserProfile = async (targetUid) => {
    if (!targetUid) return;
    
    toggleModal('modal-public-profile', true);
    document.getElementById('public-prof-name').innerText = "Se încarcă...";
    document.getElementById('public-prof-avatar').src = "";
    const postsList = document.getElementById('public-prof-posts');
    postsList.innerHTML = '<div class="text-center py-4 text-gray-400"><span class="material-icons-round animate-spin">refresh</span></div>';
    const actionsDiv = document.getElementById('public-prof-actions');
    actionsDiv.innerHTML = '';

    try {
        const userRef = getDocPath(COLL_USERS, targetUid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('public-prof-name').innerText = data.name || "Utilizator";
            const avatarSrc = data.avatar || `https://ui-avatars.com/api/?name=${data.name}&background=random`;
            document.getElementById('public-prof-avatar').src = avatarSrc;

            // Add action buttons if not viewing own profile
            if (currentUser && targetUid !== currentUser.uid) {
                const buttons = [];

                // Message button
                buttons.push(`
                    <button onclick="startConversation('${targetUid}')" class="glass-card px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 neon-glow" style="border-radius: var(--radius-full); color: var(--neon-cyan);">
                        <span class="material-icons-round text-sm">chat_bubble</span> Trimite Mesaj
                    </button>
                `);

                // WhatsApp button
                if (data.phone) {
                    let cleanPhone = data.phone.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
                    if (cleanPhone.length > 0 && !cleanPhone.startsWith('40')) cleanPhone = '40' + cleanPhone;

                    buttons.push(`
                        <a href="https://wa.me/${cleanPhone}" target="_blank" class="glass-card px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all hover:scale-105" style="border-radius: var(--radius-full); color: var(--neon-green);">
                            <span class="material-icons-round text-sm">chat</span> WhatsApp
                        </a>
                    `);
                }

                actionsDiv.innerHTML = buttons.join('');
            }
        } else {
            document.getElementById('public-prof-name').innerText = "Utilizator necunoscut";
        }

        const q = query(getCollectionRef(COLL_POSTS), where('uid', '==', targetUid));
        
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
                const div = document.createElement('div');
                div.className = "bg-gray-50 border border-gray-100 p-4 rounded-2xl flex justify-between items-center shadow-sm";
                
                const priceInfo = post.type === 'event' 
                    ? (post.isFree ? 'Gratuit' : `${post.price} RON`) 
                    : `${post.price} RON`;

                div.innerHTML = `
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">${post.title}</h4>
                        <div class="flex gap-2 mt-1">
                            <span class="text-xs bg-white px-2 py-0.5 rounded border text-gray-500 uppercase font-bold">${post.type === 'event' ? 'Eveniment' : 'Vânzare'}</span>
                            <span class="text-xs text-brand-primary font-bold">${priceInfo}</span>
                        </div>
                    </div>
                `;
                postsList.appendChild(div);
            });
        });

    } catch (error) {
        console.error("Error fetching public profile:", error);
        showToast("Eroare la încărcarea profilului", "error");
    }
};

// --- CARD CREATION FUNCTIONS ---
function createPostCard(post) {
    const article = document.createElement('article');
    article.className = "post-card-new ";

    const date = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : '';
    const avatarSrc = post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
    const commentCount = post.commentCount || 0;
    const likeCount = post.likeCount || 0;

    const isLiked = (post.likedUsers || []).includes(currentUser?.uid);
    const isSaved = (post.savedUsers || []).includes(currentUser?.uid);

    // Truncate description to ~100 characters
    const truncatedDesc = post.description.length > 100
        ? post.description.substring(0, 100) + '...'
        : post.description;
    const clickableTruncatedDesc = makeLinksClickable(truncatedDesc);

    article.innerHTML = `
        <!-- Post Header -->
        <div class="post-header">
            ${post.type !== 'afaceri-locale' && post.type !== 'interes-local' ? `
                <div class="post-author" onclick="event.stopPropagation(); viewUserProfile('${post.uid}')">
                    <img src="${avatarSrc}" alt="${post.authorName}">
                    <div class="post-author-info">
                        <h4>${post.authorName}</h4>
                        <p>${date}</p>
                    </div>
                </div>
            ` : `
                <div class="post-author">
                    <div class="post-author-info">
                        <h4>${post.businessName || post.title}</h4>
                        <p>${date}</p>
                    </div>
                </div>
            `}
            ${post.authorPhone && post.type !== 'afaceri-locale' && post.type !== 'interes-local' ? `
                <button onclick="event.stopPropagation(); contactViaWhatsApp('${post.authorPhone}', '${post.title.replace(/'/g, "\\'")}', '${post.authorName.replace(/'/g, "\\'")}', '${post.type}')" class="px-4 py-2 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2" style="background: #25D366;">
                    WhatsApp
                </button>
            ` : ''}
        </div>

        <!-- Post Image -->
        ${post.image ? `<img src="${post.image}" class="post-image" alt="${post.title}">` : ''}

        <!-- Post Content -->
        <div class="post-content">
            <div class="flex justify-between items-center mb-3">
                <span class="post-category-badge">
                    ${getCategoryLabel(post.type)}
                </span>
                ${post.price ? `
                    <div class="flex items-center gap-2 text-brand-primary font-bold text-base">
                        <span class="material-icons-round" style="font-size: 20px;">sell</span>
                        <span>${post.price} RON</span>
                    </div>
                ` : ''}
            </div>

            <h3 class="mb-3">${post.title}</h3>
            ${post.type === 'afaceri-locale' && post.businessName ? `
                <div class="business-details mb-3">
                    <p class="text-sm font-bold text-gray-800">${post.businessName}</p>
                    ${post.businessHours ? `<p class="text-xs text-gray-500">${post.businessHours}</p>` : ''}
                </div>
            ` : ''}
            <p class="text-gray-600 text-sm leading-relaxed">${clickableTruncatedDesc}</p>
        </div>

        <!-- Post Actions -->
        <div class="post-actions">
            <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleLike('${post.id}')" id="like-btn-${post.id}">
                <span class="material-icons-round">${isLiked ? 'favorite' : 'favorite_border'}</span>
                <span>${likeCount} aprecieri</span>
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); openComments('${post.id}')">
                <span class="material-icons-round">chat_bubble_outline</span>
                <span>${commentCount} comentarii</span>
            </button>
            <button class="action-btn ml-auto ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleSave('${post.id}')" id="save-btn-${post.id}">
                <span class="material-icons-round">${isSaved ? 'bookmark' : 'bookmark_border'}</span>
                <span class="text-xs">salveaza</span>
            </button>
        </div>
    `;

    // Add click handler to open details
    article.onclick = () => openPostDetails(post.id);

    return article;
}

function createEventCard(post) {
    const article = document.createElement('article');
    article.className = "post-card-new";

    const date = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : '';
    const avatarSrc = post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
    const interestedCount = post.interestedCount || 0;
    const commentCount = post.commentCount || 0;
    const isInterested = (post.interestedUsers || []).includes(currentUser?.uid);
    const isSaved = (post.savedUsers || []).includes(currentUser?.uid);

    const eventDateObj = new Date(post.eventDate);
    const dateStr = eventDateObj.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
    const location = post.eventLocation || 'Corbeanca';

    article.innerHTML = `
        <!-- Post Header -->
        <div class="post-header">
            <div class="post-author" onclick="event.stopPropagation(); viewUserProfile('${post.uid}')">
                <img src="${avatarSrc}" alt="${post.authorName}">
                <div class="post-author-info">
                    <h4>${post.authorName}</h4>
                    <p>${date}</p>
                </div>
            </div>
            ${post.authorPhone ? `
                <button onclick="event.stopPropagation(); contactViaWhatsApp('${post.authorPhone}', '${post.title.replace(/'/g, "\\'")}', '${post.authorName.replace(/'/g, "\\'")}', 'event')" class="px-4 py-2 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2" style="background: #25D366;">
                    WhatsApp
                </button>
            ` : ''}
        </div>

        <!-- Post Image -->
        ${post.image ? `<img src="${post.image}" class="post-image" alt="${post.title}">` : ''}

        <!-- Post Content -->
        <div class="post-content">
            <div class="flex justify-between items-center mb-3">
                <span class="post-category-badge">
                    Evenimente
                </span>
                <div class="flex items-center gap-2 text-brand-primary font-bold text-sm">
                    <span class="material-icons-round" style="font-size: 18px;">schedule</span>
                    <span>${dateStr}, ${post.eventTime}</span>
                </div>
            </div>

            <h3 class="mb-4">${post.title}</h3>

            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-2 text-gray-600 text-sm font-semibold">
                    <span class="material-icons-round text-gray-500" style="font-size: 20px;">location_on</span>
                    <span>${location}</span>
                </div>
                ${post.isFree ? `
                    <span class="px-4 py-1.5 text-sm font-extrabold rounded-lg bg-green-50 border border-green-500 text-green-600">GRATUIT</span>
                ` : post.price ? `
                    <span class="px-4 py-1.5 text-sm font-extrabold rounded-lg bg-brand-secondary border border-brand-primary text-brand-primary">${post.price} RON</span>
                ` : ''}
            </div>
        </div>

        <!-- Post Actions -->
        <div class="post-actions">
            <button class="action-btn ${isInterested ? 'liked' : ''}" onclick="event.stopPropagation(); toggleInterest('${post.id}')" id="interest-btn-${post.id}">
                <span class="material-icons-round">${isInterested ? 'favorite' : 'favorite_border'}</span>
                <span>${interestedCount} aprecieri</span>
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); openComments('${post.id}')">
                <span class="material-icons-round">chat_bubble_outline</span>
                <span>${commentCount} comentarii</span>
            </button>
            <button class="action-btn ml-auto ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleSave('${post.id}')" id="save-btn-${post.id}">
                <span class="material-icons-round">${isSaved ? 'bookmark' : 'bookmark_border'}</span>
                <span class="text-xs">salveaza</span>
            </button>
        </div>
    `;

    // Add click handler to open details
    article.onclick = () => openPostDetails(post.id);

    return article;
}

// --- POST DETAILS MODAL ---
window.openPostDetails = async (postId) => {
    if (!postId) return;
    currentViewingPostId = postId;

    try {
        const postRef = getDocPath(COLL_POSTS, postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            showToast('Postarea nu a fost găsită', 'error');
            return;
        }

        const post = { id: postSnap.id, ...postSnap.data() };
        const content = document.getElementById('post-detail-content');
        const title = document.getElementById('post-detail-title');

        title.textContent = post.title;

        if (post.type === 'event') {
            renderEventDetails(post, content);
        } else if (post.type === 'afaceri-locale') {
            renderBusinessDetails(post, content);
        } else if (post.type === 'interes-local') {
            renderInteresLocalDetails(post, content);
        } else {
            renderSaleDetails(post, content);
        }

        toggleModal('modal-post-details', true);
    } catch (error) {
        console.error('Error loading post details:', error);
        showToast('Eroare la încărcare', 'error');
    }
};

function renderSaleDetails(post, container) {
    const avatarSrc = post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
    const date = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : '';

    let cleanPhone = (post.authorPhone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('40')) cleanPhone = '40' + cleanPhone;
    const waHref = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Salut, pt anunțul: ' + post.title)}` : 'javascript:void(0)';

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Author Info -->
            <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-xl transition-colors" onclick="viewUserProfile('${post.uid}')">
                <img src="${avatarSrc}" class="w-12 h-12 rounded-full object-cover bg-gray-100 border-2 border-gray-100">
                <div>
                    <p class="font-bold text-gray-800">${post.authorName}</p>
                    <p class="text-xs text-gray-400">acum ${date}</p>
                </div>
            </div>

            ${post.image ? `<img src="${post.image}" class="w-full h-64 object-cover rounded-2xl border border-gray-100">` : ''}

            <!-- Description -->
            <div>
                <p class="text-xs font-bold text-gray-500 uppercase mb-2">Descriere</p>
                <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">${makeLinksClickable(post.description)}</p>
            </div>

            <!-- Contact Button -->
            ${cleanPhone ? `
            <a href="${waHref}" target="_blank" class="w-full text-white py-3 px-6 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all" style="background: #25D366;">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
            </a>
            ` : ''}
        </div>
    `;
}

function renderEventDetails(post, container) {
    const avatarSrc = post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
    const interestedCount = post.interestedCount || 0;
    const isInterested = (post.interestedUsers || []).includes(currentUser?.uid);

    const eventDateObj = new Date(post.eventDate);
    const dateStr = eventDateObj.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const priceDisplay = post.isFree ? "Gratuit" : `${post.price} RON`;
    const location = post.eventLocationDetails?.address || post.eventLocation || 'Corbeanca';
    const lat = post.eventLocationDetails?.lat || 44.6293;
    const lng = post.eventLocationDetails?.lng || 26.0469;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}&query_place_id=${lat},${lng}`;
    const embedMapUrl = `https://maps.google.com/maps?q=${lat},${lng}&output=embed&z=15`;
    const btnClass = isInterested ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700";
    const btnIcon = isInterested ? "favorite" : "favorite_border";
    const btnText = isInterested ? "Interesat" : "Marchează Interes";

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Author Info -->
            <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-xl transition-colors" onclick="viewUserProfile('${post.uid}')">
                <img src="${avatarSrc}" class="w-12 h-12 rounded-full object-cover bg-gray-100 border-2 border-purple-100">
                <div>
                    <p class="font-bold text-gray-800">${post.authorName}</p>
                    <p class="text-xs text-gray-400">Organizator</p>
                </div>
            </div>

            ${post.image ? `<img src="${post.image}" class="w-full h-64 object-cover rounded-2xl border border-gray-100">` : ''}

            <!-- Date & Time -->
            <div class="bg-brand-primary/20 p-4 rounded-2xl border-2 border-brand-primary">
                <div class="flex items-center gap-3">
                    <span class="material-icons-round text-brand-primary text-3xl">calendar_today</span>
                    <div>
                        <p class="text-xs font-bold text-brand-primary uppercase">Când?</p>
                        <p class="text-lg font-bold text-brand-primary capitalize">${dateStr}</p>
                        <p class="text-sm font-bold text-brand-primary">Ora: ${post.eventTime}</p>
                    </div>
                </div>
            </div>

            <!-- Location with Map -->
            <div>
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-round text-red-500">location_on</span>
                        <p class="font-bold text-gray-800">${location}</p>
                    </div>
                    <a href="${mapUrl}" target="_blank" class="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-200 transition-colors">
                        <span class="material-icons-round text-sm">directions</span>
                        Indicații
                    </a>
                </div>
                <div class="rounded-2xl overflow-hidden border-2 border-gray-200">
                    <iframe
                        width="100%"
                        height="250"
                        frameborder="0"
                        style="border:0"
                        src="${embedMapUrl}"
                        loading="lazy"
                        allowfullscreen>
                    </iframe>
                </div>
            </div>

            <!-- Description -->
            <div>
                <p class="text-xs font-bold text-gray-500 uppercase mb-2">Descriere</p>
                <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">${makeLinksClickable(post.description)}</p>
            </div>

            <!-- Interest Button -->
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div class="flex items-center gap-2 text-sm text-gray-600">
                    <span class="material-icons-round text-pink-400">group</span>
                    <span class="font-bold">${interestedCount} persoane interesate</span>
                </div>
                <button onclick="toggleInterest('${post.id}')" class="${btnClass} px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg">
                    <span class="material-icons-round">${btnIcon}</span>
                    ${btnText}
                </button>
            </div>
        </div>
    `;
}

function renderInteresLocalDetails(post, container) {
    const date = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : '';

    container.innerHTML = `
        <div class="space-y-4">
            ${post.image ? `<img src="${post.image}" class="w-full h-64 object-cover rounded-2xl border border-gray-100">` : ''}

            <!-- Description -->
            <div>
                <p class="text-xs font-bold text-gray-500 uppercase mb-2">Descriere</p>
                <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">${makeLinksClickable(post.description)}</p>
            </div>
        </div>
    `;
}

function renderBusinessDetails(post, container) {
    const date = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : '';

    let cleanPhone = (post.authorPhone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('40')) cleanPhone = '40' + cleanPhone;
    const waHref = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Salut, pt anunțul: ' + post.title)}` : 'javascript:void(0)';

    container.innerHTML = `
        <div class="space-y-4">
            ${post.image ? `<img src="${post.image}" class="w-full h-64 object-cover rounded-2xl border border-gray-100">` : ''}
            <!-- Business Name and Hours -->
            <div class="bg-gray-100 p-4 rounded-2xl border-2 border-gray-200">
                <p class="text-xs font-bold text-gray-500 uppercase mb-1">Nume Afacere</p>
                <p class="text-xl font-extrabold text-gray-800">${post.businessName || 'N/A'}</p>
                ${post.businessHours ? `
                    <p class="text-xs font-bold text-gray-500 uppercase mt-3 mb-1">Program</p>
                    <p class="text-md font-bold text-gray-700">${post.businessHours}</p>
                ` : ''}
            </div>

            <!-- Description -->
            <div>
                <p class="text-xs font-bold text-gray-500 uppercase mb-2">Descriere</p>
                <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">${makeLinksClickable(post.description)}</p>
            </div>

            <!-- Contact Button -->
            ${cleanPhone ? `
            <a href="${waHref}" target="_blank" class="w-full text-white py-3 px-6 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all" style="background: #25D366;">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
            </a>
            ` : ''}
        </div>
    `;
}

window.openCommentsFromDetail = () => {
    if (currentViewingPostId) {
        openComments(currentViewingPostId);
    }
};

function createMyPostCard(post) {
    const div = document.createElement('div');
    div.className = "bg-white border border-gray-100 p-4 rounded-2xl flex justify-between items-center shadow-sm";
    div.innerHTML = `
        <div class="flex-1">
            <h4 class="font-bold text-gray-800">${post.title}</h4>
            <p class="text-xs text-gray-400 mt-1 uppercase font-bold">${post.type === 'event' ? 'Eveniment' : 'Vânzare'}</p>
        </div>
        <div class="flex gap-2">
            <button onclick="openEditModal('${post.id}')" class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100">
                <span class="material-icons-round text-sm">edit</span>
            </button>
            <button onclick="deletePost('${post.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                <span class="material-icons-round text-sm">delete</span>
            </button>
        </div>
    `;
    return div;
}

window.deletePost = async (id) => {
    if (!confirm('Sigur vrei să ștergi?')) return;
    try {
        const postRef = getDocPath(COLL_POSTS, id);
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
            const post = postSnap.data();
            if (post.imagePath) {
                const imageRef = ref(storage, post.imagePath);
                await deleteObject(imageRef);
            }
        }

        await deleteDoc(postRef);
        showToast('Șters.');
    } catch (e) {
        showToast('Eroare', 'error');
        console.error(e);
    }
};

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

// --- GLOBAL MAP VARIABLES ---
let map;
let marker;
let geocoder;
let mapInitialized = false;
let mapInitializing = false;
let selectedLat = 44.6293; // Default to Corbeanca, Romania
let selectedLng = 26.0469;
let selectedAddress = 'Corbeanca, Romania';
let locationPickerMode = 'edit'; // 'edit' or 'create'

// --- GOOGLE MAPS INIT ---
async function initMap() {
    if (mapInitialized) return;
    if (mapInitializing) {
        // Wait for initialization to complete
        while (mapInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
    }

    mapInitializing = true;

    try {
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    map = new Map(document.getElementById('map'), {
        center: { lat: selectedLat, lng: selectedLng },
        zoom: 14,
        mapId: 'f27c0aadac960951ff249d2f',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    marker = new AdvancedMarkerElement({
        map,
        position: { lat: selectedLat, lng: selectedLng },
        gmpDraggable: true,
    });

        geocoder = new google.maps.Geocoder();

        // Listen for map clicks
        map.addListener('click', (e) => {
            placeMarkerAndPanTo(e.latLng, map);
        });

        // Listen for marker drag end
        marker.addListener('dragend', () => {
            geocodeLatLng(marker.position);
        });

        mapInitialized = true;
    } catch (error) {
        console.error('Error initializing map:', error);
        showToast("Eroare la încărcarea hărții", "error");
    } finally {
        mapInitializing = false;
    }
}

function placeMarkerAndPanTo(latLng, map) {
    marker.position = latLng;
    map.panTo(latLng);
    geocodeLatLng(latLng);
}

function geocodeLatLng(latlng) {
    geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK') {
            if (results[0]) {
                selectedAddress = results[0].formatted_address;
                selectedLat = latlng.lat();
                selectedLng = latlng.lng();
                document.getElementById('selected-location-display').value = selectedAddress;
            } else {
                window.alert('No results found');
            }
        } else {
            window.alert('Geocoder failed due to: ' + status);
        }
    });
}

function geocodeAddress(address) {
    geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK') {
            if (results[0]) {
                const latLng = results[0].geometry.location;
                placeMarkerAndPanTo(latLng, map);
                selectedAddress = results[0].formatted_address;
                selectedLat = latLng.lat();
                selectedLng = latLng.lng();
                document.getElementById('selected-location-display').value = selectedAddress;
            } else {
                window.alert('Address not found');
            }
        } else {
            window.alert('Geocoding failed due to: ' + status);
        }
    });
}

// --- LOCATION PICKER FUNCTIONS ---
window.openLocationPicker = async () => {
    locationPickerMode = 'edit';
    const currentLoc = userProfile.location || { address: 'Corbeanca, Romania', lat: 44.6293, lng: 26.0469 };

    toggleModal('modal-location-picker', true);

    // Initialize map if not already initialized
    await initMap();

    // Ensure map is initialized and ready before trying to set center/marker
    google.maps.event.addListenerOnce(map, 'idle', () => {
        geocodeAddress(currentLoc.address);
    });
};

window.openLocationPickerForCreate = async () => {
    locationPickerMode = 'create';
    const currentLocation = document.getElementById('event-location').value;

    toggleModal('modal-location-picker', true);

    // Initialize map if not already initialized
    await initMap();

    google.maps.event.addListenerOnce(map, 'idle', () => {
        if (currentLocation) {
            geocodeAddress(currentLocation);
        } else {
            geocodeAddress('Corbeanca, Romania');
        }
    });
};

window.confirmLocationSelection = () => {
    if (selectedAddress && selectedLat && selectedLng) {
        const locationObject = {
            address: selectedAddress,
            lat: selectedLat,
            lng: selectedLng
        };

        if (locationPickerMode === 'create') {
            document.getElementById('event-location').value = selectedAddress;
        } else { // 'edit' mode
            document.getElementById('edit-event-location').value = selectedAddress;
        }
        showToast('Locație selectată!');
    } else {
        showToast('Selectează o locație validă!', 'error');
    }

    toggleModal('modal-location-picker', false);
};

document.addEventListener('DOMContentLoaded', () => {
    const locationSearch = document.getElementById('location-search');

    if (locationSearch) {
        let searchTimeout;

        locationSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                const searchQuery = e.target.value.trim();

                if (searchQuery.length > 2) {
                    geocodeAddress(searchQuery);
                }
            }, 500); 
        });

        locationSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchQuery = e.target.value.trim();

                if (searchQuery) {
                    geocodeAddress(searchQuery);
                }
            }
        });
    }
});

// --- ADMIN DASHBOARD FUNCTIONS ---
let adminPosts = [];
let adminUsers = [];
let adminAllPosts = [];

async function loadAdminDashboard() {
    if (!isSuperAdmin()) return;

    try {
        // Load all posts
        const postsQuery = query(collection(db, COLL_POSTS), orderBy('timestamp', 'desc'));
        const postsSnap = await getDocs(postsQuery);
        adminAllPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        adminPosts = [...adminAllPosts];

        // Load all users
        const usersQuery = query(collection(db, COLL_USERS));
        const usersSnap = await getDocs(usersQuery);
        adminUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Count comments
        let totalComments = 0;
        for (const post of adminPosts) {
            const commentsSnap = await getDocs(collection(db, COLL_POSTS, post.id, 'comments'));
            totalComments += commentsSnap.size;
        }

        // Update stats
        document.getElementById('admin-total-posts').textContent = adminPosts.length;
        document.getElementById('admin-total-users').textContent = adminUsers.length;
        document.getElementById('admin-total-comments').textContent = totalComments;

        // Render posts
        renderAdminPosts();
        switchAdminTab('posts');
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showToast('Eroare la încărcarea dashboard-ului', 'error');
    }
}

window.switchAdminTab = (tabName) => {
    // Update tab buttons
    document.querySelectorAll('[id^="admin-tab-"]').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-tertiary)';
        btn.style.border = 'none';
    });

    const activeTab = document.getElementById(`admin-tab-${tabName}`);
    activeTab.style.background = 'var(--glass-medium)';
    activeTab.style.color = 'var(--neon-cyan)';
    activeTab.style.border = '1px solid var(--neon-cyan)';

    // Show/hide tab content
    document.getElementById('admin-posts-tab').classList.add('hidden');
    document.getElementById('admin-users-tab').classList.add('hidden');
    document.getElementById('admin-reports-tab').classList.add('hidden');

    document.getElementById(`admin-${tabName}-tab`).classList.remove('hidden');

    // Load data
    if (tabName === 'posts') {
        renderAdminPosts();
    } else if (tabName === 'users') {
        renderAdminUsers();
    }
};

window.filterAdminPosts = () => {
    const filter = document.getElementById('admin-posts-filter').value;
    if (filter === 'all') {
        adminPosts = [...adminAllPosts];
    } else {
        adminPosts = adminAllPosts.filter(p => p.type === filter);
    }
    renderAdminPosts();
};

window.searchAdminUsers = () => {
    const searchTerm = document.getElementById('admin-users-search').value.toLowerCase();
    renderAdminUsers(searchTerm);
};

function renderAdminPosts() {
    const container = document.getElementById('admin-posts-list');
    container.innerHTML = '';

    if (adminPosts.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Nu există postări</p>';
        return;
    }

    adminPosts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'glass-card p-4 flex items-start gap-4 cursor-pointer neon-glow';
        postEl.style.transition = 'var(--transition-smooth)';
        const timestamp = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : 'Recent';
        postEl.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="font-bold text-base truncate" style="color: var(--text-primary);">${post.title}</div>
                <div class="text-xs mt-2" style="color: var(--text-secondary);">${getCategoryLabel(post.type)} • ${post.authorName}</div>
                <div class="text-xs mt-1" style="color: var(--text-tertiary);">${timestamp}</div>
            </div>
            <button onclick="event.stopPropagation(); adminDeletePost('${post.id}')" class="glass-card p-2.5 rounded-full transition-all hover:scale-110 flex-shrink-0" style="background: rgba(247, 37, 133, 0.2); border: 1px solid var(--neon-pink);">
                <span class="material-icons-round text-sm" style="color: var(--neon-pink);">delete</span>
            </button>
        `;

        // Add click handler to open post details
        postEl.onclick = () => openPostDetails(post.id);

        container.appendChild(postEl);
    });
}

function renderAdminUsers(searchTerm = '') {
    const container = document.getElementById('admin-users-list');
    container.innerHTML = '';

    let filteredUsers = adminUsers;
    if (searchTerm) {
        filteredUsers = adminUsers.filter(u =>
            u.name?.toLowerCase().includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredUsers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Nu există utilizatori</p>';
        return;
    }

    filteredUsers.forEach(user => {
        const isAdmin = user.role === 'super-admin';
        const isCurrent = user.id === currentUser.uid;
        const userEl = document.createElement('div');
        userEl.className = 'glass-card p-4 flex items-center gap-4';
        userEl.innerHTML = `
            <div class="w-14 h-14 rounded-full p-0.5 flex-shrink-0 neon-glow" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));">
                <img src="${user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}" class="w-full h-full rounded-full object-cover" style="border: 2px solid var(--carbon);">
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-bold text-base truncate flex items-center gap-2" style="color: var(--text-primary);">
                    ${user.name}
                    ${isAdmin ? '<span class="text-[10px] font-bold uppercase px-3 py-1 rounded-full" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple)); color: var(--void-black);">Admin</span>' : ''}
                    ${isCurrent ? '<span class="text-[10px] font-bold uppercase px-3 py-1 rounded-full glass-card" style="color: var(--text-secondary);">You</span>' : ''}
                </div>
                <div class="text-xs truncate mt-1" style="color: var(--text-secondary);">${user.email}</div>
                <div class="text-xs mt-0.5" style="color: var(--text-tertiary);">${user.phone || 'No phone'}</div>
            </div>
            ${!isCurrent ? `
                <div class="flex gap-2 flex-shrink-0">
                    ${!isAdmin ? `<button onclick="adminToggleRole('${user.id}')" class="glass-card px-4 py-2 rounded-full transition-all hover:scale-105 text-xs font-bold" style="background: rgba(0, 240, 255, 0.2); border: 1px solid var(--neon-cyan); color: var(--neon-cyan);">
                        Make Admin
                    </button>` : ''}
                    <button onclick="adminDeleteUser('${user.id}')" class="glass-card p-2.5 rounded-full transition-all hover:scale-110" style="background: rgba(247, 37, 133, 0.2); border: 1px solid var(--neon-pink);">
                        <span class="material-icons-round text-sm" style="color: var(--neon-pink);">delete</span>
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(userEl);
    });
}

window.adminDeletePost = async (postId) => {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    if (!confirm('Sigur vrei să ștergi această postare?')) return;

    try {
        await deleteDoc(getDocPath(COLL_POSTS, postId));
        adminPosts = adminPosts.filter(p => p.id !== postId);
        adminAllPosts = adminAllPosts.filter(p => p.id !== postId);
        renderAdminPosts();
        document.getElementById('admin-total-posts').textContent = adminAllPosts.length;
        showToast('Postare ștearsă cu succes', 'success');
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Eroare la ștergerea postării', 'error');
    }
};

window.adminDeleteUser = async (userId) => {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    if (!confirm('Sigur vrei să ștergi acest utilizator? Această acțiune este ireversibilă!')) return;

    try {
        // Delete user's posts
        const userPosts = adminAllPosts.filter(p => p.authorId === userId);
        for (const post of userPosts) {
            await deleteDoc(getDocPath(COLL_POSTS, post.id));
        }

        // Delete user document
        await deleteDoc(getDocPath(COLL_USERS, userId));

        adminUsers = adminUsers.filter(u => u.id !== userId);
        adminAllPosts = adminAllPosts.filter(p => p.authorId !== userId);
        renderAdminUsers();
        document.getElementById('admin-total-users').textContent = adminUsers.length;
        document.getElementById('admin-total-posts').textContent = adminAllPosts.length;
        showToast('Utilizator șters cu succes', 'success');
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Eroare la ștergerea utilizatorului', 'error');
    }
};

window.adminToggleRole = async (userId) => {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    try {
        const userRef = getDocPath(COLL_USERS, userId);
        await updateDoc(userRef, { role: 'super-admin' });

        const userIndex = adminUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            adminUsers[userIndex].role = 'super-admin';
        }

        renderAdminUsers();
        showToast('Utilizator promovat la admin', 'success');
    } catch (error) {
        console.error('Error toggling role:', error);
        showToast('Eroare la modificarea rolului', 'error');
    }
};

window.adminDeleteComment = async (postId, commentId) => {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    if (!confirm('Sigur vrei să ștergi acest comentariu?')) return;

    try {
        const commentRef = doc(db, COLL_POSTS, postId, 'comments', commentId);
        await deleteDoc(commentRef);
        showToast('Comentariu șters cu succes', 'success');

        // Reload comments if viewing them
        if (currentCommentingPostId === postId) {
            loadComments(postId);
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Eroare la ștergerea comentariului', 'error');
    }
};

// --- WHATSAPP CONTACT FUNCTION ---
window.contactViaWhatsApp = (phone, title, authorName, category) => {
    // Format phone number - remove spaces and ensure it starts with country code
    let formattedPhone = phone.replace(/\s+/g, '');

    // If phone starts with 0, replace with Romania country code (+40)
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '40' + formattedPhone.substring(1);
    }

    // If phone doesn't start with +, add it
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }

    // Create context-aware message based on category
    let message = '';
    const categoryMessages = {
        'sale': `Bună! Sunt interesat de anunțul tău: "${title}"`,
        'borrow': `Bună! Aș dori să împrumut: "${title}"`,
        'event': `Bună! Vreau să aflu mai multe despre evenimentul: "${title}"`,
        'local': `Bună! Am văzut postarea ta despre: "${title}"`,
        'business': `Bună! Sunt interesat de serviciile tale: "${title}"`,
        'recommendation': `Bună! Am văzut recomandarea ta despre: "${title}"`
    };

    message = categoryMessages[category] || `Bună! Am văzut postarea ta: "${title}"`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Open WhatsApp in new window
    window.open(whatsappUrl, '_blank');

    // Optional: Track analytics or show confirmation
    showToast(`Deschid WhatsApp pentru ${authorName}...`, 'success');
};

function getCategoryLabel(category) {
    const labels = {
        'sale': 'Bazar',
        'borrow': 'Împrumut',
        'event': 'Eveniment',
        'interes-local': 'Interes Local',
        'afaceri-locale': 'Afacere Locală',
        'recommendation': 'Recomandare'
    };
    return labels[category] || category;
}

// --- MESSAGING SYSTEM ---

// Load all conversations for current user
function loadConversations() {
    if (!currentUser) return;

    if (unsubscribeConversations) unsubscribeConversations();

    conversationsContainer.innerHTML = '<div class="flex justify-center py-16"><span class="material-icons-round animate-spin text-3xl" style="color: var(--neon-cyan);">refresh</span></div>';

    const q = query(
        getCollectionRef(COLL_CONVERSATIONS),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
    );

    unsubscribeConversations = onSnapshot(q, async (snapshot) => {
        conversationsContainer.innerHTML = '';

        if (snapshot.empty) {
            conversationsContainer.innerHTML = `
                <div class="text-center py-16">
                    <span class="material-icons-round text-6xl mb-4" style="color: var(--text-tertiary);">chat_bubble_outline</span>
                    <p class="text-sm font-semibold" style="color: var(--text-secondary);">Nu ai nicio conversație încă</p>
                    <p class="text-xs mt-2" style="color: var(--text-tertiary);">Trimite un mesaj unui vecin pentru a începe o conversație</p>
                </div>
            `;
            return;
        }

        const conversations = [];
        for (const doc of snapshot.docs) {
            const convData = { id: doc.id, ...doc.data() };
            const otherUserId = convData.participants.find(uid => uid !== currentUser.uid);
            const otherUserDoc = await getDoc(getDocPath(COLL_USERS, otherUserId));
            if (otherUserDoc.exists()) {
                convData.otherUser = { id: otherUserId, ...otherUserDoc.data() };
                conversations.push(convData);
            }
        }

        conversations.forEach(conv => {
            conversationsContainer.appendChild(createConversationCard(conv));
        });
    });
}

// Create conversation card
function createConversationCard(conv) {
    const card = document.createElement('div');
    card.className = 'glass-card p-4 flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] neon-glow';
    card.onclick = () => openConversation(conv.id, conv.otherUser.id);

    const hasUnread = conv.unreadCount && conv.unreadCount[currentUser.uid] > 0;
    const unreadCount = hasUnread ? conv.unreadCount[currentUser.uid] : 0;

    const avatar = conv.otherUser.avatar || `https://ui-avatars.com/api/?name=${conv.otherUser.name}&background=random`;
    const lastMessageTime = conv.lastMessageTime ? timeAgo(conv.lastMessageTime.toDate()) : '';

    card.innerHTML = `
        <div class="w-14 h-14 rounded-full p-0.5 flex-shrink-0 ${hasUnread ? 'neon-glow' : ''}" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));">
            <img src="${avatar}" class="w-full h-full rounded-full object-cover" style="border: 2px solid var(--carbon);">
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
                <h3 class="font-bold text-base truncate" style="color: var(--text-primary);">${conv.otherUser.name}</h3>
                <span class="text-xs flex-shrink-0 ml-2" style="color: var(--text-tertiary);">${lastMessageTime}</span>
            </div>
            <div class="flex items-center justify-between">
                <p class="text-sm truncate ${hasUnread ? 'font-bold' : ''}" style="color: ${hasUnread ? 'var(--neon-cyan)' : 'var(--text-secondary)'};">${conv.lastMessage || 'Niciun mesaj încă'}</p>
                ${hasUnread ? `<span class="flex-shrink-0 ml-2 px-2 py-0.5 text-xs font-bold rounded-full" style="background: var(--neon-pink); color: var(--void-black);">${unreadCount}</span>` : ''}
            </div>
        </div>
    `;

    return card;
}

// Open conversation with a specific user
window.openConversation = async (conversationId, otherUserId) => {
    if (!currentUser) return;

    currentConversationId = conversationId;
    currentChatUserId = otherUserId;

    // Get other user data
    const otherUserDoc = await getDoc(getDocPath(COLL_USERS, otherUserId));
    if (!otherUserDoc.exists()) {
        showToast('Utilizatorul nu a fost găsit', 'error');
        return;
    }

    const otherUser = otherUserDoc.data();
    const avatar = otherUser.avatar || `https://ui-avatars.com/api/?name=${otherUser.name}&background=random`;

    document.getElementById('conversation-user-avatar').src = avatar;
    document.getElementById('conversation-user-name').textContent = otherUser.name;

    toggleModal('modal-conversation', true);
    loadMessages(conversationId);

    // Mark messages as read
    await markMessagesAsRead(conversationId);
}

// Load messages in a conversation
function loadMessages(conversationId) {
    if (unsubscribeMessages) unsubscribeMessages();

    messagesContainer.innerHTML = '<div class="flex justify-center py-8"><span class="material-icons-round animate-spin text-2xl" style="color: var(--neon-cyan);">refresh</span></div>';

    const q = query(
        collection(db, shouldUseCustomToken ? `artifacts/${appId}/public/data/${COLL_CONVERSATIONS}/${conversationId}/${COLL_MESSAGES}` : `${COLL_CONVERSATIONS}/${conversationId}/${COLL_MESSAGES}`),
        orderBy('timestamp', 'asc')
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';

        if (snapshot.empty) {
            messagesContainer.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-sm" style="color: var(--text-tertiary);">Trimite primul mesaj</p>
                </div>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const message = { id: doc.id, ...doc.data() };
            messagesContainer.appendChild(createMessageBubble(message));
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Create message bubble
function createMessageBubble(message) {
    const isMyMessage = message.senderId === currentUser.uid;
    const bubble = document.createElement('div');
    bubble.className = `flex ${isMyMessage ? 'justify-end' : 'justify-start'}`;

    const time = message.timestamp ? timeAgo(message.timestamp.toDate()) : '';

    if (isMyMessage) {
        // My messages - brand primary with white text
        bubble.innerHTML = `
            <div class="max-w-[70%] p-3 rounded-2xl" style="background: var(--primary); color: white;">
                <p class="text-sm break-words">${message.text}</p>
                <span class="text-xs block mt-1 opacity-70">${time}</span>
            </div>
        `;
    } else {
        // Received messages - light background with dark text
        bubble.innerHTML = `
            <div class="max-w-[70%] p-3 rounded-2xl" style="background: var(--background-light); border: 1px solid var(--border-color);">
                <p class="text-sm break-words" style="color: var(--text-primary);">${message.text}</p>
                <span class="text-xs block mt-1 opacity-70" style="color: var(--text-secondary);">${time}</span>
            </div>
        `;
    }

    return bubble;
}

// Send message
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !currentConversationId || !currentChatUserId) return;

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    input.disabled = true;

    try {
        // Add message to subcollection
        const messagesRef = collection(db, shouldUseCustomToken ? `artifacts/${appId}/public/data/${COLL_CONVERSATIONS}/${currentConversationId}/${COLL_MESSAGES}` : `${COLL_CONVERSATIONS}/${currentConversationId}/${COLL_MESSAGES}`);
        await addDoc(messagesRef, {
            text,
            senderId: currentUser.uid,
            timestamp: serverTimestamp()
        });

        // Update conversation with last message
        const convRef = getDocPath(COLL_CONVERSATIONS, currentConversationId);
        const updateData = {
            lastMessage: text,
            lastMessageTime: serverTimestamp()
        };

        // Increment unread count for the other user
        updateData[`unreadCount.${currentChatUserId}`] = increment(1);

        await updateDoc(convRef, updateData);

        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Eroare la trimiterea mesajului', 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }
});

// Mark messages as read
async function markMessagesAsRead(conversationId) {
    if (!currentUser) return;

    try {
        const convRef = getDocPath(COLL_CONVERSATIONS, conversationId);
        await updateDoc(convRef, {
            [`unreadCount.${currentUser.uid}`]: 0
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// Start a new conversation (called from user profile)
window.startConversation = async (otherUserId) => {
    if (!currentUser || currentUser.uid === otherUserId) return;

    // Close the public profile modal first
    toggleModal('modal-public-profile', false);

    try {
        // Check if conversation already exists
        const q = query(
            getCollectionRef(COLL_CONVERSATIONS),
            where('participants', 'array-contains', currentUser.uid)
        );

        const snapshot = await getDocs(q);
        let existingConvId = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.participants.includes(otherUserId)) {
                existingConvId = doc.id;
            }
        });

        if (existingConvId) {
            // Open existing conversation
            await openConversation(existingConvId, otherUserId);
        } else {
            // Create new conversation
            const convData = {
                participants: [currentUser.uid, otherUserId],
                createdAt: serverTimestamp(),
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                unreadCount: {
                    [currentUser.uid]: 0,
                    [otherUserId]: 0
                }
            };

            const convRef = await addDoc(getCollectionRef(COLL_CONVERSATIONS), convData);
            await openConversation(convRef.id, otherUserId);
        }
    } catch (error) {
        console.error('Error starting conversation:', error);
        showToast('Eroare la deschiderea conversației', 'error');
    }
}

// Listen for unread messages and show badge
function listenForUnreadMessages() {
    if (!currentUser) return;

    const q = query(
        getCollectionRef(COLL_CONVERSATIONS),
        where('participants', 'array-contains', currentUser.uid)
    );

    onSnapshot(q, (snapshot) => {
        let totalUnread = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.unreadCount && data.unreadCount[currentUser.uid]) {
                totalUnread += data.unreadCount[currentUser.uid];
            }
        });

        const badge = document.getElementById('messages-badge');
        if (totalUnread > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

window.toggleModal = toggleModal;
window.showScreen = showScreen;
window.logout = () => {
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_phone');
    signOut(auth).then(() => window.location.reload());
};