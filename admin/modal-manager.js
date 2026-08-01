/**
 * Centralized admin modal manager — one modal, one backdrop, clean teardown.
 *
 * Z-index hierarchy (see admin-polish.css):
 *   Loading 9990 · Backdrop 9995 · Modal 10000 · Dropdown 10010 · Tooltip 10020
 */

const BACKDROP_ID = "adminModalBackdrop";
const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

let activeDialog = null;
let onEscapeHandler = null;
let escListener = null;
let focusTrapListener = null;
let cancelListener = null;
let previousFocus = null;

function ensureBackdrop() {
    let backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.id = BACKDROP_ID;
        backdrop.className = "modal-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        backdrop.hidden = true;
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => {
            if (!activeDialog) return;
            if (typeof onEscapeHandler === "function") onEscapeHandler();
            else closeAllModals();
        });
    }
    return backdrop;
}

function getFocusable(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden && el.getAttribute("aria-hidden") !== "true");
}

function lockBody() {
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
}

function unlockBody() {
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
}

function detachDialogListeners(dialog) {
    if (focusTrapListener) {
        dialog?.removeEventListener("keydown", focusTrapListener);
        focusTrapListener = null;
    }
    if (cancelListener) {
        dialog?.removeEventListener("cancel", cancelListener);
        cancelListener = null;
    }
}

function removeEscListener() {
    if (escListener) {
        document.removeEventListener("keydown", escListener, true);
        escListener = null;
    }
}

function setupFocusTrap(dialog) {
    focusTrapListener = (event) => {
        if (event.key !== "Tab" || !activeDialog) return;
        const nodes = getFocusable(dialog);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    dialog.addEventListener("keydown", focusTrapListener);
}

function setupEsc() {
    escListener = (event) => {
        if (event.key !== "Escape" || !activeDialog) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof onEscapeHandler === "function") onEscapeHandler();
        else closeAllModals();
    };
    document.addEventListener("keydown", escListener, true);
}

export function closeAllModals() {
    const closing = activeDialog;
    detachDialogListeners(closing);

    document.querySelectorAll("dialog.admin-modal").forEach((dialog) => {
        try {
            if (dialog.open) dialog.close();
        } catch {
            /* ignore */
        }
        dialog.removeAttribute("open");
    });

    document.querySelectorAll(".modal-backdrop").forEach((node) => {
        if (node.id === BACKDROP_ID) {
            node.hidden = true;
            node.classList.remove("is-visible");
            node.setAttribute("aria-hidden", "true");
        } else {
            node.remove();
        }
    });

    removeEscListener();
    unlockBody();
    activeDialog = null;
    onEscapeHandler = null;

    if (previousFocus && typeof previousFocus.focus === "function") {
        try {
            previousFocus.focus({ preventScroll: true });
        } catch {
            /* ignore */
        }
    }
    previousFocus = null;
}

export function isModalOpen() {
    return Boolean(activeDialog);
}

export function openModal(dialogEl, { onEscape } = {}) {
    if (!dialogEl) return;

    closeAllModals();

    const backdrop = ensureBackdrop();
    activeDialog = dialogEl;
    onEscapeHandler = onEscape || null;
    previousFocus = document.activeElement;

    lockBody();
    backdrop.hidden = false;
    backdrop.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => backdrop.classList.add("is-visible"));

    // show() — not showModal() — avoids native ::backdrop stacking per dialog
    if (typeof dialogEl.show === "function") {
        dialogEl.show();
    } else {
        dialogEl.setAttribute("open", "");
    }

    setupFocusTrap(dialogEl);
    setupEsc();

    cancelListener = (event) => {
        event.preventDefault();
        if (typeof onEscapeHandler === "function") onEscapeHandler();
        else closeAllModals();
    };
    dialogEl.addEventListener("cancel", cancelListener);

    const focusables = getFocusable(dialogEl);
    const target = focusables.find((el) => el.tagName !== "BUTTON" || !el.classList.contains("dialog-close")) || focusables[0];
    (target || dialogEl).focus?.();
}

export function closeModal(dialogEl) {
    if (dialogEl?.open) {
        try {
            dialogEl.close();
        } catch {
            /* ignore */
        }
    }
    closeAllModals();
}

export function getActiveModal() {
    return activeDialog;
}

export const ModalManager = {
    open: openModal,
    close: closeModal,
    closeAll: closeAllModals,
    isOpen: isModalOpen,
    getActive: getActiveModal,
};
