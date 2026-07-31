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

let initPromise;

const FALLBACK_QUESTIONS = [
    { question: "Admissions", answer: "Admissions are open at Eaglewood Polytechnic Institute. Call +91 94237 16230 or visit the admission office for eligibility, documents and seat guidance.", category: "Admissions", keywords: ["admission", "apply", "eligibility"], priority: 10 },
    { question: "Courses", answer: "Eaglewood offers engineering programs through departments such as Civil, Computer, Electrical, Artificial Intelligence and AIML.", category: "Courses", keywords: ["courses", "programs", "branches"], priority: 9 },
    { question: "Contact", answer: "Contact Eaglewood at +91 94237 16230 or eaglewoodpoly@gmail.com. Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131.", category: "Contact", keywords: ["contact", "phone", "email"], priority: 9 },
    { question: "Fees", answer: "For the latest fee details and scholarship guidance, call the admission office at +91 94237 16230.", category: "Fees", keywords: ["fees", "fee", "cost"], priority: 8 },
    { question: "Departments", answer: "Focused academic departments with practical labs, workshops and faculty mentoring.", category: "Departments", keywords: ["departments", "labs"], priority: 8 },
    { question: "Scholarships", answer: "Scholarship guidance is available through the admission office with required documents.", category: "Scholarships", keywords: ["scholarship"], priority: 7 },
    { question: "Call Office", answer: "Call the admission office at +91 94237 16230.", category: "Contact", keywords: ["call", "office"], priority: 7 },
    { question: "WhatsApp Admission Help", answer: "WhatsApp: https://wa.me/919423716230", category: "Contact", keywords: ["whatsapp"], priority: 7 },
];

let state = {
    questions: [],
    settings: DEFAULT_SETTINGS,
    recent: JSON.parse(localStorage.getItem("ew_ai_recent") || "[]"),
    sessionId: localStorage.getItem("ew_ai_session") || crypto.randomUUID(),
    lastAnswer: null,
    lastQuestion: "",
};
localStorage.setItem("ew_ai_session", state.sessionId);

