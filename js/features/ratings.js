// =====================================================
// RATINGS MODULE - Business Ratings System
// =====================================================

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import { db } from '../config/firebase-init.js';
import { getCurrentUser } from '../core/state.js';
import { showToast } from '../ui/toast.js';

// ==================== RATING COMPONENT ====================

/**
 * Create a star rating component
 * @param {number} averageRating - Average rating (0-5)
 * @param {number} ratingCount - Total number of ratings
 * @param {boolean} interactive - Whether stars are clickable
 * @param {string} postId - Post ID for interactive ratings
 * @returns {string} HTML string for rating component
 */
export function createRatingDisplay(averageRating = 0, ratingCount = 0, interactive = false, postId = null) {
    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHtml = '';

    // Full stars
    for (let i = 0; i < fullStars; i++) {
        if (interactive && postId) {
            starsHtml += `<span class="material-icons-round rating-star interactive" data-rating="${i + 1}" data-post-id="${postId}" style="color: #FFC107; font-size: 24px; cursor: pointer;">star</span>`;
        } else {
            starsHtml += `<span class="material-icons-round" style="color: #FFC107; font-size: 20px;">star</span>`;
        }
    }

    // Half star
    if (hasHalfStar) {
        if (interactive && postId) {
            starsHtml += `<span class="material-icons-round rating-star interactive" data-rating="${fullStars + 1}" data-post-id="${postId}" style="color: #FFC107; font-size: 24px; cursor: pointer;">star_half</span>`;
        } else {
            starsHtml += `<span class="material-icons-round" style="color: #FFC107; font-size: 20px;">star_half</span>`;
        }
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        if (interactive && postId) {
            starsHtml += `<span class="material-icons-round rating-star interactive" data-rating="${fullStars + (hasHalfStar ? 1 : 0) + i + 1}" data-post-id="${postId}" style="color: #E0E0E0; font-size: 24px; cursor: pointer;">star_border</span>`;
        } else {
            starsHtml += `<span class="material-icons-round" style="color: #E0E0E0; font-size: 20px;">star_border</span>`;
        }
    }

    const ratingText = averageRating > 0
        ? `${averageRating.toFixed(1)} ⭐ · ${ratingCount} ${ratingCount === 1 ? 'evaluare' : 'evaluări'}`
        : 'Fără evaluări';

    return `
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
                ${starsHtml}
            </div>
            <span class="text-sm font-semibold text-gray-600">${ratingText}</span>
        </div>
    `;
}

/**
 * Create interactive rating component for modal
 * @param {string} postId - Post ID
 * @param {number} userRating - User's current rating (0 if none)
 * @returns {string} HTML string for interactive rating
 */
export function createInteractiveRating(postId, userRating = 0) {
    let starsHtml = '';

    for (let i = 1; i <= 5; i++) {
        const filled = i <= userRating;
        starsHtml += `
            <span
                class="material-icons-round rating-star-interactive"
                data-rating="${i}"
                data-post-id="${postId}"
                style="color: ${filled ? '#FFC107' : '#E0E0E0'}; font-size: 32px; cursor: pointer; transition: all 0.2s;"
                onmouseover="this.style.color='#FFC107'"
                onmouseout="this.style.color='${filled ? '#FFC107' : '#E0E0E0'}'"
            >
                ${filled ? 'star' : 'star_border'}
            </span>
        `;
    }

    return `
        <div class="flex flex-col items-center gap-3 p-6 bg-gray-50 rounded-xl">
            <p class="text-sm font-bold text-gray-700 uppercase tracking-wide">Evaluează acest business</p>
            <div class="flex items-center gap-2" id="rating-stars-${postId}">
                ${starsHtml}
            </div>
            <p class="text-xs text-gray-500">${userRating > 0 ? `Ai acordat ${userRating} ${userRating === 1 ? 'stea' : 'stele'}` : 'Click pe stele pentru a evalua'}</p>
        </div>
    `;
}

// ==================== RATING OPERATIONS ====================

/**
 * Get user's rating for a post
 * @param {string} postId - Post ID
 * @returns {Promise<number>} User's rating (0 if none)
 */
