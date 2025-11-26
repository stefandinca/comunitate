// =====================================================
// ADMIN MODULE - Dashboard, Moderation, User Management
// =====================================================

// Firebase imports
import {
    collection,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    updateDoc,
    doc
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Internal imports
import { db, getDocPath, getCollectionRef } from '../config/firebase-init.js';
import { COLL_POSTS, COLL_USERS, COLL_COMMENTS } from '../config/constants.js';
import {
    getCurrentUser,
    getAdminPosts,
    setAdminPosts,
    getAdminUsers,
    setAdminUsers,
    getAdminAllPosts,
    setAdminAllPosts,
    getCurrentCommentingPostId,
    isSuperAdmin
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { timeAgo, getCategoryLabel } from '../utils/helpers.js';

// ==================== ADMIN DASHBOARD ====================

/**
 * Load admin dashboard data
 */
export async function loadAdminDashboard() {
    if (!isSuperAdmin()) return;

    try {
        // Load all posts
        const postsQuery = query(collection(db, COLL_POSTS), orderBy('timestamp', 'desc'));
        const postsSnap = await getDocs(postsQuery);
        const allPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setAdminAllPosts(allPosts);
        setAdminPosts([...allPosts]);

        // Load all users
        const usersQuery = query(collection(db, COLL_USERS));
        const usersSnap = await getDocs(usersQuery);
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAdminUsers(users);

        // Count comments from top-level collection
        const commentsQuery = query(getCollectionRef(COLL_COMMENTS));
        const commentsSnap = await getDocs(commentsQuery);
        const totalComments = commentsSnap.size;

        // Update stats
        document.getElementById('admin-total-posts').textContent = allPosts.length;
        document.getElementById('admin-total-users').textContent = users.length;
        document.getElementById('admin-total-comments').textContent = totalComments;

        // Render posts
        renderAdminPosts();
        switchAdminTab('posts');
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showToast('Eroare la încărcarea dashboard-ului', 'error');
    }
}

// ==================== TAB SWITCHING ====================

/**
 * Switch admin dashboard tabs
 * @param {string} tabName - Tab name ('posts', 'users', 'reports')
 */
export function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('[id^="admin-tab-"]').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-tertiary)';
        btn.style.border = 'none';
    });

    const activeTab = document.getElementById(`admin-tab-${tabName}`);
    if (activeTab) {
        activeTab.style.background = 'var(--glass-medium)';
        activeTab.style.color = 'var(--neon-cyan)';
        activeTab.style.border = '1px solid var(--neon-cyan)';
    }

    // Show/hide tab content
    document.getElementById('admin-posts-tab')?.classList.add('hidden');
    document.getElementById('admin-users-tab')?.classList.add('hidden');
    document.getElementById('admin-reports-tab')?.classList.add('hidden');

    document.getElementById(`admin-${tabName}-tab`)?.classList.remove('hidden');

    // Load data
    if (tabName === 'posts') {
        renderAdminPosts();
    } else if (tabName === 'users') {
        renderAdminUsers();
    }
}

// ==================== POSTS MANAGEMENT ====================

/**
 * Filter admin posts by type
 */
export function filterAdminPosts() {
    const adminAllPosts = getAdminAllPosts();
    const filter = document.getElementById('admin-posts-filter')?.value;

    if (filter === 'all') {
        setAdminPosts([...adminAllPosts]);
    } else {
        setAdminPosts(adminAllPosts.filter(p => p.type === filter));
    }
    renderAdminPosts();
}

/**
 * Render admin posts list
 */
