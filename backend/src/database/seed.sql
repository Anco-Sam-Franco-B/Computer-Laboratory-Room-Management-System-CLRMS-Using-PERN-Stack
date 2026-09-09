-- ============================================================================
--  CLRMS — Seed Data (static reference data)
--  Users are seeded in Node (seed.js) because passwords need bcrypt hashing.
-- ============================================================================

-- ------------------------------------------------------------------ ROLES
INSERT INTO roles (id, name, code, description, permissions) VALUES
('11111111-1111-4111-8111-111111111101','Super Admin','super_admin','Full system access', '["*"]'),
('11111111-1111-4111-8111-111111111102','Laboratory Manager','lab_manager','Manages assigned laboratories and resources','["dashboard:view","labs:manage","computers:manage","equipment:manage","bookings:manage","attendance:manage","reports:view","maintenance:view","incidents:view"]'),
('11111111-1111-4111-8111-111111111103','Technician','technician','Repairs and maintains equipment','["dashboard:view","maintenance:manage","incidents:manage","equipment:update","computers:update","reports:view"]'),
('11111111-1111-4111-8111-111111111104','Lecturer','lecturer','Requests bookings, records attendance','["dashboard:view","bookings:create","attendance:manage","schedule:view","incidents:create","reports:view"]'),
('11111111-1111-4111-8111-111111111105','Student','student','Views schedules and attendance','["dashboard:view","schedule:view","attendance:view","incidents:create"]')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, permissions = EXCLUDED.permissions;

-- ------------------------------------------------------------ DEPARTMENTS
INSERT INTO departments (id, name, code, description, color) VALUES
('22222222-2222-4222-8222-222222222201','Computer Science','CS','Computer Science department','#6366f1'),
('22222222-2222-4222-8222-222222222202','Information Technology','IT','Information Technology department','#10b981'),
('22222222-2222-4222-8222-222222222203','Engineering','ENG','Engineering department','#f59e0b'),
('22222222-2222-4222-8222-222222222204','Business Studies','BUS','Business Studies department','#ec4899')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------- LABORATORIES
INSERT INTO laboratories (id, name, code, location, capacity, status, department_id, opens_at, closes_at) VALUES
('33333333-3333-4333-8333-333333333301','Lab 1 — Programming','LAB-CS-01','Block A, Room 101',40,'active','22222222-2222-4222-8222-222222222201','08:00','20:00'),
('33333333-3333-4333-8333-333333333302','Lab 2 — Networking','LAB-CS-02','Block A, Room 103',30,'active','22222222-2222-4222-8222-222222222201','08:00','20:00'),
('33333333-3333-4333-8333-333333333303','Lab 3 — Multimedia','LAB-IT-01','Block B, Room 205',25,'active','22222222-2222-4222-8222-222222222202','09:00','18:00'),
('33333333-3333-4333-8333-333333333304','Engineering Lab','LAB-ENG-01','Block C, Room 110',20,'active','22222222-2222-4222-8222-222222222203','08:00','17:00'),
('33333333-3333-4333-8333-333333333305','Business Computing Lab','LAB-BUS-01','Block B, Room 210',35,'maintenance','22222222-2222-4222-8222-222222222204','08:00','18:00')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------ COMPUTERS
INSERT INTO computers (id, computer_number, serial_number, brand, model, processor, ram_gb, storage_gb, storage_type, os, status, laboratory_id, health_score, purchase_date, warranty_until) VALUES
('44444444-4444-4444-8444-444444444401','CS1-001','SN-X1-0001','Dell','OptiPlex 7010','Intel Core i5-13500',16,512,'SSD','Windows 11','active','33333333-3333-4333-8333-333333333301',100,'2023-01-10','2026-01-10'),
('44444444-4444-4444-8444-444444444402','CS1-002','SN-X1-0002','Dell','OptiPlex 7010','Intel Core i5-13500',16,512,'SSD','Windows 11','active','33333333-3333-4333-8333-333333333301',98,'2023-01-10','2026-01-10'),
('44444444-4444-4444-8444-444444444403','CS1-003','SN-X1-0003','Dell','OptiPlex 7010','Intel Core i5-13500',16,512,'SSD','Windows 11','maintenance','33333333-3333-4333-8333-333333333301',60,'2023-01-10','2026-01-10'),
('44444444-4444-4444-8444-444444444404','CS2-001','SN-N1-0001','HP','ProDesk 400','Intel Core i7-12700',32,1024,'NVMe','Windows 11','active','33333333-3333-4333-8333-333333333302',100,'2024-02-01','2027-02-01'),
('44444444-4444-4444-8444-444444444405','CS2-002','SN-N1-0002','HP','ProDesk 400','Intel Core i7-12700',32,1024,'NVMe','Windows 11','broken','33333333-3333-4333-8333-333333333302',25,'2024-02-01','2027-02-01'),
('44444444-4444-4444-8444-444444444406','ITM-001','SN-M1-0001','Apple','iMac 24"','Apple M1',16,512,'SSD','macOS Ventura','active','33333333-3333-4333-8333-333333333303',100,'2023-06-15','2026-06-15'),
('44444444-4444-4444-8444-444444444407','ENG-001','SN-E1-0001','Lenovo','ThinkCentre M90','Intel Core i5-12400',16,512,'SSD','Windows 10','active','33333333-3333-4333-8333-333333333304',96,'2022-08-20','2025-08-20'),
('44444444-4444-4444-8444-444444444408','BUS-001','SN-B1-0001','Dell','OptiPlex 7080','Intel Core i5-10500',8,256,'SSD','Windows 10','retired','33333333-3333-4333-8333-333333333305',50,'2021-03-01','2024-03-01')
ON CONFLICT (computer_number) DO NOTHING;

