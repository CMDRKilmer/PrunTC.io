import { router } from './router.js';
import { initTheme, toggleTheme } from './utils/index.js';

class App {
    constructor() {
        this.modules = new Map();
        this.currentModule = null;
        this.initialized = false;
    }

    register(name, module) {
        this.modules.set(name, module);
        return this;
    }

    switchModule(name) {
        const module = this.modules.get(name);
        if (!module) {
            console.error(`Module ${name} not found`);
            return;
        }

        if (this.currentModule && this.currentModule.unmount) {
            this.currentModule.unmount();
        }

        this.currentModule = module;

        if (module.mount) {
            module.mount();
        }
    }

    init() {
        if (this.initialized) return;

        initTheme();

        router.onChange((route) => {
            if (route === '/pruntc') {
                this.switchModule('pruntc');
            } else if (route === '/mtc') {
                this.switchModule('mtc');
            }
        });

        this.initialized = true;
    }

    getModule(name) {
        return this.modules.get(name);
    }
}

const app = new App();
export { app };
export default App;