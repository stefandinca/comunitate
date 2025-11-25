// =====================================================
// TOAST NOTIFICATIONS MODULE
// =====================================================

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type ('success' or 'error')
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-4 rounded-xl shadow-lg z-[9999] transition-all transform translate-x-0 ${
        type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-white text-gray-800 border-2 border-brand-primary'
    }`;
    toast.style.animation = 'slideInRight 0.3s ease-out';
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-icons-round">${type === 'error' ? 'error' : 'check_circle'}</span>
            <span class="font-medium">${message}</span>
        </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Shows a loading toast that stays until dismissed
 * @param {string} message - Message to display
 * @returns {Function} Function to dismiss the toast
 */
export function showLoadingToast(message = 'Se încarcă...') {
    const toast = document.createElement('div');
    toast.id = 'loading-toast';
    toast.className = 'fixed top-4 right-4 px-6 py-4 rounded-xl shadow-lg z-[9999] bg-white text-gray-800 border-2 border-brand-primary';
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-icons-round animate-spin">refresh</span>
            <span class="font-medium">${message}</span>
        </div>
    `;

    document.body.appendChild(toast);

    return () => {
        const existingToast = document.getElementById('loading-toast');
        if (existingToast) {
            existingToast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => existingToast.remove(), 300);
        }
    };
}

/**
 * Shows a confirmation dialog
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Confirm button text (default: 'Da')
 * @param {string} cancelText - Cancel button text (default: 'Nu')
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
export function showConfirm(message, confirmText = 'Da', cancelText = 'Nu') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <p class="text-lg font-medium text-gray-800 mb-6">${message}</p>
                <div class="flex gap-3">
                    <button id="confirm-cancel" class="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 font-medium text-gray-700 hover:bg-gray-50">
                        ${cancelText}
                    </button>
                    <button id="confirm-ok" class="flex-1 px-4 py-3 rounded-xl bg-brand-primary text-white font-medium hover:bg-brand-primary-dark">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('confirm-ok').onclick = () => {
            overlay.remove();
            resolve(true);
        };

        document.getElementById('confirm-cancel').onclick = () => {
            overlay.remove();
            resolve(false);
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        };
    });
}