export async function getUserRating(postId) {
    const user = getCurrentUser();
    if (!user) return 0;

    try {
        const ratingRef = doc(db, 'posts', postId, 'ratings', user.uid);
        const ratingSnap = await getDoc(ratingRef);

        if (ratingSnap.exists()) {
            return ratingSnap.data().rating || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting user rating:', error);
        return 0;
    }
}

/**
 * Get average rating and count for a post
 * @param {string} postId - Post ID
 * @returns {Promise<{average: number, count: number}>} Rating stats
 */
export async function getPostRatingStats(postId) {
    try {
        const ratingsRef = collection(db, 'posts', postId, 'ratings');
        const ratingsSnap = await getDocs(ratingsRef);

        if (ratingsSnap.empty) {
            return { average: 0, count: 0 };
        }

        let total = 0;
        ratingsSnap.forEach(doc => {
            total += doc.data().rating || 0;
        });

        const count = ratingsSnap.size;
        const average = total / count;

        return { average, count };
    } catch (error) {
        console.error('Error getting rating stats:', error);
        return { average: 0, count: 0 };
    }
}

/**
 * Submit or update a rating
 * @param {string} postId - Post ID
 * @param {number} rating - Rating value (1-5)
 */
export async function submitRating(postId, rating) {
    const user = getCurrentUser();
    if (!user) {
        showToast('Trebuie să fii autentificat pentru a evalua', 'error');
        return;
    }

    if (rating < 1 || rating > 5) {
        showToast('Rating invalid', 'error');
        return;
    }

    try {
        // Save user's rating
        const ratingRef = doc(db, 'posts', postId, 'ratings', user.uid);
        await setDoc(ratingRef, {
            rating: rating,
            userId: user.uid,
            timestamp: serverTimestamp()
        });

        // Recalculate average rating
        const stats = await getPostRatingStats(postId);

        // Update post document with new stats
        const postRef = doc(db, 'posts', postId);
        await setDoc(postRef, {
            averageRating: stats.average,
            ratingCount: stats.count
        }, { merge: true });

        showToast('Evaluare trimisă cu succes!', 'success');

        // Refresh the rating display
        await refreshRatingDisplay(postId);

    } catch (error) {
        console.error('Error submitting rating:', error);
        showToast('Eroare la trimiterea evaluării', 'error');
    }
}

/**
 * Refresh rating display after submission
 * @param {string} postId - Post ID
 */
async function refreshRatingDisplay(postId) {
    const stats = await getPostRatingStats(postId);
    const userRating = await getUserRating(postId);

    // Update stars in modal
    const starsContainer = document.getElementById(`rating-stars-${postId}`);
    if (starsContainer) {
        const stars = starsContainer.querySelectorAll('.rating-star-interactive');
        stars.forEach((star, index) => {
            const starRating = index + 1;
            const filled = starRating <= userRating;
            star.style.color = filled ? '#FFC107' : '#E0E0E0';
            star.textContent = filled ? 'star' : 'star_border';
            star.setAttribute('onmouseout', `this.style.color='${filled ? '#FFC107' : '#E0E0E0'}'`);
        });

        // Update text
        const textEl = starsContainer.parentElement.querySelector('p.text-xs');
        if (textEl) {
            textEl.textContent = userRating > 0
                ? `Ai acordat ${userRating} ${userRating === 1 ? 'stea' : 'stele'}`
                : 'Click pe stele pentru a evalua';
        }
    }

    // Update average rating display
    const avgContainer = document.getElementById(`avg-rating-${postId}`);
    if (avgContainer) {
        avgContainer.innerHTML = createRatingDisplay(stats.average, stats.count, false);
    }
}

/**
 * Initialize rating event listeners
 */
export function initRatings() {
    document.addEventListener('click', async (e) => {
        const star = e.target.closest('.rating-star-interactive');
        if (!star) return;

        const rating = parseInt(star.getAttribute('data-rating'));
        const postId = star.getAttribute('data-post-id');

        if (rating && postId) {
            await submitRating(postId, rating);
        }
    });
}

// Auto-initialize on module load
initRatings();
