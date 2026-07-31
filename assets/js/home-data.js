/**
 * Eaglewood Polytechnic — Home Page CMS Data
 * Single source of truth for all home page content.
 * Each field maps to data-section / data-field attributes for the Admin Panel.
 */

const HOME_DATA = {
    topBar: {
        phone: "+91 94237 16230",
        email: "eaglewoodpoly@gmail.com",
        links: [
            { label: "Admission Open", href: "admission.html" },
            { label: "Admission Info", href: "admission.html" },
            { label: "Contact", href: "contact.html" },
        ],
    },

    announcements: {
        label: "Latest Updates",
        items: [
            "Admissions Open for 2026-27",
            "Scholarship guidance available at the admission office",
            "AI and emerging technology workshops planned for students",
            "Industrial visits and field exposure registrations started",
        ],
    },

    hero: {
        badge: "Admissions open • Diploma & Degree Engineering",
        title: "Learn. Innovate.",
        titleHighlight: "Lead the future.",
        description:
            "Eaglewood Polytechnic Institute turns ambition into practical engineering ability through modern laboratories, experienced faculty, industry exposure and a vibrant campus community.",
        slides: [
            {
                src: "assets/images/uploaded/workshop-front.jpg",
                alt: "Students at a technical workshop on campus",
            },
            {
                src: "assets/images/uploaded/machine-lab-practical.jpg",
                alt: "Machine lab practical session at Eaglewood",
            },
            {
                src: "assets/images/uploaded/industrial-visit-group.jpg",
                alt: "Students during an industrial visit",
            },
            {
                src: "assets/images/uploaded/sports-volleyball.jpg",
                alt: "Volleyball sports event at Eaglewood campus",
            },
        ],
        buttons: [
            { label: "Explore Courses", href: "courses.html", variant: "primary" },
            {
                label: "Admission Information",
                href: "admission.html",
                variant: "ghost",
            },
            { label: "Contact Us", href: "contact.html", variant: "ghost" },
        ],
    },

    about: {
        image: {
            src: "assets/images/campus.jpg",
            alt: "Eaglewood Polytechnic Institute campus",
        },
        caption: "A secure, disciplined campus for academic, practical and personal growth.",
        eyebrow: "Welcome to Eaglewood",
        heading: "Technical education with purpose",
        paragraphs: [
            "Venkateshwara Manav Vikas Mandal's Eaglewood Polytechnic Institute is located at Sunanda Nagar, Phule Pimpalgaon, Majalgaon, District Beed. It is approved by AICTE, DTE and the Government of Maharashtra, and affiliated to MSBTE and DBATU.",
            "Our learning environment brings classroom knowledge together with laboratories, workshops, industrial visits, expert lectures and project-based development.",
        ],
        highlights: [
            "Highly qualified and experienced faculty",
            "Modern laboratories, workshops and smart classrooms",
            "Career guidance and placement assistance",
            "Hostel, transport, sports and cultural activities",
        ],
        button: { label: "Discover Eaglewood", href: "about.html" },
    },

    principal: {
        enabled: false,
        eyebrow: "Leadership",
        name: "",
        title: "Principal's Message",
        image: { src: "", alt: "" },
        message: "",
        signature: "",
    },

    statistics: {
        enabled: true,
        items: [
            { id: "stat-programs", value: 4, suffix: "", label: "Engineering Streams" },
            { id: "stat-codes", value: 2634, suffix: "", label: "DTE Code" },
            { id: "stat-labs", value: 12, suffix: "+", label: "Labs and Workshops" },
            { id: "stat-campus", value: 431131, suffix: "", label: "Majalgaon Campus" },
        ],
    },

    courses: {
        eyebrow: "Academic pathways",
        heading: "Choose your engineering future",
        lead: "Four high-impact disciplines are available at diploma and degree level, each supported by dedicated laboratories and faculty.",
        link: { label: "View intake & codes", href: "courses.html" },
        items: [
            {
                id: "course-1",
                index: "01 • Infrastructure",
                title: "Civil Engineering",
                description: "Buildings, bridges, roads, dams, surveying and construction.",
            },
            {
                id: "course-2",
                index: "02 • Digital",
                title: "Computer Engineering",
                description: "Programming, hardware, software and information technology.",
            },
            {
                id: "course-3",
                index: "03 • Energy",
                title: "Electrical Engineering",
                description: "Electrical systems, electronics, energy and communications.",
            },
            {
                id: "course-4",
                index: "04 • Future Tech",
                title: "AI & Machine Learning",
                description: "Data, intelligent systems, NLP and database technologies.",
            },
        ],
    },

    departments: {
        enabled: true,
        eyebrow: "Departments",
        heading: "Specialized departments with practical depth",
        lead: "Each department blends fundamentals with labs, projects, mentoring and field exposure so students graduate with usable technical confidence.",
        link: { label: "View all departments", href: "departments.html" },
        items: [
            { id: "dept-civil", icon: "CE", title: "Civil Engineering", description: "Surveying, construction materials, site practice, drawing and infrastructure fundamentals." },
            { id: "dept-computer", icon: "CO", title: "Computer Engineering", description: "Programming, hardware, networking, software development and digital problem solving." },
            { id: "dept-electrical", icon: "EE", title: "Electrical Engineering", description: "Electrical machines, circuits, measurement, power systems and workshop-based learning." },
        ],
    },

    facilities: {
        enabled: true,
        eyebrow: "Infrastructure",
        heading: "A campus built for hands-on learning",
        lead: "Modern academic spaces, core engineering labs and student support facilities keep learning active, visual and practice-led.",
        link: { label: "Explore infrastructure", href: "infrastructure.html" },
        items: [
            { id: "facility-labs", icon: "01", title: "Modern Laboratories", description: "Computer, electrical, surveying, chemistry and workshop spaces for regular practical sessions." },
            { id: "facility-library", icon: "02", title: "Library and Reading Hall", description: "Focused spaces for reference study, exam preparation and guided academic work." },
            { id: "facility-campus", icon: "03", title: "Student Facilities", description: "Hostel, dining, transport, sports and cultural activities support a complete campus life." },
        ],
    },

    placements: {
        enabled: true,
        eyebrow: "Careers",
        heading: "Career guidance from first year to final interview",
        lead: "Students receive support through skill-building sessions, aptitude preparation, industry exposure, placement guidance and interview readiness.",
        stats: [
            { value: "Industry visits", label: "Real workplace exposure" },
            { value: "Soft skills", label: "Communication and confidence" },
            { value: "Project work", label: "Portfolio-ready learning" },
        ],
        recruiters: ["Local industry connects", "Technical workshops", "Placement interviews", "Entrepreneurship guidance"],
    },

    gallery: {
        eyebrow: "Campus life",
        heading: "Learning that lives beyond lectures",
        lead: "Annual gatherings, technical workshops, social initiatives and competitive sports build confident, connected students.",
        link: { label: "Explore full gallery", href: "gallery.html" },
        items: [
            {
                id: "gallery-1",
                image: {
                    src: "assets/images/annual-gathering.jpg",
                    alt: "Annual gathering at Eaglewood",
                },
                tag: "Culture",
                title: "Annual Gathering",
                description: "A flagship celebration of student talent, creativity and campus community.",
            },
            {
                id: "gallery-2",
                image: {
                    src: "assets/images/drone-workshop.jpg",
                    alt: "Drone technology workshop",
                },
                tag: "Technology",
                title: "Drone Workshop",
                description: "Hands-on exposure to emerging technology and practical applications.",
            },
            {
                id: "gallery-3",
                image: {
                    src: "assets/images/blood-donation.jpg",
                    alt: "Blood donation camp",
                },
                tag: "Social impact",
                title: "Blood Donation",
                description: "Student participation in health, service and community initiatives.",
            },
        ],
    },

    testimonials: {
        enabled: true,
        eyebrow: "Voices",
        heading: "What students value at Eaglewood",
        lead: "A disciplined environment, approachable faculty and practical activities help students feel supported while they build technical ability.",
        items: [
            { id: "testimonial-1", quote: "The labs and workshops make engineering concepts easier to understand because we practice what we learn.", author: "Diploma Student", role: "Computer Engineering" },
            { id: "testimonial-2", quote: "Industrial visits, sports and events helped me become more confident beyond classroom study.", author: "Final Year Student", role: "Civil Engineering" },
            { id: "testimonial-3", quote: "Faculty support and admission guidance made the process clear for our family.", author: "Parent Feedback", role: "Eaglewood Community" },
        ],
    },

    news: {
        enabled: true,
        eyebrow: "News",
        heading: "Latest from Eaglewood",
        lead: "Campus updates, student activities and admission-related notices in one quick view.",
        items: [
            { title: "Admissions Open", summary: "Diploma and degree engineering admission support is available through the college office." },
            { title: "Workshop Culture", summary: "Technical workshops continue to strengthen practical exposure across departments." },
            { title: "Campus Activities", summary: "Sports, cultural events and social initiatives create a balanced student experience." },
        ],
    },

    events: {
        eyebrow: "Experience beyond classrooms",
        heading: "Sports, events & industry exposure",
        lead: "Real campus moments show students building teamwork on the court and understanding engineering practice during industrial visits.",
        link: { label: "See all new photos", href: "gallery.html" },
        items: [
            {
                id: "event-1",
                image: {
                    src: "assets/images/uploaded/sports-volleyball.jpg",
                    alt: "Students playing volleyball during a sports event",
                },
                tag: "Sports & Events",
                title: "Teamwork in action",
                description:
                    "Sports activities encourage fitness, discipline, confidence and team spirit alongside academic development.",
            },
            {
                id: "event-2",
                image: {
                    src: "assets/images/uploaded/industrial-visit-plant.jpg",
                    alt: "Eaglewood students observing industrial plant equipment",
                },
                tag: "Industrial Visit",
                title: "Engineering in the real world",
                description:
                    "Industrial visits help students connect classroom principles with equipment, processes and professional working environments.",
            },
        ],
    },

    faq: {
        enabled: true,
        eyebrow: "FAQ",
        heading: "Frequently asked questions",
        lead: "Quick answers for admissions, courses and campus facilities.",
        items: [
            { id: "faq-1", question: "Which engineering streams are offered?", answer: "Eaglewood offers Civil, Computer, Electrical and AI and Machine Learning focused engineering pathways." },
            { id: "faq-2", question: "Is admission guidance available?", answer: "Yes. The admissions team can guide students on eligibility, documents, scholarships and course selection." },
            { id: "faq-3", question: "Are hostel and transport facilities available?", answer: "The campus supports students with hostel, dining, transport, sports and learning facilities." },
        ],
    },

    contact: {
        heading: "Your engineering journey starts here.",
        description: "Speak with the Eaglewood admissions team for courses, eligibility and documents.",
        buttons: [
            { label: "Call Now", href: "tel:+919423716230", variant: "white" },
            { label: "Admission Information", href: "admission.html", variant: "ghost" },
        ],
    },

    footer: {
        tagline: "Eaglewood Polytechnic Institute",
        address: "Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131",
        phone: "+91 94237 16230",
        email: "eaglewoodpoly@gmail.com",
        social: [
            {
                label: "Facebook",
                href: "https://www.facebook.com/people/Eaglewood-Polytechnic-Institute-Phule-Pimpalgaon-Majalgaon/100094206302049/?mibextid=ZbWKwL",
                icon: "f",
            },
            {
                label: "Instagram",
                href: "https://www.instagram.com/eaglewood_polytechnic/",
                icon: "◎",
            },
            {
                label: "Twitter / X",
                href: "https://x.com/eaglewoodpoly?t=IeFIDR-stfwL8BUZjZEZgQ&s=08",
                icon: "X",
            },
        ],
        copyright: "Eaglewood Polytechnic Institute. All rights reserved.",
        developer: {
            name: "Shubham Ahire",
            contact: "https://wa.me/917249868133",
        },
    },
};

export default HOME_DATA;
