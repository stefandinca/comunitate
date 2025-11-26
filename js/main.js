// =====================================================
// MAIN ENTRY POINT - V2 Modular Architecture
// =====================================================

// Import all modules
import { initAuth, setupAuthListener, toggleAuthMode, loginWithGoogle, logout } from './core/auth.js';
import { initScreens, registerCallbacks, showScreen, toggleModal } from './ui/navigation.js';

// Posts module
import {
    filterPosts,
    loadPosts,
    loadMorePosts,
    toggleLike,
    toggleSave,
    toggleInterest,
    deletePost,
    contactViaWhatsApp,
    clearCreateImage,
    clearEditImage,
    toggleEventPrice,
    handleSearch,
    clearSearch,
    loadSearchHistory
} from './features/posts.js';

// Profile module
import {
    loadUserProfile,
    switchProfileTab,
    viewUserProfile,
    initProfileModule
} from './features/profile.js';

// Messaging module
import {
    loadConversations,
    openConversation,
    startConversation,
    initMessagingModule
} from './features/messaging.js';

// Post-details module
import {
    openPostDetails,
    openComments,
    openCommentsFromDetail,
    openEditModal,
    listenForNotifications,
    initPostDetailsModule
} from './features/post-details.js';

// Admin module
import {
    loadAdminDashboard,
    switchAdminTab,
    filterAdminPosts,
    searchAdminUsers,
    adminDeletePost,
    adminDeleteUser,
    adminToggleRole,
    adminDeleteComment
} from './features/admin.js';

// Businesses module
import {
    loadBusinesses,
    loadMoreBusinesses
} from './features/businesses.js';

// ==================== WINDOW EXPOSURES ====================
// Expose functions that are called from HTML onclick handlers

// Navigation
window.showScreen = showScreen;
window.toggleModal = toggleModal;

// Auth
window.toggleAuthMode = toggleAuthMode;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

// Posts
window.filterPosts = filterPosts;
window.loadMorePosts = loadMorePosts;
window.toggleLike = toggleLike;
window.toggleSave = toggleSave;
window.toggleInterest = toggleInterest;
window.deletePost = deletePost;
window.contactViaWhatsApp = contactViaWhatsApp;
window.clearCreateImage = clearCreateImage;
window.clearEditImage = clearEditImage;
window.toggleEventPrice = toggleEventPrice;

// Profile
window.switchProfileTab = switchProfileTab;
window.viewUserProfile = viewUserProfile;

// Messaging
window.openConversation = openConversation;
window.startConversation = startConversation;

// Post Details & Comments
window.openPostDetails = openPostDetails;
window.openComments = openComments;
window.openCommentsFromDetail = openCommentsFromDetail;
window.openEditModal = openEditModal;

// Admin
window.switchAdminTab = switchAdminTab;
window.filterAdminPosts = filterAdminPosts;
window.searchAdminUsers = searchAdminUsers;
window.adminDeletePost = adminDeletePost;
window.adminDeleteUser = adminDeleteUser;
window.adminToggleRole = adminToggleRole;
window.adminDeleteComment = adminDeleteComment;

// ==================== APPLICATION INITIALIZATION ====================

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('🚀 Initializing Corbeanca Community App v2...');
    initScreens();

    try {
        // Register navigation callbacks
        registerCallbacks({
            loadPosts,
            loadUserProfile,
            switchProfileTab,
            loadConversations,
            loadAdminDashboard,
            loadBusinesses,
            clearCreateImage,
            clearEditImage
        });


        // Initialize all modules
        initProfileModule();
        initMessagingModule();
        initPostDetailsModule();

        // Setup search functionality
        loadSearchHistory();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
        }

        const clearSearchBtn = document.getElementById('clear-search-btn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', clearSearch);
        }

        // Setup mobile category filter dropdown
        const postCategoryFilterMobile = document.getElementById('post-category-filter-mobile');
        if (postCategoryFilterMobile) {
            postCategoryFilterMobile.addEventListener('change', (e) => {
                filterPosts(e.target.value);
            });
        }

        // Initialize authentication (custom token if needed)
        await initAuth();

        // Setup auth state listener with navigation callbacks
        setupAuthListener(
            // onLogin callback
            (user) => {
                showScreen('feed');
                loadPosts();
                loadUserProfile();
                listenForNotifications();
            },
            // onLogout callback
            () => {
                showScreen('login');
            }
        );

        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing app:', error);
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ==================== EXPORTS ====================

export {
    loadPosts,
    loadUserProfile,
    loadConversations,
    loadAdminDashboard,
    listenForNotifications
};
