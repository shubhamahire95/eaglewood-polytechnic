/**
 * Eaglewood Polytechnic — Shared Utilities
 * Reusable helpers for rendering, performance, and CMS field binding.
 */

/** Escape HTML to prevent XSS when interpolating CMS content. */
export const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/** Build data-section / data-field attribute string for CMS binding. */
export const cmsAttrs = (section, field) =>
    `data-section="${escapeHtml(section)}" data-field="${escapeHtml(field)}"`;

/** Resolve a DOM container by id; returns null if missing. */
export const getSection = (id) => document.getElementById(id);

/** Debounce — delays execution until activity pauses (scroll handlers). */
export const debounce = (fn, wait = 16) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
};

/** Throttle — limits execution rate (resize handlers). */
export const throttle = (fn, wait = 150) => {
    let last = 0;
    let timer;
    return (...args) => {
        const now = Date.now();
        const remaining = wait - (now - last);
        if (remaining <= 0) {
            clearTimeout(timer);
            last = now;
            fn(...args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn(...args);
            }, remaining);
        }
    };
};

/** Map button variant to existing CSS class names. */
export const btnClass = (variant = "primary") => {
    const map = {
        primary: "btn",
        ghost: "btn btn-ghost",
        teal: "btn btn-teal",
        white: "btn btn-white",
    };
    return map[variant] || map.primary;
};

