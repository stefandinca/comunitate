// =====================================================
// HELPER UTILITIES
// =====================================================

/**
 * Converts a timestamp to a human-readable relative time
 * @param {Date|number} timestamp - The timestamp to convert
 * @returns {string} Relative time string (e.g., "2h", "5 zile")
 */
export function timeAgo(timestamp) {
    const now = new Date();
    const seconds = Math.floor((now - timestamp) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) {
        return Math.floor(interval) + " ani";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        return Math.floor(interval) + " luni";
    }
    interval = seconds / 86400;
    if (interval > 1) {
        return Math.floor(interval) + " zile";
    }
    interval = seconds / 3600;
    if (interval > 1) {
        return Math.floor(interval) + "h";
    }
    interval = seconds / 60;
    if (interval > 1) {
        return Math.floor(interval) + "m";
    }
    return Math.floor(seconds) + "s";
}

/**
 * Converts URLs in text to clickable links
 * @param {string} text - The text containing URLs
 * @returns {string} HTML string with clickable links
 */
export function makeLinksClickable(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">${url}</a>`;
    });
}

/**
 * Gets category label in Romanian
 * @param {string} category - Category key
 * @returns {string} Romanian label
 */
export function getCategoryLabel(category) {
    const labels = {
        sale: 'Vând',
        borrow: 'Împrumut',
        event: 'Eveniment',
        local: 'Interes Local',
        business: 'Business',
        recommendation: 'Recomandare'
    };
    return labels[category] || category;
}

/**
 * Truncates text to a specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 150) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Formats phone number for WhatsApp
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneForWhatsApp(phone) {
    return phone.replace(/[^0-9]/g, '');
}

/**
 * Generates avatar URL for user
 * @param {object} user - User object with name and optional avatar
 * @returns {string} Avatar URL
 */
export function getAvatarUrl(user) {
    if (user.avatar) return user.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
}

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
