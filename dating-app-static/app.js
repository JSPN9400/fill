// ===== CONFIG: change this to your Render backend URL once deployed =====
const DEFAULT_API_BASE = 'https://fillings-backend.onrender.com/api/auth';
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? (window.__API_BASE_URL__ || 'http://localhost:5000/api/auth')
  : (window.__API_BASE_URL__ || DEFAULT_API_BASE);
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
  selectedInterestTags: [],
  discoverFeed: [],
  activeMatchId: null,
  chatPollTimer: null,
  socket: null,
  socketReconnectTimer: null,
  typingTimer: null,
};

const STEPS = ['welcome', 'login', 'phone', 'otp', 'google', 'face', 'id', 'profile', 'success'];
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

/**
 * Resizes + compresses an image before we store it as base64. Without this,
 * a phone camera photo can be several MB — way too big to store directly in
 * the database. Caps the longest side at 800px and re-encodes as JPEG at
 * 70% quality, which keeps photos recognizable but small.
 */
function compressImage(base64Str, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      } else {
        if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64Str); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

function showStep(name) {
  STEPS.forEach((s) => { $(`step-${s}`).style.display = 'none'; });
  $(`step-${name}`).style.display = 'flex';

  const progressWrap = $('progress-wrap');
  if (name === 'welcome' || name === 'success' || name === 'login') {
    progressWrap.style.display = 'none';
  } else {
    progressWrap.style.display = 'block';
    $('step-label').textContent = STEP_LABELS[name] || '';
    renderProgress(STEP_PROGRESS[name] ?? 0);
  }

  if (name === 'face') {
    if (state.faceBlob) showCapturedPreview(); else startCamera();
  } else {
    stopCamera();
  }
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
  const wakeupTimer = setTimeout(showWakeupNotice, 2500);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: isFormData ? body : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  } finally {
    clearTimeout(wakeupTimer);
    hideWakeupNotice();
  }
}

let wakeupToastEl = null;
function showWakeupNotice() {
  if (wakeupToastEl) return;
  wakeupToastEl = document.createElement('div');
  wakeupToastEl.className = 'toast wakeup-toast show';
  wakeupToastEl.textContent = "Waking up the server — this can take up to 50 seconds on the first request.";
  document.getElementById('toast-container').appendChild(wakeupToastEl);
}
function hideWakeupNotice() {
  if (!wakeupToastEl) return;
  wakeupToastEl.remove();
  wakeupToastEl = null;
}

