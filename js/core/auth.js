// =====================================================
// AUTHENTICATION MODULE
// =====================================================

import {
    signInWithCustomToken,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setDoc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, shouldUseCustomToken, getDocPath } from '../config/firebase-init.js';
import { COLL_USERS } from '../config/constants.js';
import {
    setCurrentUser,
    setUserProfile,
    getUserProfile,
    isSuperAdmin,
    getIsRegisterMode,
    setIsRegisterMode
} from './state.js';
import { showToast } from '../ui/toast.js';

/**
 * Initializes authentication with custom token if needed
 */
export async function initAuth() {
    try {
        if (shouldUseCustomToken && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        }
    } catch (error) {
        console.error("Auth init failed:", error);
    }
}

/**
 * Sets up auth state change listener
 * @param {Function} onLogin - Callback when user logs in
 * @param {Function} onLogout - Callback when user logs out
 */
export function setupAuthListener(onLogin, onLogout) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            setCurrentUser(user);
            const userRef = getDocPath(COLL_USERS, user.uid);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const profile = docSnap.data();
                setUserProfile(profile);

                // Update UI
                const userDisplayName = document.getElementById('user-display-name');
                if (userDisplayName) {
                    userDisplayName.textContent = `Salut, ${profile.name}!`;
                }

                const headerAvatar = document.getElementById('header-user-avatar');
                if (headerAvatar) {
                    headerAvatar.src = profile.avatar || `https://ui-avatars.com/api/?name=${profile.name}&background=random`;
                }

                // Show/hide admin nav button based on role
                const adminNavBtn = document.getElementById('nav-admin');
                if (adminNavBtn) {
                    if (isSuperAdmin()) {
                        adminNavBtn.classList.remove('hidden');
                        adminNavBtn.classList.add('flex');
                    } else {
                        adminNavBtn.classList.add('hidden');
                        adminNavBtn.classList.remove('flex');
                    }
                }

                // Show business category for super-admins
                const businessCategory = document.getElementById('category-business');
                if (businessCategory && isSuperAdmin()) {
                    businessCategory.classList.remove('hidden');
                }
            }

            if (onLogin) onLogin(user);
        } else {
            setCurrentUser(null);
            if (onLogout) onLogout();
        }
    });
}

/**
 * Toggles between login and register mode
 */
export function toggleAuthMode() {
    const isRegister = !getIsRegisterMode();
    setIsRegisterMode(isRegister);

    const extraFields = document.getElementById('register-fields');
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    if (isRegister) {
        extraFields.classList.remove('hidden');
        title.innerText = "Creează Cont";
        btn.innerHTML = `Înregistrează-te <span class="material-icons-round">arrow_forward</span>`;
        toggleText.innerHTML = `Ai deja cont? <span class="text-brand-primary font-bold cursor-pointer" onclick="toggleAuthMode()">Autentifică-te</span>`;
        const nameInput = document.getElementById('input-name');
        if (nameInput) nameInput.focus();
    } else {
        extraFields.classList.add('hidden');
        title.innerText = "Bine ai revenit!";
        btn.innerHTML = `Intră în cont <span class="material-icons-round">arrow_forward</span>`;
        toggleText.innerHTML = `Nu ai cont? <span class="text-brand-primary font-bold cursor-pointer" onclick="toggleAuthMode()">Înregistrează-te</span>`;
    }
}

/**
 * Handles Google Sign-In
 */
export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = getDocPath(COLL_USERS, user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            const profileData = {
                name: user.displayName || 'Utilizator Google',
                email: user.email,
                phone: '',
                avatar: user.photoURL || '',
                role: 'user',
                createdAt: serverTimestamp()
            };
            await setDoc(userRef, profileData);
            setUserProfile(profileData);
            localStorage.setItem('user_name', profileData.name);
            showToast(`Cont creat! Bun venit, ${profileData.name}!`);
        } else {
            const profile = docSnap.data();
            setUserProfile(profile);
            if (!profile.avatar && user.photoURL) {
                await updateDoc(userRef, { avatar: user.photoURL });
                setUserProfile({ ...profile, avatar: user.photoURL });
            }
            localStorage.setItem('user_name', profile.name);
            showToast(`Te-ai autentificat cu succes!`);
        }
    } catch (error) {
        console.error("Google Auth Error:", error);
        showToast('Eroare: ' + error.message, 'error');
    }
}

/**
 * Handles email/password login or registration
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User name (for registration)
 * @param {string} phone - User phone (for registration)
 * @returns {Promise<boolean>} Success status
 */
export async function handleEmailAuth(email, password, name = '', phone = '') {
    const isRegister = getIsRegisterMode();

    if (!email || !password) {
        showToast('Introdu email și parolă!', 'error');
        return false;
    }

    if (isRegister && (!name || !phone)) {
        showToast('Completează datele!', 'error');
        return false;
    }

    try {
        if (isRegister) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const profileData = {
                name,
                phone,
                email,
                avatar: '',
                role: 'user',
                createdAt: serverTimestamp()
            };
            await setDoc(getDocPath(COLL_USERS, user.uid), profileData);
            setUserProfile(profileData);
            localStorage.setItem('user_name', name);
            localStorage.setItem('user_phone', phone);
            showToast(`Cont creat! Bun venit, ${name}!`);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast(`Te-ai autentificat cu succes!`);
        }
        return true;
    } catch (error) {
        console.error(error);
        showToast('Eroare la autentificare.', 'error');
        return false;
    }
}

/**
 * Signs out the current user
 */
export async function logout() {
    try {
        await signOut(auth);
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_phone');
        showToast('Te-ai deconectat cu succes!');
    } catch (error) {
        console.error(error);
        showToast('Eroare la deconectare.', 'error');
    }
}

/**
 * Sets up login form event listener
 * @param {HTMLFormElement} form - Login form element
 */
export function setupLoginForm(form) {
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('input-email').value;
        const password = document.getElementById('input-password').value;
        const name = document.getElementById('input-name')?.value || '';
        const phone = document.getElementById('input-phone')?.value || '';
        const btn = document.getElementById('auth-btn');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `Se procesează...`;
        }

        const success = await handleEmailAuth(email, password, name, phone);

        if (btn) {
            btn.disabled = false;
            const isRegister = getIsRegisterMode();
            btn.innerHTML = isRegister
                ? `Înregistrează-te <span class="material-icons-round">arrow_forward</span>`
                : `Intră în cont <span class="material-icons-round">arrow_forward</span>`;
        }
    });
}
