-- Eaglewood Polytechnic — Default CMS Content
-- Run in Supabase SQL Editor AFTER RUN_ALL_MIGRATIONS.sql
-- Idempotent: each section inserts only when the target table is empty.
-- Regenerate: node scripts/generate-default-content-sql.js


-- home_slides
insert into public.home_slides (title, subtitle, image_url, button_primary_label, button_primary_url, button_secondary_label, button_secondary_url, published, status, display_order, created_at, updated_at)
select * from (values
  ('Eaglewood Polytechnic Institute', 'AICTE Approved • DTE 2634 • MSBTE 51307 — Learn, innovate and lead with practical engineering education in Majalgaon.', 'assets/images/uploaded/workshop-front.jpg', 'Apply for Admission', 'admission.html', 'Explore Courses', 'courses.html', true, 'published', 1, now(), now()),
  ('Hands-On Engineering Education', 'Modern laboratories, workshops and project-based learning prepare students for industry and higher studies.', 'assets/images/uploaded/machine-lab-practical.jpg', 'View Departments', 'departments.html', 'Campus Gallery', 'gallery.html', true, 'published', 2, now(), now()),
  ('Industry Exposure & Placements', 'Industrial visits, aptitude training and placement guidance build interview-ready engineering professionals.', 'assets/images/uploaded/industrial-visit-group.jpg', 'Placement Highlights', 'index.html#placements', 'Contact Office', 'contact.html', true, 'published', 3, now(), now()),
  ('A Vibrant Student Campus', 'Sports, cultural events, NSS activities and disciplined residential life support holistic student growth.', 'assets/images/uploaded/sports-volleyball.jpg', 'Admission Open 2026-27', 'admission.html', 'Important Notices', 'index.html#notice-board', true, 'published', 4, now(), now())
) as v(title, subtitle, image_url, button_primary_label, button_primary_url, button_secondary_label, button_secondary_url, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.home_slides limit 1);


insert into public.principal_message (photo_url, name, qualification, designation, message, signature, published, status, display_order, created_at, updated_at)
select
  'assets/images/logo-official.jpg',
  'Dr. Principal Name',
  'M.Tech, Ph.D.',
  'Principal, Eaglewood Polytechnic Institute',
  'Welcome to Eaglewood Polytechnic Institute. We are committed to disciplined learning, practical engineering education and student-centred mentoring. Our campus at Sunanda Nagar, Phule Pimpalgaon, Majalgaon offers AICTE-approved diploma and degree pathways with modern laboratories, experienced faculty and strong industry exposure. We nurture confident, ethical and capable engineers ready to serve society and industry.',
  'Principal, Eaglewood Polytechnic',
  true, 'published', 1, now(), now()
where not exists (select 1 from public.principal_message limit 1);


