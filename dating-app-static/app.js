// ===== CONFIG: change this to your Render backend URL once deployed =====
const API_BASE_URL = 'https://feelings-dating-app.onrender.com/api/auth';
const API_ROOT = API_BASE_URL.replace(/\/auth$/, ''); // for /discover, /swipe, /matches, /messages, /profile
const MOCK_MODE = true; // matches backend .env MOCK_MODE — flip both together

// ===== Simple state =====
const state = {
  phone: '',
  regToken: '',
  sessionToken: '',
  faceBlob: null,
  cameraStream: null,
  selectedIdType: 'Aadhaar',
  selectedGender: '',
  selectedInterests: [],
  discoverFeed: [],
  activeMatchId: null,
  chatPollTimer: null,
};

const STEPS = ['welcome', 'phone', 'otp', 'google', 'face', 'id', 'profile', 'success'];
const STEP_LABELS = {
  phone: 'Step 1 of 5 · Phone number',
  otp: 'Step 1 of 5 · Verify code',
  google: 'Step 2 of 5 · Gmail',
  face: 'Step 3 of 5 · Face scan',
  id: 'Step 4 of 5 · ID verification',
  profile: 'Step 5 of 5 · Your profile',
};
const STEP_PROGRESS = { phone: 0, otp: 1, google: 1, face: 2, id: 3, profile: 4, success: 5 };

function $(id) { return document.getElementById(id); }

function showStep(name) {
  STEPS.forEach((s) => { $(`step-${s}`).style.display = 'none'; });
  $(`step-${name}`).style.display = 'flex';

  const progressWrap = $('progress-wrap');
  if (name === 'welcome' || name === 'success') {
    progressWrap.style.display = 'none';
  } else {
    progressWrap.style.display = 'block';
    $('step-label').textContent = STEP_LABELS[name] || '';
    renderProgress(STEP_PROGRESS[name] ?? 0);
  }

  if (name === 'face') startCamera();
  else stopCamera();
}

function renderProgress(current, total = 5) {
  const track = $('progress-track');
  track.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const seg = document.createElement('div');
    seg.className = 'progress-segment' + (i < current ? ' filled' : '');
    track.appendChild(seg);
  }
}

function showError(elId, message) {
  const el = $(elId);
  el.innerHTML = message ? `<div class="error-banner">${message}</div>` : '';
}

