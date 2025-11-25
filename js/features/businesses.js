import { getDocuments, getDocument, orderBy, where } from '../core/api.js';
import { setCurrentBusinessId, getCurrentBusinessId, getUserProfile, getCurrentUser } from '../core/state.js';
import { uploadImage } from '../utils/images.js';

function createBusinessCard(business) {
    const { id, name, category, coverImage, averageRating, reviewCount } = business;
    const rating = averageRating ? `${averageRating.toFixed(1)}/5` : 'N/A';
    const reviews = reviewCount ? `${reviewCount} recenzii` : 'Fără recenzii';

    return `
        <div class="glass-card p-4 flex gap-4 items-center" data-id="${id}">
            <img src="${coverImage || 'img/corbeanca-community-logo.png'}" class="w-24 h-24 rounded-lg object-cover bg-gray-200">
            <div class="flex-1">
                <h3 class="font-bold text-lg text-gray-900">${name}</h3>
                <p class="text-sm text-gray-600">${category}</p>
                <div class="flex items-center gap-2 mt-2">
                    <span class="material-icons-round text-yellow-500" style="font-size: 18px;">star</span>
                    <span class="font-bold text-sm">${rating}</span>
                    <span class="text-xs text-gray-500">(${reviews})</span>
                </div>
            </div>
            <button class="bg-brand-primary text-white px-4 py-2 rounded-lg font-bold text-sm" onclick="viewBusinessDetails('${id}')">
                Detalii
            </button>
        </div>
    `;
}

function renderBusinessDetails(business, reviews) {
    const detailsContainer = document.getElementById('business-details-content');
    const reviewsContainer = document.getElementById('business-reviews-container');
    const nameHeader = document.getElementById('business-details-name');

    if (!detailsContainer || !reviewsContainer || !nameHeader) return;

    nameHeader.textContent = business.name;

    detailsContainer.innerHTML = `
        <img src="${business.coverImage || 'img/corbeanca-community-logo.png'}" class="w-full h-48 rounded-lg object-cover bg-gray-200 mb-4">
        <p class="text-gray-600 mb-4">${business.description}</p>
        <div class="space-y-2">
            <p><span class="font-bold">Adresă:</span> ${business.address}</p>
            <p><span class="font-bold">Telefon:</span> ${business.phone}</p>
            <p><span class="font-bold">Website:</span> <a href="${business.website}" target="_blank" class="text-brand-primary hover:underline">${business.website}</a></p>
        </div>
    `;

    if (reviews.length === 0) {
        reviewsContainer.innerHTML = '<p class="text-gray-500">Nu sunt recenzii pentru această afacere.</p>';
        return;
    }

    reviewsContainer.innerHTML = reviews.map(review => `
        <div class="glass-card p-4">
            <div class="flex items-center mb-2">
                <p class="font-bold">${review.authorName}</p>
                <div class="flex items-center ml-auto">
                    <span class="font-bold text-sm">${review.rating}/5</span>
                    <span class="material-icons-round text-yellow-500" style="font-size: 18px;">star</span>
                </div>
            </div>
            <p class="text-gray-700">${review.text}</p>
        </div>
    `).join('');
}

export async function loadBusinesses(filter = 'all', search = '') {
    const businessesContainer = document.getElementById('businesses-container');
    if (!businessesContainer) return;

    businessesContainer.innerHTML = '<div class="flex justify-center py-16"><span class="material-icons-round animate-spin text-3xl text-brand-primary">refresh</span></div>';

    try {
        const queryConstraints = [orderBy('createdAt', 'desc')];
        if (filter !== 'all') {
            queryConstraints.push(where('category', '==', filter));
        }
        if (search) {
            queryConstraints.push(where('name', '>=', search), where('name', '<=', search + '\uf8ff'));
        }

        const businesses = await getDocuments('businesses', ...queryConstraints);
        
        if (businesses.length === 0) {
            businessesContainer.innerHTML = '<p class="text-center text-gray-500">Niciun rezultat găsit.</p>';
            return;
        }

        businessesContainer.innerHTML = businesses.map(createBusinessCard).join('');
    } catch (error) {
        console.error("Error loading businesses:", error);
        businessesContainer.innerHTML = '<p class="text-center text-red-500">A apărut o eroare la încărcarea afacerilor.</p>';
    }
}

