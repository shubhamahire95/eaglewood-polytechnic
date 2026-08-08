/**
 * CMS table column manifest — matches supabase/migrations/001_eaglewood_cms.sql.
 * Used to strip unknown fields and coerce types before PostgREST writes.
 */

/** @type {Record<string, Record<string, string>>} */
export const TABLE_COLUMNS = {
    admins: {
        auth_user_id: "uuid", name: "text", email: "text", password: "text", role: "text",
        permissions: "jsonb", status: "text",
    },
    settings: {
        key: "text", value: "jsonb", published: "boolean", status: "text", display_order: "int",
    },
    home_slides: {
        title: "text", subtitle: "text", image_url: "text", button_primary_label: "text",
        button_primary_url: "text", button_secondary_label: "text", button_secondary_url: "text",
        floating_cards: "jsonb", published: "boolean", status: "text", display_order: "int",
    },
    updates: {
        icon: "text", title: "text", description: "text", image_url: "text", category: "text",
        pinned: "boolean", button_label: "text", button_url: "text", color: "text", date: "date",
        published: "boolean", status: "text", display_order: "int",
    },
    notices: {
        title: "text", description: "text", pdf_url: "text", attachment_url: "text", image_url: "text",
        date: "date", expiry_date: "date", priority: "text", important: "boolean", is_new: "boolean",
        published: "boolean", status: "text", display_order: "int",
    },
    principal_message: {
        photo_url: "text", name: "text", designation: "text", message: "text", signature: "text",
        background_url: "text", institute: "text", qualification: "text",
        published: "boolean", status: "text", display_order: "int",
    },
    courses: {
        department: "text", image_url: "text", title: "text", duration: "text", fees: "text",
        seats: "int", code: "text", description: "text", eligibility: "text", syllabus_pdf_url: "text",
        program_type: "text", button_label: "text", button_url: "text",
        published: "boolean", status: "text", display_order: "int",
    },
    departments: {
        title: "text", hod_name: "text", hod_photo_url: "text", department_image_url: "text",
        description: "text", labs: "text", faculty_count: "int", students_count: "int",
        program_type: "text", button_label: "text", button_url: "text",
        published: "boolean", status: "text", display_order: "int",
    },
    faculty: {
        photo_url: "text", name: "text", qualification: "text", experience: "text", department: "text",
        subjects: "text", email: "text", social_links: "jsonb", published: "boolean", status: "text",
        display_order: "int",
    },
    facilities: {
        title: "text", icon: "text", image_url: "text", description: "text", category: "text",
        published: "boolean", status: "text", display_order: "int",
    },
    placements: {
        title: "text", recruiter: "text", company_logo_url: "text", image_url: "text", package: "text",
        highest_package: "text", average_package: "text", placed_students: "int", training_activities: "text",
        testimonial: "text", student_name: "text", course: "text", published: "boolean", status: "text",
        display_order: "int",
    },
    gallery: {
        title: "text", album: "text", category: "text", image_url: "text", alt: "text",
        description: "text", featured: "boolean", published: "boolean", status: "text", display_order: "int",
    },
    downloads: {
        title: "text", description: "text", file_url: "text", file_type: "text", category: "text",
        published: "boolean", status: "text", display_order: "int",
    },
    media_library: {
        file_url: "text", thumbnail_url: "text", title: "text", file_type: "text", folder: "text",
        alt: "text", tags: "text", size_bytes: "bigint", published: "boolean", status: "text",
        display_order: "int",
    },
    footer_blocks: {
        block_key: "text", title: "text", content: "jsonb", published: "boolean", status: "text",
        display_order: "int",
    },
    inquiries: {
        name: "text", phone: "text", email: "text", course: "text", message: "text",
        assigned_to: "text", reply_status: "text", status: "text",
    },
    admissions: {
        student_name: "text", phone: "text", email: "text", course: "text", previous_school: "text",
        address: "text", message: "text", application_status: "text", payment_status: "text", status: "text",
    },
    contacts: {
        name: "text", email: "text", phone: "text", subject: "text", message: "text",
        assigned_to: "text", reply_status: "text", status: "text",
    },
    ai_knowledge_base: {
        question: "text", answer: "text", category: "text", keywords: "text", version: "int",
        published: "boolean", status: "text", display_order: "int",
    },
    ai_prompts: {
        name: "text", prompt: "text", greeting_message: "text", fallback_response: "text",
        quick_replies: "jsonb", suggested_questions: "jsonb", temperature: "numeric", token_limit: "int",
        response_delay: "int", published: "boolean", status: "text", display_order: "int",
    },
    ai_conversations: {
        session_id: "text", visitor_name: "text", question: "text", answer: "text", rating: "int",
        status: "text", metadata: "jsonb",
    },
};

const READONLY = new Set(["id", "created_at", "updated_at"]);

function isEmptyValue(value) {
    return value === "" || value === undefined;
}

function coerceValue(type, value) {
    if (value === null) return null;
    if (type === "date") {
        if (isEmptyValue(value)) return null;
        const s = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
        return s;
    }
    if (type === "int" || type === "bigint") {
        if (isEmptyValue(value)) return null;
        const n = Number(value);
        return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    if (type === "numeric") {
        if (isEmptyValue(value)) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    if (type === "boolean") {
        if (typeof value === "boolean") return value;
        if (value === "true" || value === true || value === 1 || value === "1") return true;
        if (value === "false" || value === false || value === 0 || value === "0") return false;
        return Boolean(value);
    }
    if (type === "jsonb") {
        if (value === null || value === "") return null;
        if (typeof value === "object") return value;
        try { return JSON.parse(String(value)); } catch { return null; }
    }
    if (type === "uuid") {
        if (isEmptyValue(value)) return null;
        return String(value);
    }
    if (isEmptyValue(value)) return null;
    return String(value);
}

/**
 * Strip unknown columns, readonly fields, and coerce types for PostgREST.
 * @returns {{ payload: object, stripped: string[], coerced: string[] }}
 */
export function sanitizeWritePayload(table, payload) {
    const schema = TABLE_COLUMNS[table];
    const input = { ...(payload || {}) };
    const stripped = [];
    const coerced = [];

    if (!schema) {
        return { payload: input, stripped, coerced };
    }

    const out = {};
    for (const [key, value] of Object.entries(input)) {
        if (READONLY.has(key)) {
            stripped.push(key);
            continue;
        }
        if (!(key in schema)) {
            stripped.push(key);
            continue;
        }
        const next = coerceValue(schema[key], value);
        if (next !== value) coerced.push(key);
        if (next !== null && next !== undefined) {
            out[key] = next;
        }
    }

    return { payload: out, stripped, coerced };
}

export function getTableColumns(table) {
    return TABLE_COLUMNS[table] ? Object.keys(TABLE_COLUMNS[table]) : [];
}

export function isKnownColumn(table, column) {
    return Boolean(TABLE_COLUMNS[table]?.[column]);
}
