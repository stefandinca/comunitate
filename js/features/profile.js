// =====================================================
// PROFILE MODULE - User Profile & Posts Management
// =====================================================

// Firebase imports
import {
    query,
    where,
    orderBy,
    onSnapshot,
    getDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { ref, deleteObject } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';

// Internal imports
import { getCollectionRef, getDocPath, storage } from '../config/firebase-init.js';
import { COLL_POSTS, COLL_USERS } from '../config/constants.js';
import {
    getCurrentUser,
    getUserProfile,
    setUserProfile,
    getUnsubscribeMyPosts,
    setUnsubscribeMyPosts,
    getUnsubscribeInterested,
    setUnsubscribeInterested,
    getUnsubscribePublicProfilePosts,
    setUnsubscribePublicProfilePosts,
    getActiveProfileTab,
    setActiveProfileTab,
    getPendingAvatarFile,
    setPendingAvatarFile
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { uploadImage, compressImage } from '../utils/images.js';
import { timeAgo } from '../utils/helpers.js';

// Module-level variables for location (shared with maps)
let selectedAddress = 'Corbeanca, Romania';
let selectedLat = 44.6293;
let selectedLng = 26.0469;

// ==================== PROFILE LOADING ====================

/**
 * Load current user's profile into form fields
 */
export function loadUserProfile() {
    const userProfile = getUserProfile();
    if (!userProfile) return;

    document.getElementById('prof-name').value = userProfile.name || '';
    document.getElementById('prof-phone').value = userProfile.phone || '';
    document.getElementById('prof-email').value = userProfile.email || '';
    document.getElementById('prof-avatar-file').value = '';
    document.getElementById('profile-display-name').innerText = userProfile.name;

    const avatarEl = document.getElementById('profile-display-avatar');
    if (userProfile.avatar) {
        avatarEl.src = userProfile.avatar;
    } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${userProfile.name}&background=random`;
    }

    // Update selected location with user profile's location
    if (userProfile.location) {
        selectedAddress = userProfile.location.address;
        selectedLat = userProfile.location.lat;
        selectedLng = userProfile.location.lng;
    }
}

/**
 * Handle profile form submission
 * @param {Event} e - Form submit event
 */
export async function handleProfileFormSubmit(e) {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const userProfile = getUserProfile();
    if (!currentUser) return;

    const name = document.getElementById('prof-name').value;
    const phone = document.getElementById('prof-phone').value;
    const email = document.getElementById('prof-email').value;
    const btn = document.getElementById('btn-save-profile');
    const pendingAvatarFile = getPendingAvatarFile();

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round animate-spin">refresh</span> Se salvează...';

    try {
        const newData = { name, phone, email };

        // Handle avatar upload if there's a pending file
        if (pendingAvatarFile) {
            if (userProfile.avatarPath) {
                const oldRef = ref(storage, userProfile.avatarPath);
                await deleteObject(oldRef);
            }
            const { url, path } = await uploadImage(pendingAvatarFile, `avatars/${currentUser.uid}`);
            newData.avatar = url;
            newData.avatarPath = path;
        }

        // Handle location update
        if (selectedAddress && selectedLat && selectedLng) {
            newData.location = {
                address: selectedAddress,
                lat: selectedLat,
                lng: selectedLng
            };
        }

        await updateDoc(getDocPath(COLL_USERS, currentUser.uid), newData);

        const updatedProfile = { ...userProfile, ...newData };
        setUserProfile(updatedProfile);
        localStorage.setItem('user_name', name);

        loadUserProfile();
        showToast('Profil actualizat!');
        setPendingAvatarFile(null);
    } catch (e) {
        showToast('Eroare la salvare.', 'error');
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Salvează Modificările';
    }
}

/**
 * Setup avatar file input handler
 */
export function setupAvatarUpload() {
    const fileInput = document.getElementById('prof-avatar-file');
    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const compressedFile = await compressImage(file);
            setPendingAvatarFile(compressedFile);
            document.getElementById('profile-display-avatar').src = URL.createObjectURL(compressedFile);
            showToast('Fotografie încărcată. Salvează pentru a aplica.');
        } catch (error) {
            showToast('Eroare la procesarea imaginii', 'error');
            console.error(error);
        }
    });
}

// ==================== MY POSTS ====================

/**
 * Load current user's own posts
 */
export function loadMyPosts() {
    const unsubscribeMyPosts = getUnsubscribeMyPosts();
    if (unsubscribeMyPosts) unsubscribeMyPosts();

    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const myPostsContainer = document.getElementById('my-posts-container');
    const q = query(getCollectionRef(COLL_POSTS));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        myPostsContainer.innerHTML = '';
        const posts = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid === currentUser.uid) {
                posts.push({ id: doc.id, ...data });
            }
        });

        posts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if (posts.length === 0) {
            myPostsContainer.innerHTML = `<div class="text-center py-6 text-gray-400 text-sm">Nu ai publicat nimic încă.</div>`;
            return;
        }

        posts.forEach(post => myPostsContainer.appendChild(createMyPostCard(post)));
    });

    setUnsubscribeMyPosts(unsubscribe);
}

/**
 * Load events user is interested in
 */
export function loadInterestedEvents() {
    const unsubscribeInterested = getUnsubscribeInterested();
    if (unsubscribeInterested) unsubscribeInterested();

    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const q = query(
        getCollectionRef(COLL_POSTS),
        where('interestedUsers', 'array-contains', currentUser.uid)
    );
    const container = document.getElementById('interested-container');

    container.innerHTML = '<div class="text-center py-4"><span class="material-icons-round animate-spin text-gray-300">refresh</span></div>';

    const unsubscribe = onSnapshot(q, (snapshot) => {
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

        // Import createEventCard from posts module - for now, create inline
        posts.forEach(post => container.appendChild(createEventCardSimple(post)));
    });

    setUnsubscribeInterested(unsubscribe);
}

/**
 * Create simple event card for interested events
 * @param {Object} post - Post data
 * @returns {HTMLElement} Event card element
 */
function createEventCardSimple(post) {
    const div = document.createElement('div');
    div.className = "bg-white border border-gray-100 p-4 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow";
    div.onclick = () => window.openPostDetails(post.id);

    const eventDateObj = new Date(post.eventDate);
    const dateStr = eventDateObj.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
    const priceInfo = post.isFree ? 'Gratuit' : `${post.price} RON`;

    div.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <h4 class="font-bold text-gray-800 mb-2">${post.title}</h4>
                <div class="flex flex-col gap-1.5">
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                        <span class="material-icons-round text-sm">calendar_today</span>
                        <span>${dateStr} • ${post.eventTime}</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                        <span class="material-icons-round text-sm">location_on</span>
                        <span>${post.eventLocation || 'Corbeanca'}</span>
                    </div>
                </div>
            </div>
            <span class="px-3 py-1 text-xs font-bold rounded-lg ${post.isFree ? 'bg-green-50 text-green-600' : 'bg-brand-secondary text-brand-primary'}">${priceInfo}</span>
        </div>
    `;

    return div;
}

/**
 * Create a card for user's own posts (mini version)
 * @param {Object} post - Post data
 * @returns {HTMLElement} Post card element
 */
function createMyPostCard(post) {
    const div = document.createElement('div');
    div.className = "bg-white border border-gray-100 p-4 rounded-2xl flex justify-between items-center shadow-sm";
    div.innerHTML = `
        <div class="flex-1">
            <h4 class="font-bold text-gray-800">${post.title}</h4>
            <p class="text-xs text-gray-400 mt-1 uppercase font-bold">${post.type === 'event' ? 'Eveniment' : 'Vânzare'}</p>
        </div>
        <div class="flex gap-2">
            <button onclick="window.openEditModal('${post.id}')" class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100">
                <span class="material-icons-round text-sm">edit</span>
            </button>
            <button onclick="window.deletePost('${post.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                <span class="material-icons-round text-sm">delete</span>
            </button>
        </div>
    `;
    return div;
}

// ==================== PROFILE TABS ====================

/**
 * Switch between profile tabs
 * @param {string} tab - Tab name ('my-posts' or 'interested')
 */
export function switchProfileTab(tab) {
    setActiveProfileTab(tab);

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

// ==================== PUBLIC PROFILE ====================

/**
 * View another user's public profile
 * @param {string} targetUid - User ID to view
 */
export async function viewUserProfile(targetUid) {
    if (!targetUid) return;
    const currentUser = getCurrentUser();

    window.toggleModal('modal-public-profile', true);
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
                    <button onclick="window.startConversation('${targetUid}')" class="glass-card px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 neon-glow" style="border-radius: var(--radius-full); color: var(--neon-cyan);">
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

        // Load user's posts
        const q = query(
            getCollectionRef(COLL_POSTS),
            where('uid', '==', targetUid)
        );

        const unsubscribePublicProfilePosts = getUnsubscribePublicProfilePosts();
        if (unsubscribePublicProfilePosts) unsubscribePublicProfilePosts();

        const unsubscribe = onSnapshot(q, (snapshot) => {
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
                div.className = "bg-gray-50 border border-gray-100 p-4 rounded-2xl flex justify-between items-center shadow-sm cursor-pointer hover:shadow-md transition-shadow";
                div.onclick = () => window.openPostDetails(post.id);

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

        setUnsubscribePublicProfilePosts(unsubscribe);

    } catch (error) {
        console.error("Error fetching public profile:", error);
        showToast("Eroare la încărcarea profilului", "error");
    }
}

// ==================== LOCATION HELPERS ====================

/**
 * Get selected location data
 * @returns {Object} Location object with address, lat, lng
 */
export function getSelectedLocation() {
    return {
        address: selectedAddress,
        lat: selectedLat,
        lng: selectedLng
    };
}

/**
 * Set selected location data
 * @param {string} address - Address string
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
export function setSelectedLocation(address, lat, lng) {
    selectedAddress = address;
    selectedLat = lat;
    selectedLng = lng;
}

/**
 * Initialize profile module
 */
export function initProfileModule() {
    // Setup avatar upload handler
    setupAvatarUpload();

    // Setup profile form submit handler
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileFormSubmit);
    }
}
