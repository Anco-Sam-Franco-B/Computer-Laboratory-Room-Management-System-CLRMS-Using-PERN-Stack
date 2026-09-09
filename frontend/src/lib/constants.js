export { toTitleCase } from './format';

export const ROLES = {
  super_admin: { label: 'Super Admin', color: 'purple' },
  lab_manager: { label: 'Laboratory Manager', color: 'blue' },
  technician: { label: 'Technician', color: 'amber' },
  lecturer: { label: 'Lecturer', color: 'teal' },
  student: { label: 'Student', color: 'slate' },
};

export const STATUS_COLORS = {
  // generic statuses
  active: 'green',
  inactive: 'slate',
  pending: 'amber',
  approved: 'green',
  rejected: 'rose',
  cancelled: 'slate',
  completed: 'blue',
  // labs
  maintenance: 'amber',
  closed: 'rose',
  // computers
  broken: 'rose',
  retired: 'slate',
  // attendance
  present: 'green',
  absent: 'rose',
  late: 'amber',
  excused: 'blue',
  // maintenance
  open: 'red',
  in_progress: 'amber',
  resolved: 'green',
  in_repair: 'amber',
  // incidents
  assigned: 'blue',
  // visitors
  checked_in: 'green',
  checked_out: 'slate',
  denied: 'rose',
  // users
  suspended: 'rose',
  locked: 'red',
};

export const PRIORITY_COLORS = {
  low: 'blue',
  medium: 'amber',
  high: 'orange',
  critical: 'rose',
};

export const BOOKING_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const COMPUTER_STATUS_LABELS = {
  active: 'Active',
  maintenance: 'Maintenance',
  broken: 'Broken',
  retired: 'Retired',
};

export const EQUIPMENT_TYPES = ['printer', 'projector', 'ups', 'router', 'switch', 'scanner', 'other'];
export const EQUIPMENT_TYPE_LABELS = {
  printer: 'Printer',
  projector: 'Projector',
  ups: 'UPS',
  router: 'Router',
  switch: 'Switch',
  scanner: 'Scanner',
  other: 'Other',
};

export const INCIDENT_TYPES = ['hardware', 'network', 'software', 'security', 'other'];
export const INCIDENT_TYPE_LABELS = {
  hardware: 'Hardware',
  network: 'Network',
  software: 'Software',
  security: 'Security',
  other: 'Other',
};

export const SESSION_KINDS = ['class', 'lab', 'exam', 'workshop', 'other'];
export const SESSION_KIND_LABELS = {
  class: 'Class',
  lab: 'Lab',
  exam: 'Exam',
  workshop: 'Workshop',
  other: 'Other',
};

export const ATTENDANCE_STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

export const REPORT_TYPES = [
  { type: 'attendance', label: 'Attendance' },
  { type: 'utilization', label: 'Laboratory Utilization' },
  { type: 'bookings', label: 'Bookings' },
  { type: 'maintenance', label: 'Maintenance' },
  { type: 'equipment', label: 'Equipment' },
  { type: 'assets', label: 'Assets' },
  { type: 'incidents', label: 'Incidents' },
  { type: 'visitors', label: 'Visitors' },
];