export async function initAiAssistant() {
    if (initPromise) return initPromise;
    initPromise = mountAiAssistant();
    return initPromise;
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
        safeFetch("ai_prompts", (q) => q.select("name,greeting_message,fallback_response,quick_replies,suggested_questions,temperature,token_limit,response_delay").eq("published", true).limit(1), [], "ai:prompts"),
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
            primary_color: DEFAULT_SETTINGS.primary_color,
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
    button.innerHTML = '<span class="ask-ai-mark" aria-hidden="true">AI</span><span>Ask AI</span>';
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

function renderAssistant() {
    const s = state.settings;
    const greeting = timeGreeting();
    document.documentElement.style.setProperty("--ai-primary", s.primary_color || DEFAULT_SETTINGS.primary_color);
    document.body.insertAdjacentHTML("beforeend", `
        <aside class="ew-ai" id="ewAi" data-ai-assistant aria-live="polite">
            <button class="ew-ai__fab" id="ewAiFab" type="button" aria-label="Open ${esc(s.assistant_name)}">
                <span class="ew-ai__fab-icon" aria-hidden="true">AI</span>
                <span class="ew-ai__fab-label">Ask AI</span>
            </button>
            <section class="ew-ai__panel" id="ewAiPanel" aria-label="${esc(s.assistant_name)}" hidden>
                <header class="ew-ai__head">
                    <div class="ew-ai__avatar" aria-hidden="true">AI</div>
                    <div class="ew-ai__meta">
                        <small>Online</small>
                        <strong>${esc(s.assistant_name)}</strong>
                    </div>
                    <button class="ew-ai__close" id="ewAiClose" type="button" aria-label="Close assistant">×</button>
                </header>
                <div class="ew-ai__body" id="ewAiBody">
                    <div class="ew-ai__welcome" id="ewAiWelcome">
                        <h3>${esc(greeting)}</h3>
                        <p>${esc(s.welcome_message)}</p>
                        <div class="ew-ai__chips">${topicButtons().join("")}</div>
                    </div>
                    <div class="ew-ai__instant" id="ewAiInstant" hidden></div>
                    <div class="ew-ai__messages" id="ewAiMessages"></div>
                </div>
                <form class="ew-ai__composer" id="ewAiComposer">
                    <textarea id="ewAiInput" rows="1" autocomplete="off" placeholder="Ask anything about Eaglewood..." aria-label="Ask Eaglewood AI"></textarea>
                    <button class="ew-ai__send" id="ewAiSend" type="submit" aria-label="Send message">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>
                    </button>
                    <span class="ew-ai__hint">Press Enter to send · Shift+Enter for new line</span>
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
    const input = document.getElementById("ewAiInput");
    const open = () => { panel.hidden = false; root.classList.add("open"); setTimeout(() => input.focus(), 80); };
    const close = () => { panel.hidden = true; root.classList.remove("open"); };

    document.getElementById("ewAiFab").addEventListener("click", async () => { await loadKnowledgeBase(); open(); });
    document.querySelector(".ask-ai-nav")?.addEventListener("click", async () => { await loadKnowledgeBase(); open(); });
    document.getElementById("ewAiClose").addEventListener("click", close);
    root.addEventListener("click", handleAssistantClick);
    input.addEventListener("input", debounce(() => {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
        renderInstantSuggestions(input.value);
    }, 160));
    document.getElementById("ewAiComposer").addEventListener("submit", (event) => { event.preventDefault(); submitQuestion(); });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitQuestion(); } });
}

function submitQuestion() {
    const input = document.getElementById("ewAiInput");
    const value = input.value;
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
    if (event.target.closest("[data-rating]")) saveFeedback(event);
    if (event.target.closest("[data-ask-again]")) ask(state.lastQuestion);
}

async function ask(rawQuestion) {
    const question = sanitize(rawQuestion);
    if (!question) return;
    document.getElementById("ewAiWelcome")?.remove();
    state.lastQuestion = question;
    remember(question);
    addBubble(question, "user");
    const thinking = addBubble("Thinking...", "bot typing");
    const answer = searchKnowledge(question);
    await delay(Number(state.settings.typing_speed || 260));
    thinking.remove();
    state.lastAnswer = answer;
    addAnswerCard(answer, question);
    await persistResult(question, answer);
    document.getElementById("ewAiBody").scrollTop = document.getElementById("ewAiBody").scrollHeight;
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

function addAnswerCard(result) {
    const isUnavailable = !result.confidence;
    const related = result.related?.length && !isUnavailable
        ? `<div class="ew-ai__chips">${result.related.map((q) => `<button type="button" data-question="${esc(q)}">${esc(q)}</button>`).join("")}</div>`
        : "";
    const top = isUnavailable
        ? `<div class="ew-ai__card-top"><span class="ew-ai__badge ew-ai__badge--warn">Forwarded to Admin</span></div>`
        : `<div class="ew-ai__card-top"><span class="ew-ai__badge">${esc(result.category)}</span><span class="ew-ai__badge ew-ai__badge--warn">${result.confidence}% match</span></div>`;
    const actions = isUnavailable
        ? `<div class="ew-ai__actions"><button data-ask-again type="button">Ask again</button></div>`
        : `<div class="ew-ai__actions"><button data-copy type="button">Copy</button><button data-share type="button">Share</button><button data-rating="5" type="button">Like</button><button data-rating="1" type="button">Dislike</button><button data-ask-again type="button">Regenerate</button></div>`;
    document.getElementById("ewAiMessages").insertAdjacentHTML("beforeend", `
        <article class="ew-ai__card ${isUnavailable ? "is-unavailable" : ""}">
            ${top}
            <p>${formatAnswer(result.answer)}</p>
            ${isUnavailable ? "" : `<div class="ew-ai__source">Source: ${esc(result.source)}</div>`}
            ${related}
            ${actions}
            <time datetime="${new Date().toISOString()}">${formatTime()}</time>
        </article>
    `);
    document.getElementById("ewAiBody").scrollTop = document.getElementById("ewAiBody").scrollHeight;
}

function formatTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
function addBubble(text, type) {
    const el = document.getElementById("ewAiMessages");
    const cls = type.includes("user") ? "ew-ai__msg ew-ai__msg--user" : type.includes("typing") ? "ew-ai__msg ew-ai__msg--bot ew-ai__msg--typing" : "ew-ai__msg ew-ai__msg--bot";
    el.insertAdjacentHTML("beforeend", `<div class="${cls}">${esc(text)}${type.includes("user") ? `<time datetime="${new Date().toISOString()}">${formatTime()}</time>` : ""}</div>`);
    document.getElementById("ewAiBody").scrollTop = document.getElementById("ewAiBody").scrollHeight;
    return el.lastElementChild;
}
function remember(question) { state.recent = [question, ...state.recent.filter((q) => q !== question)].slice(0, 8); localStorage.setItem("ew_ai_recent", JSON.stringify(state.recent)); }
function relatedQuestions(tokens) { const expanded = expandTokens(tokens); return state.questions.map((item) => scoreQuestion(item, expanded, expanded.join(" "))).filter((item) => item.confidence > 5).sort((a, b) => b.confidence - a.confidence).map((item) => item.question).slice(0, 6); }
function tokenize(text) { return clean(text).split(" ").filter((word) => word.length > 2); }
function expandTokens(tokens) { return [...new Set(tokens.flatMap((token) => [token, ...(SYNONYMS[token] || []), ...Object.entries(SYNONYMS).filter(([, list]) => list.includes(token)).map(([key]) => key)]))]; }
function clean(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097F ]/g, " ").replace(/\s+/g, " ").trim(); }
function sanitize(text) { return String(text || "").replace(/[<>]/g, "").trim().slice(0, 500); }
function formatAnswer(text) { return esc(text).replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); }
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
        await safeInsert("ai_conversations", {
        session_id: state.sessionId,
        question: state.lastQuestion,
        answer: state.lastAnswer?.answer || "",
        rating,
        status: "feedback",
        metadata: { feedback: rating >= 4 ? "positive" : "negative" },
        });
    }
    addBubble("Thank you. Your feedback helps improve the institute assistant.", "bot");
}

function copyText(text) { navigator.clipboard?.writeText(text); }
function shareAnswer() { if (navigator.share && state.lastAnswer) navigator.share({ title: "Eaglewood AI Answer", text: state.lastAnswer.answer }); }
