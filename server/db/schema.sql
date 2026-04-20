CREATE TABLE IF NOT EXISTS faculties (
  faculty_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  gender ENUM('M', 'F', 'O') NOT NULL DEFAULT 'O',
  dept_id VARCHAR(32) NOT NULL,
  teaching_type ENUM('T', 'NT') NOT NULL DEFAULT 'T',
  designation VARCHAR(255) NOT NULL,
  qualification ENUM('Graduate', 'Postgraduate', 'PhD') NOT NULL DEFAULT 'Graduate',
  date_of_joining DATE NULL,
  experience_years DECIMAL(6, 2) NOT NULL DEFAULT 0,
  is_on_leave BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fairness_counter (
  faculty_id INT PRIMARY KEY,
  jr_sv_count INT NOT NULL DEFAULT 0,
  sr_sv_count INT NOT NULL DEFAULT 0,
  squad_count INT NOT NULL DEFAULT 0,
  total_allocations INT NOT NULL DEFAULT 0,
  last_allocated_term VARCHAR(255) NULL,
  last_allocated_exam INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fairness_faculty FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exams (
  exam_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_name VARCHAR(255) NOT NULL,
  total_blocks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_schedule (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  student_count INT NOT NULL DEFAULT 0,
  block_required INT NOT NULL,
  dept_id VARCHAR(32) NOT NULL,
  exam_date DATE NOT NULL,
  shift ENUM('M', 'E') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_exam FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  schedule_id INT NULL,
  faculty_id INT NOT NULL,
  role ENUM('Jr_SV', 'Substitute', 'Sr_SV', 'Squad') NOT NULL,
  block_number INT NULL,
  squad_number INT NULL,
  exam_date DATE NOT NULL,
  shift ENUM('M', 'E') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alloc_exam FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_schedule FOREIGN KEY (schedule_id) REFERENCES exam_schedule(schedule_id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_faculty FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dept_block_rules (
  rule_id INT AUTO_INCREMENT PRIMARY KEY,
  dept_id VARCHAR(32) NOT NULL,
  start_block INT NOT NULL,
  end_block INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
