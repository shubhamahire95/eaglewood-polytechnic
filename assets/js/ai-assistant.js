import { safeFetch, safeInsert, isCmsAvailable } from "./supabase.js";

const DEFAULT_SETTINGS = {
    assistant_name: "Institute Assistant",
    welcome_message: "Ask me about admissions, courses, fees, placements, hostel, scholarships, faculty or campus facilities.",
    fallback_message: "I couldn't find an official answer. Your question has been forwarded to the administrator.",
    primary_color: "#0F766E",
    typing_speed: 260,
    suggested_questions: ["Admissions", "Courses", "Fees", "Placements", "Hostel", "Scholarships", "Transport", "Documents", "Faculty", "Contact"],
};

const SYNONYMS = {
    admission: ["admissions", "apply", "application", "enquiry", "inquiry"],
    fees: ["fee", "cost", "payment", "charges"],
    course: ["courses", "branch", "program", "programme", "department"],
    hostel: ["accommodation", "room", "mess"],
    bus: ["transport", "vehicle", "route"],
    placement: ["placements", "job", "company", "package", "recruiter"],
    document: ["documents", "certificate", "papers"],
    exam: ["exams", "test", "result", "results"],
    library: ["books", "reading"],
    laboratory: ["laboratory", "lab", "labs", "practical"],
};

const FALLBACK_QUESTIONS = [
    { question: "Admissions", answer: "Admissions are open at Eaglewood Polytechnic Institute. Call +91 94237 16230 or visit the admission office for eligibility, documents and seat guidance.", category: "Admissions", keywords: ["admission", "apply", "eligibility"], priority: 10 },
    { question: "Courses", answer: "Eaglewood offers engineering programs through departments such as Civil, Computer, Electrical, and AI & Machine Learning.", category: "Courses", keywords: ["courses", "programs", "branches"], priority: 9 },
    { question: "Contact", answer: "Contact Eaglewood at +91 94237 16230 or eaglewoodpoly@gmail.com. Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131.", category: "Contact", keywords: ["contact", "phone", "email"], priority: 9 },
    { question: "Fees", answer: "For the latest fee details and scholarship guidance, call the admission office at +91 94237 16230.", category: "Fees", keywords: ["fees", "fee", "cost"], priority: 8 },
    { question: "Placements", answer: "The Training & Placement Cell provides aptitude training, interview preparation and industry interaction for final-year students.", category: "Placements", keywords: ["placement", "job"], priority: 8 },
    { question: "Hostel", answer: "Hostel facilities are available for students. Contact the admission office for availability and guidelines.", category: "Hostel", keywords: ["hostel", "accommodation"], priority: 7 },
    { question: "Scholarships", answer: "Scholarship guidance is available through the admission office with required documents.", category: "Scholarships", keywords: ["scholarship"], priority: 7 },
    { question: "WhatsApp Admission Help", answer: "WhatsApp: https://wa.me/919423716230", category: "Contact", keywords: ["whatsapp"], priority: 7 },
];

let initPromise;
let unreadCount = 0;
let mobileViewportBound = false;
const MOBILE_BP = 768;
const PANEL_HEIGHT_KEY = "ew_ai_panel_height";

let state = {
    questions: [],
    settings: DEFAULT_SETTINGS,
    messages: [],
    sessionId: readAiSessionId(),
    lastAnswer: null,
    lastQuestion: "",
    isOpen: false,
    isLoading: false,
};

function readAiSessionId() {
    try {
        return localStorage.getItem("ew_ai_session") || crypto.randomUUID();
    } catch {
        return crypto.randomUUID();
    }
}

try {
    localStorage.setItem("ew_ai_session", state.sessionId);
} catch { /* ignore quota/private mode */ }
restoreHistory();

