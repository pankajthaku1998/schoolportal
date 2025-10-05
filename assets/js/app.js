// Tailwind Configuration
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'primary': '#1976d2', // Professional Blue
                'secondary': '#1565c0', // Darker Blue
                'accent': '#2196f3', // Light Blue
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        }
    }
}

// Load external libraries dynamically
function loadExternalLibraries() {
    // Load Lucide icons for better UX
    const lucideScript = document.createElement('script');
    lucideScript.src = 'https://unpkg.com/lucide@latest';
    lucideScript.onload = () => {
        console.log('Lucide icons loaded');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    };
    document.head.appendChild(lucideScript);

    // Load SheetJS for Excel parsing and generation
    const xlsxScript = document.createElement('script');
    xlsxScript.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    xlsxScript.onload = () => {
        console.log('SheetJS loaded');
    };
    document.head.appendChild(xlsxScript);
}

// Initialize libraries when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadExternalLibraries();
    
    // Initialize any other components here
    console.log('Application initialized');
});

// Utility Functions
window.showNotificationModal = (title, message) => {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('notification-modal').classList.remove('hidden');
};

window.hideNotificationModal = () => {
    document.getElementById('notification-modal').classList.add('hidden');
};

// Professional dropdown functions
window.toggleUserDropdown = () => {
    const dropdown = document.getElementById('user-dropdown-content');
    dropdown.classList.toggle('show');
};

window.hideUserDropdown = () => {
    const dropdown = document.getElementById('user-dropdown-content');
    dropdown.classList.remove('show');
};

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
        hideUserDropdown();
    }
});

// Password Change Modal Functions (fallback if not loaded from firebase-app.js)
window.showPasswordChangeModal = window.showPasswordChangeModal || (() => {
    console.log('Password change modal function not yet loaded. Please wait for Firebase initialization.');
});

window.hidePasswordChangeModal = window.hidePasswordChangeModal || (() => {
    const modal = document.getElementById('password-change-modal');
    if (modal) modal.classList.add('hidden');
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showNotificationModal,
        hideNotificationModal,
        toggleUserDropdown,
        hideUserDropdown,
        showPasswordChangeModal,
        hidePasswordChangeModal
    };
}
