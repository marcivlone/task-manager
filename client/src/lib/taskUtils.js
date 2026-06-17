export const STATUS_LABELS = {
  1: 'Новая',
  2: 'В работе',
  3: 'Завершена',
};

export const DEFAULT_STATUS_LABEL = 'Новая';
export const NO_STATUS_LABEL = 'Без статуса';
export const NO_DATE_LABEL = 'Без даты';

const DONE_WORDS = ['done', 'готов', 'выполн', 'заверш'];
const PROGRESS_WORDS = ['progress', 'работ', 'процесс'];
const BLOCKED_WORDS = ['block', 'ошиб', 'проблем'];

const includesAny = (text, words) => words.some((word) => text.includes(word));

export const getStatusLabel = (
  statusId,
  statusName,
  fallbackLabel = DEFAULT_STATUS_LABEL,
) => {
  const normalizedName = typeof statusName === 'string' ? statusName.trim() : '';

  if (normalizedName && !normalizedName.includes('?')) {
    return normalizedName;
  }

  return STATUS_LABELS[Number(statusId)] || fallbackLabel;
};

export const getStatusKind = (statusId, statusName) => {
  const label = getStatusLabel(statusId, statusName, '').toLowerCase();

  if (Number(statusId) === 3 || includesAny(label, DONE_WORDS)) {
    return 'done';
  }

  if (Number(statusId) === 2 || includesAny(label, PROGRESS_WORDS)) {
    return 'progress';
  }

  if (includesAny(label, BLOCKED_WORDS)) {
    return 'blocked';
  }

  return 'new';
};

export const formatTaskDate = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return NO_DATE_LABEL;
  }

  return parsedDate.toLocaleDateString('ru-RU');
};

export const formatTaskDateTime = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const normalizeFilterValue = (value) => (
  value === 'all' || value === 'none' ? '' : value
);

export const nullableSelectValue = (value) => (
  value === '' || value === 'none' ? null : value
);

export const buildTaskPayload = (task) => ({
  title: task.title,
  description: task.description,
  status_id: nullableSelectValue(task.status_id),
  assigned_to: nullableSelectValue(task.assigned_to),
});

export const parseStoredUser = (value) => {
  try {
    const user = JSON.parse(value || '{}');
    return user && typeof user === 'object' && !Array.isArray(user) ? user : {};
  } catch {
    return {};
  }
};
