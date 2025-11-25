// =====================================================
// DOM ELEMENT REFERENCES
// =====================================================

/**
 * Centralized DOM element references
 * This module provides cached references to frequently accessed DOM elements
 */

// ==================== SCREENS ====================

export const screens = {
    login: () => document.getElementById('screen-login'),
    feed: () => document.getElementById('screen-feed'),
    profile: () => document.getElementById('screen-profile'),
    admin: () => document.getElementById('screen-admin'),
    messages: () => document.getElementById('screen-messages')
};

// ==================== MODALS ====================

export const modals = {
    create: () => document.getElementById('modal-create'),
    edit: () => document.getElementById('modal-edit'),
    comments: () => document.getElementById('modal-comments'),
    notifications: () => document.getElementById('modal-notifications'),
    publicProfile: () => document.getElementById('modal-public-profile'),
    locationPicker: () => document.getElementById('modal-location-picker'),
    postDetails: () => document.getElementById('modal-post-details'),
    conversation: () => document.getElementById('modal-conversation')
};

// ==================== CONTAINERS ====================

export const containers = {
    feed: () => document.getElementById('feed-container'),
    myPosts: () => document.getElementById('my-posts-container'),
    interested: () => document.getElementById('interested-container'),
    conversations: () => document.getElementById('conversations-container'),
    messages: () => document.getElementById('messages-container'),
    commentsList: () => document.getElementById('comments-list'),
    notifList: () => document.getElementById('notif-list'),
    searchHistory: () => document.getElementById('search-history')
};

// ==================== FORMS ====================

export const forms = {
    login: () => document.getElementById('login-form'),
    create: () => document.getElementById('create-form'),
    edit: () => document.getElementById('edit-form'),
    profile: () => document.getElementById('profile-form'),
    comment: () => document.getElementById('comment-form'),
    message: () => document.getElementById('message-form')
};

// ==================== INPUT FIELDS ====================

export const inputs = {
    searchInput: () => document.getElementById('search-input'),
    clearSearchBtn: () => document.getElementById('clear-search-btn'),
    messageInput: () => document.getElementById('message-input'),
    commentInput: () => document.getElementById('comment-input')
};

// ==================== DISPLAY ELEMENTS ====================

export const display = {
    userDisplayName: () => document.getElementById('user-display-name'),
    profileDisplayName: () => document.getElementById('profile-display-name'),
    profileDisplayAvatar: () => document.getElementById('profile-display-avatar'),
    notifBadge: () => document.getElementById('notif-badge'),
    messagesBadge: () => document.getElementById('messages-badge')
};

// ==================== HELPER FUNCTION ====================

/**
 * Get element by ID with error handling
 * @param {string} id - Element ID
 * @param {boolean} required - Whether element is required (throws error if missing)
 * @returns {HTMLElement|null} The element or null
 */
export function getElement(id, required = false) {
    const element = document.getElementById(id);
    if (required && !element) {
        console.error(`Required element with ID "${id}" not found`);
    }
    return element;
}

/**
 * Get all elements matching a selector
 * @param {string} selector - CSS selector
 * @returns {NodeList} List of matching elements
 */
export function getAllElements(selector) {
    return document.querySelectorAll(selector);
}
