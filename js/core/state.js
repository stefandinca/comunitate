// =====================================================
// APPLICATION STATE MANAGEMENT
// =====================================================

// User state
let currentUser = null;
let userProfile = null;

// Firestore unsubscribe functions
let unsubscribePosts = null;
let unsubscribeMyPosts = null;
let unsubscribeInterested = null;
let unsubscribeSaved = null;
let unsubscribeComments = null;
let unsubscribeNotifs = null;
let unsubscribeConversations = null;
let unsubscribeMessages = null;
let unsubscribePublicProfilePosts = null;

// Current item IDs
let editingPostId = null;
let currentCommentingPostId = null;
let currentViewingPostId = null;
let currentConversationId = null;
let currentChatUserId = null;

// Pending files (for uploads)
let pendingAvatarFile = null;
let pendingPostImageFile = null;
let pendingEditPostImageFile = null;

// UI state
let isRegisterMode = false;
let activePostType = 'sale';
let activeProfileTab = 'my-posts';

// Pagination state
let lastVisiblePost = null;
let hasMorePosts = true;
let isLoadingMorePosts = false;
let allPostsCache = [];

// Filter & search state
let activeFilter = 'all';
let isSearching = false;
let searchHistory = [];

// Admin state
let adminPosts = [];
let adminUsers = [];
let adminAllPosts = [];

// ==================== USER STATE ====================

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function getUserProfile() {
    return userProfile;
}

export function setUserProfile(profile) {
    userProfile = profile;
}

export function isSuperAdmin() {
    return userProfile && userProfile.role === 'super-admin';
}

// ==================== UNSUBSCRIBE FUNCTIONS ====================

export function getUnsubscribePosts() {
    return unsubscribePosts;
}

export function setUnsubscribePosts(fn) {
    unsubscribePosts = fn;
}

export function getUnsubscribeMyPosts() {
    return unsubscribeMyPosts;
}

export function setUnsubscribeMyPosts(fn) {
    unsubscribeMyPosts = fn;
}

export function getUnsubscribeInterested() {
    return unsubscribeInterested;
}

export function setUnsubscribeInterested(fn) {
    unsubscribeInterested = fn;
}

export function getUnsubscribeSaved() {
    return unsubscribeSaved;
}

export function setUnsubscribeSaved(fn) {
    unsubscribeSaved = fn;
}

export function getUnsubscribeComments() {
    return unsubscribeComments;
}

export function setUnsubscribeComments(fn) {
    unsubscribeComments = fn;
}

export function getUnsubscribeNotifs() {
    return unsubscribeNotifs;
}

export function setUnsubscribeNotifs(fn) {
    unsubscribeNotifs = fn;
}

export function getUnsubscribeConversations() {
    return unsubscribeConversations;
}

export function setUnsubscribeConversations(fn) {
    unsubscribeConversations = fn;
}

export function getUnsubscribeMessages() {
    return unsubscribeMessages;
}

export function setUnsubscribeMessages(fn) {
    unsubscribeMessages = fn;
}

export function getUnsubscribePublicProfilePosts() {
    return unsubscribePublicProfilePosts;
}

export function setUnsubscribePublicProfilePosts(fn) {
    unsubscribePublicProfilePosts = fn;
}

// ==================== CURRENT ITEM IDS ====================

export function getEditingPostId() {
    return editingPostId;
}

export function setEditingPostId(id) {
    editingPostId = id;
}

export function getCurrentCommentingPostId() {
    return currentCommentingPostId;
}

export function setCurrentCommentingPostId(id) {
    currentCommentingPostId = id;
}

export function getCurrentViewingPostId() {
    return currentViewingPostId;
}

export function setCurrentViewingPostId(id) {
    currentViewingPostId = id;
}

export function getCurrentConversationId() {
    return currentConversationId;
}

export function setCurrentConversationId(id) {
    currentConversationId = id;
}

export function getCurrentChatUserId() {
    return currentChatUserId;
}

export function setCurrentChatUserId(id) {
    currentChatUserId = id;
}

// ==================== PENDING FILES ====================

export function getPendingAvatarFile() {
    return pendingAvatarFile;
}

export function setPendingAvatarFile(file) {
    pendingAvatarFile = file;
}

export function getPendingPostImageFile() {
    return pendingPostImageFile;
}

export function setPendingPostImageFile(file) {
    pendingPostImageFile = file;
}

export function getPendingEditPostImageFile() {
    return pendingEditPostImageFile;
}

export function setPendingEditPostImageFile(file) {
    pendingEditPostImageFile = file;
}

// ==================== UI STATE ====================

export function getIsRegisterMode() {
    return isRegisterMode;
}

export function setIsRegisterMode(mode) {
    isRegisterMode = mode;
}

export function getActivePostType() {
    return activePostType;
}

export function setActivePostType(type) {
    activePostType = type;
}

export function getActiveProfileTab() {
    return activeProfileTab;
}

export function setActiveProfileTab(tab) {
    activeProfileTab = tab;
}

// ==================== PAGINATION STATE ====================

export function getLastVisiblePost() {
    return lastVisiblePost;
}

export function setLastVisiblePost(post) {
    lastVisiblePost = post;
}

export function getHasMorePosts() {
    return hasMorePosts;
}

export function setHasMorePosts(hasMore) {
    hasMorePosts = hasMore;
}

export function getIsLoadingMorePosts() {
    return isLoadingMorePosts;
}

export function setIsLoadingMorePosts(isLoading) {
    isLoadingMorePosts = isLoading;
}

export function getAllPostsCache() {
    return allPostsCache;
}

export function setAllPostsCache(posts) {
    allPostsCache = posts;
}

export function addToPostsCache(posts) {
    allPostsCache = [...allPostsCache, ...posts];
}

export function clearPostsCache() {
    allPostsCache = [];
}

// ==================== FILTER & SEARCH STATE ====================

export function getActiveFilter() {
    return activeFilter;
}

export function setActiveFilter(filter) {
    activeFilter = filter;
}

export function getIsSearching() {
    return isSearching;
}

export function setIsSearching(searching) {
    isSearching = searching;
}

export function getSearchHistory() {
    return searchHistory;
}

export function setSearchHistory(history) {
    searchHistory = history;
}

export function addToSearchHistory(query) {
    searchHistory = searchHistory.filter(q => q !== query);
    searchHistory.unshift(query);
    if (searchHistory.length > 5) {
        searchHistory.pop();
    }
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

export function loadSearchHistory() {
    const history = localStorage.getItem('searchHistory');
    if (history) {
        searchHistory = JSON.parse(history);
    }
}

// ==================== ADMIN STATE ====================

export function getAdminPosts() {
    return adminPosts;
}

export function setAdminPosts(posts) {
    adminPosts = posts;
}

export function getAdminUsers() {
    return adminUsers;
}

export function setAdminUsers(users) {
    adminUsers = users;
}

export function getAdminAllPosts() {
    return adminAllPosts;
}

export function setAdminAllPosts(posts) {
    adminAllPosts = posts;
}
