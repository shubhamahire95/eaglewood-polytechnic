/**
 * Recovered Eaglewood Polytechnic default CMS content.
 * Used ONLY for SQL/bootstrap seed scripts — never rendered directly on public pages.
 */
import HOME_DATA from "./home-data.js";

export const CMS_DEFAULT_SETTINGS = {
    phone: "+91 94237 16230",
    email: "eaglewoodpoly@gmail.com",
    mission: "To deliver industry-oriented engineering education with discipline, practical exposure and ethical values.",
    vision: "To be a leading polytechnic nurturing confident engineers for society and industry.",
    objectives: '["Hands-on laboratory learning","Industry-aligned curriculum","Student mentoring and placement support","Inclusive campus culture"]',
    core_values: '["Integrity","Innovation","Discipline","Excellence","Service"]',
    dte_code: '"2634"',
    msbte_code: '"51307"',
    affiliation: '"Affiliated to MSBTE & DBATU"',
    approval: '"Approved by AICTE, DTE & Govt. of Maharashtra"',
};

export const HOME_FALLBACKS = {
    slides: HOME_DATA.hero.slides.map((slide, index) => ({
        title: index === 0 ? "Eaglewood Polytechnic Institute" : ["Hands-on Engineering Education", "Industry Exposure from Campus", "A Vibrant Student Campus"][index - 1] || HOME_DATA.hero.title,
        subtitle: [
            "AICTE Approved • DTE 2634 • MSBTE 51307 — Learn, innovate and lead with practical engineering education in Majalgaon.",
            "Modern laboratories, workshops and project-based learning prepare students for industry and higher studies.",
            "Industrial visits, aptitude training and placement guidance build interview-ready professionals.",
            "Sports, cultural events and disciplined residential life support holistic student growth.",
        ][index] || HOME_DATA.hero.description,
        image_url: slide.src,
        button_primary_label: "Apply for Admission",
        button_primary_url: "admission.html",
        button_secondary_label: "Explore Courses",
        button_secondary_url: "courses.html",
    })),
    principal: {
        photo_url: "assets/images/logo-official.jpg",
        name: "Dr. Principal Name",
        qualification: "M.Tech, Ph.D.",
        designation: "Principal, Eaglewood Polytechnic Institute",
        message: "Welcome to Eaglewood Polytechnic Institute. We are committed to disciplined learning, practical engineering education and student-centred mentoring. Our campus at Sunanda Nagar, Phule Pimpalgaon, Majalgaon offers AICTE-approved diploma and degree pathways with modern laboratories, experienced faculty and strong industry exposure. We nurture confident, ethical and capable engineers ready to serve society and industry.",
        signature: "Principal, Eaglewood Polytechnic",
    },
    updates: HOME_DATA.news.items.map((item, index) => ({
        icon: ["Admission", "Workshop", "Campus"][index] || "Update",
        title: item.title,
        description: item.summary,
        image_url: ["assets/images/induction-programme.jpg", "assets/images/drone-workshop.jpg", "assets/images/annual-gathering.jpg"][index],
        category: ["Admission", "Workshop", "Campus"][index] || "Update",
        color: ["#005B5B", "#D4AF37", "#005B5B"][index % 3],
        date: new Date().toISOString().slice(0, 10),
        button_label: "Read More",
        button_url: "index.html#latest-updates",
    })).concat([
        { title: "Industrial Visit", description: "Students observed manufacturing processes during an industry visit.", image_url: "assets/images/industrial-visit-plant.jpg", category: "Industrial Visit", color: "#005B5B", date: "2026-07-01", button_label: "Read More", button_url: "gallery.html" },
        { title: "Placement Guidance", description: "Aptitude and interview preparation for final-year students.", image_url: "assets/images/placement-guidance.jpg", category: "Placement", color: "#D4AF37", date: "2026-07-01", button_label: "Read More", button_url: "index.html#placements" },
    ]),
    notices: [
        { title: "Admissions Open 2026-27", description: "Admission guidance for diploma and degree engineering programs is available at the institute office.", date: "2026-07-15", important: true, is_new: true, priority: "Important", category: "Admission" },
        { title: "Document Verification Schedule", description: "Original certificates and admission documents will be verified at the admission counter on working days.", date: "2026-07-15", important: false, is_new: true, priority: "Academic", category: "Admission" },
        { title: "MSBTE Exam Form Notification", description: "Students must submit examination forms before the deadline announced by the exam cell.", date: "2026-07-15", important: false, is_new: true, priority: "Examination", category: "Exam Cell" },
        { title: "Anti-Ragging Awareness", description: "Eaglewood maintains a zero-tolerance policy against ragging.", date: "2026-07-15", important: true, is_new: false, priority: "Important", category: "Compliance" },
        { title: "Scholarship Guidance Desk", description: "Collect scholarship eligibility information from the admission office.", date: "2026-07-15", important: false, is_new: true, priority: "Scholarship", category: "Student Services" },
        { title: "Industrial Visit Registration", description: "Department-wise industrial visit registrations are open for eligible students.", date: "2026-07-15", important: false, is_new: true, priority: "General", category: "Academics" },
    ],
    courses: HOME_DATA.courses.items.map((item, index) => ({
        image_url: ["assets/images/civil-department.jpg", "assets/images/computer-department.jpg", "assets/images/electrical-department.jpg", "assets/images/ai-department.jpg"][index],
        title: item.title,
        duration: "3 Years",
        seats: 60,
        code: `EPI-${index + 1}`,
        description: item.description,
        eligibility: "10th / 12th as per admission pathway",
        button_label: "View Course",
        button_url: "courses.html",
    })),
    departments: [
        { title: "Civil Engineering", hod_name: "HOD, Civil", department_image_url: "assets/images/civil-department.jpg", description: "Surveying, construction materials, site practice and infrastructure fundamentals.", labs: "Surveying, CAD & Materials Lab", faculty_count: 8, students_count: 180, button_label: "Explore Department", button_url: "departments.html" },
        { title: "Computer Engineering", hod_name: "HOD, Computer", department_image_url: "assets/images/computer-department.jpg", description: "Programming, networking, software development and digital problem solving.", labs: "Programming, Networking & DB Lab", faculty_count: 9, students_count: 200, button_label: "Explore Department", button_url: "departments.html" },
        { title: "Electrical Engineering", hod_name: "HOD, Electrical", department_image_url: "assets/images/electrical-department.jpg", description: "Electrical machines, circuits, power systems and workshop-based learning.", labs: "Machines, Circuits & Power Lab", faculty_count: 8, students_count: 175, button_label: "Explore Department", button_url: "departments.html" },
        { title: "AI & Machine Learning", hod_name: "HOD, AI & ML", department_image_url: "assets/images/ai-department.jpg", description: "Data science, intelligent systems, NLP and database technologies.", labs: "AI, Data Science & NLP Lab", faculty_count: 6, students_count: 150, button_label: "Explore Department", button_url: "departments.html" },
        { title: "Mechanical Engineering", hod_name: "HOD, Mechanical", department_image_url: "assets/images/workshop.jpg", description: "Workshop practice, manufacturing processes and machine fundamentals.", labs: "Workshop, Manufacturing & CAD Lab", faculty_count: 7, students_count: 160, button_label: "Explore Department", button_url: "departments.html" },
    ],
    facilities: [
        { title: "Modern Laboratories", icon: "Lab", description: "Well-equipped practical spaces for hands-on engineering learning.", image_url: "assets/images/workshop.jpg", category: "Labs" },
        { title: "Central Library", icon: "Library", description: "Reference books, journals and quiet reading spaces.", image_url: "assets/images/library.jpg", category: "Library" },
        { title: "Boys Hostel", icon: "Hostel", description: "Secure residential accommodation with mess facilities.", image_url: "assets/images/hostel-building.jpg", category: "Hostel" },
        { title: "College Transport", icon: "Transport", description: "Bus routes connecting Majalgaon and nearby villages.", image_url: "assets/images/transport.jpg", category: "Transport" },
        { title: "Sports Ground", icon: "Sports", description: "Volleyball, kabaddi and annual sports competitions.", image_url: "assets/images/boys-volleyball.jpg", category: "Sports" },
        { title: "Computer Centre", icon: "Monitor", description: "Programming labs with updated systems and internet.", image_url: "assets/images/computer-lab.jpg", category: "Smart Classroom" },
        { title: "Workshop & Machine Lab", icon: "Workshop", description: "Fabrication, fitting and machine shop practice.", image_url: "assets/images/uploaded/workshop-interior.jpg", category: "Workshop" },
        { title: "Auditorium", icon: "Mic", description: "Seminars, guest lectures and cultural programmes.", image_url: "assets/images/annual-gathering-stage.jpg", category: "Auditorium" },
        { title: "Canteen", icon: "Cafe", description: "Hygienic meals and refreshments for students and staff.", image_url: "assets/images/dining-hall.jpg", category: "Canteen" },
        { title: "Smart Classrooms", icon: "Monitor", description: "Digital teaching aids for interactive learning.", image_url: "assets/images/smart-classroom.jpg", category: "Smart Classroom" },
    ],
    placements: [
        { title: "Placement Highlights", recruiter: "TCS", package: "85%", highest_package: "₹6 LPA", average_package: "₹3.2 LPA", placed_students: 120, image_url: "assets/images/placement-interview.jpg", testimonial: "Placement training helped me secure a campus interview confidently.", student_name: "Rahul K.", course: "Computer Engineering" },
        { title: "Industry Partners", recruiter: "Infosys", package: "72%", highest_package: "₹5.5 LPA", average_package: "₹3 LPA", placed_students: 95, image_url: "assets/images/placement-guidance.jpg", testimonial: "Industrial visits gave real context to classroom learning.", student_name: "Priya S.", course: "Electrical Engineering" },
    ],
    gallery: HOME_DATA.gallery.items.concat(HOME_DATA.events.items).map((item) => ({
        title: item.title,
        category: item.tag || "Campus",
        image_url: item.image?.src,
        alt: item.image?.alt || item.title,
        description: item.description,
    })),
    achievements: [
        { title: "AICTE Approved Institute", description: "Recognised by AICTE and Government of Maharashtra for quality technical education.", icon: "🏛", year: "2024" },
        { title: "MSBTE Affiliation", description: "Affiliated to Maharashtra State Board of Technical Education with strong academic outcomes.", icon: "🎓", year: "2024" },
        { title: "Placement Excellence", description: "Consistent placement guidance and industry interaction for final-year students.", icon: "💼", year: "2025" },
        { title: "Sports & Cultural Awards", description: "Students excel in zonal sports, annual gathering and technical events.", icon: "🏅", year: "2025" },
        { title: "Industrial Collaboration", description: "Regular industrial visits and expert lectures from industry professionals.", icon: "🏭", year: "2025" },
        { title: "Student Achievements", description: "Project exhibitions, poster presentations and technical competitions at state level.", icon: "⭐", year: "2025" },
    ],
    admissionSteps: [
        { step: 1, title: "Check Eligibility", description: "Confirm diploma or degree pathway eligibility with the admission office.", icon: "📋" },
        { step: 2, title: "Submit Application", description: "Fill the online form or visit campus with required documents.", icon: "📝" },
        { step: 3, title: "Document Verification", description: "Original mark sheets, certificates and identity proofs are verified.", icon: "✅" },
        { step: 4, title: "Seat Confirmation", description: "Complete admission formalities and fee payment as per guidelines.", icon: "🎓" },
        { step: 5, title: "Join Campus", description: "Attend induction, collect ID card and begin your engineering journey.", icon: "🏫" },
    ],
    campusFacts: [
        { label: "Established Campus", value: "Majalgaon" },
        { label: "DTE Code", value: "2634" },
        { label: "MSBTE Code", value: "51307" },
        { label: "Programs", value: "Diploma & Degree" },
    ],
};

/** Prefer Supabase rows; use recovered Eaglewood defaults when CMS is empty. */
export function pickList(cmsItems, fallbackItems, fetchOk = true) {
    if (Array.isArray(cmsItems) && cmsItems.length) return cmsItems;
    if (!fetchOk && !fallbackItems?.length) return [];
    return Array.isArray(fallbackItems) ? fallbackItems : [];
}

export function pickOne(cmsItem, fallbackItem, fetchOk = true) {
    if (cmsItem) return cmsItem;
    if (!fetchOk && !fallbackItem) return null;
    return fallbackItem ?? null;
}
