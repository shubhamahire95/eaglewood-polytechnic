/**
 * Google Analytics 4 — loaded once for all public pages via main.js.
 * Measurement ID: G-M8SF92S22R
 */
const GA_MEASUREMENT_ID = "G-M8SF92S22R";

if (!window.__eaglewoodGa4Initialized) {
    window.__eaglewoodGa4Initialized = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
        window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
}
