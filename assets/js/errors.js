/**
 * Global error mapping and handlers for CMS + public site.
 */

const HTTP_MESSAGES = {
    400: "The request was invalid. Check required fields and try again.",
    401: "You are not signed in. Please log in again.",
    403: "You do not have permission to perform this action.",
    404: "The requested resource was not found.",
    409: "This record conflicts with existing data.",
    422: "Some fields failed validation. Review the form and try again.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "Server error. Please try again shortly.",
    502: "Service temporarily unavailable. Please try again.",
    503: "Service temporarily unavailable. Please try again.",
};

export function mapHttpError(status, fallback = "") {
    if (!status && fallback) return fallback;
    if (HTTP_MESSAGES[status]) return HTTP_MESSAGES[status];
    if (status >= 500) return HTTP_MESSAGES[500];
    if (fallback) return fallback;
    return status ? `Request failed (HTTP ${status})` : "Request failed";
}

export function mapApiError(error, fallback = "Could not complete this action.") {
    if (!error) return fallback;
    const status = Number(error.status || error.statusCode || 0);
    const message = String(error.message || error.details || "").trim();
    if (message && !message.toLowerCase().includes("failed to fetch")) {
        return mapHttpError(status, message);
    }
    if (status) return mapHttpError(status, message);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return "You appear to be offline. Check your connection and try again.";
    }
    return fallback;
}

export function isTransientNetworkError(error) {
    const msg = String(error?.message || "").toLowerCase();
    return msg.includes("failed to fetch")
        || msg.includes("network")
        || msg.includes("timeout")
        || error?.name === "TypeError";
}

export async function withRetry(fn, { attempts = 2, delayMs = 600 } = {}) {
    let lastError = null;
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (!isTransientNetworkError(err) || i === attempts - 1) throw err;
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
    }
    throw lastError;
}

export function installGlobalErrorHandlers() {
    if (typeof window === "undefined" || window.__ewErrorsInstalled) return;
    window.__ewErrorsInstalled = true;

    window.addEventListener("unhandledrejection", (event) => {
        console.error("[Unhandled rejection]", event.reason);
    });

    window.addEventListener("error", (event) => {
        if (event.message) console.error("[Uncaught error]", event.message);
    });
}
