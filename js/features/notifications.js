// =====================================================
// PUSH NOTIFICATIONS MODULE
// =====================================================

import { messaging } from '../config/firebase-init.js';
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { db, getDocPath } from '../config/firebase-init.js';
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser } from '../core/state.js';
import { showToast } from '../ui/toast.js';

/**
 * Requests permission to send push notifications and saves the token.
 */
export async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            await saveMessagingDeviceToken();
        } else {
            console.log('Unable to get permission to notify.');
            showToast('You denied notification permission.', 'error');
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        showToast('Error requesting notification permission.', 'error');
    }
}

/**
 * Saves the messaging device token to Firestore.
 */
async function saveMessagingDeviceToken() {
    try {
        const fcmToken = await getToken(messaging, { vapidKey: 'BBgqJC5P7OyOQHuUgcjWScfIR-vjwicOuHEkyFup7-wrPubZiHUfUlfdB77_d4XT3lLs34lDaAm90IuE_IymJxY' });
        if (fcmToken) {
            console.log('Got FCM token:', fcmToken);
            const user = getCurrentUser();
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    fcmTokens: arrayUnion(fcmToken)
                });
                console.log('FCM token saved to Firestore.');
                showToast('Push notifications enabled!', 'success');
            }
        } else {
            // Need to request permission to show notifications.
            console.log('No FCM token available. Need to request permission.');
            requestNotificationPermission();
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
        showToast('Error getting notification token.', 'error');
    }
}

/**
 * Initializes the push notification functionality.
 */
export function initPushNotifications() {
    onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        showToast(payload.notification.title, 'info');
    });
}