/** Create a lazy-loaded image element as HTML string. */
export const lazyImage = ({ src, alt = "", className = "", id = "" }) => {
    const idAttr = id ? ` id="${escapeHtml(id)}"` : "";
    const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
    return `<img${idAttr}${classAttr} src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
};

/** Create an action button / link with CMS attributes. */
export const createButton = (section, field, { label, href, variant = "primary", download = false, id = "" }) => {
    const downloadAttr = download ? " download" : "";
    const idAttr = id ? ` id="${escapeHtml(id)}"` : "";
    return `<a${idAttr} class="${btnClass(variant)} btn-ripple" href="${escapeHtml(href)}"${downloadAttr} ${cmsAttrs(section, field)}>${escapeHtml(label)}</a>`;
};

/** Section head block — eyebrow, title, lead, optional CTA link. */
export const createSectionHead = (section, { eyebrow, heading, lead, link }) => {
    const linkHtml = link
        ? createButton(section, "link", { ...link, variant: "teal", id: `${section}-link` })
        : "";
    return `
    <div class="section-head">
      <div>
        <p class="eyebrow" id="${section}-eyebrow" ${cmsAttrs(section, "eyebrow")}>${escapeHtml(eyebrow)}</p>
        <h2 class="section-title" id="${section}-heading" ${cmsAttrs(section, "heading")}>${escapeHtml(heading)}</h2>
        ${lead ? `<p class="section-lead" id="${section}-lead" ${cmsAttrs(section, "lead")}>${escapeHtml(lead)}</p>` : ""}
      </div>
      ${linkHtml}
    </div>`;
};

/** Course card generator. */
export const createCourseCard = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    return `
    <article class="course-block card-hover" id="${escapeHtml(item.id)}">
      <b id="${item.id}-index" ${cmsAttrs(section, `${fieldPrefix}-index`)}>${escapeHtml(item.index)}</b>
      <h3 id="${item.id}-title" ${cmsAttrs(section, `${fieldPrefix}-title`)}>${escapeHtml(item.title)}</h3>
      <p id="${item.id}-description" ${cmsAttrs(section, `${fieldPrefix}-description`)}>${escapeHtml(item.description)}</p>
    </article>`;
};

/** Facility / generic icon card generator (CMS-ready for future sections). */
export const createFacilityCard = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    return `
    <article class="card card-hover" id="${escapeHtml(item.id)}">
      ${item.icon ? `<div class="icon" ${cmsAttrs(section, `${fieldPrefix}-icon`)}>${escapeHtml(item.icon)}</div>` : ""}
      <h3 id="${item.id}-title" ${cmsAttrs(section, `${fieldPrefix}-title`)}>${escapeHtml(item.title)}</h3>
      <p id="${item.id}-description" ${cmsAttrs(section, `${fieldPrefix}-description`)}>${escapeHtml(item.description)}</p>
    </article>`;
};

/** Gallery / photo card generator. */
export const createGalleryCard = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    const imgId = `${item.id}-image`;
    return `
    <article class="photo-card card card-hover img-zoom" id="${escapeHtml(item.id)}">
      ${lazyImage({
          src: item.image.src,
          alt: item.image.alt,
          id: imgId,
      }).replace("<img", `<img ${cmsAttrs(section, `${fieldPrefix}-image`)}`)}
      <div class="photo-card-body">
        <span class="tag" id="${item.id}-tag" ${cmsAttrs(section, `${fieldPrefix}-tag`)}>${escapeHtml(item.tag)}</span>
        <h3 id="${item.id}-title" ${cmsAttrs(section, `${fieldPrefix}-title`)}>${escapeHtml(item.title)}</h3>
        <p id="${item.id}-description" ${cmsAttrs(section, `${fieldPrefix}-description`)}>${escapeHtml(item.description)}</p>
      </div>
    </article>`;
};

/** Event / story card generator (horizontal layout). */
export const createStoryCard = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    return `
    <article class="story-card reveal card-hover img-zoom" id="${escapeHtml(item.id)}">
      ${lazyImage({
          src: item.image.src,
          alt: item.image.alt,
          id: `${item.id}-image`,
      }).replace("<img", `<img ${cmsAttrs(section, `${fieldPrefix}-image`)}`)}
      <div>
        <span class="tag" id="${item.id}-tag" ${cmsAttrs(section, `${fieldPrefix}-tag`)}>${escapeHtml(item.tag)}</span>
        <h3 id="${item.id}-title" ${cmsAttrs(section, `${fieldPrefix}-title`)}>${escapeHtml(item.title)}</h3>
        <p id="${item.id}-description" ${cmsAttrs(section, `${fieldPrefix}-description`)}>${escapeHtml(item.description)}</p>
      </div>
    </article>`;
};

/** Statistic counter block generator. */
export const createStatBlock = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    return `
    <div class="stat-block reveal" id="${escapeHtml(item.id)}">
      <span class="stat-value" id="${item.id}-value" data-count="${item.value}" data-suffix="${escapeHtml(item.suffix || "")}" ${cmsAttrs(section, `${fieldPrefix}-value`)}>0</span>
      <span class="stat-label" id="${item.id}-label" ${cmsAttrs(section, `${fieldPrefix}-label`)}>${escapeHtml(item.label)}</span>
    </div>`;
};

/** Testimonial card generator. */
export const createTestimonialCard = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    return `
    <blockquote class="testimonial-card reveal card-hover" id="${escapeHtml(item.id)}">
      <p id="${item.id}-quote" ${cmsAttrs(section, `${fieldPrefix}-quote`)}>${escapeHtml(item.quote)}</p>
      <footer>
        <strong id="${item.id}-author" ${cmsAttrs(section, `${fieldPrefix}-author`)}>${escapeHtml(item.author)}</strong>
        <span id="${item.id}-role" ${cmsAttrs(section, `${fieldPrefix}-role`)}>${escapeHtml(item.role)}</span>
      </footer>
    </blockquote>`;
};

/** FAQ accordion item generator. */
export const createFaqItem = (section, item, index) => {
    const fieldPrefix = `item-${index}`;
    return `
    <details class="faq-item reveal" id="${escapeHtml(item.id)}">
      <summary id="${item.id}-question" ${cmsAttrs(section, `${fieldPrefix}-question`)}>${escapeHtml(item.question)}</summary>
      <p id="${item.id}-answer" ${cmsAttrs(section, `${fieldPrefix}-answer`)}>${escapeHtml(item.answer)}</p>
    </details>`;
};
