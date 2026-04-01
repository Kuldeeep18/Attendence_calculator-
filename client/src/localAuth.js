const LOCAL_USERS_KEY = 'attendance_local_users_v1';
const LOCAL_SESSION_KEY = 'attendance_local_session_v1';

function createLocalAuthError(message) {
  const error = new Error(message);
  error.name = 'LocalAuthError';
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function readUsers() {
  const rawUsers = window.localStorage.getItem(LOCAL_USERS_KEY);

  if (!rawUsers) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawUsers);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function buildPublicUser(user) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  };
}

function createUid() {
  if (window.crypto?.randomUUID) {
    return `local-${window.crypto.randomUUID()}`;
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    throw createLocalAuthError('Enter your name to create an account.');
  }

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw createLocalAuthError('Enter a valid email address.');
  }

  if (String(password || '').length < 6) {
    throw createLocalAuthError('Password must be at least 6 characters.');
  }

  const users = readUsers();
  const alreadyExists = users.some((user) => user.email === normalizedEmail);

  if (alreadyExists) {
    throw createLocalAuthError('An account with this email already exists.');
  }

  const newUser = {
    uid: createUid(),
    email: normalizedEmail,
    displayName: normalizedName,
    password: String(password)
  };

  users.push(newUser);
  writeUsers(users);
  window.localStorage.setItem(LOCAL_SESSION_KEY, newUser.uid);

  return buildPublicUser(newUser);
}

export function signInLocalUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '');
  const users = readUsers();
  const matchedUser = users.find(
    (user) => user.email === normalizedEmail && user.password === normalizedPassword
  );

  if (!matchedUser) {
    throw createLocalAuthError('Invalid email or password.');
  }

  window.localStorage.setItem(LOCAL_SESSION_KEY, matchedUser.uid);
  return buildPublicUser(matchedUser);
}

export function getCurrentLocalUser() {
  const sessionUid = window.localStorage.getItem(LOCAL_SESSION_KEY);

  if (!sessionUid) {
    return null;
  }

  const users = readUsers();
  const matchedUser = users.find((user) => user.uid === sessionUid);
  return matchedUser ? buildPublicUser(matchedUser) : null;
}

export function signOutLocalUser() {
  window.localStorage.removeItem(LOCAL_SESSION_KEY);
}