// For endpoints outside /api/auth that require the logged-in session token
async function authFetch(path, options = {}) {
  const wakeupTimer = setTimeout(showWakeupNotice, 2500);
  try {
    let res = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${state.sessionToken}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401 && state.refreshToken) {
      console.log('Access token expired. Refreshing token...');
      try {
        const refreshRes = await fetch(`${API_ROOT}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: state.refreshToken })
        });
        
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          state.sessionToken = refreshData.session_token;
          state.refreshToken = refreshData.refresh_token;
          localStorage.setItem('session_token', refreshData.session_token);
          localStorage.setItem('refresh_token', refreshData.refresh_token);
          
          res = await fetch(`${API_ROOT}${path}`, {
            ...options,
            headers: {
              ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
              Authorization: `Bearer ${state.sessionToken}`,
              ...(options.headers || {}),
            },
          });
        } else {
          handleForceLogout();
        }
      } catch (refreshErr) {
        console.error('Error refreshing token:', refreshErr);
        handleForceLogout();
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  } finally {
    clearTimeout(wakeupTimer);
    hideWakeupNotice();
  }
}

function handleForceLogout() {
  localStorage.removeItem('session_token');
  localStorage.removeItem('refresh_token');
  state.sessionToken = '';
  state.refreshToken = '';
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  $('main-app').style.display = 'none';
  showStep('welcome');
  showToast('Session expired. Please log in again.', 'error');
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
$('btn-go-login').addEventListener('click', () => {
  $('login-hint').style.display = MOCK_MODE ? 'block' : 'none';
  goTo('login');
});

// ===== Login (existing users) =====
$('login-email').addEventListener('input', () => {
  $('btn-login').disabled = !/\S+@gmail\.com$/.test($('login-email').value.trim());
});

$('btn-login').addEventListener('click', async () => {
  showError('login-error', '');
  const btn = $('btn-login');
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  try {
    const fakeIdToken = JSON.stringify({ email: $('login-email').value.trim(), name: 'Returning User' });
    const result = await apiPost('/login/google', { google_id_token: fakeIdToken });
    state.sessionToken = result.session_token;
    state.refreshToken = result.refresh_token;
    localStorage.setItem('session_token', result.session_token);
    localStorage.setItem('refresh_token', result.refresh_token);
    historyStack = ['welcome'];
    $('step-login').style.display = 'none';
    $('main-app').style.display = 'flex';
    showScreen('discover');
    loadDiscoverFeed();
    initSocket();
  } catch (err) {
    showError('login-error', err.message);
    btn.disabled = false;
  } finally {
    btn.textContent = 'Continue with Gmail';
  }
});

const loginPhoneInput = $('login-phone-input');
loginPhoneInput.addEventListener('input', () => {
  let val = loginPhoneInput.value;
  if (!val.startsWith('+91')) {
    val = '+91' + val.replace(/^\+?91?/, '').replace(/\D/g, '');
    loginPhoneInput.value = val;
  }
  $('btn-login-phone-send-otp').disabled = !/^\+91[6-9]\d{9}$/.test(val.trim());
});

$('btn-login-phone-send-otp').addEventListener('click', async () => {
  showError('login-phone-error', '');
  const btn = $('btn-login-phone-send-otp');
  btn.disabled = true;
  btn.textContent = 'Sending code…';
  try {
    await apiPost('/login/phone/send-otp', { phone_number: loginPhoneInput.value.trim() });
    showToast('Phone OTP sent. Use 123456 in mock mode.', 'success');
  } catch (err) {
    showError('login-phone-error', err.message);
  } finally {
    btn.disabled = !/^\+91[6-9]\d{9}$/.test(loginPhoneInput.value.trim());
    btn.textContent = 'Send phone code';
  }
});

// ===== Phone step =====
const phoneInput = $('phone-input');

// Put the cursor after +91 on first focus so typing the number is instant
phoneInput.addEventListener('focus', () => {
  if (phoneInput.value === '+91') {
    const pos = phoneInput.value.length;
    phoneInput.setSelectionRange(pos, pos);
  }
});

phoneInput.addEventListener('input', () => {
  let val = phoneInput.value;
  // Keep the +91 prefix intact even if the user tries to delete it
  if (!val.startsWith('+91')) {
    val = '+91' + val.replace(/^\+?91?/, '').replace(/\D/g, '');
    phoneInput.value = val;
  }
  const valid = /^\+91[6-9]\d{9}$/.test(val.trim());
  $('btn-send-otp').disabled = !valid;
  const hint = $('phone-hint');
  hint.textContent = valid ? '✓ Looks good' : '10-digit Indian mobile number, starting with 6-9';
  hint.classList.toggle('valid', valid);
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
function showCapturedPreview() {
  $('camera-video').style.display = 'none';
  $('camera-ring').style.display = 'none';
  $('camera-preview').style.display = 'block';
  $('btn-capture').style.display = 'none';
  $('btn-use-photo').style.display = 'block';
  $('btn-retake').style.display = 'block';
}

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

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

document.querySelectorAll('#interest-tags-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const v = chip.dataset.value;
    if (state.selectedInterestTags.includes(v)) {
      state.selectedInterestTags = state.selectedInterestTags.filter((x) => x !== v);
      chip.classList.remove('selected');
    } else {
      state.selectedInterestTags.push(v);
      chip.classList.add('selected');
    }
  });
});

let profilePhotoDataUrl = null;
$('p-photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    profilePhotoDataUrl = await compressImage(reader.result);
    $('p-photo-preview').src = profilePhotoDataUrl;
    $('p-photo-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
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
      interests: state.selectedInterestTags,
      photo_base64: profilePhotoDataUrl,
      profession: $('p-profession').value.trim(),
    });
    $('success-message').textContent = `Your account has been created and verified. (user id: ${result.user_id}) Time to find real matches nearby.`;
    state.sessionToken = result.session_token;
    state.refreshToken = result.refresh_token;
    localStorage.setItem('session_token', result.session_token);
    localStorage.setItem('refresh_token', result.refresh_token);
    goTo('success');
  } catch (err) {
    showError('profile-error', err.message);
    btn.disabled = false;
  } finally {
    btn.textContent = 'Finish';
  }
});

// ===== Init =====
function initGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.latitude = position.coords.latitude;
        state.longitude = position.coords.longitude;
        console.log('Location permission granted:', state.latitude, state.longitude);
      },
      (error) => {
        console.warn('Geolocation error or permission denied:', error.message);
      }
    );
  }
}

// Restore session and theme
const savedToken = localStorage.getItem('session_token');
const savedRefreshToken = localStorage.getItem('refresh_token');
const savedTheme = localStorage.getItem('theme') || 'light';

document.documentElement.setAttribute('data-theme', savedTheme);
const themeChk = $('theme-toggle-chk');
if (themeChk) themeChk.checked = (savedTheme === 'dark');

if (savedToken && savedRefreshToken) {
  state.sessionToken = savedToken;
  state.refreshToken = savedRefreshToken;
  $('main-app').style.display = 'flex';
  showScreen('discover');
  loadDiscoverFeed();
  initSocket();
  initGeolocation();
} else {
  showStep('welcome');
}

// =========================================================
// MAIN APP: Discover, Matches, Chat
// =========================================================

$('btn-go-discover').addEventListener('click', () => {
  $('step-success').style.display = 'none';
  $('main-app').style.display = 'flex';
  showScreen('discover');
  loadDiscoverFeed();
  initGeolocation();
});

function showScreen(name) {
  ['discover', 'feelings', 'matches', 'chat', 'composer', 'user-profile', 'settings', 'edit-profile', 'preferences', 'notifications'].forEach((s) => { 
    const el = $(`screen-${s}`);
    if (el) el.style.display = 'none'; 
  });
  $(`screen-${name}`).style.display = 'flex';
  $('nav-discover').classList.toggle('active', name === 'discover');
  $('nav-feelings').classList.toggle('active', name === 'feelings' || name === 'composer' || name === 'user-profile');
  $('nav-matches').classList.toggle('active', name === 'matches' || name === 'chat');
  $('nav-settings').classList.toggle('active', name === 'settings' || name === 'edit-profile' || name === 'preferences' || name === 'notifications');
  
  $('btn-open-composer').style.display = name === 'feelings' ? 'flex' : 'none';
  $('main-app').classList.toggle('section-matches', name === 'matches' || name === 'chat');
  if (name !== 'chat' && state.chatPollTimer) {
    clearInterval(state.chatPollTimer);
    state.chatPollTimer = null;
  }
}

$('nav-discover').addEventListener('click', () => { showScreen('discover'); loadDiscoverFeed(); });
$('nav-feelings').addEventListener('click', () => { showScreen('feelings'); loadFeelingsFeed(); });
$('nav-matches').addEventListener('click', () => { showScreen('matches'); loadMatches(); });
$('nav-settings').addEventListener('click', () => { showScreen('settings'); loadUnreadNotificationsCount(); });
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
  const visiblePeople = state.discoverFeed.slice(0, 2);
  visiblePeople.reverse().forEach((person, idx) => {
    const card = document.createElement('div');
    card.className = 'swipe-card';
    const age = person.birth_date ? calcAge(person.birth_date) : '';
    card.innerHTML = `
      <div class="photo">${person.photo_url ? `<img src="${person.photo_url}" style="width:100%;height:100%;object-fit:cover;user-select:none;pointer-events:none;">` : '🙂'}</div>
      <div class="info">
        <div class="name-age">${escapeHtml(person.display_name)}${age ? ', ' + age : ''} ${person.is_verified ? '<span class="verified-tick">✓</span>' : ''}</div>
        <div class="location">${escapeHtml(person.city || '')}${person.state ? ', ' + escapeHtml(person.state) : ''}</div>
        ${person.profession ? `<div class="profession">💼 ${escapeHtml(person.profession)}</div>` : ''}
        ${person.bio ? `<div class="bio">${escapeHtml(person.bio)}</div>` : ''}
        ${person.interests && person.interests.length ? `<div class="interest-tags">${person.interests.slice(0, 5).map((i) => `<span class="interest-tag">${escapeHtml(i)}</span>`).join('')}</div>` : ''}
      </div>
    `;
    
    const isTopCard = (visiblePeople.length === 2 && idx === 1) || (visiblePeople.length === 1 && idx === 0);
    if (isTopCard) {
      initCardGestures(card);
    }
    
    stack.appendChild(card);
  });
}

function initCardGestures(card) {
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  const threshold = 100; // px

  function handleStart(e) {
    isDragging = true;
    card.style.transition = 'none';
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
  }

  function handleMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offsetX = clientX - startX;
    offsetY = clientY - startY;

    const rotation = offsetX / 10;
    card.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;
  }

  function handleEnd() {
    if (!isDragging) return;
    isDragging = false;
    card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';

    if (offsetX > threshold) {
      // Swipe Right (Like)
      card.style.opacity = '0';
      card.style.transform = `translate(${window.innerWidth}px, ${offsetY}px) rotate(45deg)`;
      setTimeout(() => doSwipe('like', true), 200);
    } else if (offsetX < -threshold) {
      // Swipe Left (Dislike)
      card.style.opacity = '0';
      card.style.transform = `translate(-${window.innerWidth}px, ${offsetY}px) rotate(-45deg)`;
      setTimeout(() => doSwipe('dislike', true), 200);
    } else if (offsetY < -threshold) {
      // Swipe Up (Superlike)
      card.style.opacity = '0';
      card.style.transform = `translate(${offsetX}px, -${window.innerHeight}px) rotate(0deg)`;
      setTimeout(() => doSwipe('superlike', true), 200);
    } else {
      // Reset
      card.style.transform = 'translate(0px, 0px) rotate(0deg)';
    }
  }

  card.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  card.addEventListener('touchstart', handleStart, { passive: true });
  window.addEventListener('touchmove', handleMove, { passive: true });
  window.addEventListener('touchend', handleEnd);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function doSwipe(swipeType, skipAnimation = false) {
  if (state.discoverFeed.length === 0) return;
  const person = state.discoverFeed[0];
  showError('discover-error', '');

  const performSwipe = async () => {
    try {
      const result = await authFetch('/swipe', {
        method: 'POST',
        body: JSON.stringify({ swipee_id: person.id, swipe_type: swipeType }),
      });
      state.discoverFeed.shift();
      renderCardStack();
      if (result.matched) {
        showToast(`🎉 It's a match with ${person.display_name}!`, 'success');
      }
    } catch (err) {
      showError('discover-error', err.message);
    }
  };

  if (skipAnimation) {
    await performSwipe();
  } else {
    const stack = $('card-stack');
    const topCard = stack.lastChild;
    if (topCard && topCard.classList.contains('swipe-card')) {
      topCard.style.transition = 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out';
      topCard.style.opacity = '0';
      if (swipeType === 'like') {
        topCard.style.transform = `translate(${window.innerWidth}px, 0px) rotate(30deg)`;
      } else if (swipeType === 'dislike') {
        topCard.style.transform = `translate(-${window.innerWidth}px, 0px) rotate(-30deg)`;
      } else if (swipeType === 'superlike') {
        topCard.style.transform = `translate(0px, -${window.innerHeight}px) rotate(0deg)`;
      }
    }
    setTimeout(performSwipe, 250);
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
      row.dataset.userId = m.other_user_id;
      row.innerHTML = `
        <div class="match-avatar">${m.photo_url ? `<img src="${m.photo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '🙂'}</div>
        <div style="flex:1; min-width:0;">
          <div class="match-name">${escapeHtml(m.display_name)} ${m.is_verified ? '<span class="verified-tick">✓</span>' : ''}</div>
          <div class="match-preview">${m.last_message ? escapeHtml(m.last_message) : 'Say hello 👋'}</div>
        </div>
        <span class="presence-dot ${m.is_online ? 'online' : 'offline'}"></span>
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
  if (state.socket && state.socket.connected) {
    state.socket.emit('join_match', { matchId });
    state.socket.emit('message_read', { matchId });
  }
  loadMessages();
  if (state.chatPollTimer) clearInterval(state.chatPollTimer);
  state.chatPollTimer = setInterval(loadMessages, 3000);
}

async function loadMessages() {
  try {
    const messages = await authFetch(`/messages/${state.activeMatchId}`);
    const container = $('chat-messages');
    const wasNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 40;
    container.innerHTML = messages.map((m) => {
      const mine = Number(m.sender_id) === Number(getMyUserId());
      const receipt = mine ? `<span class="read-receipt">${m.is_read ? '✓✓' : '✓'}</span>` : '';
      return `<div class="bubble ${mine ? 'mine' : 'theirs'}">
        <div style="word-break:break-word;">${escapeHtml(m.message_text)}</div>
        ${receipt}
      </div>`;
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
$('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatMessage();
  if (state.socket && state.socket.connected && state.activeMatchId) {
    if (state.typingTimer) clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      state.socket.emit('typing', { matchId: state.activeMatchId, isTyping: false });
    }, 1200);
    state.socket.emit('typing', { matchId: state.activeMatchId, isTyping: true });
  }
});

async function sendChatMessage() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    if (state.socket && state.socket.connected && state.activeMatchId) {
      state.socket.emit('send_message', { matchId: state.activeMatchId, messageText: text }, (response) => {
        if (response && response.error) {
          showToast(response.error, 'error');
        }
      });
      state.socket.emit('typing', { matchId: state.activeMatchId, isTyping: false });
      if (state.typingTimer) clearTimeout(state.typingTimer);
    } else {
      await authFetch(`/messages/${state.activeMatchId}`, {
        method: 'POST',
        body: JSON.stringify({ message_text: text }),
      });
      loadMessages();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =========================================================
// FEELINGS — share a photo + caption, tap to visit a profile
// =========================================================

$('btn-open-composer').addEventListener('click', () => {
  showError('composer-error', '');
  goToScreenKeepingNav('composer');
});
$('composer-back-btn').addEventListener('click', () => { showScreen('feelings'); loadFeelingsFeed(); });

function goToScreenKeepingNav(name) {
  // Like showScreen, but used for screens reached *from* Feelings (composer, profile)
  // so the bottom-nav still highlights "Feelings" correctly.
  ['discover', 'feelings', 'matches', 'chat', 'composer', 'user-profile'].forEach((s) => { $(`screen-${s}`).style.display = 'none'; });
  $(`screen-${name}`).style.display = 'flex';
  $('btn-open-composer').style.display = 'none';
}

let composerPhotoDataUrl = null;

$('composer-photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    composerPhotoDataUrl = await compressImage(reader.result);
    $('composer-photo-preview').src = composerPhotoDataUrl;
    $('composer-photo-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
});

$('composer-text-input').addEventListener('input', () => {
  $('btn-post-feeling').disabled = $('composer-text-input').value.trim().length === 0;
});

$('btn-post-feeling').addEventListener('click', async () => {
  showError('composer-error', '');
  const btn = $('btn-post-feeling');
  btn.disabled = true;
  btn.textContent = 'Sharing…';
  try {
    await authFetch('/feelings', {
      method: 'POST',
      body: JSON.stringify({ feeling_text: $('composer-text-input').value.trim(), photo_url: composerPhotoDataUrl }),
    });
    $('composer-text-input').value = '';
    $('composer-photo-preview').style.display = 'none';
    $('composer-photo-input').value = '';
    composerPhotoDataUrl = null;
    showToast('Your feeling is live ✨', 'success');
    showScreen('feelings');
    loadFeelingsFeed();
  } catch (err) {
    showError('composer-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Share';
  }
});

async function loadFeelingsFeed() {
  showError('feelings-error', '');
  const feed = $('feelings-feed');
  feed.innerHTML = '<div class="empty-state">Loading feelings…</div>';
  loadSparks(); // independent — don't let a sparks failure block the main feed
  try {
    const feelings = await authFetch('/feelings?limit=30');
    renderStoriesRow(feelings);
    if (feelings.length === 0) {
      feed.innerHTML = '<div class="empty-state">No feelings shared yet — be the first! Tap the + button.</div>';
      return;
    }
    feed.innerHTML = '';
    feelings.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'feeling-card';
      card.innerHTML = `
        ${f.photo_url
          ? `<img class="feeling-photo" src="${f.photo_url}" alt="">`
          : `<div class="feeling-photo placeholder">✨</div>`}
        <div class="feeling-body">
          <div class="feeling-author">${escapeHtml(f.display_name)} ${f.is_verified ? '<span class="verified-tick">✓</span>' : ''}</div>
          <div class="feeling-text">${escapeHtml(f.feeling_text)}</div>
        </div>
      `;
      card.addEventListener('click', () => openUserProfile(f.user_id));
      feed.appendChild(card);
    });
  } catch (err) {
    showError('feelings-error', err.message);
    feed.innerHTML = '';
  }
}

// Groups feelings by author (first/most-recent one per person) into a
// horizontal, gradient-ring "stories" row — tap to visit their profile.
function renderStoriesRow(feelings) {
  const row = $('stories-row');
  const seen = new Set();
  const uniquePeople = [];
  feelings.forEach((f) => {
    if (!seen.has(f.user_id)) {
      seen.add(f.user_id);
      uniquePeople.push(f);
    }
  });

  row.innerHTML = `
    <div class="story-item" id="story-your-story">
      <div class="story-ring empty"><div class="story-avatar">+</div></div>
      <span class="story-label">Your Story</span>
    </div>
  `;
  uniquePeople.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'story-item';
    item.innerHTML = `
      <div class="story-ring"><div class="story-avatar">${f.photo_url ? `<img src="${f.photo_url}">` : '🙂'}</div></div>
      <span class="story-label">${escapeHtml(f.display_name)}</span>
    `;
    item.addEventListener('click', () => openUserProfile(f.user_id));
    row.appendChild(item);
  });

  $('story-your-story').addEventListener('click', () => goToScreenKeepingNav('composer'));
}

