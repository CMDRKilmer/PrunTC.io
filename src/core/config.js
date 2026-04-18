export const CONFIG = Object.freeze({
    OPTIMIZE: {
        MAX_ITERATIONS: 500,
        MIN_DAYS_OFFSET: 10,
        SEARCH_BOOST: 50,
        MIN_SEARCH_DAYS: 0.001,
        FALLBACK_DAYS_INCREMENT: 1,
        EARLY_TERMINATION_THRESHOLD: 0.999
    },
    CACHE: {
        LOAD_CACHE_MAX_SIZE: 200,
        PRECISION: 0.001
    }
});