-- ------------------------------------------------------------ EQUIPMENT
INSERT INTO equipment (id, equipment_type, name, brand, model, serial_number, status, laboratory_id) VALUES
('55555555-5555-4555-8555-555555555501','printer','Laser Printer','HP','LaserJet Pro M404','EQ-PR-001','active','33333333-3333-4333-8333-333333333301'),
('55555555-5555-4555-8555-555555555502','projector','HD Projector','Epson','EB-X51','EQ-PJ-002','active','33333333-3333-4333-8333-333333333301'),
('55555555-5555-4555-8555-555555555503','ups','UPS 1500VA','APC','Back-UPS','EQ-UPS-003','active','33333333-3333-4333-8333-333333333302'),
('55555555-5555-4555-8555-555555555504','router','Campus Router','Cisco','ISR 4321','EQ-RT-004','active','33333333-3333-4333-8333-333333333302'),
('55555555-5555-4555-8555-555555555505','switch','48-Port Switch','Netgear','GS716T','EQ-SW-005','in_repair','33333333-3333-4333-8333-333333333302'),
('55555555-5555-4555-8555-555555555506','scanner','Document Scanner','Canon','imageFORMULA','EQ-SC-006','active','33333333-3333-4333-8333-333333333303')
ON CONFLICT (serial_number) DO NOTHING;

-- ----------------------------------------------------------- SEMESTERS
INSERT INTO semesters (id, name, season, year, start_date, end_date, is_active) VALUES
('66666666-6666-4666-8666-666666666601','Spring 2026','spring',2026,'2026-01-12','2026-05-01',true),
('66666666-6666-4666-8666-666666666602','Fall 2026','fall',2026,'2026-08-10','2026-12-04',false)
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------- SYSTEM SETTINGS
INSERT INTO system_settings (key, value, description) VALUES
('system.name',        '"CLRMS"', 'Name of the system'),
('system.organization','"City Technical University"','Institution name'),
('system.email_from',  '"CLRMS <no-reply@clrms.local>"','Email sender'),
('system.logo',        '""','Logo URL'),
('notification.email_enabled','"true"','Send email notifications'),
('notification.sms_enabled','"false"','Send sms notifications'),
('security.max_login_attempts','"5"','Failed attempts before locking'),
('security.lock_duration_minutes','"15"','Account lock duration'),
('security.session_days','"7"','Refresh token lifetime (days)'),
('attendance.late_after_minutes','"15"','Minutes after start considered late'),
('booking.auto_approve','"false"','Auto approve bookings'),
('booking.max_advance_days','"30"','Max days in advance a booking can be made')
ON CONFLICT (key) DO NOTHING;