// "New Sparks" — people who already liked you, shown with quick accept/reject
async function loadSparks() {
  try {
    const sparks = await authFetch('/likes-received');
    const section = $('sparks-section');
    if (sparks.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    $('sparks-count').textContent = sparks.length;
    const row = $('sparks-row');
    row.innerHTML = '';
    sparks.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'spark-card';
      card.innerHTML = `
        <div class="spark-avatar">${s.photo_url ? `<img src="${s.photo_url}">` : '🙂'}</div>
        <div class="spark-name">${escapeHtml(s.display_name)}</div>
        <div class="spark-sub">${s.swipe_type === 'superlike' ? '⭐ Super liked you' : 'Wants to connect'}</div>
        <div class="spark-actions">
          <button class="spark-btn reject" title="Not interested">✕</button>
          <button class="spark-btn accept" title="Like back">♥</button>
        </div>
      `;
      card.querySelector('.reject').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await authFetch('/swipe', { method: 'POST', body: JSON.stringify({ swipee_id: s.id, swipe_type: 'dislike' }) });
          card.remove();
        } catch (err) { showToast(err.message, 'error'); }
      });
      card.querySelector('.accept').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const result = await authFetch('/swipe', { method: 'POST', body: JSON.stringify({ swipee_id: s.id, swipe_type: 'like' }) });
          showToast(result.matched ? `🎉 It's a match with ${s.display_name}!` : 'Liked back!', 'success');
          card.remove();
        } catch (err) { showToast(err.message, 'error'); }
      });
      card.addEventListener('click', () => openUserProfile(s.id));
      row.appendChild(card);
    });
  } catch (err) {
    $('sparks-section').style.display = 'none';
  }
}