-- updates
insert into public.updates (icon, title, description, image_url, category, color, date, button_label, button_url, published, status, display_order, pinned, created_at, updated_at)
select * from (values
  ('Admission', 'Admissions Open 2026-27', 'Diploma and degree engineering admissions are open. Visit the admission office with required documents.', 'assets/images/induction-programme.jpg', 'Admission', '#D4AF37', '2026-07-01', 'Read More', '#notice-board', true, 'published', 1, true, now(), now()),
  ('Academics', 'Induction Programme for New Students', 'Orientation sessions introduce students to campus rules, laboratories and academic mentoring.', 'assets/images/induction-programme.jpg', 'Academics', '#005B5B', '2026-07-01', 'Read More', 'index.html#latest-updates', true, 'published', 2, true, now(), now()),
  ('Workshop', 'Drone Technology Workshop', 'Students explored drone assembly, flight controls and emerging aerospace applications.', 'assets/images/drone-workshop.jpg', 'Workshop', '#D4AF37', '2026-07-01', 'Read More', 'gallery.html', true, 'published', 3, false, now(), now()),
  ('Industrial Visit', 'Industrial Visit to Manufacturing Plant', 'Final-year students observed production processes and safety practices during an industry visit.', 'assets/images/industrial-visit-plant.jpg', 'Industrial Visit', '#005B5B', '2026-07-01', 'Read More', 'gallery.html', true, 'published', 4, false, now(), now()),
  ('Campus', 'Annual Gathering 2025', 'Cultural performances, awards and student achievements were celebrated on campus.', 'assets/images/annual-gathering.jpg', 'Campus', '#D4AF37', '2026-07-01', 'Read More', 'gallery.html', true, 'published', 5, false, now(), now()),
  ('Placement', 'Placement Guidance Session', 'Training on aptitude, communication and interview skills for final-year students.', 'assets/images/placement-guidance.jpg', 'Placement', '#005B5B', '2026-07-01', 'Read More', 'index.html#placements', true, 'published', 6, false, now(), now()),
  ('Social', 'Blood Donation Camp', 'NSS and student volunteers organised a successful blood donation drive.', 'assets/images/blood-donation.jpg', 'Social', '#D4AF37', '2026-07-01', 'Read More', 'gallery.html', true, 'published', 7, false, now(), now()),
  ('Event', 'Engineers Day Celebration', 'Technical quiz, project display and expert lecture marked Engineers Day.', 'assets/images/engineers-day.jpg', 'Event', '#005B5B', '2026-07-01', 'Read More', 'gallery.html', true, 'published', 8, false, now(), now()),
  ('Infrastructure', 'Smart Classroom Upgrade', 'Digital teaching aids installed in select classrooms for interactive learning.', 'assets/images/smart-classroom.jpg', 'Infrastructure', '#D4AF37', '2026-07-01', 'Read More', 'infrastructure.html', true, 'published', 9, false, now(), now()),
  ('Student Services', 'Scholarship Guidance Desk', 'Students received information on government and institute scholarship schemes.', 'assets/images/student-achievements.jpg', 'Student Services', '#005B5B', '2026-07-01', 'Read More', 'admission.html', true, 'published', 10, false, now(), now())
) as v(icon, title, description, image_url, category, color, date, button_label, button_url, published, status, display_order, pinned, created_at, updated_at)
where not exists (select 1 from public.updates limit 1);


-- notices
insert into public.notices (title, description, date, important, is_new, priority, category, published, status, display_order, created_at, updated_at)
select * from (values
  ('Admissions Open 2026-27', 'Admission forms and document verification are available at the institute office on working days.', '2026-07-15', true, true, 'Important', 'Admission', true, 'published', 1, now(), now()),
  ('Document Verification Schedule', 'Bring original mark sheets, leaving certificate, Aadhaar and passport photos for verification.', '2026-07-15', false, true, 'Academic', 'Admission', true, 'published', 2, now(), now()),
  ('MSBTE Exam Form Notification', 'Students must submit examination forms before the deadline announced by the exam cell.', '2026-07-15', false, true, 'Examination', 'Exam Cell', true, 'published', 3, now(), now()),
  ('Anti-Ragging Awareness', 'Eaglewood maintains zero tolerance for ragging. Contact the anti-ragging committee immediately.', '2026-07-15', true, true, 'Important', 'Compliance', true, 'published', 4, now(), now()),
  ('Industrial Visit Registration', 'Department-wise industrial visit registrations are open for eligible students through HODs.', '2026-07-15', false, false, 'General', 'Academics', true, 'published', 5, now(), now()),
  ('Hostel Allotment Notice', 'Hostel seat allotment list will be displayed on the notice board and website.', '2026-07-15', false, false, 'Student Services', 'Hostel', true, 'published', 6, now(), now()),
  ('Scholarship Application Window', 'Eligible students may apply for government scholarships with income and caste certificates.', '2026-07-15', false, false, 'Scholarship', 'Student Services', true, 'published', 7, now(), now()),
  ('Library Timings Extended', 'Reading hall will remain open until 8 PM during examination preparation period.', '2026-07-15', false, false, 'General', 'Library', true, 'published', 8, now(), now()),
  ('Campus Transport Routes', 'Updated bus routes for Majalgaon and nearby villages are available at the admin office.', '2026-07-15', false, false, 'General', 'Transport', true, 'published', 9, now(), now()),
  ('Parent-Teacher Meeting', 'Parents are invited to meet faculty on the scheduled Saturday between 10 AM and 1 PM.', '2026-07-15', true, false, 'Important', 'Academics', true, 'published', 10, now(), now())
) as v(title, description, date, important, is_new, priority, category, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.notices limit 1);


