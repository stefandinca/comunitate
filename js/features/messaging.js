// =====================================================
// MESSAGING MODULE - Conversations & Direct Messages
// =====================================================

// Firebase imports
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Internal imports
import { db, getCollectionRef, getDocPath, shouldUseCustomToken, appId } from '../config/firebase-init.js';
import { COLL_CONVERSATIONS, COLL_MESSAGES, COLL_USERS } from '../config/constants.js';
import {
    getCurrentUser,
    getUnsubscribeConversations,
    setUnsubscribeConversations,
    getUnsubscribeMessages,
    setUnsubscribeMessages,
    getCurrentConversationId,
    setCurrentConversationId,
    getCurrentChatUserId,
    setCurrentChatUserId
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { timeAgo } from '../utils/helpers.js';

// ==================== CONVERSATION LIST ====================

/**
 * Load all conversations for current user
 */
export function loadConversations() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const unsubscribeConversations = getUnsubscribeConversations();
    if (unsubscribeConversations) unsubscribeConversations();

    const conversationsContainer = document.getElementById('conversations-container');
    conversationsContainer.innerHTML = '<div class="flex justify-center py-16"><span class="material-icons-round animate-spin text-3xl" style="color: var(--neon-cyan);">refresh</span></div>';

    const q = query(
        getCollectionRef(COLL_CONVERSATIONS),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        conversationsContainer.innerHTML = '';

        if (snapshot.empty) {
            conversationsContainer.innerHTML = `
                <div class="text-center py-16">
                    <span class="material-icons-round text-6xl mb-4" style="color: var(--text-tertiary);">chat_bubble_outline</span>
                    <p class="text-sm font-semibold" style="color: var(--text-secondary);">Nu ai nicio conversație încă</p>
                    <p class="text-xs mt-2" style="color: var(--text-tertiary);">Trimite un mesaj unui vecin pentru a începe o conversație</p>
                </div>
            `;
            return;
        }

        const conversations = [];
        for (const doc of snapshot.docs) {
            const convData = { id: doc.id, ...doc.data() };
            const otherUserId = convData.participants.find(uid => uid !== currentUser.uid);
            const otherUserDoc = await getDoc(getDocPath(COLL_USERS, otherUserId));
            if (otherUserDoc.exists()) {
                convData.otherUser = { id: otherUserId, ...otherUserDoc.data() };
                conversations.push(convData);
            }
        }

        conversations.forEach(conv => {
            conversationsContainer.appendChild(createConversationCard(conv));
        });
    });

    setUnsubscribeConversations(unsubscribe);
}

/**
 * Create conversation card
 * @param {Object} conv - Conversation data
 * @returns {HTMLElement} Conversation card element
 */
export function createConversationCard(conv) {
    const currentUser = getCurrentUser();
    const card = document.createElement('div');
    card.className = 'glass-card p-4 flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] neon-glow';
    card.onclick = () => openConversation(conv.id, conv.otherUser.id);

    const hasUnread = conv.unreadCount && conv.unreadCount[currentUser.uid] > 0;
    const unreadCount = hasUnread ? conv.unreadCount[currentUser.uid] : 0;

    const avatar = conv.otherUser.avatar || `https://ui-avatars.com/api/?name=${conv.otherUser.name}&background=random`;
    const lastMessageTime = conv.lastMessageTime ? timeAgo(conv.lastMessageTime.toDate()) : '';

    card.innerHTML = `
        <div class="w-14 h-14 rounded-full p-0.5 flex-shrink-0 ${hasUnread ? 'neon-glow' : ''}" style="background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));">
            <img src="${avatar}" class="w-full h-full rounded-full object-cover" style="border: 2px solid var(--carbon);">
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
                <h3 class="font-bold text-base truncate" style="color: var(--text-primary);">${conv.otherUser.name}</h3>
                <span class="text-xs flex-shrink-0 ml-2" style="color: var(--text-tertiary);">${lastMessageTime}</span>
            </div>
            <div class="flex items-center justify-between">
                <p class="text-sm truncate ${hasUnread ? 'font-bold' : ''}" style="color: ${hasUnread ? 'var(--neon-cyan)' : 'var(--text-secondary)'};">${conv.lastMessage || 'Niciun mesaj încă'}</p>
                ${hasUnread ? `<span class="flex-shrink-0 ml-2 px-2 py-0.5 text-xs font-bold rounded-full" style="background: var(--neon-pink); color: var(--void-black);">${unreadCount}</span>` : ''}
            </div>
        </div>
    `;

    return card;
}

