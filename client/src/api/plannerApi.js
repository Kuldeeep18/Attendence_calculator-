const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function getAuthHeaders(user) {
  if (user?.getIdToken) {
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`
    };
  }

  const fallbackEmail = user?.email || 'demo@student.local';
  const fallbackName =
    user?.displayName ||
    user?.name ||
    (fallbackEmail.includes('@') ? fallbackEmail.split('@')[0] : 'Local Demo User');

  return {
    'x-dev-user-id': user?.uid || 'local-demo-user',
    'x-dev-user-email': fallbackEmail,
    'x-dev-user-name': fallbackName
  };
}

async function request(path, options = {}, user) {
  const authHeaders = await getAuthHeaders(user);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });

  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || 'Request failed.');
  }

  return responseData;
}

export function fetchSelectableFriends(user) {
  return request('/api/friends', { method: 'GET' }, user);
}

export function addFriendByEnrollment(enrollmentNo, user) {
  return request(
    '/api/friends/by-enrollment',
    {
      method: 'POST',
      body: JSON.stringify({ enrollmentNo })
    },
    user
  );
}

export function fetchPlannerResult(payload, user) {
  return request(
    '/api/planner/group-bunk',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    user
  );
}

export function fetchAttendanceDashboard(user) {
  return request('/api/attendance/me', { method: 'GET' }, user);
}

export function linkStudentProfile(enrollmentNo, user) {
  return request(
    '/api/attendance/link-student',
    {
      method: 'POST',
      body: JSON.stringify({ enrollmentNo })
    },
    user
  );
}

export function submitDailyAttendance(payload, user) {
  return request(
    '/api/attendance/daily-update',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    user
  );
}

export function importWeeklyAttendance(files, user) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  return request(
    '/api/attendance/import-weekly',
    {
      method: 'POST',
      body: formData
    },
    user
  );
}
