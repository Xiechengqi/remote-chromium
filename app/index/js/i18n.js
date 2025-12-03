/*
 * Internationalization (i18n) support for noVNC
 * Supports Chinese (Simplified) and English
 */

var I18n = (function() {
    "use strict";
    
    // Language resources
    var translations = {
        'zh-CN': {
            // Status messages
            'status.connecting': '正在连接...',
            'status.connected': '已连接',
            'status.disconnected': '已断开',
            'status.failed': '连接失败',
            'status.loading': '加载中...',
            
            // Navigation buttons
            'nav.hideable': '隐藏导航栏',
            'nav.autoHide': '自动隐藏',
            'nav.drag': '拖拽',
            'nav.fullscreen': '全屏',
            'nav.autoScale': '自动缩放',
            'nav.clipboard': '剪贴板',
            'nav.keyboard': '键盘',
            'nav.language': '语言',
            'nav.showHide': '显示/隐藏导航栏',
            
            // Tooltips
            'tooltip.hideable': '隐藏导航栏',
            'tooltip.autoHide': '自动隐藏导航栏',
            'tooltip.drag': '拖拽应用程序显示区域',
            'tooltip.fullscreen': '切换全屏显示',
            'tooltip.autoScale': '切换自动缩放',
            'tooltip.clipboard': '打开剪贴板',
            'tooltip.keyboard': '切换虚拟键盘',
            
            // Modal dialogs
            'modal.password.title': '需要密码',
            'modal.password.placeholder': '请输入密码',
            'modal.password.remember': '记住我',
            'modal.password.submit': '提交',
            'modal.password.cancel': '取消',
            'modal.password.close': '关闭',
            
            'modal.clipboard.title': '剪贴板',
            'modal.clipboard.description': '这是远程应用程序的剪贴板内容。',
            'modal.clipboard.placeholder': '剪贴板内容将显示在这里...',
            'modal.clipboard.submit': '提交',
            'modal.clipboard.clear': '清空',
            'modal.clipboard.close': '关闭',
            
            // Canvas
            'canvas.label': '远程桌面显示区域',
            'canvas.notSupported': '您的浏览器不支持Canvas。请使用现代浏览器访问此应用程序。',
            
            // Language names
            'lang.zh': '中文',
            'lang.en': 'English'
        },
        'en-US': {
            // Status messages
            'status.connecting': 'Connecting...',
            'status.connected': 'Connected',
            'status.disconnected': 'Disconnected',
            'status.failed': 'Connection Failed',
            'status.loading': 'Loading...',
            
            // Navigation buttons
            'nav.hideable': 'Hideable Navbar',
            'nav.autoHide': 'Auto Hide',
            'nav.drag': 'Drag',
            'nav.fullscreen': 'Fullscreen',
            'nav.autoScale': 'Auto Scale',
            'nav.clipboard': 'Clipboard',
            'nav.keyboard': 'Keyboard',
            'nav.language': 'Language',
            'nav.showHide': 'Show/Hide Navbar',
            
            // Tooltips
            'tooltip.hideable': 'Make the navigation bar hideable',
            'tooltip.autoHide': 'Automatically hide the navigation bar',
            'tooltip.drag': 'Drag the application\'s display',
            'tooltip.fullscreen': 'Toggle browser\'s fullscreen display',
            'tooltip.autoScale': 'Toggle automatic downscaling of the application\'s display',
            'tooltip.clipboard': 'Open the application\'s clipboard',
            'tooltip.keyboard': 'Toggle the virtual keyboard',
            
            // Modal dialogs
            'modal.password.title': 'Password Required',
            'modal.password.placeholder': 'Enter password',
            'modal.password.remember': 'Remember Me',
            'modal.password.submit': 'Submit',
            'modal.password.cancel': 'Cancel',
            'modal.password.close': 'Close',
            
            'modal.clipboard.title': 'Clipboard',
            'modal.clipboard.description': 'This is the content of the clipboard of the remote application.',
            'modal.clipboard.placeholder': 'Clipboard content will appear here...',
            'modal.clipboard.submit': 'Submit',
            'modal.clipboard.clear': 'Clear',
            'modal.clipboard.close': 'Close',
            
            // Canvas
            'canvas.label': 'Remote Desktop Display Area',
            'canvas.notSupported': 'Your browser does not support Canvas. Please use a modern browser to access this application.',
            
            // Language names
            'lang.zh': '中文',
            'lang.en': 'English'
        }
    };
    
    // Default language detection
    var defaultLang = 'zh-CN';
    var currentLang = defaultLang;
    
    // Detect browser language
    function detectLanguage() {
        if (typeof navigator !== 'undefined' && navigator.language) {
            var browserLang = navigator.language;
            if (browserLang.startsWith('zh')) {
                return 'zh-CN';
            } else {
                return 'en-US';
            }
        }
        return defaultLang;
    }
    
    // Load language preference from localStorage
    function loadLanguagePreference() {
        try {
            var savedLang = localStorage.getItem('novnc_language');
            if (savedLang && translations[savedLang]) {
                return savedLang;
            }
        } catch (e) {
            // localStorage not available, use detected language
        }
        var detectedLang = detectLanguage();
        // Ensure detected language exists in translations
        return translations[detectedLang] ? detectedLang : defaultLang;
    }
    
    // Save language preference to localStorage
    function saveLanguagePreference(lang) {
        try {
            localStorage.setItem('novnc_language', lang);
        } catch (e) {
            // localStorage not available, ignore
        }
    }
    
    // Initialize language
    function init() {
        currentLang = loadLanguagePreference();
        applyLanguage();
    }
    
    // Get translation
    function t(key, lang) {
        lang = lang || currentLang;
        
        // Ensure lang exists in translations, fallback to default
        if (!translations[lang]) {
            lang = defaultLang;
        }
        
        var langTranslations = translations[lang];
        if (!langTranslations || typeof langTranslations !== 'object') {
            return key; // Return key if translation not found
        }
        
        // Direct lookup - translations use dot-separated keys as object keys
        var value = langTranslations[key];
        
        // Return translation if found, otherwise return key
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
        return key;
    }
    
    // Set language
    function setLanguage(lang) {
        if (!translations[lang]) {
            console.warn('Language not supported: ' + lang);
            return false;
        }
        
        currentLang = lang;
        saveLanguagePreference(lang);
        applyLanguage();
        
        // Trigger custom event for language change
        if (typeof document !== 'undefined') {
            var event = new CustomEvent('languageChanged', { detail: { language: lang } });
            document.dispatchEvent(event);
        }
        
        return true;
    }
    
    // Get current language
    function getLanguage() {
        return currentLang;
    }
    
    // Apply language to page
    function applyLanguage() {
        if (typeof document === 'undefined' || typeof jQuery === 'undefined') {
            return;
        }
        
        // Ensure currentLang is valid
        if (!translations[currentLang]) {
            currentLang = defaultLang;
        }
        
        // Update elements with data-i18n attribute
        $('[data-i18n]').each(function() {
            var $el = $(this);
            var key = $el.attr('data-i18n');
            if (!key) return;
            
            var text = t(key);
            
            // Skip if translation returned the key itself (translation not found)
            if (text === key) {
                console.warn('Translation not found for key: ' + key + ' (lang: ' + currentLang + ')');
                return; // Don't update if translation not found
            }
            
            // Check if it's a placeholder or title attribute
            var attr = $el.attr('data-i18n-attr');
            if (attr) {
                $el.attr(attr, text);
            } else {
                // Update text content
                if ($el.is('input[type="password"], input[type="text"], textarea')) {
                    if ($el.attr('placeholder')) {
                        $el.attr('placeholder', text);
                    } else {
                        $el.val(text);
                    }
                } else {
                    // Replace all content with translated text
                    $el.text(text);
                }
            }
        });
        
        // Update title attributes
        $('[data-i18n-title]').each(function() {
            var $el = $(this);
            var key = $el.attr('data-i18n-title');
            if (!key) return;
            
            var text = t(key);
            $el.attr('title', text);
            $el.attr('aria-label', text);
        });
        
        // Update HTML lang attribute
        $('html').attr('lang', currentLang);
    }
    
    // Public API
    return {
        init: init,
        t: t,
        setLanguage: setLanguage,
        getLanguage: getLanguage,
        applyLanguage: applyLanguage, // Expose for external use
        getAvailableLanguages: function() {
            return Object.keys(translations);
        },
        isRTL: function() {
            return false; // Currently only LTR languages supported
        }
    };
})();

// Auto-initialize when DOM is ready
if (typeof jQuery !== 'undefined') {
    $(document).ready(function() {
        I18n.init();
    });
} else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', I18n.init);
    } else {
        I18n.init();
    }
}