async function apiPost(path, body, isFormData = false) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// For endpoints outside /api/auth that require the logged-in session token
async function authFetch(path, options = {}) {
  const res = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${state.sessionToken}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ===== Step navigation =====
let historyStack = ['welcome'];

function goTo(name) {
  historyStack.push(name);
  showStep(name);
}

function back() {
  if (historyStack.length > 1) {
    historyStack.pop();
    showStep(historyStack[historyStack.length - 1]);
  }
}

$('back-btn').addEventListener('click', back);
$('btn-start').addEventListener('click', () => goTo('phone'));

// ===== Phone step =====
const phoneInput = $('phone-input');
phoneInput.addEventListener('input', () => {
  const valid = /^\+91[6-9]\d{9}$/.test(phoneInput.value.trim());
  $('btn-send-otp').disabled = !valid;
});

$('btn-send-otp').addEventListener('click', async () => {
  showError('phone-error', '');
  const btn = $('btn-send-otp');
  btn.disabled = true;
  btn.textContent = 'Sending code…';
  try {
    state.phone = phoneInput.value.trim();
    await apiPost('/signup/send-otp', { phone_number: state.phone });
    $('otp-subtitle').textContent = `We sent a 6-digit code to ${state.phone}.`;
    $('otp-hint').style.display = MOCK_MODE ? 'block' : 'none';
    goTo('otp');
  } catch (err) {
    showError('phone-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send code';
  }
});

// ===== OTP step =====
const otpInput = $('otp-input');
otpInput.addEventListener('input', () => {
  otpInput.value = otpInput.value.replace(/\D/g, '');
  $('btn-verify-otp').disabled = otpInput.value.length !== 6;
});

$('btn-verify-otp').addEventListener('click', async () => {
  showError('otp-error', '');
  const btn = $('btn-verify-otp');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    const result = await apiPost('/signup/verify-otp', { phone_number: state.phone, code: otpInput.value });
    state.regToken = result.reg_token;
    $('google-hint').style.display = MOCK_MODE ? 'block' : 'none';
    goTo('google');
  } catch (err) {
    showError('otp-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
});

// ===== Google step =====
function validateGoogleForm() {
  const email = $('google-email').value.trim();
  const name = $('google-name').value.trim();
  $('btn-google').disabled = !(/\S+@gmail\.com$/.test(email) && name.length > 1);
}
$('google-email').addEventListener('input', validateGoogleForm);
$('google-name').addEventListener('input', validateGoogleForm);

$('btn-google').addEventListener('click', async () => {
  showError('google-error', '');
  const btn = $('btn-google');
  btn.disabled = true;
  btn.textContent = 'Linking…';
  try {
    const fakeIdToken = JSON.stringify({ email: $('google-email').value.trim(), name: $('google-name').value.trim() });
    const result = await apiPost('/signup/google', { reg_token: state.regToken, google_id_token: fakeIdToken });
    state.regToken = result.reg_token;
    goTo('face');
  } catch (err) {
    showError('google-error', err.message);
    btn.disabled = false;
  } finally {
    btn.textContent = 'Continue with Gmail';
  }
});

// ===== Face scan step =====
async function startCamera() {
  showError('camera-error', '');
  $('camera-preview').style.display = 'none';
  $('camera-video').style.display = 'block';
  $('camera-ring').style.display = 'block';
  $('btn-capture').style.display = 'block';
  $('btn-use-photo').style.display = 'none';
  $('btn-retake').style.display = 'none';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 720, height: 960 } });
    state.cameraStream = stream;
    $('camera-video').srcObject = stream;
  } catch (err) {
    showError('camera-error', 'Camera access denied. Please allow camera permission to verify your face.');
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((t) => t.stop());
    state.cameraStream = null;
  }
}

$('btn-capture').addEventListener('click', () => {
  const video = $('camera-video');
  const canvas = $('camera-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob((blob) => {
    state.faceBlob = blob;
    $('camera-preview').src = URL.createObjectURL(blob);
    $('camera-preview').style.display = 'block';
    $('camera-video').style.display = 'none';
    $('camera-ring').style.display = 'none';
    stopCamera();
    $('btn-capture').style.display = 'none';
    $('btn-use-photo').style.display = 'block';
    $('btn-retake').style.display = 'block';
  }, 'image/jpeg', 0.9);
});

$('btn-retake').addEventListener('click', () => {
  showError('face-error', '');
  startCamera();
});

$('btn-use-photo').addEventListener('click', async () => {
  showError('face-error', '');
  const btn = $('btn-use-photo');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    const form = new FormData();
    form.append('reg_token', state.regToken);
    form.append('face_image', state.faceBlob, 'face.jpg');
    const result = await apiPost('/signup/face-scan', form, true);
    state.regToken = result.reg_token;
    $('id-hint').style.display = MOCK_MODE ? 'block' : 'none';
    goTo('id');
  } catch (err) {
    showError('face-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Use this photo';
  }
});

// ===== ID verify step =====
document.querySelectorAll('#id-type-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#id-type-chips .chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    state.selectedIdType = chip.dataset.value;
    $('id-number-label').textContent = `${state.selectedIdType} number`;
  });
});

$('id-number-input').addEventListener('input', () => {
  $('btn-verify-id').disabled = $('id-number-input').value.trim().length < 4;
});

$('btn-verify-id').addEventListener('click', async () => {
  showError('id-error', '');
  const btn = $('btn-verify-id');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    const result = await apiPost('/signup/id-verify', {
      reg_token: state.regToken,
      id_document: { type: state.selectedIdType.toLowerCase(), number: $('id-number-input').value.trim() },
    });
    state.regToken = result.reg_token;
    goTo('profile');
  } catch (err) {
    showError('id-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify ID';
  }
});