export function renderAdminPosts() {
    const adminPosts = getAdminPosts();
    const container = document.getElementById('admin-posts-list');
    if (!container) return;

    container.innerHTML = '';

    if (adminPosts.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Nu există postări</p>';
        return;
    }

    adminPosts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'glass-card p-4 flex items-start gap-4 cursor-pointer neon-glow';
        postEl.style.transition = 'var(--transition-smooth)';
        const timestamp = post.timestamp ? timeAgo(new Date(post.timestamp.seconds * 1000)) : 'Recent';
        postEl.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="font-bold text-base truncate" style="color: var(--text-primary);">${post.title}</div>
                <div class="text-xs mt-2" style="color: var(--text-secondary);">${getCategoryLabel(post.type)} • ${post.authorName}</div>
                <div class="text-xs mt-1" style="color: var(--text-tertiary);">${timestamp}</div>
            </div>
            <button onclick="window.adminDeletePost('${post.id}')" class="glass-card p-2.5 rounded-full transition-all hover:scale-110 flex-shrink-0" style="background: rgba(247, 37, 133, 0.2); border: 1px solid var(--neon-pink);">
                <span class="material-icons-round text-sm" style="color: var(--neon-pink);">delete</span>
            </button>
        `;

        // Add click handler to open post details
        postEl.onclick = (e) => {
            // Don't open details if clicking delete button
            if (e.target.closest('button')) return;
            window.openPostDetails(post.id);
        };

        container.appendChild(postEl);
    });
}

/**
 * Delete a post (admin only)
 * @param {string} postId - Post document ID
 */
export async function adminDeletePost(postId) {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    if (!confirm('Sigur vrei să ștergi această postare?')) return;

    try {
        await deleteDoc(getDocPath(COLL_POSTS, postId));

        const adminPosts = getAdminPosts();
        const adminAllPosts = getAdminAllPosts();

        setAdminPosts(adminPosts.filter(p => p.id !== postId));
        setAdminAllPosts(adminAllPosts.filter(p => p.id !== postId));

        renderAdminPosts();
        document.getElementById('admin-total-posts').textContent = getAdminAllPosts().length;
        showToast('Postare ștearsă cu succes', 'success');
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Eroare la ștergerea postării', 'error');
    }
}

// ==================== USERS MANAGEMENT ====================

/**
 * Search admin users
 */
export function searchAdminUsers() {
    const searchTerm = document.getElementById('admin-users-search')?.value.toLowerCase() || '';
    renderAdminUsers(searchTerm);
}

/**
 * Render admin users list
 * @param {string} searchTerm - Optional search term
 */
export function renderAdminUsers(searchTerm = '') {
    const currentUser = getCurrentUser();
    const adminUsers = getAdminUsers();
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    container.innerHTML = '';

    let filteredUsers = adminUsers;
    if (searchTerm) {
        filteredUsers = adminUsers.filter(u =>
            u.name?.toLowerCase().includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredUsers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">Nu există utilizatori</p>';
        return;
    }

    filteredUsers.forEach(user => {
        const isAdmin = user.role === 'super-admin';
        const isCurrent = user.id === currentUser.uid;
        const userEl = document.createElement('div');
        userEl.className = 'glass-card p-4 flex items-center gap-4';
        userEl.innerHTML = `
            <div class="w-14 h-14 rounded-full p-0.5 flex-shrink-0 neon-glow" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));">
                <img src="${user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}" class="w-full h-full rounded-full object-cover" style="border: 2px solid var(--carbon);">
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-bold text-base truncate flex items-center gap-2" style="color: var(--text-primary);">
                    ${user.name}
                    ${isAdmin ? '<span class="text-[10px] font-bold uppercase px-3 py-1 rounded-full" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple)); color: var(--void-black);">Admin</span>' : ''}
                    ${isCurrent ? '<span class="text-[10px] font-bold uppercase px-3 py-1 rounded-full glass-card" style="color: var(--text-secondary);">You</span>' : ''}
                </div>
                <div class="text-xs truncate mt-1" style="color: var(--text-secondary);">${user.email}</div>
                <div class="text-xs mt-0.5" style="color: var(--text-tertiary);">${user.phone || 'No phone'}</div>
            </div>
            ${!isCurrent ? `
                <div class="flex gap-2 flex-shrink-0">
                    ${!isAdmin ? `<button onclick="window.adminToggleRole('${user.id}')" class="glass-card px-4 py-2 rounded-full transition-all hover:scale-105 text-xs font-bold" style="background: rgba(0, 240, 255, 0.2); border: 1px solid var(--neon-cyan); color: var(--neon-cyan);">
                        Make Admin
                    </button>` : ''}
                    <button onclick="window.adminDeleteUser('${user.id}')" class="glass-card p-2.5 rounded-full transition-all hover:scale-110" style="background: rgba(247, 37, 133, 0.2); border: 1px solid var(--neon-pink);">
                        <span class="material-icons-round text-sm" style="color: var(--neon-pink);">delete</span>
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(userEl);
    });
}

/**
 * Delete a user (admin only)
 * @param {string} userId - User document ID
 */
export async function adminDeleteUser(userId) {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    if (!confirm('Sigur vrei să ștergi acest utilizator? Această acțiune este ireversibilă!')) return;

    try {
        const adminAllPosts = getAdminAllPosts();

        // Delete user's posts
        const userPosts = adminAllPosts.filter(p => p.authorId === userId);
        for (const post of userPosts) {
            await deleteDoc(getDocPath(COLL_POSTS, post.id));
        }

        // Delete user document
        await deleteDoc(getDocPath(COLL_USERS, userId));

        const adminUsers = getAdminUsers();
        setAdminUsers(adminUsers.filter(u => u.id !== userId));
        setAdminAllPosts(adminAllPosts.filter(p => p.authorId !== userId));

        renderAdminUsers();
        document.getElementById('admin-total-users').textContent = getAdminUsers().length;
        document.getElementById('admin-total-posts').textContent = getAdminAllPosts().length;
        showToast('Utilizator șters cu succes', 'success');
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Eroare la ștergerea utilizatorului', 'error');
    }
}

/**
 * Toggle user role (make admin)
 * @param {string} userId - User document ID
 */
export async function adminToggleRole(userId) {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    try {
        const userRef = getDocPath(COLL_USERS, userId);
        await updateDoc(userRef, { role: 'super-admin' });

        const adminUsers = getAdminUsers();
        const userIndex = adminUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            adminUsers[userIndex].role = 'super-admin';
            setAdminUsers([...adminUsers]);
        }

        renderAdminUsers();
        showToast('Utilizator promovat la admin', 'success');
    } catch (error) {
        console.error('Error toggling role:', error);
        showToast('Eroare la modificarea rolului', 'error');
    }
}

// ==================== COMMENT MODERATION ====================

/**
 * Delete a comment (admin only)
 * @param {string} postId - Post document ID
 * @param {string} commentId - Comment document ID
 */
export async function adminDeleteComment(postId, commentId) {
    if (!isSuperAdmin()) {
        showToast('Acces interzis!', 'error');
        return;
    }

    if (!confirm('Sigur vrei să ștergi acest comentariu?')) return;

    try {
        const commentRef = doc(db, COLL_COMMENTS, commentId);
        await deleteDoc(commentRef);
        showToast('Comentariu șters cu succes', 'success');

        // Reload comments if viewing them
        const currentCommentingPostId = getCurrentCommentingPostId();
        if (currentCommentingPostId === postId) {
            window.loadComments(postId);
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Eroare la ștergerea comentariului', 'error');
    }
}