-- courses
insert into public.courses (title, department, code, duration, seats, image_url, description, eligibility, fees, button_label, button_url, published, status, display_order, created_at, updated_at)
select * from (values
  ('Civil Engineering', 'Civil', '263419110', '3 Years Diploma', 60, 'assets/images/civil-department.jpg', 'Surveying, construction materials, structural drawing and site practice.', '10th pass for Diploma; 12th Science for Degree as per DTE norms', 'As per Shikshan Shulk committee', 'View Course', 'courses.html', true, 'published', 1, now(), now()),
  ('Computer Engineering', 'Computer', '263424510', '3 Years Diploma', 60, 'assets/images/computer-department.jpg', 'Programming, networking, databases and software development fundamentals.', '10th pass for Diploma; 12th Science for Degree as per DTE norms', 'As per Shikshan Shulk committee', 'View Course', 'courses.html', true, 'published', 2, now(), now()),
  ('Electrical Engineering', 'Electrical', '263429310', '3 Years Diploma', 60, 'assets/images/electrical-department.jpg', 'Electrical machines, circuits, power systems and workshop practice.', '10th pass for Diploma; 12th Science for Degree as per DTE norms', 'As per Shikshan Shulk committee', 'View Course', 'courses.html', true, 'published', 3, now(), now()),
  ('Artificial Intelligence (AI)', 'AI & ML', '263498510', '3 Years Diploma', 60, 'assets/images/ai-department.jpg', 'Machine learning, data science, Python and intelligent systems.', '10th pass for Diploma; 12th Science for Degree as per DTE norms', 'As per Shikshan Shulk committee', 'View Course', 'courses.html', true, 'published', 4, now(), now()),
  ('Civil Engineering (Degree)', 'Civil', '263411191', '4 Years Degree', 60, 'assets/images/civil-department.jpg', 'Advanced civil engineering with design projects and industry exposure.', '10th pass for Diploma; 12th Science for Degree as per DTE norms', 'As per Shikshan Shulk committee', 'View Course', 'courses.html', true, 'published', 5, now(), now()),
  ('Computer Engineering (Degree)', 'Computer', '263411245', '4 Years Degree', 60, 'assets/images/computer-department.jpg', 'Degree pathway in computing with projects and internship support.', '10th pass for Diploma; 12th Science for Degree as per DTE norms', 'As per Shikshan Shulk committee', 'View Course', 'courses.html', true, 'published', 6, now(), now())
) as v(title, department, code, duration, seats, image_url, description, eligibility, fees, button_label, button_url, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.courses limit 1);


-- departments
insert into public.departments (title, department_image_url, description, labs, faculty_count, students_count, hod_name, button_label, button_url, published, status, display_order, created_at, updated_at)
select * from (values
  ('Civil Engineering', 'assets/images/civil-department.jpg', 'Surveying, construction materials, site practice and infrastructure fundamentals.', 'Surveying Lab, CAD Lab, Materials Testing Lab', 8, 180, 'HOD, Civil', 'Explore Department', 'departments.html', true, 'published', 1, now(), now()),
  ('Computer Engineering', 'assets/images/computer-department.jpg', 'Programming, networking, software development and digital problem solving.', 'Programming Lab, Networking Lab, DB Lab', 9, 200, 'HOD, Computer', 'Explore Department', 'departments.html', true, 'published', 2, now(), now()),
  ('Electrical Engineering', 'assets/images/electrical-department.jpg', 'Electrical machines, circuits, power systems and workshop-based learning.', 'Machines Lab, Circuits Lab, Power Lab', 8, 175, 'HOD, Electrical', 'Explore Department', 'departments.html', true, 'published', 3, now(), now()),
  ('Artificial Intelligence & ML', 'assets/images/ai-department.jpg', 'Data science, intelligent systems, NLP and database technologies.', 'AI Lab, Data Science Lab, NLP Lab', 6, 150, 'HOD, Artificial', 'Explore Department', 'departments.html', true, 'published', 4, now(), now()),
  ('Mechanical Engineering', 'assets/images/workshop.jpg', 'Workshop practice, manufacturing processes and machine fundamentals.', 'Workshop, Manufacturing Lab, CAD Lab', 7, 160, 'HOD, Mechanical', 'Explore Department', 'departments.html', true, 'published', 5, now(), now())
) as v(title, department_image_url, description, labs, faculty_count, students_count, hod_name, button_label, button_url, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.departments limit 1);


