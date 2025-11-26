// =====================================================
// POSTS MODULE - Feed, Cards, Search, Interactions
// =====================================================

// Firebase imports
import {
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { ref, deleteObject } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';

// Internal imports
import { getCollectionRef, getDocPath, storage } from '../config/firebase-init.js';
import { COLL_POSTS, COLL_USERS, COLL_COMMENTS, POSTS_PER_PAGE } from '../config/constants.js';
import {
    getCurrentUser,
    getUserProfile,
    getUnsubscribePosts,
    setUnsubscribePosts,
    getLastVisiblePost,
    setLastVisiblePost,
    getHasMorePosts,
    setHasMorePosts,
    getIsLoadingMorePosts,
    setIsLoadingMorePosts,
    getAllPostsCache,
    setAllPostsCache,
    getActiveFilter,
    setActiveFilter,
    getIsSearching,
    setIsSearching,
    getSearchHistory,
    setSearchHistory,
    isSuperAdmin
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { timeAgo, makeLinksClickable, getCategoryLabel } from '../utils/helpers.js';
import { uploadImage } from '../utils/images.js';

// ==================== FILTER & LOAD POSTS ====================

/**
 * Filter posts by type
 * @param {string} filterType - Post type filter ('all', 'sale', 'event', etc.)
 */
export function filterPosts(filterType) {
    setActiveFilter(filterType);

    // Update category pills UI (desktop)
    document.querySelectorAll('.category-pill').forEach(pill => {
        const pillCategory = pill.getAttribute('data-category');
        if (pillCategory === filterType || (filterType === 'all' && pillCategory === 'all')) {
            // Active state
            pill.classList.remove('bg-white', 'border', 'border-gray-200', 'text-gray-700');
            pill.classList.add('bg-brand-primary', 'text-white');
        } else {
            // Inactive state
            pill.classList.remove('bg-brand-primary', 'text-white');
            pill.classList.add('bg-white', 'border', 'border-gray-200', 'text-gray-700');
        }
    });

    // Update mobile dropdown
    const mobileDropdown = document.getElementById('post-category-filter-mobile');
    if (mobileDropdown) {
        mobileDropdown.value = filterType;
    }

    // Update category card UI (if any)
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
}

/**
 * Load posts from Firestore with optional filter
 */
export function loadPosts() {
    const unsubscribePosts = getUnsubscribePosts();
    if (unsubscribePosts) unsubscribePosts();

    // Reset pagination state
    setLastVisiblePost(null);
    setHasMorePosts(true);
    setAllPostsCache([]);

    const activeFilter = getActiveFilter();
    const feedContainer = document.getElementById('feed-container');

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
        feedContainer.innerHTML = '';
        const postsCache = [];

        snapshot.forEach(doc => {
            const post = { id: doc.id, ...doc.data(), _doc: doc };
            postsCache.push(post);
        });

        // Store last visible document for pagination
        if (snapshot.docs.length > 0) {
            setLastVisiblePost(snapshot.docs[snapshot.docs.length - 1]);
        }

        // Check if there might be more posts
        setHasMorePosts(snapshot.docs.length === POSTS_PER_PAGE);
        setAllPostsCache(postsCache);

        if (postsCache.length === 0) {
            feedContainer.innerHTML = `<div class="text-center py-10 text-gray-400">Nu sunt postări încă.</div>`;
            return;
        }

        renderPosts(postsCache);
        showLoadMoreButton();
    });

    setUnsubscribePosts(unsubscribe);
}

/**
 * Render posts to feed container
 * @param {Array} posts - Array of post objects
 */
