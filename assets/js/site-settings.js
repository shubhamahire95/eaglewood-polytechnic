/**
 * Shared CMS settings parsing for contact info, emails and institute counters.
 */

export function parseSettingValue(value) {
    if (value == null) return "";
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "string" || typeof parsed === "number" ? String(parsed) : parsed;
        } catch {
            return value;
        }
    }
    if (typeof value === "number") return String(value);
    return value;
}

export function parseSettingList(value) {
    const raw = parseSettingValue(value);
    if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
    if (typeof raw === "string") return raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    return [];
}

export function parseContactPhones(settings = {}) {
    const fromList = parseSettingList(settings.contact_phones);
    if (fromList.length) return fromList;
    const single = parseSettingValue(settings.phone);
    return single ? [single] : [];
}

export function parseInstituteEmails(settings = {}) {
    const poly = parseSettingValue(settings.email_polytechnic) || parseSettingValue(settings.email);
    const eng = parseSettingValue(settings.email_engineering);
    const rows = [];
    if (poly) rows.push({ label: "Polytechnic Email", value: poly });
    if (eng) rows.push({ label: "Engineering Email", value: eng });
    return rows;
}

export function formatLocaleStatValue(value) {
    const num = Number(String(value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(num)) return String(value ?? "");
    return num.toLocaleString("en-US");
}

export function getInstituteStats(settings = {}, fallbacks = {}) {
    return {
        departments: parseSettingValue(settings.stat_departments) || fallbacks.departments || "",
        placements: parseSettingValue(settings.stat_placements) || fallbacks.placements || "",
        faculty: parseSettingValue(settings.stat_faculty) || fallbacks.faculty || "",
        instituteCode: parseSettingValue(settings.stat_institute_code)
            || parseSettingValue(settings.dte_code)
            || fallbacks.instituteCode
            || "",
        students: parseSettingValue(settings.stat_students) || fallbacks.students || "1200",
    };
}

export function telHref(phone) {
    return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
}

export function programTypeLabel(type) {
    return String(type || "diploma").toLowerCase() === "degree" ? "Degree" : "Diploma";
}

export function instituteLabel(type) {
    const key = String(type || "polytechnic").toLowerCase();
    if (key === "engineering" || key === "degree") {
        return "Eaglewood College of Engineering (Degree)";
    }
    return "Eaglewood Polytechnic (Diploma)";
}

export function noticeFileMeta(url = "", fileType = "") {
    const lower = String(url).toLowerCase();
    const type = String(fileType || "").toLowerCase();
    if (type === "image" || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(lower)) {
        return { label: "Image", badge: "IMG", className: "image" };
    }
    if (type === "doc" || /\.docx?(\?|$)/i.test(lower)) {
        return { label: "Document", badge: "DOC", className: "doc" };
    }
    return { label: "PDF", badge: "PDF", className: "pdf" };
}