// ==================== CONVERSATION VIEW ====================

/**
 * Open conversation with a specific user
 * @param {string} conversationId - Conversation document ID
 * @param {string} otherUserId - Other user's ID
 */
export async function openConversation(conversationId, otherUserId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    setCurrentConversationId(conversationId);
    setCurrentChatUserId(otherUserId);

    // Get other user data
    const otherUserDoc = await getDoc(getDocPath(COLL_USERS, otherUserId));
    if (!otherUserDoc.exists()) {
        showToast('Utilizatorul nu a fost găsit', 'error');
        return;
    }

    const otherUser = otherUserDoc.data();
    const avatar = otherUser.avatar || `https://ui-avatars.com/api/?name=${otherUser.name}&background=random`;

    document.getElementById('conversation-user-avatar').src = avatar;
    document.getElementById('conversation-user-name').textContent = otherUser.name;

    window.toggleModal('modal-conversation', true);
    loadMessages(conversationId);

    // Mark messages as read
    await markMessagesAsRead(conversationId);
}

/**
 * Load messages in a conversation
 * @param {string} conversationId - Conversation document ID
 */
export function loadMessages(conversationId) {
    const currentUser = getCurrentUser();
    const unsubscribeMessages = getUnsubscribeMessages();
    if (unsubscribeMessages) unsubscribeMessages();

    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = '<div class="flex justify-center py-8"><span class="material-icons-round animate-spin text-2xl" style="color: var(--neon-cyan);">refresh</span></div>';

    const messagesPath = shouldUseCustomToken
        ? `artifacts/${appId}/public/data/${COLL_CONVERSATIONS}/${conversationId}/${COLL_MESSAGES}`
        : `${COLL_CONVERSATIONS}/${conversationId}/${COLL_MESSAGES}`;

    const q = query(
        collection(db, messagesPath),
        orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';

        if (snapshot.empty) {
            messagesContainer.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-sm" style="color: var(--text-tertiary);">Trimite primul mesaj</p>
                </div>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const message = { id: doc.id, ...doc.data() };
            messagesContainer.appendChild(createMessageBubble(message));
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    setUnsubscribeMessages(unsubscribe);
}

/**
 * Create message bubble
 * @param {Object} message - Message data
 * @returns {HTMLElement} Message bubble element
 */
export function createMessageBubble(message) {
    const currentUser = getCurrentUser();
    const isMyMessage = message.senderId === currentUser.uid;
    const bubble = document.createElement('div');
    bubble.className = `flex ${isMyMessage ? 'justify-end' : 'justify-start'}`;

    const time = message.timestamp ? timeAgo(message.timestamp.toDate()) : '';

    if (isMyMessage) {
        // My messages - brand primary with white text
        bubble.innerHTML = `
            <div class="max-w-[70%] p-3 rounded-2xl" style="background: var(--primary); color: white;">
                <p class="text-sm break-words">${message.text}</p>
                <span class="text-xs block mt-1 opacity-70">${time}</span>
            </div>
        `;
    } else {
        // Received messages - light background with dark text
        bubble.innerHTML = `
            <div class="max-w-[70%] p-3 rounded-2xl" style="background: var(--background-light); border: 1px solid var(--border-color);">
                <p class="text-sm break-words" style="color: var(--text-primary);">${message.text}</p>
                <span class="text-xs block mt-1 opacity-70" style="color: var(--text-secondary);">${time}</span>
            </div>
        `;
    }

    return bubble;
}

// ==================== SEND MESSAGE ====================

/**
 * Send a message in current conversation
 * @param {Event} e - Form submit event
 */
export async function handleSendMessage(e) {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const currentConversationId = getCurrentConversationId();
    const currentChatUserId = getCurrentChatUserId();

    if (!currentUser || !currentConversationId || !currentChatUserId) return;

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    input.disabled = true;

    try {
        // Add message to subcollection
        const messagesPath = shouldUseCustomToken
            ? `artifacts/${appId}/public/data/${COLL_CONVERSATIONS}/${currentConversationId}/${COLL_MESSAGES}`
            : `${COLL_CONVERSATIONS}/${currentConversationId}/${COLL_MESSAGES}`;

        const messagesRef = collection(db, messagesPath);
        await addDoc(messagesRef, {
            text,
            senderId: currentUser.uid,
            timestamp: serverTimestamp()
        });

        // Update conversation with last message
        const convRef = getDocPath(COLL_CONVERSATIONS, currentConversationId);
        const updateData = {
            lastMessage: text,
            lastMessageTime: serverTimestamp()
        };

        // Increment unread count for the other user
        updateData[`unreadCount.${currentChatUserId}`] = increment(1);

        await updateDoc(convRef, updateData);

        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Eroare la trimiterea mesajului', 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }
}

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation document ID
 */
export async function markMessagesAsRead(conversationId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
        const convRef = getDocPath(COLL_CONVERSATIONS, conversationId);
        await updateDoc(convRef, {
            [`unreadCount.${currentUser.uid}`]: 0
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// ==================== START NEW CONVERSATION ====================

/**
 * Start a new conversation (called from user profile)
 * @param {string} otherUserId - User ID to start conversation with
 */
export async function startConversation(otherUserId) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.uid === otherUserId) return;

    // Close the public profile modal first
    window.toggleModal('modal-public-profile', false);

    try {
        // Check if conversation already exists
        const q = query(
            getCollectionRef(COLL_CONVERSATIONS),
            where('participants', 'array-contains', currentUser.uid)
        );

        const snapshot = await getDocs(q);
        let existingConvId = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.participants.includes(otherUserId)) {
                existingConvId = doc.id;
            }
        });

        if (existingConvId) {
            // Open existing conversation
            await openConversation(existingConvId, otherUserId);
        } else {
            // Create new conversation
            const convData = {
                participants: [currentUser.uid, otherUserId],
                createdAt: serverTimestamp(),
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                unreadCount: {
                    [currentUser.uid]: 0,
                    [otherUserId]: 0
                }
            };

            const convRef = await addDoc(getCollectionRef(COLL_CONVERSATIONS), convData);
            await openConversation(convRef.id, otherUserId);
        }
    } catch (error) {
        console.error('Error starting conversation:', error);
        showToast('Eroare la deschiderea conversației', 'error');
    }
}

// ==================== UNREAD BADGE ====================

/**
 * Listen for unread messages and show badge
 */
export function listenForUnreadMessages() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const q = query(
        getCollectionRef(COLL_CONVERSATIONS),
        where('participants', 'array-contains', currentUser.uid)
    );

    onSnapshot(q, (snapshot) => {
        let totalUnread = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.unreadCount && data.unreadCount[currentUser.uid]) {
                totalUnread += data.unreadCount[currentUser.uid];
            }
        });

        const badge = document.getElementById('messages-badge');
        if (badge) {
            if (totalUnread > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    });
}

// ==================== MODULE INITIALIZATION ====================

/**
 * Initialize messaging module
 */
export function initMessagingModule() {
    // Setup message form submit handler
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', handleSendMessage);
    }

    // Start listening for unread messages badge
    listenForUnreadMessages();
}