export function renderPosts(posts) {
    const feedContainer = document.getElementById('feed-container');
    const isSearching = getIsSearching();

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

/**
 * Show "Load More" button
 */
export function showLoadMoreButton() {
    const feedContainer = document.getElementById('feed-container');
    const hasMorePosts = getHasMorePosts();

    // Remove existing button first
    const existingBtn = document.getElementById('load-more-btn');
    if (existingBtn) existingBtn.remove();

    if (!hasMorePosts) return;

    const loadMoreBtn = document.createElement('div');
    loadMoreBtn.id = 'load-more-btn';
    loadMoreBtn.className = 'flex justify-center py-6';
    loadMoreBtn.innerHTML = `
        <button onclick="window.loadMorePosts()" class="bg-brand-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-brand-primary-dark transition-colors flex items-center gap-2">
            <span id="load-more-text">Încarcă mai multe</span>
            <span class="material-icons-round">expand_more</span>
        </button>
    `;
    feedContainer.appendChild(loadMoreBtn);
}

/**
 * Load more posts (pagination)
 */
export async function loadMorePosts() {
    const isLoadingMorePosts = getIsLoadingMorePosts();
    const hasMorePosts = getHasMorePosts();
    const lastVisiblePost = getLastVisiblePost();
    const activeFilter = getActiveFilter();
    const allPostsCache = getAllPostsCache();
    const feedContainer = document.getElementById('feed-container');

    if (isLoadingMorePosts || !hasMorePosts || !lastVisiblePost) return;

    setIsLoadingMorePosts(true);
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
            setHasMorePosts(false);
        }

        if (snapshot.docs.length > 0) {
            setLastVisiblePost(snapshot.docs[snapshot.docs.length - 1]);

            const updatedCache = [...allPostsCache];

            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data(), _doc: doc };
                updatedCache.push(post);

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

            setAllPostsCache(updatedCache);
        }

        if (!getHasMorePosts()) {
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
        setHasMorePosts(true); // Allow retry
    } finally {
        setIsLoadingMorePosts(false);
        if (loadMoreText) {
            loadMoreText.textContent = 'Încarcă mai multe';
        }
    }
}

/**
 * Setup infinite scroll detection
 */
export function setupInfiniteScroll() {
    const scrollableParent = document.getElementById('screen-feed');
    if (!scrollableParent) return;

    const scrollListener = () => {
        const scrollTop = scrollableParent.scrollTop;
        const scrollHeight = scrollableParent.scrollHeight;
        const clientHeight = scrollableParent.clientHeight;

        // Trigger load when user is 200px from bottom
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            if (!getIsLoadingMorePosts() && getHasMorePosts()) {
                loadMorePosts();
            }
        }
    };

    scrollableParent.addEventListener('scroll', scrollListener);
}

// ==================== POST CARD CREATION ====================

/**
 * Create a standard post card
 * @param {Object} post - Post data object
 * @returns {HTMLElement} Post card element
 */