// ---- Public profile view (tap into someone from the Feelings feed) ----
async function openUserProfile(userId) {
  showError('user-profile-error', '');
  goToScreenKeepingNav('user-profile');
  $('btn-profile-like').style.display = 'none';
  $('btn-profile-message').style.display = 'none';
  const body = $('user-profile-body');
  body.innerHTML = '<div class="empty-state">Loading profile…</div>';
  try {
    const p = await authFetch(`/users/${userId}`);
    const age = p.birth_date ? calcAge(p.birth_date) : '';
    body.innerHTML = `
      <div class="profile-view-photo">${p.photo_url ? `<img src="${p.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : '🙂'}</div>
      <div class="name-age" style="font-family:var(--font-display); font-weight:700; font-size:20px; display:flex; align-items:center; gap:6px;">
        ${escapeHtml(p.display_name)}${age ? ', ' + age : ''} ${p.is_verified ? '<span class="verified-tick">✓</span>' : ''}
      </div>
      <div class="location" style="color:var(--text-muted); font-size:13px; margin-top:2px;">${escapeHtml(p.city || '')}${p.state ? ', ' + escapeHtml(p.state) : ''}</div>
      ${p.profession ? `<div class="profession">💼 ${escapeHtml(p.profession)}</div>` : ''}
      ${p.bio ? `<div class="bio" style="margin-top:10px; font-size:14px; line-height:1.5;">${escapeHtml(p.bio)}</div>` : ''}
    `;

    if (p.match_id) {
      $('btn-profile-message').style.display = 'block';
      $('btn-profile-message').onclick = () => {
        showScreen('matches');
        openChat(p.match_id, p.display_name);
      };
    } else if (!p.already_swiped) {
      $('btn-profile-like').style.display = 'block';
      $('btn-profile-like').onclick = async () => {
        try {
          const result = await authFetch('/swipe', {
            method: 'POST',
            body: JSON.stringify({ swipee_id: userId, swipe_type: 'like' }),
          });
          showToast(result.matched ? `🎉 It's a match with ${p.display_name}!` : 'Liked!', 'success');
          $('btn-profile-like').style.display = 'none';
          if (result.matched) {
            $('btn-profile-message').style.display = 'block';
            $('btn-profile-message').onclick = () => { showScreen('matches'); openChat(result.match_id, p.display_name); };
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
  } catch (err) {
    showError('user-profile-error', err.message);
    body.innerHTML = '';
  }
}

$('user-profile-back-btn').addEventListener('click', () => { showScreen('feelings'); loadFeelingsFeed(); });

// ============================================================
// SETTINGS, EDIT PROFILE, PREFERENCES & NOTIFICATIONS HANDLERS
// ============================================================

// Back buttons pointing to Settings
$('edit-profile-back-btn').addEventListener('click', () => showScreen('settings'));
$('preferences-back-btn').addEventListener('click', () => showScreen('settings'));
$('notifications-back-btn').addEventListener('click', () => showScreen('settings'));

// Settings list item triggers
$('btn-settings-profile').addEventListener('click', () => {
  showScreen('edit-profile');
  loadMyProfileForEdit();
});

$('btn-settings-preferences').addEventListener('click', () => {
  showScreen('preferences');
  loadPreferences();
});

$('btn-settings-notifications').addEventListener('click', () => {
  showScreen('notifications');
  loadNotifications();
});

// Logout trigger
$('btn-settings-logout').addEventListener('click', async () => {
  const btn = $('btn-settings-logout');
  btn.style.opacity = '0.5';
  try {
    if (state.refreshToken) {
      await fetch(`${API_ROOT}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: state.refreshToken })
      });
    }
  } catch (err) {
    console.error('Error logging out from server:', err);
  }
  handleForceLogout();
  btn.style.opacity = '1';
});

// Delete account trigger
$('btn-settings-delete').addEventListener('click', async () => {
  if (confirm('Are you absolutely sure you want to delete your account? This action is permanent and deletes all matches, messages, photos, and settings under GDPR right to erasure.')) {
    try {
      await authFetch('/profile', { method: 'DELETE' });
      showToast('Account successfully deleted.', 'success');
      handleForceLogout();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// Theme switcher
const themeToggleChk = $('theme-toggle-chk');
if (themeToggleChk) {
  themeToggleChk.addEventListener('change', () => {
    const isDark = themeToggleChk.checked;
    const newTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    showToast(`${isDark ? 'Dark' : 'Light'} mode enabled.`, 'success');
  });
}

// Edit Profile logic
let editProfilePhotos = [];

async function loadMyProfileForEdit() {
  showError('edit-profile-error', '');
  try {
    const profile = await authFetch('/profile');
    
    $('edit-name-input').value = profile.display_name || '';
    $('edit-bio-input').value = profile.bio || '';
    $('edit-profession-input').value = profile.profession || '';
    $('edit-dob-input').value = profile.birth_date ? profile.birth_date.split('T')[0] : '';
    
    document.querySelectorAll('#edit-gender-group .chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.gender === profile.gender);
    });
    
    document.querySelectorAll('#edit-interest-group .chip').forEach(chip => {
      const interests = profile.interested_in || [];
      chip.classList.toggle('selected', interests.includes(chip.dataset.interest));
    });

    editProfilePhotos = profile.photos || [];
    renderEditProfilePhotos();
  } catch (err) {
    showError('edit-profile-error', err.message);
  }
}

function renderEditProfilePhotos() {
  const grid = $('edit-profile-photo-grid');
  grid.innerHTML = '';
  
  editProfilePhotos.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.innerHTML = `
      <img src="${photo.media_url}" alt="Profile photo" />
      <button class="btn-delete-photo" data-id="${photo.id}">✕</button>
    `;
    
    item.querySelector('.btn-delete-photo').addEventListener('click', async (e) => {
      e.stopPropagation();
      const photoId = e.target.dataset.id;
      if (confirm('Delete this photo?')) {
        try {
          await authFetch(`/profile/photos/${photoId}`, { method: 'DELETE' });
          editProfilePhotos = editProfilePhotos.filter(p => Number(p.id) !== Number(photoId));
          renderEditProfilePhotos();
          showToast('Photo deleted successfully.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    grid.appendChild(item);
  });
}

$('edit-profile-photo-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (editProfilePhotos.length >= 6) {
    showToast('You can upload a maximum of 6 photos.', 'error');
    return;
  }

  showToast('Uploading photo...', 'success');
  
  const formData = new FormData();
  formData.append('photo', file);

  try {
    const result = await authFetch('/profile/photos', {
      method: 'POST',
      body: formData
    });
    
    editProfilePhotos.push(result.photo);
    renderEditProfilePhotos();
    showToast('Photo uploaded successfully.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    $('edit-profile-photo-upload').value = '';
  }
});

$('btn-save-profile').addEventListener('click', async () => {
  showError('edit-profile-error', '');
  
  const name = $('edit-name-input').value.trim();
  const bio = $('edit-bio-input').value.trim();
  const profession = $('edit-profession-input').value.trim();
  const dob = $('edit-dob-input').value;
  
  const selectedGenderChip = document.querySelector('#edit-gender-group .chip.selected');
  const gender = selectedGenderChip ? selectedGenderChip.dataset.gender : null;
  
  const selectedInterestChips = document.querySelectorAll('#edit-interest-group .chip.selected');
  const interested_in = Array.from(selectedInterestChips).map(chip => chip.dataset.interest);

  if (!name || !dob || !gender || interested_in.length === 0) {
    showError('edit-profile-error', 'Name, DOB, gender, and at least one gender preference are required.');
    return;
  }

  const btn = $('btn-save-profile');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await authFetch('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name,
        bio,
        profession,
        dob,
        gender,
        interested_in
      })
    });
    showToast('Profile saved successfully.', 'success');
    showScreen('settings');
  } catch (err) {
    showError('edit-profile-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
});

document.querySelectorAll('#edit-gender-group .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#edit-gender-group .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
  });
});

document.querySelectorAll('#edit-interest-group .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
  });
});

// Preferences logic
function loadPreferences() {
  const ageMin = localStorage.getItem('pref_age_min') || '18';
  const ageMax = localStorage.getItem('pref_age_max') || '50';
  const dist = localStorage.getItem('pref_dist') || '50';

  $('pref-age-min').value = ageMin;
  $('pref-age-max').value = ageMax;
  $('pref-dist').value = dist;
  
  $('pref-age-val').textContent = `${ageMin} - ${ageMax}`;
  $('pref-dist-val').textContent = `${dist} km`;
}

$('pref-age-min').addEventListener('input', (e) => {
  const minVal = parseInt(e.target.value, 10);
  const maxVal = parseInt($('pref-age-max').value, 10);
  if (minVal > maxVal) {
    $('pref-age-max').value = minVal;
  }
  $('pref-age-val').textContent = `${$('pref-age-min').value} - ${$('pref-age-max').value}`;
});

$('pref-age-max').addEventListener('input', (e) => {
  const maxVal = parseInt(e.target.value, 10);
  const minVal = parseInt($('pref-age-min').value, 10);
  if (maxVal < minVal) {
    $('pref-age-min').value = maxVal;
  }
  $('pref-age-val').textContent = `${$('pref-age-min').value} - ${$('pref-age-max').value}`;
});

$('pref-dist').addEventListener('input', (e) => {
  $('pref-dist-val').textContent = `${e.target.value} km`;
});

$('btn-save-preferences').addEventListener('click', () => {
  const ageMin = $('pref-age-min').value;
  const ageMax = $('pref-age-max').value;
  const dist = $('pref-dist').value;

  localStorage.setItem('pref_age_min', ageMin);
  localStorage.setItem('pref_age_max', ageMax);
  localStorage.setItem('pref_dist', dist);
  
  showToast('Preferences saved successfully.', 'success');
  showScreen('settings');
});

// Socket & Notifications stubs (real implementations in next phases)
if (typeof state.socket === 'undefined') state.socket = null;

function initSocket() {
  if (!state.sessionToken || state.socket) return;
  try {
    const socket = window.io(API_ROOT.replace(/\/api$/, ''), {
      auth: { token: state.sessionToken },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      if (state.activeMatchId) {
        socket.emit('join_match', { matchId: state.activeMatchId });
      }
    });

    socket.on('connect_error', () => {
      console.warn('Socket connection failed, retrying…');
    });

    socket.on('new_message', (message) => {
      if (state.activeMatchId && Number(message.match_id) === Number(state.activeMatchId)) {
        loadMessages();
        socket.emit('message_read', { matchId: state.activeMatchId });
      }
      loadMatches();
      loadUnreadNotificationsCount();
    });

    socket.on('messages_read', ({ matchId }) => {
      if (state.activeMatchId && Number(matchId) === Number(state.activeMatchId)) {
        loadMessages();
      }
    });

    socket.on('typing', ({ matchId, userId: typingUserId, isTyping }) => {
      if (Number(matchId) === Number(state.activeMatchId) && Number(typingUserId) !== Number(getMyUserId())) {
        const indicator = $('typing-indicator');
        indicator.style.display = isTyping ? 'block' : 'none';
      }
    });

    socket.on('new_notification', () => {
      loadUnreadNotificationsCount();
    });

    socket.on('user_status', ({ userId, status }) => {
      const item = Array.from(document.querySelectorAll('.match-row')).find((el) => el.dataset.userId === String(userId));
      if (item) {
        const dot = item.querySelector('.presence-dot');
        if (dot) dot.className = `presence-dot ${status}`;
      }
    });

    state.socket = socket;
  } catch (err) {
    console.error('Socket initialization failed:', err);
  }
}

function loadUnreadNotificationsCount() {
  if (!state.sessionToken) return;
  authFetch('/notifications/unread-count')
    .then(data => {
      const badge = $('settings-notif-badge');
      if (data.unread_count > 0) {
        badge.textContent = data.unread_count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    })
    .catch(err => console.warn('Unread count failed:', err));
}

async function loadNotifications() {
  const list = $('notifications-list');
  list.innerHTML = '<div class="center-text">Loading notifications…</div>';
  try {
    const notifs = await authFetch('/notifications');
    list.innerHTML = '';
    if (notifs.length === 0) {
      list.innerHTML = '<div class="center-text" style="color:var(--text-muted); padding: 40px 0;">No notifications yet.</div>';
      return;
    }
    
    notifs.forEach(n => {
      const card = document.createElement('div');
      card.className = 'notification-card' + (n.is_read ? '' : ' unread');
      
      let text = 'You received a notification.';
      if (n.type === 'new_match') {
        text = `🎉 <strong>It's a Match!</strong> You matched with ${escapeHtml(n.data.partnerName)}.`;
      } else if (n.type === 'new_message') {
        text = `💬 <strong>New message</strong> from ${escapeHtml(n.data.partnerName || 'a match')}: "${escapeHtml(n.data.text)}"`;
      }
      
      const time = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      card.innerHTML = `
        <div class="notif-text">${text}</div>
        <div class="notif-time">${time}</div>
      `;
      list.appendChild(card);
    });

    // Mark as read after rendering
    await authFetch('/notifications/read', { method: 'PUT' });
    loadUnreadNotificationsCount();
  } catch (err) {
    list.innerHTML = `<div class="error-banner">${err.message}</div>`;
  }
}