-- faculty
insert into public.faculty (name, qualification, experience, department, subjects, photo_url, published, status, display_order, created_at, updated_at)
select * from (values
  ('Prof. A. Patil', 'M.Tech Civil', '12 Years', 'Civil Engineering', 'Surveying, Building Materials', 'assets/images/logo.jpg', true, 'published', 1, now(), now()),
  ('Prof. S. Jadhav', 'M.Tech CSE', '10 Years', 'Computer Engineering', 'Programming, DBMS', 'assets/images/logo.jpg', true, 'published', 2, now(), now()),
  ('Prof. R. Deshmukh', 'M.Tech Electrical', '11 Years', 'Electrical Engineering', 'Machines, Power Systems', 'assets/images/logo.jpg', true, 'published', 3, now(), now()),
  ('Prof. N. Kulkarni', 'M.Tech AI', '8 Years', 'AI & ML', 'Machine Learning, Python', 'assets/images/logo.jpg', true, 'published', 4, now(), now()),
  ('Prof. M. Shaikh', 'B.E. Mechanical', '9 Years', 'Mechanical Engineering', 'Workshop, Manufacturing', 'assets/images/logo.jpg', true, 'published', 5, now(), now()),
  ('Prof. P. More', 'M.Sc. Physics', '7 Years', 'Applied Science', 'Engineering Physics', 'assets/images/logo.jpg', true, 'published', 6, now(), now()),
  ('Prof. V. Gaikwad', 'M.Sc. Chemistry', '6 Years', 'Applied Science', 'Engineering Chemistry', 'assets/images/logo.jpg', true, 'published', 7, now(), now()),
  ('Prof. L. Bhosale', 'MBA', '5 Years', 'Placement Cell', 'Soft Skills, Aptitude', 'assets/images/logo.jpg', true, 'published', 8, now(), now())
) as v(name, qualification, experience, department, subjects, photo_url, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.faculty limit 1);


-- facilities
insert into public.facilities (title, icon, image_url, description, category, published, status, display_order, created_at, updated_at)
select * from (values
  ('Modern Laboratories', 'Lab', 'assets/images/workshop.jpg', 'Well-equipped practical spaces for hands-on engineering learning.', 'Labs', true, 'published', 1, now(), now()),
  ('Central Library', 'Library', 'assets/images/library.jpg', 'Reference books, journals and quiet reading spaces for students.', 'Library', true, 'published', 2, now(), now()),
  ('Boys Hostel', 'Hostel', 'assets/images/hostel-building.jpg', 'Secure residential accommodation with mess and study hours.', 'Hostel', true, 'published', 3, now(), now()),
  ('Girls Hostel', 'Hostel', 'assets/images/hostel-exterior.jpg', 'Disciplined residential facility for women students.', 'Hostel', true, 'published', 4, now(), now()),
  ('College Transport', 'Transport', 'assets/images/transport.jpg', 'Bus routes connecting Majalgaon and nearby towns.', 'Transport', true, 'published', 5, now(), now()),
  ('Sports Ground', 'Sports', 'assets/images/boys-volleyball.jpg', 'Volleyball, kabaddi and annual sports competitions.', 'Sports', true, 'published', 6, now(), now()),
  ('Computer Centre', 'Monitor', 'assets/images/computer-lab.jpg', 'Programming labs with updated systems and internet.', 'Smart Classroom', true, 'published', 7, now(), now()),
  ('Workshop & Machine Lab', 'Workshop', 'assets/images/uploaded/workshop-interior.jpg', 'Fabrication, fitting and machine shop practice.', 'Workshop', true, 'published', 8, now(), now()),
  ('Auditorium', 'Mic', 'assets/images/annual-gathering-stage.jpg', 'Seminars, guest lectures and cultural programmes.', 'Auditorium', true, 'published', 9, now(), now()),
  ('Canteen', 'Cafe', 'assets/images/dining-hall.jpg', 'Hygienic meals and refreshments for students and staff.', 'Canteen', true, 'published', 10, now(), now())
) as v(title, icon, image_url, description, category, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.facilities limit 1);


