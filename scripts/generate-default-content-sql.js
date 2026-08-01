#!/usr/bin/env node
/**
 * Generates supabase/default_content.sql from structured seed data.
 * Usage: node scripts/generate-default-content-sql.js
 */
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "supabase", "default_content.sql");

const ts = "now()";

function j(v) {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

function s(v) {
    return `'${String(v).replace(/'/g, "''")}'`;
}

const header = `-- Eaglewood Polytechnic — Default CMS Content
-- Run in Supabase SQL Editor AFTER RUN_ALL_MIGRATIONS.sql
-- Idempotent: each section inserts only when the target table is empty.
-- Regenerate: node scripts/generate-default-content-sql.js

`;

const sections = [];

function seedIfEmpty(table, columns, rows) {
    const cols = columns.join(", ");
    const values = rows.map((row) => {
        const vals = columns.map((col) => {
            const v = row[col];
            if (v === null || v === undefined) return "null";
            if (typeof v === "boolean") return v ? "true" : "false";
            if (typeof v === "number") return String(v);
            if (col.endsWith("_links") || col === "content" || col === "floating_cards" || col === "quick_replies" || col === "suggested_questions" || col === "metadata" || col === "permissions" || col === "value" && typeof v === "object") return j(v);
            if (col === "value") return j(v);
            return s(v);
        });
        return `(${vals.join(", ")}, ${ts}, ${ts})`;
    }).join(",\n  ");
    sections.push(`
-- ${table}
insert into public.${table} (${cols}, created_at, updated_at)
select * from (values
  ${values}
) as v(${cols}, created_at, updated_at)
where not exists (select 1 from public.${table} limit 1);
`);
}

// ── Hero slides ─────────────────────────────────────────────────────────────
const homeSlides = [
    { title: "Eaglewood Polytechnic Institute", subtitle: "AICTE Approved • DTE 2634 • MSBTE 51307 — Learn, innovate and lead with practical engineering education in Majalgaon.", image_url: "assets/images/uploaded/workshop-front.jpg", button_primary_label: "Apply for Admission", button_primary_url: "admission.html", button_secondary_label: "Explore Courses", button_secondary_url: "courses.html", published: true, status: "published", display_order: 1 },
    { title: "Hands-On Engineering Education", subtitle: "Modern laboratories, workshops and project-based learning prepare students for industry and higher studies.", image_url: "assets/images/uploaded/machine-lab-practical.jpg", button_primary_label: "View Departments", button_primary_url: "departments.html", button_secondary_label: "Campus Gallery", button_secondary_url: "gallery.html", published: true, status: "published", display_order: 2 },
    { title: "Industry Exposure & Placements", subtitle: "Industrial visits, aptitude training and placement guidance build interview-ready engineering professionals.", image_url: "assets/images/uploaded/industrial-visit-group.jpg", button_primary_label: "Placement Highlights", button_primary_url: "index.html#placements", button_secondary_label: "Contact Office", button_secondary_url: "contact.html", published: true, status: "published", display_order: 3 },
    { title: "A Vibrant Student Campus", subtitle: "Sports, cultural events, NSS activities and disciplined residential life support holistic student growth.", image_url: "assets/images/uploaded/sports-volleyball.jpg", button_primary_label: "Admission Open 2026-27", button_primary_url: "admission.html", button_secondary_label: "Important Notices", button_secondary_url: "index.html#notice-board", published: true, status: "published", display_order: 4 },
];
seedIfEmpty("home_slides", ["title", "subtitle", "image_url", "button_primary_label", "button_primary_url", "button_secondary_label", "button_secondary_url", "published", "status", "display_order"], homeSlides);

// ── Principal ───────────────────────────────────────────────────────────────
const principalMessage = {
    photo_url: "assets/images/logo-official.jpg",
    name: "Dr. Principal Name",
    qualification: "M.Tech, Ph.D.",
    designation: "Principal, Eaglewood Polytechnic Institute",
    message: "Welcome to Eaglewood Polytechnic Institute. We are committed to disciplined learning, practical engineering education and student-centred mentoring. Our campus at Sunanda Nagar, Phule Pimpalgaon, Majalgaon offers AICTE-approved diploma and degree pathways with modern laboratories, experienced faculty and strong industry exposure. We nurture confident, ethical and capable engineers ready to serve society and industry.",
    signature: "Principal, Eaglewood Polytechnic",
    published: true,
    status: "published",
    display_order: 1,
};
sections.push(`
insert into public.principal_message (photo_url, name, qualification, designation, message, signature, published, status, display_order, created_at, updated_at)
select
  ${s(principalMessage.photo_url)},
  ${s(principalMessage.name)},
  ${s(principalMessage.qualification)},
  ${s(principalMessage.designation)},
  ${s(principalMessage.message)},
  ${s(principalMessage.signature)},
  true, 'published', 1, ${ts}, ${ts}
where not exists (select 1 from public.principal_message limit 1);
`);

// ── Updates (10) ────────────────────────────────────────────────────────────
const updateTitles = [
    ["Admissions Open 2026-27", "Diploma and degree engineering admissions are open. Visit the admission office with required documents.", "Admission", "assets/images/induction-programme.jpg", "#notice-board"],
    ["Induction Programme for New Students", "Orientation sessions introduce students to campus rules, laboratories and academic mentoring.", "Academics", "assets/images/induction-programme.jpg", "index.html#latest-updates"],
    ["Drone Technology Workshop", "Students explored drone assembly, flight controls and emerging aerospace applications.", "Workshop", "assets/images/drone-workshop.jpg", "gallery.html"],
    ["Industrial Visit to Manufacturing Plant", "Final-year students observed production processes and safety practices during an industry visit.", "Industrial Visit", "assets/images/industrial-visit-plant.jpg", "gallery.html"],
    ["Annual Gathering 2025", "Cultural performances, awards and student achievements were celebrated on campus.", "Campus", "assets/images/annual-gathering.jpg", "gallery.html"],
    ["Placement Guidance Session", "Training on aptitude, communication and interview skills for final-year students.", "Placement", "assets/images/placement-guidance.jpg", "index.html#placements"],
    ["Blood Donation Camp", "NSS and student volunteers organised a successful blood donation drive.", "Social", "assets/images/blood-donation.jpg", "gallery.html"],
    ["Engineers Day Celebration", "Technical quiz, project display and expert lecture marked Engineers Day.", "Event", "assets/images/engineers-day.jpg", "gallery.html"],
    ["Smart Classroom Upgrade", "Digital teaching aids installed in select classrooms for interactive learning.", "Infrastructure", "assets/images/smart-classroom.jpg", "infrastructure.html"],
    ["Scholarship Guidance Desk", "Students received information on government and institute scholarship schemes.", "Student Services", "assets/images/student-achievements.jpg", "admission.html"],
];
const updateRows = updateTitles.map(([title, description, category, image_url, button_url], i) => ({
    icon: category, title, description, image_url, category, color: i % 2 ? "#005B5B" : "#D4AF37",
    date: "2026-07-01", button_label: "Read More", button_url, published: true, status: "published", display_order: i + 1, pinned: i < 2,
}));
seedIfEmpty("updates", ["icon", "title", "description", "image_url", "category", "color", "date", "button_label", "button_url", "published", "status", "display_order", "pinned"], updateRows);

// ── Notices (10) ──────────────────────────────────────────────────────────────
const noticeData = [
    ["Admissions Open 2026-27", "Admission forms and document verification are available at the institute office on working days.", true, "Important", "Admission"],
    ["Document Verification Schedule", "Bring original mark sheets, leaving certificate, Aadhaar and passport photos for verification.", false, "Academic", "Admission"],
    ["MSBTE Exam Form Notification", "Students must submit examination forms before the deadline announced by the exam cell.", false, "Examination", "Exam Cell"],
    ["Anti-Ragging Awareness", "Eaglewood maintains zero tolerance for ragging. Contact the anti-ragging committee immediately.", true, "Important", "Compliance"],
    ["Industrial Visit Registration", "Department-wise industrial visit registrations are open for eligible students through HODs.", false, "General", "Academics"],
    ["Hostel Allotment Notice", "Hostel seat allotment list will be displayed on the notice board and website.", false, "Student Services", "Hostel"],
    ["Scholarship Application Window", "Eligible students may apply for government scholarships with income and caste certificates.", false, "Scholarship", "Student Services"],
    ["Library Timings Extended", "Reading hall will remain open until 8 PM during examination preparation period.", false, "General", "Library"],
    ["Campus Transport Routes", "Updated bus routes for Majalgaon and nearby villages are available at the admin office.", false, "General", "Transport"],
    ["Parent-Teacher Meeting", "Parents are invited to meet faculty on the scheduled Saturday between 10 AM and 1 PM.", true, "Important", "Academics"],
];
const noticeRows = noticeData.map(([title, description, important, priority, category], i) => ({
    title, description, date: "2026-07-15", important, is_new: i < 4, priority, category, published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("notices", ["title", "description", "date", "important", "is_new", "priority", "category", "published", "status", "display_order"], noticeRows);

// ── Courses ─────────────────────────────────────────────────────────────────
const courses = [
    ["Civil Engineering", "Civil", "263419110", "3 Years Diploma", "60", "assets/images/civil-department.jpg", "Surveying, construction materials, structural drawing and site practice."],
    ["Computer Engineering", "Computer", "263424510", "3 Years Diploma", "60", "assets/images/computer-department.jpg", "Programming, networking, databases and software development fundamentals."],
    ["Electrical Engineering", "Electrical", "263429310", "3 Years Diploma", "60", "assets/images/electrical-department.jpg", "Electrical machines, circuits, power systems and workshop practice."],
    ["Artificial Intelligence (AI)", "AI & ML", "263498510", "3 Years Diploma", "60", "assets/images/ai-department.jpg", "Machine learning, data science, Python and intelligent systems."],
    ["Civil Engineering (Degree)", "Civil", "263411191", "4 Years Degree", "60", "assets/images/civil-department.jpg", "Advanced civil engineering with design projects and industry exposure."],
    ["Computer Engineering (Degree)", "Computer", "263411245", "4 Years Degree", "60", "assets/images/computer-department.jpg", "Degree pathway in computing with projects and internship support."],
];
const courseRows = courses.map(([title, department, code, duration, seats, image_url, description], i) => ({
    title, department, code, duration, seats: Number(seats), image_url, description,
    eligibility: "10th pass for Diploma; 12th Science for Degree as per DTE norms",
    fees: "As per Shikshan Shulk committee", button_label: "View Course", button_url: "courses.html",
    published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("courses", ["title", "department", "code", "duration", "seats", "image_url", "description", "eligibility", "fees", "button_label", "button_url", "published", "status", "display_order"], courseRows);

// ── Departments ─────────────────────────────────────────────────────────────
const depts = [
    ["Civil Engineering", "assets/images/civil-department.jpg", "Surveying, construction materials, site practice and infrastructure fundamentals.", "Surveying Lab, CAD Lab, Materials Testing Lab", 8, 180],
    ["Computer Engineering", "assets/images/computer-department.jpg", "Programming, networking, software development and digital problem solving.", "Programming Lab, Networking Lab, DB Lab", 9, 200],
    ["Electrical Engineering", "assets/images/electrical-department.jpg", "Electrical machines, circuits, power systems and workshop-based learning.", "Machines Lab, Circuits Lab, Power Lab", 8, 175],
    ["Artificial Intelligence & ML", "assets/images/ai-department.jpg", "Data science, intelligent systems, NLP and database technologies.", "AI Lab, Data Science Lab, NLP Lab", 6, 150],
    ["Mechanical Engineering", "assets/images/workshop.jpg", "Workshop practice, manufacturing processes and machine fundamentals.", "Workshop, Manufacturing Lab, CAD Lab", 7, 160],
];
const departmentRows = depts.map(([title, department_image_url, description, labs, faculty_count, students_count], i) => ({
    title, department_image_url, description, labs, faculty_count, students_count,
    hod_name: `HOD, ${title.split(" ")[0]}`, button_label: "Explore Department", button_url: "departments.html",
    published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("departments", ["title", "department_image_url", "description", "labs", "faculty_count", "students_count", "hod_name", "button_label", "button_url", "published", "status", "display_order"], departmentRows);

// ── Faculty (sample) ────────────────────────────────────────────────────────
const faculty = [
    ["Prof. A. Patil", "M.Tech Civil", "12 Years", "Civil Engineering", "Surveying, Building Materials"],
    ["Prof. S. Jadhav", "M.Tech CSE", "10 Years", "Computer Engineering", "Programming, DBMS"],
    ["Prof. R. Deshmukh", "M.Tech Electrical", "11 Years", "Electrical Engineering", "Machines, Power Systems"],
    ["Prof. N. Kulkarni", "M.Tech AI", "8 Years", "AI & ML", "Machine Learning, Python"],
    ["Prof. M. Shaikh", "B.E. Mechanical", "9 Years", "Mechanical Engineering", "Workshop, Manufacturing"],
    ["Prof. P. More", "M.Sc. Physics", "7 Years", "Applied Science", "Engineering Physics"],
    ["Prof. V. Gaikwad", "M.Sc. Chemistry", "6 Years", "Applied Science", "Engineering Chemistry"],
    ["Prof. L. Bhosale", "MBA", "5 Years", "Placement Cell", "Soft Skills, Aptitude"],
];
const facultyRows = faculty.map(([name, qualification, experience, department, subjects], i) => ({
    name, qualification, experience, department, subjects,
    photo_url: "assets/images/logo.jpg", published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("faculty", ["name", "qualification", "experience", "department", "subjects", "photo_url", "published", "status", "display_order"], facultyRows);

// ── Facilities ──────────────────────────────────────────────────────────────
const facilities = [
    ["Modern Laboratories", "Lab", "assets/images/workshop.jpg", "Well-equipped practical spaces for hands-on engineering learning.", "Labs"],
    ["Central Library", "Library", "assets/images/library.jpg", "Reference books, journals and quiet reading spaces for students.", "Library"],
    ["Boys Hostel", "Hostel", "assets/images/hostel-building.jpg", "Secure residential accommodation with mess and study hours.", "Hostel"],
    ["Girls Hostel", "Hostel", "assets/images/hostel-exterior.jpg", "Disciplined residential facility for women students.", "Hostel"],
    ["College Transport", "Transport", "assets/images/transport.jpg", "Bus routes connecting Majalgaon and nearby towns.", "Transport"],
    ["Sports Ground", "Sports", "assets/images/boys-volleyball.jpg", "Volleyball, kabaddi and annual sports competitions.", "Sports"],
    ["Computer Centre", "Monitor", "assets/images/computer-lab.jpg", "Programming labs with updated systems and internet.", "Smart Classroom"],
    ["Workshop & Machine Lab", "Workshop", "assets/images/uploaded/workshop-interior.jpg", "Fabrication, fitting and machine shop practice.", "Workshop"],
    ["Auditorium", "Mic", "assets/images/annual-gathering-stage.jpg", "Seminars, guest lectures and cultural programmes.", "Auditorium"],
    ["Canteen", "Cafe", "assets/images/dining-hall.jpg", "Hygienic meals and refreshments for students and staff.", "Canteen"],
];
const facilityRows = facilities.map(([title, icon, image_url, description, category], i) => ({
    title, icon, image_url, description, category, published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("facilities", ["title", "icon", "image_url", "description", "category", "published", "status", "display_order"], facilityRows);

// ── Placements ──────────────────────────────────────────────────────────────
const placementRows = [
    { title: "Placement Highlights 2025", recruiter: "TCS", package: "85%", highest_package: "₹6 LPA", average_package: "₹3.2 LPA", placed_students: 120, image_url: "assets/images/placement-interview.jpg", testimonial: "Placement training and mock interviews helped me secure a campus interview confidently.", student_name: "Rahul K.", course: "Computer Engineering", published: true, status: "published", display_order: 1 },
    { title: "Industry Partners", recruiter: "Infosys", package: "72%", highest_package: "₹5.5 LPA", average_package: "₹3 LPA", placed_students: 95, image_url: "assets/images/placement-guidance.jpg", testimonial: "Industrial visits gave real context to our classroom learning.", student_name: "Priya S.", course: "Electrical Engineering", published: true, status: "published", display_order: 2 },
    { title: "Training & Placement Cell", recruiter: "Wipro", package: "80%", highest_package: "₹6 LPA", average_package: "₹3.4 LPA", placed_students: 110, image_url: "assets/images/personality-development.jpg", testimonial: "Soft skills sessions improved my communication for interviews.", student_name: "Amit D.", course: "Civil Engineering", published: true, status: "published", display_order: 3 },
];
seedIfEmpty("placements", ["title", "recruiter", "package", "highest_package", "average_package", "placed_students", "image_url", "testimonial", "student_name", "course", "published", "status", "display_order"], placementRows);

// ── Gallery ─────────────────────────────────────────────────────────────────
const gallery = [
    ["Annual Gathering", "Events", "assets/images/annual-gathering.jpg"],
    ["Drone Workshop", "Workshops", "assets/images/drone-workshop.jpg"],
    ["Industrial Visit", "Industrial Visits", "assets/images/industrial-visit-plant.jpg"],
    ["Volleyball Tournament", "Sports", "assets/images/boys-volleyball.jpg"],
    ["Blood Donation Camp", "Social", "assets/images/blood-donation.jpg"],
    ["Computer Lab Session", "Labs", "assets/images/uploaded/computer-lab-students.jpg"],
    ["Surveying Practical", "Labs", "assets/images/uploaded/surveying-field-practical.jpg"],
    ["Workshop Practice", "Labs", "assets/images/uploaded/workshop-group.jpg"],
    ["Republic Day", "Events", "assets/images/republic-day.jpg"],
    ["Teachers Day", "Events", "assets/images/teachers-day.jpg"],
    ["Campus Aerial View", "Campus", "assets/images/campus.jpg"],
    ["Library Reading Hall", "Campus", "assets/images/reading-hall.jpg"],
];
const galleryRows = gallery.map(([title, category, image_url], i) => ({
    title, category, image_url, alt: title, description: `${title} at Eaglewood Polytechnic Institute`,
    featured: i < 3, published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("gallery", ["title", "category", "image_url", "alt", "description", "featured", "published", "status", "display_order"], galleryRows);

// ── Footer blocks ───────────────────────────────────────────────────────────
const footerBlocks = [
    { block_key: "footer_main", title: "Main Footer", content: { tagline: "AICTE Approved • MSBTE Affiliated • DTE 2634", copyright: "Eaglewood Polytechnic Institute" }, published: true, status: "published", display_order: 1 },
    { block_key: "quick_links", title: "Quick Links", content: { links: [{ label: "About", href: "about.html" }, { label: "Courses", href: "courses.html" }, { label: "Departments", href: "departments.html" }, { label: "Gallery", href: "gallery.html" }, { label: "Admissions", href: "admission.html" }, { label: "Contact", href: "contact.html" }] }, published: true, status: "published", display_order: 2 },
    { block_key: "contact_block", title: "Contact", content: { phone: "+91 94237 16230", email: "eaglewoodpoly@gmail.com", address: "Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131" }, published: true, status: "published", display_order: 3 },
];
sections.push(`
insert into public.footer_blocks (block_key, title, content, published, status, display_order, created_at, updated_at)
select * from (values
  ('footer_main', 'Main Footer', ${j(footerBlocks[0].content)}::jsonb, true, 'published', 1, ${ts}, ${ts}),
  ('quick_links', 'Quick Links', ${j(footerBlocks[1].content)}::jsonb, true, 'published', 2, ${ts}, ${ts}),
  ('contact_block', 'Contact', ${j(footerBlocks[2].content)}::jsonb, true, 'published', 3, ${ts}, ${ts})
) as v(block_key, title, content, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.footer_blocks limit 1);
`);

// ── AI Prompts ────────────────────────────────────────────────────────────────
const aiPromptRow = {
    name: "Eaglewood Assistant",
    prompt: "You are the official AI assistant for Eaglewood Polytechnic Institute, Majalgaon. Answer questions about admissions, courses, departments, fees, scholarships, hostel, transport and contact details. Be concise, accurate and friendly. If unsure, direct users to the admission office.",
    greeting_message: "Hello! I am the Eaglewood AI Assistant. Ask me about admissions, courses, departments, fees or contact details.",
    fallback_response: "I could not find a confident answer. Please contact the admission office at +91 94237 16230 or eaglewoodpoly@gmail.com.",
    quick_replies: ["Admissions", "Courses", "Fees", "Hostel", "Contact"],
    suggested_questions: ["How do I apply for admission?", "Which courses are offered?", "What is the DTE code?", "Is hostel available?", "How to contact the office?"],
    temperature: 0.7,
    token_limit: 800,
    published: true,
    status: "published",
    display_order: 1,
};
sections.push(`
insert into public.ai_prompts (name, prompt, greeting_message, fallback_response, quick_replies, suggested_questions, temperature, token_limit, published, status, display_order, created_at, updated_at)
select
  ${s(aiPromptRow.name)},
  ${s(aiPromptRow.prompt)},
  ${s(aiPromptRow.greeting_message)},
  ${s(aiPromptRow.fallback_response)},
  ${j(aiPromptRow.quick_replies)}::jsonb,
  ${j(aiPromptRow.suggested_questions)}::jsonb,
  ${aiPromptRow.temperature}, ${aiPromptRow.token_limit}, true, 'published', 1, ${ts}, ${ts}
where not exists (select 1 from public.ai_prompts limit 1);
`);

// ── AI Knowledge Base ───────────────────────────────────────────────────────
const faqs = [
    ["What courses does Eaglewood offer?", "Eaglewood offers Diploma and Degree programs in Civil, Computer, Electrical and Artificial Intelligence engineering.", "Admissions"],
    ["What is the DTE institute code?", "The DTE institute code is 2634.", "Admissions"],
    ["What is the MSBTE institute code?", "The MSBTE institute code is 51307.", "Admissions"],
    ["Where is Eaglewood Polytechnic located?", "Sunanda Nagar, Phule Pimpalgaon, Majalgaon, District Beed 431131, Maharashtra.", "Contact"],
    ["What is the admission office phone number?", "Call +91 94237 16230 for admission enquiries.", "Contact"],
    ["What is the admission email?", "Email eaglewoodpoly@gmail.com for admission support.", "Contact"],
    ["What are the office hours?", "Monday to Saturday, 9:30 AM to 5:30 PM.", "Contact"],
    ["Is the institute AICTE approved?", "Yes. Eaglewood Polytechnic is approved by AICTE and Government of Maharashtra.", "Approvals"],
    ["Which university is Eaglewood affiliated to?", "Affiliated to MSBTE for diploma programs and DBATU for degree programs.", "Approvals"],
    ["Is hostel facility available?", "Yes. Separate hostel facilities are available for boys and girls.", "Campus"],
    ["Is transport available?", "College buses operate on routes covering Majalgaon and nearby villages.", "Campus"],
    ["How many seats per branch?", "Typically 60 sanctioned institute seats plus EWS and TFWS seats per branch.", "Admissions"],
    ["What documents are needed for admission?", "Mark sheets, leaving certificate, Aadhaar, photos and category certificates if applicable.", "Admissions"],
    ["Are scholarships available?", "Government and eligible scholarship schemes are supported through the admission office.", "Admissions"],
    ["Does Eaglewood have placement support?", "Yes. Training, aptitude sessions and placement guidance are provided.", "Placements"],
    ["What labs are on campus?", "Computer, electrical, surveying, workshop, AI and science laboratories.", "Academics"],
    ["How can I visit the campus?", "Contact the office to schedule a campus visit on working days.", "Contact"],
    ["Is there an anti-ragging policy?", "Eaglewood maintains zero tolerance for ragging with an active anti-ragging committee.", "Compliance"],
    ["Who developed this website?", "Designed and developed by Shubham Ahire.", "General"],
    ["How do I apply online?", "Fill the admission form on the website or visit the admission office with documents.", "Admissions"],
];
const faqRows = faqs.map(([question, answer, category], i) => ({
    question, answer, category, keywords: category.toLowerCase(), published: true, status: "published", display_order: i + 1,
}));
seedIfEmpty("ai_knowledge_base", ["question", "answer", "category", "keywords", "published", "status", "display_order"], faqRows);

// ── Extra settings keys ─────────────────────────────────────────────────────
const achievements = [
    { title: "AICTE Approved Institute", description: "Recognised by AICTE and Government of Maharashtra for quality technical education.", icon: "🏛", year: "2024" },
    { title: "MSBTE Affiliation", description: "Affiliated to Maharashtra State Board of Technical Education with strong academic outcomes.", icon: "🎓", year: "2024" },
    { title: "Placement Excellence", description: "Consistent placement guidance and industry interaction for final-year students.", icon: "💼", year: "2025" },
    { title: "Sports & Cultural Awards", description: "Students excel in zonal sports, annual gathering and technical events.", icon: "🏅", year: "2025" },
    { title: "Industrial Collaboration", description: "Regular industrial visits and expert lectures from industry professionals.", icon: "🏭", year: "2025" },
    { title: "Student Achievements", description: "Project exhibitions, poster presentations and technical competitions at state level.", icon: "⭐", year: "2025" },
];
const admissionSteps = [
    { step: 1, title: "Check Eligibility", description: "Confirm diploma or degree pathway eligibility with the admission office.", icon: "📋" },
    { step: 2, title: "Submit Application", description: "Fill the online form or visit campus with required documents.", icon: "📝" },
    { step: 3, title: "Document Verification", description: "Original mark sheets, certificates and identity proofs are verified.", icon: "✅" },
    { step: 4, title: "Seat Confirmation", description: "Complete admission formalities and fee payment as per guidelines.", icon: "🎓" },
    { step: 5, title: "Join Campus", description: "Attend induction, collect ID card and begin your engineering journey.", icon: "🏫" },
];
const campusFacts = [
    { label: "Established Campus", value: "Majalgaon" },
    { label: "DTE Code", value: "2634" },
    { label: "MSBTE Code", value: "51307" },
    { label: "Programs", value: "Diploma & Degree" },
];

sections.push(`
insert into public.settings (key, value, published, status, display_order, created_at, updated_at) values
  ('dte_code', '"2634"', true, 'active', 9, ${ts}, ${ts}),
  ('msbte_code', '"51307"', true, 'active', 10, ${ts}, ${ts}),
  ('affiliation', '"Affiliated to MSBTE & DBATU"', true, 'active', 11, ${ts}, ${ts}),
  ('approval', '"Approved by AICTE, DTE & Govt. of Maharashtra"', true, 'active', 12, ${ts}, ${ts}),
  ('whatsapp', '"+919423716230"', true, 'active', 13, ${ts}, ${ts}),
  ('mission', '"To deliver industry-oriented engineering education with discipline, practical exposure and ethical values."', true, 'active', 20, ${ts}, ${ts}),
  ('vision', '"To be a leading polytechnic nurturing confident engineers for society and industry."', true, 'active', 21, ${ts}, ${ts}),
  ('objectives', '["Hands-on laboratory learning","Industry-aligned curriculum","Student mentoring and placement support","Inclusive campus culture"]', true, 'active', 22, ${ts}, ${ts}),
  ('core_values', '["Integrity","Innovation","Discipline","Excellence","Service"]', true, 'active', 23, ${ts}, ${ts}),
  ('copyright_text', '"Eaglewood Polytechnic Institute"', true, 'active', 33, ${ts}, ${ts}),
  ('achievements', ${j(achievements)}, true, 'active', 24, ${ts}, ${ts}),
  ('admission_steps', ${j(admissionSteps)}, true, 'active', 25, ${ts}, ${ts}),
  ('campus_facts', ${j(campusFacts)}, true, 'active', 26, ${ts}, ${ts})
on conflict (key) do nothing;
`);

sections.push(`notify pgrst, 'reload schema';\n`);

const defaultSql = header + sections.join("\n");
writeFileSync(out, defaultSql, "utf8");
console.log(`Wrote ${out}`);

const migrationPath = join(root, "supabase", "migrations", "008_bootstrap_cms_content.sql");
const applyPath = join(root, "supabase", "APPLY_CMS_SYNC.sql");
const bootstrapBody = defaultSql
    .replace(header, "")
    .replace(/notify pgrst, 'reload schema';\s*/g, "")
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join("\n");

const migrationSql = `-- Bootstrap CMS default content (idempotent). Callable via RPC from homepage/admin.
create or replace function public.bootstrap_cms_default_content()
returns jsonb
language plpgsql
security definer
set search_path = public
as $bootstrap$
begin
  if exists (select 1 from public.principal_message limit 1) then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_seeded');
  end if;

${bootstrapBody}
  return jsonb_build_object('ok', true, 'seeded', true);
end;
$bootstrap$;

revoke all on function public.bootstrap_cms_default_content() from public;
grant execute on function public.bootstrap_cms_default_content() to anon, authenticated, service_role;

create or replace function public.seed_cms_as_admin(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $seed$
declare
  r public.admins%rowtype;
begin
  if p_email is null or p_password is null or length(trim(p_email)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select * into r
  from public.admins
  where lower(email) = lower(trim(p_email))
    and password = p_password
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  return public.bootstrap_cms_default_content();
end;
$seed$;

revoke all on function public.seed_cms_as_admin(text, text) from public;
grant execute on function public.seed_cms_as_admin(text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
`;

writeFileSync(migrationPath, migrationSql, "utf8");
console.log(`Wrote ${migrationPath}`);

const applySql = `-- Eaglewood CMS — one-click sync
-- Run this ONCE in Supabase SQL Editor to deploy bootstrap RPC and seed all CMS tables.

${migrationSql}

select public.bootstrap_cms_default_content();
`;

writeFileSync(applyPath, applySql, "utf8");
console.log(`Wrote ${applyPath}`);

const seedJson = {
    home_slides: homeSlides,
    principal_message: principalMessage,
    updates: updateRows,
    notices: noticeRows,
    courses: courseRows,
    departments: departmentRows,
    faculty: facultyRows,
    facilities: facilityRows,
    placements: placementRows,
    gallery: galleryRows,
    footer_blocks: footerBlocks,
    ai_prompts: [aiPromptRow],
    ai_knowledge_base: faqRows,
};
const jsonPath = join(root, "scripts", "cms-seed-data.json");
writeFileSync(jsonPath, `${JSON.stringify(seedJson, null, 2)}\n`, "utf8");
console.log(`Wrote ${jsonPath}`);
const assetsDataDir = join(root, "assets", "data");
if (!existsSync(assetsDataDir)) mkdirSync(assetsDataDir, { recursive: true });
copyFileSync(jsonPath, join(assetsDataDir, "cms-seed-data.json"));
console.log(`Copied to assets/data/cms-seed-data.json`);
