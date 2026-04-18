/**
 * PrunTC.io 应用主入口模块
 * 负责初始化应用、注册模块、配置路由
 */

import { app } from './app.js';
import { router } from './router.js';
import { toggleTheme } from './utils/index.js';
import { createPrunTCModule } from './pruntc.js';
import { createMTCModule } from './mtc.js';

function initApp() {
    app.register('pruntc', createPrunTCModule());
    app.register('mtc', createMTCModule());

    router.register('/pruntc', () => {
        app.switchModule('pruntc');
    });

    router.register('/mtc', () => {
        app.switchModule('mtc');
    });

    window.toggleTheme = toggleTheme;
    window.app = app;
    window.router = router;

    app.init();

    initNavEventListeners();
    
    const initialRoute = window.location.hash.slice(1) || '/pruntc';
    if (initialRoute === '/pruntc' || initialRoute === '/mtc') {
        router.handleRoute();
    } else {
        router.navigate('/pruntc');
    }
}

function initNavEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const route = tab.getAttribute('href');
            if (route && route.startsWith('#')) {
                router.navigate(route.slice(1));
            }
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export { app, router };
