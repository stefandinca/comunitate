// =====================================================
// REUSABLE UI COMPONENTS
// =====================================================

/**
 * Creates a loading spinner element
 * @param {string} message - Loading message (optional)
 * @returns {HTMLElement} Loading spinner element
 */
export function createLoadingSpinner(message = 'Se încarcă...') {
    const container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center py-12';
    container.innerHTML = `
        <span class="material-icons-round animate-spin text-4xl mb-4" style="color: var(--primary);">refresh</span>
        <p class="text-sm" style="color: var(--text-secondary);">${message}</p>
    `;
    return container;
}

/**
 * Creates an empty state component
 * @param {string} icon - Material icon name
 * @param {string} message - Empty state message
 * @param {string} actionText - Optional action button text
 * @param {Function} actionCallback - Optional action button callback
 * @returns {HTMLElement} Empty state element
 */
export function createEmptyState(icon, message, actionText = null, actionCallback = null) {
    const container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center py-16 px-4';

    let html = `
        <span class="material-icons-round text-6xl mb-4" style="color: var(--text-tertiary);">${icon}</span>
        <p class="text-sm font-semibold text-center" style="color: var(--text-secondary);">${message}</p>
    `;

    if (actionText && actionCallback) {
        html += `
            <button id="empty-state-action" class="mt-6 px-6 py-3 rounded-xl font-medium" style="background: var(--primary); color: white;">
                ${actionText}
            </button>
        `;
    }

    container.innerHTML = html;

    if (actionText && actionCallback) {
        container.querySelector('#empty-state-action').addEventListener('click', actionCallback);
    }

    return container;
}

/**
 * Creates a user avatar element
 * @param {object} user - User object with name and optional avatar
 * @param {string} size - Size class (default: 'w-10 h-10')
 * @returns {HTMLElement} Avatar element
 */
export function createAvatar(user, size = 'w-10 h-10') {
    const container = document.createElement('div');
    container.className = `${size} rounded-full p-0.5 flex-shrink-0`;
    container.style.background = 'linear-gradient(135deg, var(--primary), #ff6b9d)';

    const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;

    container.innerHTML = `
        <img src="${avatarUrl}" class="w-full h-full rounded-full object-cover" style="border: 2px solid white;">
    `;

    return container;
}

/**
 * Creates a badge element
 * @param {string} text - Badge text
 * @param {string} color - Badge color (primary, green, red, yellow)
 * @returns {HTMLElement} Badge element
 */
export function createBadge(text, color = 'primary') {
    const badge = document.createElement('span');
    badge.className = 'px-3 py-1 rounded-full text-xs font-semibold';

    const colors = {
        primary: 'bg-brand-primary text-white',
        green: 'bg-green-500 text-white',
        red: 'bg-red-500 text-white',
        yellow: 'bg-yellow-500 text-white',
        blue: 'bg-blue-500 text-white',
        gray: 'bg-gray-200 text-gray-700'
    };

    badge.className += ` ${colors[color] || colors.primary}`;
    badge.textContent = text;

    return badge;
}

/**
 * Creates a button element
 * @param {string} text - Button text
 * @param {string} icon - Material icon name (optional)
 * @param {string} variant - Button variant ('primary', 'secondary', 'danger')
 * @returns {HTMLElement} Button element
 */
export function createButton(text, icon = null, variant = 'primary') {
    const button = document.createElement('button');
    button.className = 'px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all';

    const variants = {
        primary: 'bg-brand-primary text-white hover:bg-brand-primary-dark',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        danger: 'bg-red-500 text-white hover:bg-red-600'
    };

    button.className += ` ${variants[variant] || variants.primary}`;

    if (icon) {
        button.innerHTML = `
            <span class="material-icons-round text-sm">${icon}</span>
            <span>${text}</span>
        `;
    } else {
        button.textContent = text;
    }

    return button;
}

/**
 * Creates a card container
 * @param {string} content - Card HTML content
 * @param {string} classes - Additional classes (optional)
 * @returns {HTMLElement} Card element
 */
export function createCard(content, classes = '') {
    const card = document.createElement('div');
    card.className = `post-card-new ${classes}`;
    card.innerHTML = content;
    return card;
}

/**
 * Creates an icon button
 * @param {string} icon - Material icon name
 * @param {Function} onClick - Click handler
 * @param {string} label - Aria label for accessibility
 * @returns {HTMLElement} Icon button element
 */
export function createIconButton(icon, onClick, label = '') {
    const button = document.createElement('button');
    button.className = 'p-2 rounded-full hover:bg-gray-100 transition-all';
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span class="material-icons-round">${icon}</span>`;
    button.addEventListener('click', onClick);
    return button;
}

/**
 * Creates a divider element
 * @param {string} text - Optional text label
 * @returns {HTMLElement} Divider element
 */
export function createDivider(text = null) {
    const divider = document.createElement('div');
    divider.className = 'flex items-center gap-4 my-6';

    if (text) {
        divider.innerHTML = `
            <div class="flex-1 h-px bg-gray-200"></div>
            <span class="text-xs font-medium text-gray-500">${text}</span>
            <div class="flex-1 h-px bg-gray-200"></div>
        `;
    } else {
        divider.innerHTML = '<div class="w-full h-px bg-gray-200"></div>';
    }

    return divider;
}
