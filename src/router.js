/**
 * 路由模块
 * 基于哈希的简单路由实现
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.listeners = [];
        
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }
    
    register(path, handler) {
        this.routes.set(path, handler);
        return this;
    }
    
    navigate(path) {
        window.location.hash = path;
    }
    
    handleRoute() {
        const hash = window.location.hash.slice(1) || '/pruntc';
        const route = this.routes.get(hash);
        
        this.updateNavTabs(hash);
        
        if (route) {
            if (this.currentRoute && this.currentRoute.unmount) {
                this.currentRoute.unmount();
            }
            this.currentRoute = { path: hash, handler: route };
            route();
            this.notifyListeners(hash);
        }
    }
    
    updateNavTabs(currentRoute) {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            const route = tab.getAttribute('href');
            if (route === currentRoute || route === '#' + currentRoute) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });
    }
    
    onChange(callback) {
        this.listeners.push(callback);
    }
    
    notifyListeners(route) {
        this.listeners.forEach(cb => cb(route));
    }
    
    getCurrentRoute() {
        return this.currentRoute ? this.currentRoute.path : null;
    }
}

const router = new Router();
export { router };
export default Router;
