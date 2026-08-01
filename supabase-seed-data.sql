-- Safe starter data for Eaglewood Polytechnic Institute CMS
insert into public.settings (key, value, category, is_public, display_order) values
('phone', '"+91 94237 16230"'::jsonb, 'contact', true, 1),
('email', '"eaglewoodpoly@gmail.com"'::jsonb, 'contact', true, 2),
('address', '"Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131"'::jsonb, 'contact', true, 3),
('institute_type', '"Private Polytechnic Institute"'::jsonb, 'approval', true, 4),
('dte_code', '"2634"'::jsonb, 'approval', true, 5),
('msbte_code', '"51307"'::jsonb, 'approval', true, 6)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.principal_message (heading, message, short_message, full_message, principal_name, name, designation, photo_url, button_text, button_link, published)
select 'Leadership with Purpose',
'At Eaglewood Polytechnic Institute, we focus on disciplined learning, practical engineering education and student-centred mentoring. Our aim is to build confident, skilled and responsible professionals ready for industry and society.',
'At Eaglewood Polytechnic Institute, we focus on disciplined learning, practical engineering education and student-centred mentoring.',
'At Eaglewood Polytechnic Institute, we focus on disciplined learning, practical engineering education and student-centred mentoring. Our aim is to build confident, skilled and responsible professionals ready for industry and society.',
'Principal', 'Principal', 'Eaglewood Polytechnic Institute', '', 'Read Full Message', '#principal-message', true
where not exists (select 1 from public.principal_message);

insert into public.home_slides (title, subtitle, description, image_url, button_primary_label, button_primary_url, button_secondary_label, button_secondary_url, display_order, published) values
('Eaglewood Polytechnic Institute', 'Private Polytechnic Institute with statutory approvals and affiliation.', 'A modern technical education campus focused on disciplined learning, practical labs and student mentoring.', 'assets/images/campus.jpg', 'Apply for Admission', '#inquiry', 'Latest Notices', '#notice-board', 1, true)
on conflict do nothing;

insert into public.courses (title, name, slug, duration, intake, seats, eligibility, description, image_url, display_order, published) values
('Civil Engineering', 'Civil Engineering', 'civil-engineering', '3 Years', 60, 60, 'As per admission norms', 'Diploma engineering education with practical learning and site exposure.', 'assets/images/civil-department.jpg', 1, true),
('Computer Engineering', 'Computer Engineering', 'computer-engineering', '3 Years', 60, 60, 'As per admission norms', 'Programming, computing fundamentals and practical digital skills.', 'assets/images/computer-department.jpg', 2, true),
('Electrical Engineering', 'Electrical Engineering', 'electrical-engineering', '3 Years', 60, 60, 'As per admission norms', 'Electrical systems, machines and practical workshop exposure.', 'assets/images/electrical-department.jpg', 3, true)
on conflict do nothing;

insert into public.departments (title, name, slug, description, department_image_url, image_url, display_order, published) values
('Civil Engineering', 'Civil Engineering', 'civil-engineering', 'Practical civil engineering education with labs, workshops and project learning.', 'assets/images/civil-department.jpg', 'assets/images/civil-department.jpg', 1, true),
('Computer Engineering', 'Computer Engineering', 'computer-engineering', 'Computer education focused on programming, labs and practical skills.', 'assets/images/computer-department.jpg', 'assets/images/computer-department.jpg', 2, true),
('Electrical Engineering', 'Electrical Engineering', 'electrical-engineering', 'Electrical engineering learning through experiments and technical mentoring.', 'assets/images/electrical-department.jpg', 'assets/images/electrical-department.jpg', 3, true)
on conflict do nothing;

insert into public.facilities (title, slug, description, image_url, icon, display_order, published) values
('Modern Laboratories', 'modern-laboratories', 'Well-equipped practical spaces for hands-on engineering learning.', 'assets/images/workshop.jpg', 'flask', 1, true),
('Library and Reading Hall', 'library-reading-hall', 'Quiet reading and reference support for academic growth.', 'assets/images/library.jpg', 'book', 2, true),
('Student Facilities', 'student-facilities', 'Campus support services for daily student needs.', 'assets/images/campus.jpg', 'building', 3, true),
('Hostel', 'hostel', 'Residential support for students.', 'assets/images/hostel-building.jpg', 'building', 4, true),
('Sports', 'sports', 'Activities that build teamwork and discipline.', 'assets/images/boys-volleyball.jpg', 'trophy', 5, true),
('Computer Lab', 'computer-lab', 'Computer systems for programming and digital practice.', 'assets/images/computer-lab.jpg', 'monitor', 6, true),
('Auditorium', 'auditorium', 'A shared space for seminars, presentations and academic events.', 'assets/images/annual-gathering.jpg', 'mic', 7, true),
('Cafeteria', 'cafeteria', 'Refreshment space for students and staff.', 'assets/images/dining-hall.jpg', 'coffee', 8, true)
on conflict do nothing;

insert into public.notices (title, description, notice_date, priority, important, is_new, display_order, published) values
('Admissions Open', 'Admission guidance is available at the institute office.', current_date, 10, true, true, 1, true)
on conflict do nothing;

insert into public.ai_settings (key, value, category, display_order, published, is_active) values
('welcome_message', '"Hello. I am Eaglewood AI Assistant. Ask me about admissions, courses, fees, departments, scholarships or contact details."'::jsonb, 'assistant', 1, true, true),
('suggested_questions', '["Admissions","Courses","Contact","Fees","Departments","Scholarships","Call Office","WhatsApp Admission Help"]'::jsonb, 'assistant', 2, true, true)
on conflict (key) do update set value = excluded.value, updated_at = now();