// ===== Profile step =====
document.querySelectorAll('#gender-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#gender-chips .chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    state.selectedGender = chip.dataset.value;
    validateProfileForm();
  });
});

document.querySelectorAll('#interest-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const v = chip.dataset.value;
    if (state.selectedInterests.includes(v)) {
      state.selectedInterests = state.selectedInterests.filter((x) => x !== v);
      chip.classList.remove('selected');
    } else {
      state.selectedInterests.push(v);
      chip.classList.add('selected');
    }
    validateProfileForm();
  });
});

['p-name', 'p-dob', 'p-state', 'p-city'].forEach((id) => $(id).addEventListener('input', validateProfileForm));

function validateProfileForm() {
  const ok = $('p-name').value.trim() && $('p-dob').value && state.selectedGender &&
    state.selectedInterests.length > 0 && $('p-state').value.trim() && $('p-city').value.trim();
  $('btn-finish').disabled = !ok;
}

$('btn-finish').addEventListener('click', async () => {
  showError('profile-error', '');
  const btn = $('btn-finish');
  btn.disabled = true;
  btn.textContent = 'Creating account…';
  try {
    const result = await apiPost('/signup/complete-profile', {
      reg_token: state.regToken,
      name: $('p-name').value.trim(),
      dob: $('p-dob').value,
      gender: state.selectedGender.toLowerCase(),
      interested_in: state.selectedInterests.map((g) => g.toLowerCase()),
      nationality: $('p-nationality').value.trim(),
      state: $('p-state').value.trim(),
      city: $('p-city').value.trim(),
      area: $('p-area').value.trim(),
    });
    $('success-message').textContent = `Your account has been created and verified. (user id: ${result.user_id}) Time to find real matches nearby.`;
    state.sessionToken = result.session_token;
    goTo('success');
  } catch (err) {
    showError('profile-error', err.message);
    btn.disabled = false;
  } finally {
    btn.textContent = 'Finish';
  }
});

// ===== Init =====
showStep('welcome');

// =========================================================
// MAIN APP: Discover, Matches, Chat
// =========================================================

$('btn-go-discover').addEventListener('click', () => {
  $('step-success').style.display = 'none';
  $('main-app').style.display = 'flex';
  showScreen('discover');
  loadDiscoverFeed();
});

function showScreen(name) {
  ['discover', 'matches', 'chat'].forEach((s) => { $(`screen-${s}`).style.display = 'none'; });
  $(`screen-${name}`).style.display = 'flex';
  $('nav-discover').classList.toggle('active', name === 'discover');
  $('nav-matches').classList.toggle('active', name === 'matches' || name === 'chat');
  if (name !== 'chat' && state.chatPollTimer) {
    clearInterval(state.chatPollTimer);
    state.chatPollTimer = null;
  }
}

$('nav-discover').addEventListener('click', () => { showScreen('discover'); loadDiscoverFeed(); });
$('nav-matches').addEventListener('click', () => { showScreen('matches'); loadMatches(); });
$('chat-back-btn').addEventListener('click', () => { showScreen('matches'); loadMatches(); });

