// =====================================================
// NAVIGATION MODULE
// =====================================================

import { isSuperAdmin, getUserProfile, setCurrentCommentingPostId, setCurrentConversationId, setCurrentChatUserId, getUnsubscribeComments, getUnsubscribePublicProfilePosts, getUnsubscribeMessages } from '../core/state.js';
import { showToast } from './toast.js';

// Screen references
const screens = {
    login: null,
    feed: null,
    profile: null,
    admin: null,
    messages: null
};

// Callbacks for loading screen data
let callbacks = {
    loadPosts: null,
    setupInfiniteScroll: null,
    loadUserProfile: null,
    switchProfileTab: null,
    loadConversations: null,
    loadAdminDashboard: null,
    clearCreateImage: null,
    clearEditImage: null
};

/**
 * Initializes screen references
 */
export function initScreens() {
    screens.login = document.getElementById('screen-login');
    screens.feed = document.getElementById('screen-feed');
    screens.profile = document.getElementById('screen-profile');
    screens.admin = document.getElementById('screen-admin');
    screens.messages = document.getElementById('screen-messages');
}

/**
 * Registers callbacks for screen loading
 * @param {object} callbackFunctions - Object with callback functions
 */
export function registerCallbacks(callbackFunctions) {
    callbacks = { ...callbacks, ...callbackFunctions };
}

/**
 * Shows a screen and hides others
 * @param {string} screenName - Screen name ('login', 'feed', 'profile', 'messages', 'admin')
 */
export function showScreen(screenName) {
    // Hide all screens and modals
    Object.values(screens).forEach(el => {
        if (el && el.id.startsWith('screen')) {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    });

    // Hide modals
    document.querySelectorAll('[id^="modal-"]').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });

    // Hide bottom nav by default
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.classList.add('hidden');
    }

    // Reset all nav buttons to inactive state
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.add('opacity-60');
        b.classList.remove('opacity-100');
    });

    // Show requested screen
    if (screenName === 'login') {
        if (screens.login) {
            screens.login.classList.remove('hidden');
            screens.login.classList.add('flex');
            const emailInput = document.getElementById('input-email');
            if (emailInput) emailInput.focus();
        }
    } else if (screenName === 'feed') {
        if (screens.feed) {
            screens.feed.classList.remove('hidden');
            screens.feed.classList.add('flex');
        }
        if (bottomNav) bottomNav.classList.remove('hidden');
        const navHome = document.getElementById('nav-home');
        if (navHome) {
            navHome.classList.remove('opacity-60');
            navHome.classList.add('opacity-100');
        }
        if (callbacks.loadPosts) callbacks.loadPosts();
        if (callbacks.setupInfiniteScroll) callbacks.setupInfiniteScroll();
    } else if (screenName === 'profile') {
        if (screens.profile) {
            screens.profile.classList.remove('hidden');
            screens.profile.classList.add('flex');
        }
        if (bottomNav) bottomNav.classList.remove('hidden');
        const navProfile = document.getElementById('nav-profile');
        if (navProfile) {
            navProfile.classList.remove('opacity-60');
            navProfile.classList.add('opacity-100');
        }
        if (callbacks.loadUserProfile) callbacks.loadUserProfile();
        if (callbacks.switchProfileTab) callbacks.switchProfileTab('my-posts');
    } else if (screenName === 'messages') {
        if (screens.messages) {
            screens.messages.classList.remove('hidden');
            screens.messages.classList.add('flex');
        }
        if (bottomNav) bottomNav.classList.remove('hidden');
        const navMessages = document.getElementById('nav-messages');
        if (navMessages) {
            navMessages.classList.remove('opacity-60');
            navMessages.classList.add('opacity-100');
        }
        if (callbacks.loadConversations) callbacks.loadConversations();
    } else if (screenName === 'admin') {
        if (!isSuperAdmin()) {
            showToast('Acces interzis!', 'error');
            showScreen('feed');
            return;
        }
        if (screens.admin) {
            screens.admin.classList.remove('hidden');
            screens.admin.classList.add('flex');
        }
        if (bottomNav) bottomNav.classList.remove('hidden');
        const navAdmin = document.getElementById('nav-admin');
        if (navAdmin) {
            navAdmin.classList.remove('opacity-60');
            navAdmin.classList.add('opacity-100');
        }
        if (callbacks.loadAdminDashboard) callbacks.loadAdminDashboard();
    }
}

/**
 * Toggles modal visibility
 * @param {string} modalId - Modal element ID
 * @param {boolean} show - True to show, false to hide
 */
export function toggleModal(modalId, show) {
    const el = document.getElementById(modalId);
    if (!el) return;

    if (show) {
        el.classList.remove('hidden');
        el.classList.add('flex');

        // Handle specific modal opening logic
        if (modalId === 'modal-create') {
            const phoneInput = document.getElementById('post-phone');
            const userProfile = getUserProfile();
            if (phoneInput && userProfile?.phone) {
                phoneInput.value = userProfile.phone;
            }
            if (callbacks.clearCreateImage) callbacks.clearCreateImage();
        }
    } else {
        el.classList.add('hidden');
        el.classList.remove('flex');

        // Handle specific modal closing logic
        if (modalId === 'modal-edit') {
            if (callbacks.clearEditImage) callbacks.clearEditImage();
        }

        if (modalId === 'modal-comments') {
            const unsubscribe = getUnsubscribeComments();
            if (unsubscribe) unsubscribe();
            setCurrentCommentingPostId(null);
        }

        if (modalId === 'modal-public-profile') {
            const unsubscribe = getUnsubscribePublicProfilePosts();
            if (unsubscribe) unsubscribe();
        }

        if (modalId === 'modal-conversation') {
            const unsubscribe = getUnsubscribeMessages();
            if (unsubscribe) unsubscribe();
            setCurrentConversationId(null);
            setCurrentChatUserId(null);
        }
    }
}

/**
 * Opens a modal
 * @param {string} modalId - Modal element ID
 */
export function openModal(modalId) {
    toggleModal(modalId, true);
}

/**
 * Closes a modal
 * @param {string} modalId - Modal element ID
 */
export function closeModal(modalId) {
    toggleModal(modalId, false);
}

/**
 * Closes all modals
 */
export function closeAllModals() {
    document.querySelectorAll('[id^="modal-"]').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });
}
