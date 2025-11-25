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
    loadSearchHistory,
    initPostsModule
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

// Notifications module
import {
    initPushNotifications,
    requestNotificationPermission
} from './features/notifications.js';

// Businesses module
import {
    loadBusinesses,
    viewBusinessDetails,
    initBusinessDetailsModule
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

// Businesses
window.viewBusinessDetails = viewBusinessDetails;

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

// Notifications
window.requestNotificationPermission = requestNotificationPermission;

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
            clearCreateImage,
            clearEditImage,
            loadBusinesses
        });


        // Initialize all modules
        initProfileModule();
        initMessagingModule();
        initPostDetailsModule();
        initPushNotifications();
        initBusinessDetailsModule();
        initPostsModule();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                }).catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        }


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