-- placements
insert into public.placements (title, recruiter, package, highest_package, average_package, placed_students, image_url, testimonial, student_name, course, published, status, display_order, created_at, updated_at)
select * from (values
  ('Placement Highlights 2025', 'TCS', '85%', '₹6 LPA', '₹3.2 LPA', 120, 'assets/images/placement-interview.jpg', 'Placement training and mock interviews helped me secure a campus interview confidently.', 'Rahul K.', 'Computer Engineering', true, 'published', 1, now(), now()),
  ('Industry Partners', 'Infosys', '72%', '₹5.5 LPA', '₹3 LPA', 95, 'assets/images/placement-guidance.jpg', 'Industrial visits gave real context to our classroom learning.', 'Priya S.', 'Electrical Engineering', true, 'published', 2, now(), now()),
  ('Training & Placement Cell', 'Wipro', '80%', '₹6 LPA', '₹3.4 LPA', 110, 'assets/images/personality-development.jpg', 'Soft skills sessions improved my communication for interviews.', 'Amit D.', 'Civil Engineering', true, 'published', 3, now(), now())
) as v(title, recruiter, package, highest_package, average_package, placed_students, image_url, testimonial, student_name, course, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.placements limit 1);


-- gallery
insert into public.gallery (title, category, image_url, alt, description, featured, published, status, display_order, created_at, updated_at)
select * from (values
  ('Annual Gathering', 'Events', 'assets/images/annual-gathering.jpg', 'Annual Gathering', 'Annual Gathering at Eaglewood Polytechnic Institute', true, true, 'published', 1, now(), now()),
  ('Drone Workshop', 'Workshops', 'assets/images/drone-workshop.jpg', 'Drone Workshop', 'Drone Workshop at Eaglewood Polytechnic Institute', true, true, 'published', 2, now(), now()),
  ('Industrial Visit', 'Industrial Visits', 'assets/images/industrial-visit-plant.jpg', 'Industrial Visit', 'Industrial Visit at Eaglewood Polytechnic Institute', true, true, 'published', 3, now(), now()),
  ('Volleyball Tournament', 'Sports', 'assets/images/boys-volleyball.jpg', 'Volleyball Tournament', 'Volleyball Tournament at Eaglewood Polytechnic Institute', false, true, 'published', 4, now(), now()),
  ('Blood Donation Camp', 'Social', 'assets/images/blood-donation.jpg', 'Blood Donation Camp', 'Blood Donation Camp at Eaglewood Polytechnic Institute', false, true, 'published', 5, now(), now()),
  ('Computer Lab Session', 'Labs', 'assets/images/uploaded/computer-lab-students.jpg', 'Computer Lab Session', 'Computer Lab Session at Eaglewood Polytechnic Institute', false, true, 'published', 6, now(), now()),
  ('Surveying Practical', 'Labs', 'assets/images/uploaded/surveying-field-practical.jpg', 'Surveying Practical', 'Surveying Practical at Eaglewood Polytechnic Institute', false, true, 'published', 7, now(), now()),
  ('Workshop Practice', 'Labs', 'assets/images/uploaded/workshop-group.jpg', 'Workshop Practice', 'Workshop Practice at Eaglewood Polytechnic Institute', false, true, 'published', 8, now(), now()),
  ('Republic Day', 'Events', 'assets/images/republic-day.jpg', 'Republic Day', 'Republic Day at Eaglewood Polytechnic Institute', false, true, 'published', 9, now(), now()),
  ('Teachers Day', 'Events', 'assets/images/teachers-day.jpg', 'Teachers Day', 'Teachers Day at Eaglewood Polytechnic Institute', false, true, 'published', 10, now(), now()),
  ('Campus Aerial View', 'Campus', 'assets/images/campus.jpg', 'Campus Aerial View', 'Campus Aerial View at Eaglewood Polytechnic Institute', false, true, 'published', 11, now(), now()),
  ('Library Reading Hall', 'Campus', 'assets/images/reading-hall.jpg', 'Library Reading Hall', 'Library Reading Hall at Eaglewood Polytechnic Institute', false, true, 'published', 12, now(), now())
) as v(title, category, image_url, alt, description, featured, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.gallery limit 1);


insert into public.footer_blocks (block_key, title, content, published, status, display_order, created_at, updated_at)
select * from (values
  ('footer_main', 'Main Footer', '{"tagline":"AICTE Approved • MSBTE Affiliated • DTE 2634","copyright":"Eaglewood Polytechnic Institute"}'::jsonb::jsonb, true, 'published', 1, now(), now()),
  ('quick_links', 'Quick Links', '{"links":[{"label":"About","href":"about.html"},{"label":"Courses","href":"courses.html"},{"label":"Departments","href":"departments.html"},{"label":"Gallery","href":"gallery.html"},{"label":"Admissions","href":"admission.html"},{"label":"Contact","href":"contact.html"}]}'::jsonb::jsonb, true, 'published', 2, now(), now()),
  ('contact_block', 'Contact', '{"phone":"+91 94237 16230","email":"eaglewoodpoly@gmail.com","address":"Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131"}'::jsonb::jsonb, true, 'published', 3, now(), now())
) as v(block_key, title, content, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.footer_blocks limit 1);