const AI_ICON_SVG = `<svg class="ew-ai__fab-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="5" y="9" width="14" height="11" rx="4" fill="currentColor" opacity="0.95"/>
  <path d="M9 5.5h6a2.5 2.5 0 0 1 2.5 2.5V9H6.5V8A2.5 2.5 0 0 1 9 5.5Z" fill="currentColor" opacity="0.88"/>
  <circle cx="9.5" cy="13" r="1.35" fill="#0f766e"/>
  <circle cx="14.5" cy="13" r="1.35" fill="#0f766e"/>
  <path d="M10 16.2c.7.55 1.4.8 2 .8s1.3-.25 2-.8" stroke="#0f766e" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M12 3.2v2.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="12" cy="2.4" r="1" fill="currentColor"/>
  <path d="M4.5 12.5 3 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M19.5 12.5 21 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;

export async function initAiAssistant() {
    if (initPromise) return initPromise;
    initPromise = mountAiAssistant();
    return initPromise;
}

export function openAiAssistant() {
    const opener = document.getElementById("ewAiFab");
    if (opener) {
        opener.click();
        return;
    }
    void initAiAssistant().then(() => document.getElementById("ewAiFab")?.click());
}

async function mountAiAssistant() {
    if (document.getElementById("ewAi")) return;
    if (!document.querySelector('link[href*="ai-assistant.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "assets/css/ai-assistant.css";
        document.head.appendChild(link);
    }
    await loadKnowledgeBase();
    renderHeaderButton();
    renderAssistant();
    bindAssistant();
    renderHistory();
}

function restoreHistory() {
    try {
        state.messages = JSON.parse(localStorage.getItem("ew_ai_messages") || "[]");
    } catch {
        state.messages = [];
    }
}

function saveHistory() {
    try {
        localStorage.setItem("ew_ai_messages", JSON.stringify(state.messages.slice(-40)));
    } catch { /* ignore quota/private mode */ }
}

function timeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
}

async function loadKnowledgeBase() {
    if (!isCmsAvailable()) {
        state.questions = FALLBACK_QUESTIONS;
        return;
    }
    const [kbResult, promptResult] = await Promise.all([
        safeFetch("ai_knowledge_base", (q) => q.select("id,question,answer,category,keywords,version,published").eq("published", true).order("display_order", { ascending: true }).limit(400), [], "ai:kb"),
        safeFetch("ai_prompts", (q) => q.select("name,greeting_message,fallback_response,quick_replies,suggested_questions,response_delay").eq("published", true).limit(1), [], "ai:prompts"),
    ]);
    const kb = (kbResult.data || []).map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        category: row.category || "Knowledge Base",
        keywords: row.keywords || "",
        priority: Number(row.version || 0),
    }));
    state.questions = kb.length ? kb : FALLBACK_QUESTIONS;
    const prompt = promptResult.data?.[0];
    if (prompt) {
        state.settings = {
            ...DEFAULT_SETTINGS,
            assistant_name: prompt.name || DEFAULT_SETTINGS.assistant_name,
            welcome_message: prompt.greeting_message || DEFAULT_SETTINGS.welcome_message,
            fallback_message: prompt.fallback_response || DEFAULT_SETTINGS.fallback_message,
            typing_speed: Number(prompt.response_delay || DEFAULT_SETTINGS.typing_speed),
            suggested_questions: toArray(prompt.suggested_questions || prompt.quick_replies) || DEFAULT_SETTINGS.suggested_questions,
        };
    }
}

function renderHeaderButton() {
    const nav = document.querySelector(".nav-links, nav ul, header nav");
    if (!nav || document.querySelector(".ask-ai-nav")) return;
    const button = document.createElement("button");
    button.className = "ask-ai-nav";
    button.type = "button";
    button.innerHTML = '<span class="ask-ai-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="5" y="9" width="14" height="11" rx="4" fill="currentColor"/><circle cx="9.5" cy="13" r="1" fill="#0f766e"/><circle cx="14.5" cy="13" r="1" fill="#0f766e"/></svg></span><span>Ask AI</span>';
    button.setAttribute("aria-label", "Ask Eaglewood AI");
    if (nav.tagName === "UL") {
        const item = document.createElement("li");
        item.className = "ask-ai-item";
        item.appendChild(button);
        nav.appendChild(item);
    } else {
        nav.appendChild(button);
    }
}

const FAB_ICON = AI_ICON_SVG;

function renderAssistant() {
    const s = state.settings;
    const displayName = "AI Assistant";
    document.documentElement.style.setProperty("--ai-primary", s.primary_color || DEFAULT_SETTINGS.primary_color);
    document.body.insertAdjacentHTML("beforeend", `
        <div class="ew-ai__backdrop" id="ewAiBackdrop" hidden></div>
        <aside class="ew-ai" id="ewAi" data-ai-assistant aria-live="polite">
            <div class="ew-ai__fab-wrap">
                <button class="ew-ai__fab" id="ewAiFab" type="button" aria-label="Open ${esc(displayName)}" aria-expanded="false" aria-controls="ewAiPanel">
                    <span class="ew-ai__fab-icon">${FAB_ICON}</span>
                    <span class="ew-ai__badge" id="ewAiBadge" aria-hidden="true"></span>
                </button>
            </div>
            <section class="ew-ai__panel ew-ai__panel--mobile-full" id="ewAiPanel" aria-label="${esc(displayName)}" role="dialog" aria-modal="true" hidden>
                <header class="ew-ai__head">
                    <div class="ew-ai__avatar" aria-hidden="true">${FAB_ICON}</div>
                    <div class="ew-ai__meta">
                        <small>Online</small>
                        <strong>${esc(displayName)}</strong>
                    </div>
                    <div class="ew-ai__toolbar">
                        <button class="ew-ai__tool" id="ewAiMinimize" type="button" title="Minimize" aria-label="Minimize assistant">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14"/></svg>
                        </button>
                        <button class="ew-ai__close" id="ewAiClose" type="button" aria-label="Close assistant">×</button>
                    </div>
                </header>
                <div class="ew-ai__quick-actions">
                    <a href="admission.html">Admission</a>
                    <a href="tel:+919423716230">Call</a>
                    <a href="https://wa.me/919423716230" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    <a href="courses.html">Courses</a>
                </div>
                <div class="ew-ai__body" id="ewAiBody">
                    <div class="ew-ai__welcome" id="ewAiWelcome">
                        <h3>${esc(timeGreeting())}</h3>
                        <p>${esc(s.welcome_message)}</p>
                        <div class="ew-ai__chips">${topicButtons().join("")}</div>
                    </div>
                    <div class="ew-ai__instant" id="ewAiInstant" hidden></div>
                    <div class="ew-ai__messages" id="ewAiMessages"></div>
                </div>
                <button type="button" class="ew-ai__resize" id="ewAiResize" aria-label="Resize chat panel" tabindex="-1"></button>
                <form class="ew-ai__composer" id="ewAiComposer">
                    <textarea id="ewAiInput" rows="1" autocomplete="off" placeholder="Ask anything about Eaglewood..." aria-label="Ask Eaglewood AI" enterkeyhint="send"></textarea>
                    <button class="ew-ai__send" id="ewAiSend" type="submit" aria-label="Send message">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>
                    </button>
                    <span class="ew-ai__hint">Enter to send · Shift+Enter for new line</span>
                </form>
            </section>
        </aside>
    `);
}

function topicButtons() {
    return [...new Set(toArray(state.settings.suggested_questions))].slice(0, 8).map((item) => `<button type="button" data-question="${esc(item)}">${esc(item)}</button>`);
}

function bindAssistant() {
    const root = document.getElementById("ewAi");
    const panel = document.getElementById("ewAiPanel");
    const backdrop = document.getElementById("ewAiBackdrop");
    const input = document.getElementById("ewAiInput");
    const fab = document.getElementById("ewAiFab");

    const open = async () => {
        await loadKnowledgeBase();
        clearUnreadBadge();
        panel.hidden = false;
        backdrop.hidden = false;
        panel.classList.remove("is-minimized");
        root.classList.add("open");
        state.isOpen = true;
        fab.setAttribute("aria-expanded", "true");
        if (isMobileView()) {
            document.body.classList.add("no-scroll");
            panel.classList.add("ew-ai__panel--mobile-full");
            bindMobileViewport();
        }
        applySavedPanelHeight();
        requestAnimationFrame(() => {
            panel.classList.add("is-visible");
            backdrop.classList.add("is-visible");
        });
        setTimeout(() => input.focus({ preventScroll: true }), 180);
        scrollToBottom();
    };

    const close = () => {
        panel.classList.remove("is-visible", "is-minimized");
        backdrop.classList.remove("is-visible");
        root.classList.remove("open");
        state.isOpen = false;
        fab.setAttribute("aria-expanded", "false");
        document.body.classList.remove("no-scroll");
        setTimeout(() => {
            panel.hidden = true;
            backdrop.hidden = true;
            fab.focus({ preventScroll: true });
        }, 320);
    };

    const minimize = () => {
        if (!state.isOpen) return;
        panel.classList.remove("is-visible");
        panel.classList.add("is-minimized");
        backdrop.classList.remove("is-visible");
        root.classList.remove("open");
        state.isOpen = false;
        fab.setAttribute("aria-expanded", "false");
        setTimeout(() => {
            panel.hidden = true;
            backdrop.hidden = true;
            fab.focus({ preventScroll: true });
        }, 280);
    };

    fab.addEventListener("click", () => (state.isOpen ? close() : open()));
    document.querySelector(".ask-ai-nav")?.addEventListener("click", () => (state.isOpen ? close() : open()));
    document.getElementById("ewAiClose").addEventListener("click", close);
    document.getElementById("ewAiMinimize").addEventListener("click", minimize);
    backdrop.addEventListener("click", close);
    root.addEventListener("click", handleAssistantClick);
    input.addEventListener("input", debounce(() => {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
        renderInstantSuggestions(input.value);
    }, 160));
    document.getElementById("ewAiComposer").addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        submitQuestion();
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submitQuestion();
        }
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.isOpen) close(); });
    bindPanelResize();
}

function isMobileView() {
    return window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;
}

function bindMobileViewport() {
    if (mobileViewportBound || !window.visualViewport) return;
    mobileViewportBound = true;
    const sync = () => {
        if (!state.isOpen || !isMobileView()) return;
        const vv = window.visualViewport;
        const height = vv ? vv.height : window.innerHeight;
        document.documentElement.style.setProperty("--ew-ai-vh", `${height}px`);
        const offset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
        const panel = document.getElementById("ewAiPanel");
        const composer = document.getElementById("ewAiComposer");
        if (panel) panel.style.setProperty("--ew-ai-kb-offset", `${offset}px`);
        if (composer) composer.style.marginBottom = offset > 0 ? `${offset}px` : "";
        scrollToBottom();
    };
    window.visualViewport.addEventListener("resize", sync);
    window.visualViewport.addEventListener("scroll", sync);
    sync();
}

function bindPanelResize() {
    const grip = document.getElementById("ewAiResize");
    const panel = document.getElementById("ewAiPanel");
    if (!grip || !panel) return;
    let startY = 0;
    let startH = 0;
    const onMove = (event) => {
        const y = event.touches ? event.touches[0].clientY : event.clientY;
        const next = Math.min(window.innerHeight - 120, Math.max(420, startH + (startY - y)));
        panel.style.height = `${next}px`;
        panel.style.maxHeight = `${next}px`;
    };
    const onEnd = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
        try {
            localStorage.setItem(PANEL_HEIGHT_KEY, String(parseInt(panel.style.height, 10) || 0));
        } catch { /* ignore */ }
    };
    grip.addEventListener("mousedown", (event) => {
        if (isMobileView()) return;
        startY = event.clientY;
        startH = panel.getBoundingClientRect().height;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onEnd);
    });
    grip.addEventListener("touchstart", (event) => {
        if (isMobileView()) return;
        startY = event.touches[0].clientY;
        startH = panel.getBoundingClientRect().height;
        document.addEventListener("touchmove", onMove, { passive: true });
        document.addEventListener("touchend", onEnd);
    }, { passive: true });
}

function applySavedPanelHeight() {
    if (isMobileView()) return;
    const panel = document.getElementById("ewAiPanel");
    if (!panel) return;
    try {
        const saved = Number(localStorage.getItem(PANEL_HEIGHT_KEY) || 0);
        if (saved >= 420 && saved <= window.innerHeight - 80) {
            panel.style.height = `${saved}px`;
            panel.style.maxHeight = `${saved}px`;
        }
    } catch { /* ignore */ }
}

function setUnreadBadge(count) {
    unreadCount = Math.max(0, count);
    const badge = document.getElementById("ewAiBadge");
    if (!badge) return;
    if (!unreadCount || state.isOpen) {
        badge.textContent = "";
        badge.classList.remove("is-visible");
        return;
    }
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    badge.classList.add("is-visible");
}

function clearUnreadBadge() {
    setUnreadBadge(0);
}

function bumpUnreadBadge() {
    if (state.isOpen) return;
    setUnreadBadge(unreadCount + 1);
}

function clearChat() {
    state.messages = [];
    saveHistory();
    document.getElementById("ewAiMessages").innerHTML = "";
    const welcome = document.getElementById("ewAiWelcome");
    if (welcome) welcome.hidden = false;
    state.lastAnswer = null;
    state.lastQuestion = "";
}

function renderHistory() {
    if (!state.messages.length) return;
    document.getElementById("ewAiWelcome")?.remove();
    state.messages.forEach((msg) => {
        if (msg.role === "user") addBubble(msg.text, "user", msg.time, false);
        else if (msg.role === "answer") renderAnswerCard(msg.payload, false);
        else if (msg.role === "error") addErrorBubble(msg.text, false);
    });
    scrollToBottom();
}

function submitQuestion() {
    if (state.isLoading) return;
    const input = document.getElementById("ewAiInput");
    const value = input.value;
    if (!sanitize(value)) return;
    input.value = "";
    input.style.height = "auto";
    hideInstant();
    ask(value);
}

function handleAssistantClick(event) {
    const question = event.target.closest("[data-question]")?.dataset.question;
    if (question) ask(question);
    if (event.target.closest("[data-copy]")) copyText(state.lastAnswer?.answer || "");
    if (event.target.closest("[data-share]")) shareAnswer();
    if (event.target.closest("[data-rating]")) void saveFeedback(event).catch(() => {});
    if (event.target.closest("[data-retry]")) ask(state.lastQuestion);
    if (event.target.closest("[data-ask-again]")) ask(state.lastQuestion);
}

async function ask(rawQuestion) {
    const question = sanitize(rawQuestion);
    if (!question || state.isLoading) return;
    document.getElementById("ewAiWelcome")?.remove();
    state.lastQuestion = question;
    state.isLoading = true;
    addBubble(question, "user");
    const thinking = addTypingBubble();
    try {
        const answer = searchKnowledge(question);
        await delay(Number(state.settings.typing_speed || 260));
        thinking.remove();
        state.lastAnswer = answer;
        renderAnswerCard(answer);
        await persistResult(question, answer);
    } catch {
        thinking.remove();
        addErrorBubble("Something went wrong. Please try again.");
    } finally {
        state.isLoading = false;
        scrollToBottom();
    }
}

function searchKnowledge(question) {
    const queryTokens = expandTokens(tokenize(question));
    const matches = state.questions.map((item) => scoreQuestion(item, queryTokens, question)).sort((a, b) => b.confidence - a.confidence || Number(b.priority || 0) - Number(a.priority || 0));
    const best = matches[0];
    if (best?.confidence >= 38) return answerPayload(best, "Knowledge Base");
    return { answer: state.settings.fallback_message, confidence: 0, category: "Unanswered", source: "Needs training", related: relatedQuestions(queryTokens) };
}

function scoreQuestion(item, queryTokens, original) {
    const exact = clean(item.question) === clean(original) ? 55 : 0;
    const partial = clean(item.question).includes(clean(original)) || clean(original).includes(clean(item.question)) ? 25 : 0;
    const keywordText = clean(`${item.keywords || ""}`);
    const titleText = clean(item.question);
    const answerText = clean(item.answer);
    const keyword = queryTokens.filter((token) => keywordText.includes(token)).length * 13;
    const title = queryTokens.filter((token) => titleText.includes(token)).length * 9;
    const content = queryTokens.filter((token) => answerText.includes(token)).length * 3;
    return { ...item, confidence: Math.min(99, exact + partial + keyword + title + content + Number(item.priority || 0)) };
}

function answerPayload(item, source) {
    return { answer: item.answer, confidence: Math.max(1, Math.round(item.confidence)), category: item.category || "Knowledge Base", source, related: relatedQuestions(tokenize(item.question)).filter((q) => q !== item.question).slice(0, 3), id: item.id };
}

function renderAnswerCard(result, persist = true) {
    const isUnavailable = !result.confidence;
    const related = result.related?.length && !isUnavailable
        ? `<div class="ew-ai__chips">${result.related.map((q) => `<button type="button" data-question="${esc(q)}">${esc(q)}</button>`).join("")}</div>`
        : "";
    const top = isUnavailable
        ? `<div class="ew-ai__card-top"><span class="ew-ai__badge ew-ai__badge--warn">Forwarded to Admin</span></div>`
        : `<div class="ew-ai__card-top"><span class="ew-ai__badge">${esc(result.category)}</span><span class="ew-ai__badge ew-ai__badge--warn">${result.confidence}% match</span></div>`;
    const actions = isUnavailable
        ? `<div class="ew-ai__actions"><button data-retry type="button">Retry</button><button data-ask-again type="button">Ask again</button></div>`
        : `<div class="ew-ai__actions"><button data-copy type="button">Copy</button><button data-share type="button">Share</button><button data-rating="5" type="button">Like</button><button data-rating="1" type="button">Dislike</button></div>`;
    const time = new Date().toISOString();
    document.getElementById("ewAiMessages").insertAdjacentHTML("beforeend", `
        <article class="ew-ai__card ${isUnavailable ? "is-unavailable" : ""}">
            ${top}
            <div class="ew-ai__card-body">${formatAnswer(result.answer)}</div>
            ${isUnavailable ? "" : `<div class="ew-ai__source">Source: ${esc(result.source)}</div>`}
            ${related}
            ${actions}
            <time datetime="${time}">${formatTime(time)}</time>
        </article>
    `);
    if (persist) {
        state.messages.push({ role: "answer", payload: result, time });
        saveHistory();
    }
    if (!state.isOpen) bumpUnreadBadge();
    scrollToBottom();
}

function addErrorBubble(text, persist = true) {
    const time = new Date().toISOString();
    document.getElementById("ewAiMessages").insertAdjacentHTML("beforeend", `
        <div class="ew-ai__msg ew-ai__msg--error">
            <p>${esc(text)}</p>
            <button type="button" data-retry>Retry</button>
            <time datetime="${time}">${formatTime(time)}</time>
        </div>
    `);
    if (persist) {
        state.messages.push({ role: "error", text, time });
        saveHistory();
    }
}

function formatTime(value = new Date()) {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderInstantSuggestions(value) {
    const box = document.getElementById("ewAiInstant");
    const q = sanitize(value);
    if (!q) return hideInstant();
    const tokens = expandTokens(tokenize(q));
    const matches = state.questions.map((item) => scoreQuestion(item, tokens, q)).filter((item) => item.confidence > 8).sort((a, b) => b.confidence - a.confidence).slice(0, 6);
    if (!matches.length) return hideInstant();
    box.hidden = false;
    box.innerHTML = matches.map((item) => `<button type="button" data-question="${esc(item.question)}"><strong>${esc(item.question)}</strong><span>${esc(item.category || "Knowledge Base")}</span></button>`).join("");
}

function hideInstant() { const box = document.getElementById("ewAiInstant"); if (box) box.hidden = true; }

function addTypingBubble() {
    const el = document.getElementById("ewAiMessages");
    el.insertAdjacentHTML("beforeend", `<div class="ew-ai__msg ew-ai__msg--bot ew-ai__msg--typing" aria-live="polite"><span class="ew-ai__dots" aria-hidden="true"><span></span><span></span><span></span></span><span class="sr-only">Assistant is thinking</span></div>`);
    scrollToBottom();
    return el.lastElementChild;
}

function addBubble(text, type, timeValue, persist = true) {
    const el = document.getElementById("ewAiMessages");
    const time = timeValue || new Date().toISOString();
    const cls = type.includes("user") ? "ew-ai__msg ew-ai__msg--user" : "ew-ai__msg ew-ai__msg--bot";
    el.insertAdjacentHTML("beforeend", `<div class="${cls}"><div class="ew-ai__bubble">${formatAnswer(text)}</div><time datetime="${time}">${formatTime(time)}</time></div>`);
    if (persist && type.includes("user")) {
        state.messages.push({ role: "user", text, time });
        saveHistory();
    }
    scrollToBottom();
    return el.lastElementChild;
}

function scrollToBottom() {
    const body = document.getElementById("ewAiBody");
    if (body) body.scrollTop = body.scrollHeight;
}

function relatedQuestions(tokens) {
    const expanded = expandTokens(tokens);
    return state.questions.map((item) => scoreQuestion(item, expanded, expanded.join(" "))).filter((item) => item.confidence > 5).sort((a, b) => b.confidence - a.confidence).map((item) => item.question).slice(0, 6);
}

function tokenize(text) { return clean(text).split(" ").filter((word) => word.length > 2); }
function expandTokens(tokens) { return [...new Set(tokens.flatMap((token) => [token, ...(SYNONYMS[token] || []), ...Object.entries(SYNONYMS).filter(([, list]) => list.includes(token)).map(([key]) => key)]))]; }
function clean(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097F ]/g, " ").replace(/\s+/g, " ").trim(); }
function sanitize(text) { return String(text || "").replace(/[<>]/g, "").trim().slice(0, 500); }

function formatAnswer(text) {
    let raw = esc(text);
    raw = raw.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    raw = raw.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    raw = raw.replace(/\*(.*?)\*/g, "<em>$1</em>");
    raw = raw.replace(/`([^`]+)`/g, "<code>$1</code>");
    raw = raw.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    raw = raw.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    raw = raw.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
    raw = raw.replace(/(<li>.*<\/li>)/gs, (match) => `<ul>${match}</ul>`);
    raw = raw.replace(/\n/g, "<br>");
    raw = raw.replace(/<br><ul>/g, "<ul>");
    raw = raw.replace(/<\/ul><br>/g, "</ul>");
    return raw;
}

