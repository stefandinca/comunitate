// Import the Firebase app and messaging scripts
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js");

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDlJySD0JWV3joNXiGOR9SXhKkffNxozMw",  // Replace with new key after revoking old one
    authDomain: "corbeanca-community.firebaseapp.com",
    projectId: "corbeanca-community",
    storageBucket: "corbeanca-community.firebasestorage.app",
    messagingSenderId: "1086285762362",
    appId: "1:1086285762362:web:885b97b8cf4a72c1f18a03",
    measurementId: "G-T479WRD5G2"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/img/corbeanca-community-logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