insert into public.ai_prompts (name, prompt, greeting_message, fallback_response, quick_replies, suggested_questions, temperature, token_limit, published, status, display_order, created_at, updated_at)
select
  'Eaglewood Assistant',
  'You are the official AI assistant for Eaglewood Polytechnic Institute, Majalgaon. Answer questions about admissions, courses, departments, fees, scholarships, hostel, transport and contact details. Be concise, accurate and friendly. If unsure, direct users to the admission office.',
  'Hello! I am the Eaglewood AI Assistant. Ask me about admissions, courses, departments, fees or contact details.',
  'I could not find a confident answer. Please contact the admission office at +91 94237 16230 or eaglewoodpoly@gmail.com.',
  '["Admissions","Courses","Fees","Hostel","Contact"]'::jsonb::jsonb,
  '["How do I apply for admission?","Which courses are offered?","What is the DTE code?","Is hostel available?","How to contact the office?"]'::jsonb::jsonb,
  0.7, 800, true, 'published', 1, now(), now()
where not exists (select 1 from public.ai_prompts limit 1);


-- ai_knowledge_base
insert into public.ai_knowledge_base (question, answer, category, keywords, published, status, display_order, created_at, updated_at)
select * from (values
  ('What courses does Eaglewood offer?', 'Eaglewood offers Diploma and Degree programs in Civil, Computer, Electrical and Artificial Intelligence engineering.', 'Admissions', 'admissions', true, 'published', 1, now(), now()),
  ('What is the DTE institute code?', 'The DTE institute code is 2634.', 'Admissions', 'admissions', true, 'published', 2, now(), now()),
  ('What is the MSBTE institute code?', 'The MSBTE institute code is 51307.', 'Admissions', 'admissions', true, 'published', 3, now(), now()),
  ('Where is Eaglewood Polytechnic located?', 'Sunanda Nagar, Phule Pimpalgaon, Majalgaon, District Beed 431131, Maharashtra.', 'Contact', 'contact', true, 'published', 4, now(), now()),
  ('What is the admission office phone number?', 'Call +91 94237 16230 for admission enquiries.', 'Contact', 'contact', true, 'published', 5, now(), now()),
  ('What is the admission email?', 'Email eaglewoodpoly@gmail.com for admission support.', 'Contact', 'contact', true, 'published', 6, now(), now()),
  ('What are the office hours?', 'Monday to Saturday, 9:30 AM to 5:30 PM.', 'Contact', 'contact', true, 'published', 7, now(), now()),
  ('Is the institute AICTE approved?', 'Yes. Eaglewood Polytechnic is approved by AICTE and Government of Maharashtra.', 'Approvals', 'approvals', true, 'published', 8, now(), now()),
  ('Which university is Eaglewood affiliated to?', 'Affiliated to MSBTE for diploma programs and DBATU for degree programs.', 'Approvals', 'approvals', true, 'published', 9, now(), now()),
  ('Is hostel facility available?', 'Yes. Separate hostel facilities are available for boys and girls.', 'Campus', 'campus', true, 'published', 10, now(), now()),
  ('Is transport available?', 'College buses operate on routes covering Majalgaon and nearby villages.', 'Campus', 'campus', true, 'published', 11, now(), now()),
  ('How many seats per branch?', 'Typically 60 sanctioned institute seats plus EWS and TFWS seats per branch.', 'Admissions', 'admissions', true, 'published', 12, now(), now()),
  ('What documents are needed for admission?', 'Mark sheets, leaving certificate, Aadhaar, photos and category certificates if applicable.', 'Admissions', 'admissions', true, 'published', 13, now(), now()),
  ('Are scholarships available?', 'Government and eligible scholarship schemes are supported through the admission office.', 'Admissions', 'admissions', true, 'published', 14, now(), now()),
  ('Does Eaglewood have placement support?', 'Yes. Training, aptitude sessions and placement guidance are provided.', 'Placements', 'placements', true, 'published', 15, now(), now()),
  ('What labs are on campus?', 'Computer, electrical, surveying, workshop, AI and science laboratories.', 'Academics', 'academics', true, 'published', 16, now(), now()),
  ('How can I visit the campus?', 'Contact the office to schedule a campus visit on working days.', 'Contact', 'contact', true, 'published', 17, now(), now()),
  ('Is there an anti-ragging policy?', 'Eaglewood maintains zero tolerance for ragging with an active anti-ragging committee.', 'Compliance', 'compliance', true, 'published', 18, now(), now()),
  ('Who developed this website?', 'Designed and developed by Shubham Ahire.', 'General', 'general', true, 'published', 19, now(), now()),
  ('How do I apply online?', 'Fill the admission form on the website or visit the admission office with documents.', 'Admissions', 'admissions', true, 'published', 20, now(), now())
) as v(question, answer, category, keywords, published, status, display_order, created_at, updated_at)
where not exists (select 1 from public.ai_knowledge_base limit 1);