export async function viewBusinessDetails(businessId) {
    setCurrentBusinessId(businessId);

    const detailsContainer = document.getElementById('business-details-content');
    const reviewsContainer = document.getElementById('business-reviews-container');

    if (!detailsContainer || !reviewsContainer) return;

    detailsContainer.innerHTML = '<div class="flex justify-center py-16"><span class="material-icons-round animate-spin text-3xl text-brand-primary">refresh</span></div>';
    reviewsContainer.innerHTML = '';
    
    const { showScreen } = await import('../ui/navigation.js');
    showScreen('business-details');

    try {
        const businessResult = await getDocument('businesses', businessId);
        if (!businessResult.exists) {
            throw new Error('Business not found');
        }
        
        const reviews = await getDocuments(`businesses/${businessId}/reviews`, orderBy('createdAt', 'desc'));
        
        renderBusinessDetails(businessResult.data, reviews);

    } catch (error) {
        console.error("Error viewing business details:", error);
        detailsContainer.innerHTML = '<p class="text-center text-red-500">A apărut o eroare la încărcarea detaliilor.</p>';
    }
}

async function submitReview(businessId, rating, text) {
    const user = getCurrentUser();
    const profile = getUserProfile();

    if (!user || !profile) {
        throw new Error("User not logged in");
    }

    const { runTransaction, db, doc, serverTimestamp } = await import('../core/api.js');
    const businessRef = doc(db, 'businesses', businessId);
    const reviewRef = doc(db, 'businesses', businessId, 'reviews', user.uid);

    return runTransaction(db, async (transaction) => {
        const businessDoc = await transaction.get(businessRef);
        if (!businessDoc.exists()) {
            throw "Business does not exist!";
        }

        const businessData = businessDoc.data();
        const oldRatingTotal = (businessData.averageRating || 0) * (businessData.reviewCount || 0);
        const newReviewCount = (businessData.reviewCount || 0) + 1;
        const newAverageRating = (oldRatingTotal + rating) / newReviewCount;

        transaction.set(reviewRef, {
            rating,
            text,
            authorUid: user.uid,
            authorName: profile.name,
            createdAt: serverTimestamp()
        });

        transaction.update(businessRef, {
            reviewCount: newReviewCount,
            averageRating: newAverageRating
        });
    });
}

function initBusinessSearch() {
    const searchInput = document.getElementById('business-search-input');
    const categoryFilter = document.getElementById('business-category-filter');

    const performLoad = () => {
        const searchValue = searchInput.value.trim();
        const filterValue = categoryFilter.value;
        loadBusinesses(filterValue, searchValue);
    };

    if (searchInput) {
        searchInput.addEventListener('input', performLoad);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', performLoad);
    }
}

export function initBusinessDetailsModule() {
    initBusinessSearch();
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        // Star rating handler
        const stars = reviewForm.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.dataset.value);
                document.getElementById('review-rating').value = rating;
                stars.forEach(s => {
                    const sValue = parseInt(s.dataset.value);
                    if (sValue <= rating) {
                        s.textContent = 'star';
                        s.classList.add('text-yellow-500');
                    } else {
                        s.textContent = 'star_outline';
                        s.classList.remove('text-yellow-500');
                    }
                });
            });
        });

        // Form submission handler
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = parseInt(document.getElementById('review-rating').value);
            const text = document.getElementById('review-text').value;
            const businessId = getCurrentBusinessId();

            if (rating === 0 || !text || !businessId) {
                alert('Vă rugăm să acordați o notă și să scrieți o recenzie.');
                return;
            }

            try {
                await submitReview(businessId, rating, text);
                reviewForm.reset();
                stars.forEach(s => {
                    s.textContent = 'star_outline';
                    s.classList.remove('text-yellow-500');
                });
                // Refresh reviews
                viewBusinessDetails(businessId);
            } catch (error) {
                console.error("Error submitting review:", error);
                alert('A apărut o eroare la trimiterea recenziei.');
            }
        });
    }
}

export async function createBusiness() {
    const name = document.getElementById('business-name').value;
    const category = document.getElementById('business-category').value;
    const address = document.getElementById('business-address').value;
    const website = document.getElementById('business-website').value;
    const description = document.getElementById('post-desc').value;
    const phone = document.getElementById('post-phone').value;
    const imageFile = document.getElementById('post-image').files[0];
    
    const user = getCurrentUser();

    if (!name || !category || !address || !description || !phone) {
        alert('Please fill all required fields');
        return;
    }

    try {
        let imageUrl = '';
        let imagePath = '';
        if (imageFile) {
            const { url, path } = await uploadImage(imageFile, 'business-images');
            imageUrl = url;
            imagePath = path;
        }

        const businessData = {
            name,
            category,
            address,
            website,
            description,
            phone,
            coverImage: imageUrl,
            imagePath: imagePath,
            ownerUid: user.uid,
            averageRating: 0,
            reviewCount: 0,
        };

        const { createDocument } = await import('../core/api.js');
        await createDocument('businesses', businessData);
        alert('Business created successfully!');
        
        const { toggleModal } = await import('../ui/navigation.js');
        toggleModal('modal-create', false);
        loadBusinesses();
    } catch (error) {
        console.error("Error creating business:", error);
        alert('Error creating business.');
    }
}