function toArray(value) { return Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n|,/).map((x) => x.trim()).filter(Boolean) : []; }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(ms, 100), 1200))); }
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }
function esc(value) { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; }

async function persistResult(question, answer) {
    if (!isCmsAvailable()) return;
    await safeInsert("ai_conversations", {
        session_id: state.sessionId,
        question,
        answer: answer.answer,
        status: answer.confidence > 0 ? "answered" : "pending",
        metadata: { confidence: answer.confidence, category: answer.category, source: answer.source },
    });
    if (answer.confidence > 0) return;
    await safeInsert("inquiries", {
        name: "AI Unanswered Question",
        phone: "0000000000",
        email: "ai@eaglewoodpoly.in",
        course: answer.category || "AI Assistant",
        message: `[AI Training Required]\nQuestion: ${question}`,
        status: "new",
        reply_status: "pending",
    });
}

async function saveFeedback(event) {
    const button = event?.target?.closest?.("[data-rating]");
    const rating = Number(button?.dataset?.rating || 0);
    if (!state.lastQuestion || !rating) return;
    if (isCmsAvailable()) {
        const result = await safeInsert("ai_conversations", {
            session_id: state.sessionId,
            question: state.lastQuestion,
            answer: state.lastAnswer?.answer || "",
            rating,
            status: "feedback",
            metadata: { feedback: rating >= 4 ? "positive" : "negative" },
        });
        if (!result.ok) return;
    }
    addBubble("Thank you. Your feedback helps improve the institute assistant.", "bot", null, false);
}

function copyText(text) { navigator.clipboard?.writeText(text); }
function shareAnswer() { if (navigator.share && state.lastAnswer) navigator.share({ title: "Eaglewood AI Answer", text: state.lastAnswer.answer }); }
