// =====================================================
// POST DETAILS MODULE - Detail Views, Comments, Notifications
// =====================================================

// Firebase imports
import {
    query,
    where,
    orderBy,
    onSnapshot,
    getDoc,
    updateDoc,
    addDoc,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { ref, deleteObject } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';

// Internal imports
import { getCollectionRef, getDocPath, storage } from '../config/firebase-init.js';
import { COLL_POSTS, COLL_COMMENTS } from '../config/constants.js';
import {
    getCurrentUser,
    getUserProfile,
    getUnsubscribeComments,
    setUnsubscribeComments,
    getCurrentCommentingPostId,
    setCurrentCommentingPostId,
    getCurrentViewingPostId,
    setCurrentViewingPostId,
    getEditingPostId,
    setEditingPostId,
    getPendingEditPostImageFile,
    setPendingEditPostImageFile,
    isSuperAdmin
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { timeAgo, makeLinksClickable } from '../utils/helpers.js';
import { uploadImage } from '../utils/images.js';

// Module-level variables for location (shared with maps and profile)
let selectedAddress = 'Corbeanca, Romania';
let selectedLat = 44.6293;
let selectedLng = 26.0469;

// ==================== POST DETAILS MODAL ====================

/**
 * Open post details modal
 * @param {string} postId - Post document ID
 */
export async function openPostDetails(postId) {
    if (!postId) return;
    setCurrentViewingPostId(postId);

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

        window.toggleModal('modal-post-details', true);
    } catch (error) {
        console.error('Error loading post details:', error);
        showToast('Eroare la încărcare', 'error');
    }
}

/**
 * Render sale/borrow post details
 * @param {Object} post - Post data
 * @param {HTMLElement} container - Container element
 */
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
            <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-xl transition-colors" onclick="window.viewUserProfile('${post.uid}')">
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

/**
 * Render event details
 * @param {Object} post - Post data
 * @param {HTMLElement} container - Container element
 */
function renderEventDetails(post, container) {
    const currentUser = getCurrentUser();
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
            <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-xl transition-colors" onclick="window.viewUserProfile('${post.uid}')">
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
                <button onclick="window.toggleInterest('${post.id}')" class="${btnClass} px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg">
                    <span class="material-icons-round">${btnIcon}</span>
                    ${btnText}
                </button>
            </div>
        </div>
    `;
}

/**
 * Render local interest post details
 * @param {Object} post - Post data
 * @param {HTMLElement} container - Container element
 */
function renderInteresLocalDetails(post, container) {
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

/**
 * Render business post details
 * @param {Object} post - Post data
 * @param {HTMLElement} container - Container element
 */
function renderBusinessDetails(post, container) {
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

/**
 * Open comments from detail modal
 */
export function openCommentsFromDetail() {
    const currentViewingPostId = getCurrentViewingPostId();
    if (currentViewingPostId) {
        openComments(currentViewingPostId);
    }
}

// ==================== COMMENTS ====================

/**
 * Open comments modal
 * @param {string} postId - Post document ID
 */
export function openComments(postId) {
    const currentUser = getCurrentUser();
    const userProfile = getUserProfile();
    if (!currentUser) return showToast('Trebuie să fii autentificat!', 'error');

    setCurrentCommentingPostId(postId);

    const userAvatar = userProfile?.avatar || `https://ui-avatars.com/api/?name=${userProfile?.name || 'U'}&background=random`;
    document.getElementById('comment-user-avatar').src = userAvatar;

    window.toggleModal('modal-comments', true);

    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '<div class="text-center py-4 text-gray-400"><span class="material-icons-round animate-spin">refresh</span></div>';

    const q = query(
        getCollectionRef(COLL_COMMENTS),
        where('postId', '==', postId)
    );

    const unsubscribeComments = getUnsubscribeComments();
    if (unsubscribeComments) unsubscribeComments();

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
                <img src="${avatar}" class="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100 cursor-pointer hover:opacity-80" onclick="window.viewUserProfile('${comment.uid}')">
                <div class="flex-1">
                    <div class="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-2 inline-block max-w-[90%] ${isMe ? 'bg-blue-50 text-blue-900' : 'text-gray-800'}">
                        <p class="text-[10px] font-bold text-gray-500 mb-0.5 cursor-pointer hover:underline" onclick="window.viewUserProfile('${comment.uid}')">${comment.authorName}</p>
                        <p class="text-sm leading-relaxed">${comment.text}</p>
                    </div>
                    <div class="flex items-center gap-2 mt-1 ml-2">
                        <p class="text-[10px] text-gray-300">acum ${timeAgo(new Date(comment.timestamp?.seconds * 1000))}</p>
                        ${isSuperAdmin() ? `<button onclick="window.adminDeleteComment('${postId}', '${comment.id}')" class="text-[10px] text-red-500 hover:text-red-700 font-bold ml-2">Delete</button>` : ''}
                    </div>
                </div>
            `;
            commentsList.appendChild(div);
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    });

    setUnsubscribeComments(unsubscribe);
}

/**
 * Handle comment form submission
 * @param {Event} e - Form submit event
 */
export async function handleCommentSubmit(e) {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const userProfile = getUserProfile();
    const currentCommentingPostId = getCurrentCommentingPostId();

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

    } catch (error) {
        console.error(error);
        showToast('Eroare la trimitere.', 'error');
    }
}

// ==================== EDIT POST ====================

/**
 * Open edit modal
 * @param {string} postId - Post document ID
 */
export async function openEditModal(postId) {
    setEditingPostId(postId);
    window.clearEditImage();

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

        window.toggleModal('modal-edit', true);
    } catch (error) {
        console.error('Error loading post for edit:', error);
        showToast('Eroare la încărcare', 'error');
    }
}

/**
 * Handle edit form submission
 * @param {Event} e - Form submit event
 */
export async function handleEditFormSubmit(e) {
    e.preventDefault();
    const editingPostId = getEditingPostId();
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

        const pendingEditPostImageFile = getPendingEditPostImageFile();
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
        window.toggleModal('modal-edit', false);
        setEditingPostId(null);
        setPendingEditPostImageFile(null);
    } catch (error) {
        console.error('Error updating post:', error);
        showToast('Eroare la actualizare', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Actualizează';
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

// ==================== MODULE INITIALIZATION ====================

/**
 * Initialize post-details module
 */
export function initPostDetailsModule() {
    // Setup comment form submit handler
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
    }

    // Setup edit form submit handler
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditFormSubmit);
    }
}