// ---- Discover / swipe ----
function calcAge(dobStr) {
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

async function loadDiscoverFeed() {
  showError('discover-error', '');
  const stack = $('card-stack');
  stack.innerHTML = '<div class="empty-state">Loading profiles…</div>';
  try {
    state.discoverFeed = await authFetch('/discover?limit=15');
    renderCardStack();
  } catch (err) {
    showError('discover-error', err.message);
    stack.innerHTML = '';
  }
}

function renderCardStack() {
  const stack = $('card-stack');
  stack.innerHTML = '';
  if (state.discoverFeed.length === 0) {
    stack.innerHTML = '<div class="empty-state">No more profiles right now — check back later!</div>';
    return;
  }
  // Render top 2 for a slight stacked-card feel, top one interactive
  state.discoverFeed.slice(0, 2).reverse().forEach((person, idx) => {
    const card = document.createElement('div');
    card.className = 'swipe-card';
    const age = person.birth_date ? calcAge(person.birth_date) : '';
    card.innerHTML = `
      <div class="photo">${person.photo_url ? `<img src="${person.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : '🙂'}</div>
      <div class="info">
        <div class="name-age">${escapeHtml(person.display_name)}${age ? ', ' + age : ''} ${person.is_verified ? '<span class="verified-tick">✓</span>' : ''}</div>
        <div class="location">${escapeHtml(person.city || '')}${person.state ? ', ' + escapeHtml(person.state) : ''}</div>
        ${person.bio ? `<div class="bio">${escapeHtml(person.bio)}</div>` : ''}
      </div>
    `;
    stack.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function doSwipe(swipeType) {
  if (state.discoverFeed.length === 0) return;
  const person = state.discoverFeed[0];
  showError('discover-error', '');
  try {
    const result = await authFetch('/swipe', {
      method: 'POST',
      body: JSON.stringify({ swipee_id: person.id, swipe_type: swipeType }),
    });
    state.discoverFeed.shift();
    renderCardStack();
    if (result.matched) {
      setTimeout(() => alert(`🎉 It's a match with ${person.display_name}!`), 100);
    }
  } catch (err) {
    showError('discover-error', err.message);
  }
}

$('btn-like').addEventListener('click', () => doSwipe('like'));
$('btn-dislike').addEventListener('click', () => doSwipe('dislike'));
$('btn-superlike').addEventListener('click', () => doSwipe('superlike'));

// ---- Matches list ----
async function loadMatches() {
  const list = $('matches-list');
  list.innerHTML = '<div class="empty-state">Loading matches…</div>';
  try {
    const matches = await authFetch('/matches');
    if (matches.length === 0) {
      list.innerHTML = '<div class="empty-state">No matches yet — go like some profiles!</div>';
      return;
    }
    list.innerHTML = '';
    matches.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'match-row';
      row.innerHTML = `
        <div class="match-avatar">${m.photo_url ? `<img src="${m.photo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '🙂'}</div>
        <div style="flex:1; min-width:0;">
          <div class="match-name">${escapeHtml(m.display_name)} ${m.is_verified ? '<span class="verified-tick">✓</span>' : ''}</div>
          <div class="match-preview">${m.last_message ? escapeHtml(m.last_message) : 'Say hello 👋'}</div>
        </div>
      `;
      row.addEventListener('click', () => openChat(m.match_id, m.display_name));
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div class="error-banner">${err.message}</div>`;
  }
}

// ---- Chat ----
function openChat(matchId, name) {
  state.activeMatchId = matchId;
  $('chat-with-name').textContent = name;
  showScreen('chat');
  loadMessages();
  state.chatPollTimer = setInterval(loadMessages, 3000); // simple polling — good enough until real-time chat is built
}

async function loadMessages() {
  try {
    const messages = await authFetch(`/messages/${state.activeMatchId}`);
    const container = $('chat-messages');
    const wasNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 40;
    container.innerHTML = messages.map((m) => {
      const mine = m.sender_id === getMyUserId();
      return `<div class="bubble ${mine ? 'mine' : 'theirs'}">${escapeHtml(m.message_text)}</div>`;
    }).join('');
    if (wasNearBottom) container.scrollTop = container.scrollHeight;
  } catch (err) {
    $('chat-messages').innerHTML = `<div class="error-banner">${err.message}</div>`;
  }
}

function getMyUserId() {
  // Decode the JWT payload (not verifying signature client-side — just reading userId for UI purposes)
  try {
    const payload = JSON.parse(atob(state.sessionToken.split('.')[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

$('chat-send-btn').addEventListener('click', sendChatMessage);
$('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });

async function sendChatMessage() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    await authFetch(`/messages/${state.activeMatchId}`, {
      method: 'POST',
      body: JSON.stringify({ message_text: text }),
    });
    loadMessages();
  } catch (err) {
    alert(err.message); // e.g. content-filter rejection ("please don't share contact info…")
  }
}
