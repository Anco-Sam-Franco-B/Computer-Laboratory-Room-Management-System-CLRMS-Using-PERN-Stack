import Badge from './ui/Badge';
import { STATUS_COLORS, PRIORITY_COLORS, ROLES } from '../lib/constants';
import { toTitleCase } from '../lib/format';

export default function StatusBadge({ status, role }) {
  if (role && ROLES[role]) {
    return <Badge color={ROLES[role].color}>{ROLES[role].label}</Badge>;
  }
  const color = STATUS_COLORS[status] || 'slate';
  return <Badge color={color}>{toTitleCase(status)}</Badge>;
}

export function PriorityBadge({ priority }) {
  return <Badge color={PRIORITY_COLORS[priority] || 'slate'}>{toTitleCase(priority)}</Badge>;
}

export function HealthBadge({ score }) {
  const color = score >= 85 ? 'green' : score >= 60 ? 'amber' : 'rose';
  return <Badge color={color}>{score}%</Badge>;
}