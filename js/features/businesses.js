// =====================================================
// BUSINESSES MODULE - Local Business Listings
// =====================================================

import {
    query,
    where,
    orderBy,
    limit,
    getDocs,
    startAfter
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import { getCollectionRef } from '../config/firebase-init.js';
import { COLL_POSTS, POSTS_PER_PAGE } from '../config/constants.js';
import {
    getCurrentUser,
    setLastVisiblePost,
    getLastVisiblePost,
    setHasMorePosts,
    getHasMorePosts
} from '../core/state.js';
import { renderBusinessPost } from './posts.js';

// ==================== LOAD BUSINESSES ====================

/**
 * Load businesses from Firestore
 */
export async function loadBusinesses() {
    console.log('Loading businesses...');
    const businessesContainer = document.getElementById('businesses-container');
    if (!businessesContainer) return;

    businessesContainer.innerHTML = '<div class="flex justify-center py-16"><span class="material-icons-round animate-spin text-3xl text-brand-primary">refresh</span></div>';

    try {
        // Query for business and local posts
        const q = query(
            getCollectionRef(COLL_POSTS),
            where('type', 'in', ['business', 'local']),
            orderBy('timestamp', 'desc'),
            limit(POSTS_PER_PAGE)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            businessesContainer.innerHTML = '<div class="text-center py-10 text-gray-400">Nu există afaceri locale încă.</div>';
            return;
        }

        businessesContainer.innerHTML = '';

        const businesses = [];
        snapshot.forEach(doc => {
            const business = { id: doc.id, ...doc.data() };
            businesses.push(business);
        });

        // Store last visible for pagination
        if (snapshot.docs.length > 0) {
            setLastVisiblePost(snapshot.docs[snapshot.docs.length - 1]);
        }

        setHasMorePosts(snapshot.docs.length === POSTS_PER_PAGE);

        renderBusinesses(businesses);

        // Show/hide load more button
        const loadMoreBtn = document.getElementById('load-more-businesses');
        if (loadMoreBtn) {
            if (getHasMorePosts()) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading businesses:', error);
        businessesContainer.innerHTML = '<div class="text-center py-10 text-red-500">Eroare la încărcarea afacerilor.</div>';
    }
}

/**
 * Load more businesses (pagination)
 */
export async function loadMoreBusinesses() {
    const lastVisible = getLastVisiblePost();
    if (!lastVisible) return;

    const businessesContainer = document.getElementById('businesses-container');
    if (!businessesContainer) return;

    try {
        const q = query(
            getCollectionRef(COLL_POSTS),
            where('type', 'in', ['business', 'local']),
            orderBy('timestamp', 'desc'),
            startAfter(lastVisible),
            limit(POSTS_PER_PAGE)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            setHasMorePosts(false);
            const loadMoreBtn = document.getElementById('load-more-businesses');
            if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
            return;
        }

        const businesses = [];
        snapshot.forEach(doc => {
            const business = { id: doc.id, ...doc.data() };
            businesses.push(business);
        });

        // Update last visible
        if (snapshot.docs.length > 0) {
            setLastVisiblePost(snapshot.docs[snapshot.docs.length - 1]);
        }

        setHasMorePosts(snapshot.docs.length === POSTS_PER_PAGE);

        renderBusinesses(businesses, true);

        // Update load more button
        const loadMoreBtn = document.getElementById('load-more-businesses');
        if (loadMoreBtn && !getHasMorePosts()) {
            loadMoreBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading more businesses:', error);
    }
}

/**
 * Render businesses to container
 * @param {Array} businesses - Array of business post objects
 * @param {boolean} append - Whether to append or replace content
 */
function renderBusinesses(businesses, append = false) {
    const container = document.getElementById('businesses-container');
    if (!container) return;

    if (!append) {
        container.innerHTML = '';
    }

    businesses.forEach(business => {
        const postEl = createBusinessCard(business);
        container.appendChild(postEl);
    });
}

/**
 * Create a business card element
 * @param {object} business - Business post object
 * @returns {HTMLElement} Business card element
 */
function createBusinessCard(business) {
    const article = document.createElement('article');
    article.className = 'post-card-new cursor-pointer';
    article.onclick = () => window.openPostDetails(business.id);

    const date = business.timestamp ? new Date(business.timestamp.seconds * 1000).toLocaleDateString('ro-RO') : '';
    const description = business.description || '';
    const truncatedDesc = description.length > 150
        ? description.substring(0, 150) + '...'
        : description;

    article.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <img src="/img/community-logo.png" alt="Comunitate Corbeanca" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                <div class="post-author-info">
                    <h4>Comunitate Corbeanca</h4>
                    <p>${date}</p>
                </div>
            </div>
        </div>

        ${business.image ? `<img src="${business.image}" class="post-image" alt="${business.title}">` : ''}

        <div class="post-content">
            <h3 class="post-title">${business.title}</h3>
            <p class="post-description">${truncatedDesc}</p>

            <span class="category-badge ${business.type}">${business.type === 'business' ? 'Afacere Locală' : 'Interes Local'}</span>
        </div>

        <div class="post-actions">
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 20px;">favorite_border</span>
                    <span class="text-sm font-semibold" style="color: var(--text-secondary);">${business.likeCount || 0}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 20px;">chat_bubble_outline</span>
                    <span class="text-sm font-semibold" style="color: var(--text-secondary);">${business.commentCount || 0}</span>
                </div>
            </div>
        </div>
    `;

    return article;
}

// Window exports for HTML onclick handlers
window.loadMoreBusinesses = loadMoreBusinesses;
