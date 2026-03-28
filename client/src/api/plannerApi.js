const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function getAuthHeaders(user) {
  if (user?.getIdToken) {
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`
    };
  }

  return {
    'x-dev-user-id': 'local-demo-user',
    'x-dev-user-email': 'demo@student.local',
    'x-dev-user-name': 'Local Demo User'
  };
}

async function request(path, options = {}, user) {
  const authHeaders = await getAuthHeaders(user);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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
