/**
 * Responsive Swiper helpers — enable loop only when enough slides exist for the current viewport.
 */

const responsiveSwiperCleanups = new WeakMap();

export function countSwiperSlides(container) {
    if (!container) return 0;
    return container.querySelectorAll(".swiper-slide").length;
}

export function resolveSlidesPerViewAt(breakpoints = {}, width = typeof window !== "undefined" ? window.innerWidth : 0, fallback = 1) {
    let spv = Number(fallback) || 1;
    const keys = Object.keys(breakpoints)
        .map(Number)
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => a - b);
    for (const key of keys) {
        if (width >= key) {
            const next = breakpoints[key]?.slidesPerView;
            if (next !== undefined) spv = Number(next) || spv;
        }
    }
    return spv;
}

export function maxSlidesPerView(breakpoints = {}, fallback = 1) {
    let max = Number(fallback) || 1;
    for (const bp of Object.values(breakpoints)) {
        const value = Number(bp?.slidesPerView);
        if (!Number.isNaN(value)) max = Math.max(max, value);
    }
    return Math.ceil(max);
}

function usesFractionalSlidesPerView(breakpoints = {}, fallback = 1) {
    const values = [fallback, ...Object.values(breakpoints).map((bp) => bp?.slidesPerView)].filter((value) => value !== undefined);
    return values.some((value) => Number(value) % 1 !== 0);
}

export function minSlidesRequiredForLoop(breakpoints = {}, fallback = 1, slidesPerGroup = 1) {
    const spv = maxSlidesPerView(breakpoints, fallback);
    const group = Math.max(1, Number(slidesPerGroup) || 1);
    let required = spv * 3 + group + 1;
    if (usesFractionalSlidesPerView(breakpoints, fallback)) required += spv;
    return required;
}

export function canEnableSwiperLoop(container, { breakpoints = {}, slidesPerView = 1, slidesPerGroup = 1 } = {}) {
    const slideCount = countSwiperSlides(container);
    if (slideCount <= 1) return false;
    const required = minSlidesRequiredForLoop(breakpoints, slidesPerView, slidesPerGroup);
    return slideCount >= required;
}

export function applyResponsiveLoopOptions(container, options = {}) {
    if (options.loop === false) return { ...options, loop: false };
    const breakpoints = options.breakpoints || {};
    const baseSpv = options.slidesPerView ?? 1;
    const slidesPerGroup = options.slidesPerGroup ?? 1;
    const loop = canEnableSwiperLoop(container, { breakpoints, slidesPerView: baseSpv, slidesPerGroup });
    const slideCount = countSwiperSlides(container);
    const next = { ...options, loop };
    if (!loop) {
        next.rewind = slideCount > 1 && options.rewind !== false;
    }
    return next;
}

export function destroyResponsiveSwiper(container) {
    const cleanup = responsiveSwiperCleanups.get(container);
    if (cleanup) cleanup();
    responsiveSwiperCleanups.delete(container);
    if (container?.swiper?.destroy) {
        try { container.swiper.destroy(true, true); } catch { /* ignore */ }
    }
}

export function mountResponsiveSwiper(container, getOptions, { debounceMs = 150 } = {}) {
    if (!container || typeof getOptions !== "function") return null;
    destroyResponsiveSwiper(container);

    let instance = null;
    let lastLoop = null;
    let timer = null;

    const buildOptions = () => applyResponsiveLoopOptions(container, getOptions() || {});

    const init = () => {
        if (!window.Swiper) return false;
        const opts = buildOptions();
        const canLoop = opts.loop === true;
        if (instance?.destroy && lastLoop !== null && lastLoop !== canLoop) {
            instance.destroy(true, true);
            instance = null;
        }
        if (!instance) {
            instance = new window.Swiper(container, opts);
            lastLoop = canLoop;
        }
        return true;
    };

    const onResize = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (!container.isConnected) return;
            const opts = buildOptions();
            const canLoop = opts.loop === true;
            if (canLoop === lastLoop) return;
            if (instance?.destroy) instance.destroy(true, true);
            instance = new window.Swiper(container, opts);
            lastLoop = canLoop;
        }, debounceMs);
    };

    if (!init()) return null;

    window.addEventListener("resize", onResize, { passive: true });
    responsiveSwiperCleanups.set(container, () => {
        window.removeEventListener("resize", onResize);
        clearTimeout(timer);
        if (instance?.destroy) {
            try { instance.destroy(true, true); } catch { /* ignore */ }
        }
        instance = null;
        lastLoop = null;
    });

    return instance;
}

export function bootResponsiveSwiper(container, getOptions, { debounceMs = 150, timeoutMs = 8000, intervalMs = 60 } = {}) {
    if (!container) return;
    const boot = () => {
        if (!window.Swiper) return false;
        mountResponsiveSwiper(container, getOptions, { debounceMs });
        return true;
    };
    if (boot()) return;
    const wait = setInterval(() => {
        if (boot()) clearInterval(wait);
    }, intervalMs);
    setTimeout(() => clearInterval(wait), timeoutMs);
}