insert into public.settings (key, value, published, status, display_order, created_at, updated_at) values
  ('dte_code', '"2634"', true, 'active', 9, now(), now()),
  ('msbte_code', '"51307"', true, 'active', 10, now(), now()),
  ('affiliation', '"Affiliated to MSBTE & DBATU"', true, 'active', 11, now(), now()),
  ('approval', '"Approved by AICTE, DTE & Govt. of Maharashtra"', true, 'active', 12, now(), now()),
  ('whatsapp', '"+919423716230"', true, 'active', 13, now(), now()),
  ('mission', '"To deliver industry-oriented engineering education with discipline, practical exposure and ethical values."', true, 'active', 20, now(), now()),
  ('vision', '"To be a leading polytechnic nurturing confident engineers for society and industry."', true, 'active', 21, now(), now()),
  ('objectives', '["Hands-on laboratory learning","Industry-aligned curriculum","Student mentoring and placement support","Inclusive campus culture"]', true, 'active', 22, now(), now()),
  ('core_values', '["Integrity","Innovation","Discipline","Excellence","Service"]', true, 'active', 23, now(), now()),
  ('copyright_text', '"Eaglewood Polytechnic Institute"', true, 'active', 33, now(), now()),
  ('achievements', '[{"title":"AICTE Approved Institute","description":"Recognised by AICTE and Government of Maharashtra for quality technical education.","icon":"🏛","year":"2024"},{"title":"MSBTE Affiliation","description":"Affiliated to Maharashtra State Board of Technical Education with strong academic outcomes.","icon":"🎓","year":"2024"},{"title":"Placement Excellence","description":"Consistent placement guidance and industry interaction for final-year students.","icon":"💼","year":"2025"},{"title":"Sports & Cultural Awards","description":"Students excel in zonal sports, annual gathering and technical events.","icon":"🏅","year":"2025"},{"title":"Industrial Collaboration","description":"Regular industrial visits and expert lectures from industry professionals.","icon":"🏭","year":"2025"},{"title":"Student Achievements","description":"Project exhibitions, poster presentations and technical competitions at state level.","icon":"⭐","year":"2025"}]'::jsonb, true, 'active', 24, now(), now()),
  ('admission_steps', '[{"step":1,"title":"Check Eligibility","description":"Confirm diploma or degree pathway eligibility with the admission office.","icon":"📋"},{"step":2,"title":"Submit Application","description":"Fill the online form or visit campus with required documents.","icon":"📝"},{"step":3,"title":"Document Verification","description":"Original mark sheets, certificates and identity proofs are verified.","icon":"✅"},{"step":4,"title":"Seat Confirmation","description":"Complete admission formalities and fee payment as per guidelines.","icon":"🎓"},{"step":5,"title":"Join Campus","description":"Attend induction, collect ID card and begin your engineering journey.","icon":"🏫"}]'::jsonb, true, 'active', 25, now(), now()),
  ('campus_facts', '[{"label":"Established Campus","value":"Majalgaon"},{"label":"DTE Code","value":"2634"},{"label":"MSBTE Code","value":"51307"},{"label":"Programs","value":"Diploma & Degree"}]'::jsonb, true, 'active', 26, now(), now())
on conflict (key) do nothing;

notify pgrst, 'reload schema';