export function createPostCard(post) {
    const currentUser = getCurrentUser();
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
                <div class="post-author" onclick="event.stopPropagation(); window.viewUserProfile('${post.uid}')">
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
                <button onclick="event.stopPropagation(); window.contactViaWhatsApp('${post.authorPhone}', '${post.title.replace(/'/g, "\\'")}', '${post.authorName.replace(/'/g, "\\'")}', '${post.type}')" class="px-4 py-2 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2" style="background: #25D366;">
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
            <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); window.toggleLike('${post.id}')" id="like-btn-${post.id}">
                <span class="material-icons-round">${isLiked ? 'favorite' : 'favorite_border'}</span>
                <span>${likeCount} aprecieri</span>
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); window.openComments('${post.id}')">
                <span class="material-icons-round">chat_bubble_outline</span>
                <span>${commentCount} comentarii</span>
            </button>
            <button class="action-btn ml-auto ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); window.toggleSave('${post.id}')" id="save-btn-${post.id}">
                <span class="material-icons-round">${isSaved ? 'bookmark' : 'bookmark_border'}</span>
                <span class="text-xs">salveaza</span>
            </button>
        </div>
    `;

    // Add click handler to open details
    article.onclick = () => window.openPostDetails(post.id);

    return article;
}

/**
 * Create an event card
 * @param {Object} post - Event post data object
 * @returns {HTMLElement} Event card element
 */
export function createEventCard(post) {
    const currentUser = getCurrentUser();
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
            <div class="post-author" onclick="event.stopPropagation(); window.viewUserProfile('${post.uid}')">
                <img src="${avatarSrc}" alt="${post.authorName}">
                <div class="post-author-info">
                    <h4>${post.authorName}</h4>
                    <p>${date}</p>
                </div>
            </div>
            ${post.authorPhone ? `
                <button onclick="event.stopPropagation(); window.contactViaWhatsApp('${post.authorPhone}', '${post.title.replace(/'/g, "\\'")}', '${post.authorName.replace(/'/g, "\\'")}', 'event')" class="px-4 py-2 text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2" style="background: #25D366;">
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
            <button class="action-btn ${isInterested ? 'liked' : ''}" onclick="event.stopPropagation(); window.toggleInterest('${post.id}')" id="interest-btn-${post.id}">
                <span class="material-icons-round">${isInterested ? 'favorite' : 'favorite_border'}</span>
                <span>${interestedCount} aprecieri</span>
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); window.openComments('${post.id}')">
                <span class="material-icons-round">chat_bubble_outline</span>
                <span>${commentCount} comentarii</span>
            </button>
            <button class="action-btn ml-auto ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); window.toggleSave('${post.id}')" id="save-btn-${post.id}">
                <span class="material-icons-round">${isSaved ? 'bookmark' : 'bookmark_border'}</span>
                <span class="text-xs">salveaza</span>
            </button>
        </div>
    `;

    // Add click handler to open details
    article.onclick = () => window.openPostDetails(post.id);

    return article;
}

/**
 * Create a card for user's own posts
 * @param {Object} post - Post data object
 * @returns {HTMLElement} My post card element
 */
export function createMyPostCard(post) {
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

// ==================== POST INTERACTIONS ====================

/**
 * Toggle like on a post
 * @param {string} postId - Post document ID
 */
export async function toggleLike(postId) {
    const currentUser = getCurrentUser();
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

/**
 * Toggle save on a post
 * @param {string} postId - Post document ID
 */
export async function toggleSave(postId) {
    const currentUser = getCurrentUser();
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

/**
 * Toggle interest on an event
 * @param {string} postId - Post document ID
 */
export async function toggleInterest(postId) {
    const currentUser = getCurrentUser();
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

/**
 * Delete a post
 * @param {string} id - Post document ID
 */
export async function deletePost(id) {
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
}

// ==================== SEARCH FUNCTIONALITY ====================

/**
 * Handle search input
 * @param {Event} e - Input event
 */
export function handleSearch(e) {
    const query = e.target.value.trim();
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchHistoryContainer = document.getElementById('search-history');

    if (query.length > 0) {
        clearSearchBtn.classList.remove('hidden');
        searchHistoryContainer.classList.add('hidden');
    } else {
        clearSearchBtn.classList.add('hidden');
        renderSearchHistory();
    }
    performSearch(query);
}

/**
 * Clear search
 */
export function clearSearch() {
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    performSearch('');
    renderSearchHistory();
}

/**
 * Perform search for posts and users
 * @param {string} query - Search query string
 */
export async function performSearch(query) {
    const allPostsCache = getAllPostsCache();

    if (query.length === 0) {
        setIsSearching(false);
        renderPosts(allPostsCache);
        return;
    }

    setIsSearching(true);
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

/**
 * Render search results
 * @param {Array} posts - Filtered posts
 * @param {Array} users - Matched users
 */
export function renderSearchResults(posts, users) {
    const feedContainer = document.getElementById('feed-container');
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
            userCard.onclick = () => window.viewUserProfile(user.id);

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

/**
 * Save search query to history
 * @param {string} query - Search query
 */
export function saveSearchQuery(query) {
    let searchHistory = getSearchHistory();
    searchHistory = searchHistory.filter(q => q !== query);
    searchHistory.unshift(query);
    if (searchHistory.length > 5) {
        searchHistory.pop();
    }
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    setSearchHistory(searchHistory);
}

/**
 * Load search history from localStorage
 */
export function loadSearchHistory() {
    const history = localStorage.getItem('searchHistory');
    if (history) {
        setSearchHistory(JSON.parse(history));
    }
}

/**
 * Render search history dropdown
 */
export function renderSearchHistory() {
    const searchHistoryContainer = document.getElementById('search-history');
    const searchHistory = getSearchHistory();
    const searchInput = document.getElementById('search-input');

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

// ==================== WHATSAPP CONTACT ====================

/**
 * Contact author via WhatsApp
 * @param {string} phone - Phone number
 * @param {string} title - Post title
 * @param {string} authorName - Author name
 * @param {string} category - Post category
 */
export function contactViaWhatsApp(phone, title, authorName, category) {
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

    // Open WhatsApp with pre-filled message
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
}

// ==================== IMAGE UTILITIES ====================

/**
 * Clear create post image preview
 */
export function clearCreateImage() {
    document.getElementById('post-image').value = '';
    document.getElementById('post-image-preview').src = '';
    document.getElementById('post-image-preview-container').classList.add('hidden');
}

/**
 * Clear edit post image preview
 */
export function clearEditImage() {
    document.getElementById('edit-post-image').value = '';
    document.getElementById('edit-image-preview').src = '';
    document.getElementById('edit-image-preview-container').classList.add('hidden');
}

/**
 * Toggle event price field visibility
 */
export function toggleEventPrice() {
    const isPaid = document.getElementById('event-paid').checked;
    const priceInput = document.getElementById('event-price-input');
    if (isPaid) priceInput.classList.remove('hidden');
    else priceInput.classList.add('hidden');
}
