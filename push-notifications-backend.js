const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendPushNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();

        const recipientUid = notification.recipientUid;
        const senderName = notification.senderName;
        const postTitle = notification.postTitle;

        // Get the user's FCM tokens
        const userDoc = await admin.firestore().collection('users').doc(recipientUid).get();
        if (!userDoc.exists) {
            console.log('User not found');
            return;
        }

        const fcmTokens = userDoc.data().fcmTokens;
        if (!fcmTokens || fcmTokens.length === 0) {
            console.log('User has no FCM tokens');
            return;
        }

        const payload = {
            notification: {
                title: 'New Comment!',
                body: `${senderName} commented on your post: "${postTitle}"`,
                icon: '/img/corbeanca-community-logo.png',
                click_action: `https://stefandinca.ro/comunitate/app.html` // Optional: URL to open when notification is clicked
            }
        };

        try {
            const response = await admin.messaging().sendToDevice(fcmTokens, payload);
            console.log('Successfully sent message:', response);
        } catch (error) {
            console.log('Error sending message:', error);
        }
    });
