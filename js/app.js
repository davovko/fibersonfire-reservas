import { auth, db } from './firebase.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, getDocs, addDoc, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── State ──────────────────────────────────────────────
let currentUser = null;
let currentUserData = null;

// ── Toast ──────────────────────────────────────────────
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => t.className = '', 3000);
}

// ── Auth ───────────────────────────────────────────────
document.getElementById('btn-google-login')?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) { toast('Error al iniciar sesión', 'error'); }
});

document.getElementById('btn-logout')?.addEventListener('click', () => signOut(auth));
document.getElementById('btn-logout-pending')?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) { showLogin(); return; }
  currentUser = user;
  const ref = doc(db, 'users', user.uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email,
      photo: user.photoURL || '',
      role: 'user',
      status: 'pending',
      createdAt: serverTimestamp()
    });
    snap = await getDoc(ref);
  }
  currentUserData = snap.data();
  if (currentUserData.status === 'pending') { showPending(); return; }
  if (currentUserData.status === 'blocked') { showBlocked(); return; }
  showApp();
});

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('pending-screen').style.display = 'none';
  document.getElementById('blocked-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'none';
}
function showPending() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('pending-screen').style.display = 'flex';
  document.getElementById('blocked-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'none';
}
function showBlocked() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('pending-screen').style.display = 'none';
  document.getElementById('blocked-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('pending-screen').style.display = 'none';
  document.getElementById('blocked-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  initApp();
}

// ── App init ───────────────────────────────────────────
function initApp() {
  const role = currentUserData.role;
  // Set user info in sidebar
  document.getElementById('sidebar-name').textContent = currentUserData.name || currentUser.email;
  document.getElementById('sidebar-role').textContent = role;
  const photo = currentUserData.photo;
  const avatarEl = document.getElementById('sidebar-avatar');
  if (photo) {
    avatarEl.innerHTML = `<img src="${photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`;
  } else {
    avatarEl.textContent = (currentUserData.name || 'U')[0].toUpperCase();
  }

  // Show/hide nav items by role
  document.querySelectorAll('[data-role]').forEach(el => {
    const roles = el.dataset.role.split(',');
    el.style.display = roles.includes(role) ? 'flex' : 'none';
  });

  // Nav routing
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
      closeSidebar();
    });
  });

  // Mobile menu
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
  });
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  navigateTo('dashboard');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  loadPage(page);
}

function loadPage(page) {
  switch(page) {
    case 'dashboard': loadDashboard(); break;
    case 'reservas':  loadReservas();  break;
    case 'usuarios':  loadUsuarios();  break;
    case 'horarios':  loadHorarios();  break;
    case 'pagos':     loadPagos();     break;
    case 'rutinas':   loadRutinas();   break;
    case 'notas':     loadNotas();     break;
    case 'historial': loadHistorial(); break;
    case 'perfil':    loadPerfil();    break;
  }
}

// ── Helpers ────────────────────────────────────────────
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
const DAY_KEYS = ['lunes','martes','miercoles','jueves','viernes'];

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

function getMondayOfWeek(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  return new Date(now.setDate(diff));
}

function getWeekDates(monday) {
  return DAY_KEYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateKey(date) {
  return date.toISOString().split('T')[0];
}

// ── DASHBOARD ─────────────────────────────────────────
async function loadDashboard() {
  const role = currentUserData.role;
  const cont = document.getElementById('dashboard-content');

  if (role === 'admin') {
    const [usersSnap, bookingsSnap, sessionsSnap] = await Promise.all([
      getDocs(collection(db,'users')),
      getDocs(query(collection(db,'bookings'), where('status','==','activa'))),
      getDocs(collection(db,'sessions'))
    ]);
    const activeUsers = usersSnap.docs.filter(d => d.data().status === 'active').length;
    const pendingUsers = usersSnap.docs.filter(d => d.data().status === 'pending').length;
    cont.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${activeUsers}</div><div class="stat-label">Usuarios activos</div></div>
        <div class="stat-card"><div class="stat-value text-warning">${pendingUsers}</div><div class="stat-label">Pendientes de activar</div></div>
        <div class="stat-card"><div class="stat-value">${bookingsSnap.size}</div><div class="stat-label">Reservas esta semana</div></div>
        <div class="stat-card"><div class="stat-value">${sessionsSnap.size}</div><div class="stat-label">Sesiones configuradas</div></div>
      </div>
      ${pendingUsers > 0 ? `<div class="alert alert-warning">⚠️ Tienes ${pendingUsers} usuario(s) esperando activación. <a href="#" onclick="event.preventDefault(); navigateTo('usuarios')">Ir a usuarios →</a></div>` : ''}
      <div class="card"><div class="card-header"><span class="card-title">Acceso rápido</span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="navigateTo('usuarios')">👥 Gestionar usuarios</button>
          <button class="btn btn-secondary" onclick="navigateTo('horarios')">📅 Configurar horarios</button>
          <button class="btn btn-secondary" onclick="navigateTo('pagos')">💳 Registrar pagos</button>
          <button class="btn btn-secondary" onclick="navigateTo('rutinas')">💪 Asignar rutinas</button>
        </div>
      </div>`;
  } else if (role === 'trainer') {
    const sessionsSnap = await getDocs(query(collection(db,'sessions'), where('trainerId','==',currentUser.uid)));
    cont.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${sessionsSnap.size}</div><div class="stat-label">Mis sesiones</div></div>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">Acceso rápido</span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="navigateTo('reservas')">📋 Ver mis sesiones</button>
          <button class="btn btn-secondary" onclick="navigateTo('rutinas')">💪 Gestionar rutinas</button>
          <button class="btn btn-secondary" onclick="navigateTo('notas')">📝 Notas de alumnos</button>
        </div>
      </div>`;
  } else {
    // user
    const myBookings = await getDocs(query(collection(db,'bookings'), where('userId','==',currentUser.uid), where('status','==','activa')));
    const myRoutines = await getDocs(query(collection(db,'routines'), where('userId','==',currentUser.uid)));
    const paySnap = await getDocs(query(collection(db,'payments'), where('userId','==',currentUser.uid), orderBy('createdAt','desc')));
    let payAlert = '';
    if (paySnap.docs.length > 0) {
      const last = paySnap.docs[0].data();
      if (last.vencido) payAlert = `<div class="alert alert-danger">⚠️ Tu mensualidad está vencida. Contacta al administrador.</div>`;
    }
    cont.innerHTML = `
      ${payAlert}
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${myBookings.size}</div><div class="stat-label">Mis reservas activas</div></div>
        <div class="stat-card"><div class="stat-value">${myRoutines.size}</div><div class="stat-label">Mis rutinas</div></div>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">Acceso rápido</span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="navigateTo('reservas')">📅 Reservar clase</button>
          <button class="btn btn-secondary" onclick="navigateTo('rutinas')">💪 Ver mis rutinas</button>
          <button class="btn btn-secondary" onclick="navigateTo('historial')">📋 Mi historial</button>
        </div>
      </div>`;
  }
}

// ── RESERVAS ──────────────────────────────────────────
let weekOffset = 0;

async function loadReservas() {
  const cont = document.getElementById('reservas-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;

  const monday = getMondayOfWeek(weekOffset);
  const dates = getWeekDates(monday);
  const blockedSnap = await getDocs(collection(db,'blocked_dates'));
  const blocked = blockedSnap.docs.map(d => d.id);
  const sessionsSnap = await getDocs(collection(db,'sessions'));
  const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const bookingsSnap = await getDocs(query(collection(db,'bookings'), where('status','==','activa')));
  const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // trainers map
  const trainersSnap = await getDocs(query(collection(db,'users'), where('role','==','trainer')));
  const trainerMap = {};
  trainersSnap.docs.forEach(d => { trainerMap[d.id] = d.data().name; });

  const weekLabel = `${dates[0].toLocaleDateString('es-CO',{day:'2-digit',month:'short'})} – ${dates[4].toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}`;

  let html = `
    <div class="flex-between" style="margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" id="prev-week">← Anterior</button>
        <span style="font-size:14px;font-weight:500">${weekLabel}</span>
        <button class="btn btn-secondary btn-sm" id="next-week">Siguiente →</button>
      </div>
    </div>
    <div class="week-grid">`;

  for (let i = 0; i < 5; i++) {
    const date = dates[i];
    const dk = dateKey(date);
    const isBlocked = blocked.includes(dk);
    const daySessions = sessions.filter(s => s.day === DAY_KEYS[i]).sort((a,b) => a.time.localeCompare(b.time));

    html += `<div class="day-col">
      <div class="day-header">${DAYS[i]}<br><span style="font-weight:400;font-size:10px">${date.toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span></div>`;

    if (isBlocked) {
      html += `<div class="session-slot blocked"><div class="slot-time">🚫 Bloqueado</div></div>`;
    } else if (daySessions.length === 0) {
      html += `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Sin sesiones</div>`;
    } else {
      for (const s of daySessions) {
        const slotBookings = bookings.filter(b => b.sessionId === s.id && b.dateKey === dk);
        const count = slotBookings.length;
        const cap = s.capacity || 4;
        const isFull = count >= cap;
        const myBooking = slotBookings.find(b => b.userId === currentUser.uid);
        const pct = Math.round((count/cap)*100);
        const fillClass = pct >= 100 ? 'full-bar' : pct >= 75 ? 'almost' : '';
        const trainerName = s.trainerId ? (trainerMap[s.trainerId] || 'Sin entrenador') : 'Sin entrenador';

        // Time window: open 12h before, close 1h before class
        const startHour = parseInt(s.time.split(':')[0]);
        const classStart = new Date(date);
        classStart.setHours(startHour, 0, 0, 0);
        const openAt  = new Date(classStart.getTime() - 12 * 60 * 60 * 1000);
        const closeAt = new Date(classStart.getTime() -  1 * 60 * 60 * 1000);
        const now = new Date();
        const isAdminRole = currentUserData.role === 'admin';
        const notYetOpen = now < openAt;
        const alreadyClosed = now > closeAt;
        const isLocked = !isAdminRole && (notYetOpen || alreadyClosed) && !myBooking;

        let lockLabel = '';
        if (!isAdminRole && notYetOpen) {
          lockLabel = `<div style="font-size:10px;color:var(--warning);margin-top:4px">🔒 Abre ${openAt.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</div>`;
        } else if (!isAdminRole && alreadyClosed && !myBooking) {
          lockLabel = `<div style="font-size:10px;color:var(--muted);margin-top:4px">⏱ Reserva cerrada</div>`;
        }

        html += `<div class="session-slot ${isFull&&!myBooking?'full':''} ${myBooking?'booked':''} ${isLocked?'full':''}"
          data-session-id="${s.id}"
          data-dk="${dk}"
          data-time="${s.time}"
          data-day="${DAYS[i]}"
          data-full="${isFull}"
          data-locked="${isLocked}"
          data-my-booking="${!!myBooking}"
          data-booking-id="${myBooking?.id||''}">
          <div class="slot-time">${s.time}</div>
          <div class="slot-trainer">${trainerName}</div>
          <div class="slot-capacity">
            <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
            <span>${count}/${cap}</span>
          </div>
          ${myBooking ? '<div style="font-size:10px;color:var(--accent);margin-top:4px">✓ Reservado</div>' : lockLabel}
        </div>`;
      }
    }
    html += `</div>`;
  }
  html += `</div>`;
  cont.innerHTML = html;

  document.getElementById('prev-week').addEventListener('click', () => { weekOffset--; loadReservas(); });
  document.getElementById('next-week').addEventListener('click', () => { weekOffset++; loadReservas(); });

  // Event delegation for slot clicks
  cont.addEventListener('click', (e) => {
    const slot = e.target.closest('.session-slot');
    if (!slot || slot.classList.contains('blocked')) return;
    const { sessionId, dk, time, day, full, locked, myBooking, bookingId } = slot.dataset;
    handleSlotClick(sessionId, dk, time, day, full === 'true', locked === 'true', myBooking === 'true', bookingId);
  });
}

window.handleSlotClick = async function(sessionId, dk, time, dayName, isFull, isLocked, myBooking, bookingId) {
  const modal = document.getElementById('modal-slot');
  const body = document.getElementById('modal-slot-body');
  const role = currentUserData.role;

  // Re-fetch bookings with user names
  const bookingsSnap = await getDocs(query(collection(db,'bookings'),
    where('sessionId','==',sessionId), where('dateKey','==',dk), where('status','==','activa')));
  const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let peopleHtml = bookings.length === 0
    ? '<p style="color:var(--muted);font-size:13px">Nadie reservado aún.</p>'
    : `<table><thead><tr><th>Nombre</th><th>Email</th>${role!=='user'?'<th></th>':''}</tr></thead><tbody>
        ${bookings.map(b => `<tr>
          <td>${b.userName}</td><td style="color:var(--muted)">${b.userEmail}</td>
          ${role!=='user'?`<td><button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')">Cancelar</button></td>`:''}
        </tr>`).join('')}
      </tbody></table>`;

  let actionBtn = '';
  const myB = bookings.find(b => b.userId === currentUser.uid);
  if (myB) {
    actionBtn = `<button class="btn btn-danger" onclick="cancelBooking('${myB.id}')">Cancelar mi reserva</button>`;
  } else if (isLocked) {
    actionBtn = `<span class="badge badge-pending">⏱ Reservas no disponibles aún</span>`;
  } else if (!isFull || role === 'admin') {
    if (role !== 'trainer') {
      actionBtn = `<button class="btn btn-primary" onclick="makeBooking('${sessionId}','${dk}','${time}','${dayName}')">Reservar esta clase</button>`;
    }
  } else {
    actionBtn = `<span class="badge badge-blocked">Clase llena</span>`;
  }

  body.innerHTML = `
    <p style="color:var(--muted);font-size:13px;margin-bottom:16px">${dayName} · ${time}</p>
    <div class="divider"></div>
    <p style="font-size:13px;font-weight:600;margin-bottom:10px">Inscritos</p>
    ${peopleHtml}
    <div style="margin-top:20px">${actionBtn}</div>`;

  document.getElementById('modal-slot-title').textContent = `Clase ${time}`;
  modal.classList.add('open');
};

window.makeBooking = async function(sessionId, dk, time, dayName) {
  // Check if blocked
  const paySnap = await getDocs(query(collection(db,'payments'), where('userId','==',currentUser.uid)));
  const pays = paySnap.docs.map(d => d.data());
  const lastPay = pays.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))[0];
  if (lastPay?.vencido) { toast('Tu mensualidad está vencida. Contacta al admin.','error'); return; }
  if (currentUserData.status === 'blocked') { toast('Tu cuenta está bloqueada.','error'); return; }

  await addDoc(collection(db,'bookings'), {
    sessionId, dateKey: dk, time, dayName,
    userId: currentUser.uid,
    userName: currentUserData.name || currentUser.displayName,
    userEmail: currentUser.email,
    status: 'activa',
    createdAt: serverTimestamp()
  });
  toast('¡Reserva confirmada!');
  closeModal('modal-slot');
  loadReservas();
};

window.cancelBooking = async function(bookingId) {
  await updateDoc(doc(db,'bookings',bookingId), { status: 'cancelada', canceledAt: serverTimestamp() });
  toast('Reserva cancelada');
  closeModal('modal-slot');
  loadReservas();
};

// ── USUARIOS (admin) ───────────────────────────────────
async function loadUsuarios() {
  const cont = document.getElementById('usuarios-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
  const snap = await getDocs(query(collection(db,'users'), orderBy('createdAt','desc')));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const trainersSnap = await getDocs(query(collection(db,'users'), where('role','in',['admin','trainer','user'])));

  if (users.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>No hay usuarios aún.</p></div>`;
    return;
  }

  cont.innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="filterUsers('all',this)">Todos (${users.length})</button>
      <button class="tab" onclick="filterUsers('pending',this)">Pendientes (${users.filter(u=>u.status==='pending').length})</button>
      <button class="tab" onclick="filterUsers('active',this)">Activos (${users.filter(u=>u.status==='active').length})</button>
      <button class="tab" onclick="filterUsers('blocked',this)">Bloqueados (${users.filter(u=>u.status==='blocked').length})</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table id="users-table">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Desde</th><th>Acciones</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr data-status="${u.status}">
                <td>
                  <div style="font-weight:500">${u.name||'Sin nombre'}</div>
                  <div style="font-size:12px;color:var(--muted)">${u.email}</div>
                </td>
                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                <td><span class="badge badge-${u.status==='active'?'active':u.status==='pending'?'pending':'blocked'}">${u.status}</span></td>
                <td style="color:var(--muted)">${formatDate(u.createdAt)}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${u.status==='pending'?`<button class="btn btn-success btn-sm" onclick="activateUser('${u.id}')">Activar</button>`:''}
                    ${u.status==='active'?`<button class="btn btn-danger btn-sm" onclick="blockUser('${u.id}')">Bloquear</button>`:''}
                    ${u.status==='blocked'?`<button class="btn btn-success btn-sm" onclick="activateUser('${u.id}')">Desbloquear</button>`:''}
                    <button class="btn btn-secondary btn-sm" onclick="openChangeRole('${u.id}','${u.role}','${u.name||u.email}')">Rol</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

window.filterUsers = function(status, btn) {
  document.querySelectorAll('#usuarios-content .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#users-table tbody tr').forEach(tr => {
    tr.style.display = (status === 'all' || tr.dataset.status === status) ? '' : 'none';
  });
};

window.activateUser = async function(uid) {
  await updateDoc(doc(db,'users',uid), { status: 'active' });
  toast('Usuario activado'); loadUsuarios();
};
window.blockUser = async function(uid) {
  await updateDoc(doc(db,'users',uid), { status: 'blocked' });
  toast('Usuario bloqueado'); loadUsuarios();
};
window.openChangeRole = function(uid, currentRole, name) {
  document.getElementById('role-user-id').value = uid;
  document.getElementById('role-user-name').textContent = name;
  document.getElementById('role-select').value = currentRole;
  document.getElementById('modal-role').classList.add('open');
};
document.getElementById('btn-save-role')?.addEventListener('click', async () => {
  const uid = document.getElementById('role-user-id').value;
  const role = document.getElementById('role-select').value;
  await updateDoc(doc(db,'users',uid), { role });
  toast('Rol actualizado'); closeModal('modal-role'); loadUsuarios();
});

// ── HORARIOS (admin) ───────────────────────────────────
async function loadHorarios() {
  const cont = document.getElementById('horarios-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
  const sessionsSnap = await getDocs(query(collection(db,'sessions'), orderBy('day')));
  const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const trainersSnap = await getDocs(query(collection(db,'users'), where('role','==','trainer')));
  const trainers = trainersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const trainerMap = {}; trainers.forEach(t => trainerMap[t.id] = t.name);

  const blockedSnap = await getDocs(collection(db,'blocked_dates'));
  const blocked = blockedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  cont.innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="switchHorTab('sesiones',this)">Sesiones</button>
      <button class="tab" onclick="switchHorTab('bloqueados',this)">Fechas bloqueadas</button>
    </div>
    <div id="hor-sesiones">
      <div class="page-header">
        <div></div>
        <button class="btn btn-primary" onclick="openAddSession()">+ Nueva sesión</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Día</th><th>Horario</th><th>Capacidad</th><th>Entrenador</th><th>Acciones</th></tr></thead>
            <tbody>
              ${sessions.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px">No hay sesiones configuradas</td></tr>' :
                sessions.map(s => `
                  <tr>
                    <td style="font-weight:500;text-transform:capitalize">${s.day}</td>
                    <td>${s.time}</td>
                    <td>${s.capacity} personas</td>
                    <td style="color:var(--muted)">${s.trainerId ? (trainerMap[s.trainerId]||'—') : '—'}</td>
                    <td>
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-secondary btn-sm" onclick="openEditSession('${s.id}','${s.day}','${s.time}',${s.capacity},'${s.trainerId||''}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSession('${s.id}')">Eliminar</button>
                      </div>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="hor-bloqueados" style="display:none">
      <div class="page-header">
        <div></div>
        <button class="btn btn-primary" onclick="openBlockDate()">+ Bloquear fecha</button>
      </div>
      <div class="card">
        ${blocked.length === 0 ? '<div class="empty-state"><div class="icon">📅</div><p>No hay fechas bloqueadas</p></div>' :
          `<div class="table-wrap"><table>
            <thead><tr><th>Fecha</th><th>Motivo</th><th></th></tr></thead>
            <tbody>${blocked.map(b=>`
              <tr>
                <td>${b.id}</td>
                <td style="color:var(--muted)">${b.reason||'—'}</td>
                <td><button class="btn btn-danger btn-sm" onclick="unblockDate('${b.id}')">Desbloquear</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>`}
      </div>
    </div>`;

  // populate trainer selects
  const trainerOptions = `<option value="">Sin entrenador</option>` + trainers.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  document.getElementById('session-trainer').innerHTML = trainerOptions;
}

window.switchHorTab = function(tab, btn) {
  document.querySelectorAll('#horarios-content .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('hor-sesiones').style.display = tab==='sesiones'?'':'none';
  document.getElementById('hor-bloqueados').style.display = tab==='bloqueados'?'':'none';
};

window.openAddSession = function() {
  document.getElementById('session-id').value = '';
  document.getElementById('session-day').value = 'lunes';
  document.getElementById('session-time').value = '';
  document.getElementById('session-capacity').value = '4';
  document.getElementById('session-trainer').value = '';
  document.getElementById('modal-session-title').textContent = 'Nueva sesión';
  document.getElementById('modal-session').classList.add('open');
};

window.openEditSession = function(id, day, time, capacity, trainerId) {
  document.getElementById('session-id').value = id;
  document.getElementById('session-day').value = day;
  // Try to match existing time value in select, otherwise select first matching option
  const sel = document.getElementById('session-time');
  const match = Array.from(sel.options).find(o => o.value === time);
  sel.value = match ? time : '';
  document.getElementById('session-capacity').value = capacity;
  document.getElementById('session-trainer').value = trainerId||'';
  document.getElementById('modal-session-title').textContent = 'Editar sesión';
  document.getElementById('modal-session').classList.add('open');
};

document.getElementById('btn-save-session')?.addEventListener('click', async () => {
  const id = document.getElementById('session-id').value;
  const data = {
    day: document.getElementById('session-day').value,
    time: document.getElementById('session-time').value,
    capacity: parseInt(document.getElementById('session-capacity').value)||4,
    trainerId: document.getElementById('session-trainer').value||null
  };
  if (!data.time) { toast('Ingresa el horario','error'); return; }
  if (id) { await updateDoc(doc(db,'sessions',id), data); toast('Sesión actualizada'); }
  else { await addDoc(collection(db,'sessions'), data); toast('Sesión creada'); }
  closeModal('modal-session'); loadHorarios();
});

window.deleteSession = async function(id) {
  if (!confirm('¿Eliminar esta sesión?')) return;
  await deleteDoc(doc(db,'sessions',id));
  toast('Sesión eliminada'); loadHorarios();
};

window.openBlockDate = function() {
  document.getElementById('block-date').value = '';
  document.getElementById('block-reason').value = '';
  document.getElementById('modal-block').classList.add('open');
};

document.getElementById('btn-save-block')?.addEventListener('click', async () => {
  const date = document.getElementById('block-date').value;
  const reason = document.getElementById('block-reason').value;
  if (!date) { toast('Selecciona una fecha','error'); return; }
  await setDoc(doc(db,'blocked_dates',date), { reason, createdAt: serverTimestamp() });
  toast('Fecha bloqueada'); closeModal('modal-block'); loadHorarios();
});

window.unblockDate = async function(id) {
  await deleteDoc(doc(db,'blocked_dates',id));
  toast('Fecha desbloqueada'); loadHorarios();
};

// ── PAGOS (admin) ──────────────────────────────────────
async function loadPagos() {
  const cont = document.getElementById('pagos-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
  const usersSnap = await getDocs(query(collection(db,'users'), where('role','==','user')));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const allPaySnap = await getDocs(collection(db,'payments'));
  const allPays = allPaySnap.docs.map(d => ({ id: d.id, ...d.data() }));

  cont.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Usuario</th><th>Último pago</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${users.map(u => {
              const pays = allPays.filter(p=>p.userId===u.id).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
              const last = pays[0];
              return `<tr>
                <td>
                  <div style="font-weight:500">${u.name||'Sin nombre'}</div>
                  <div style="font-size:12px;color:var(--muted)">${u.email}</div>
                </td>
                <td>${last?formatDate(last.createdAt):'Sin pagos'}</td>
                <td>${last?`$${last.amount.toLocaleString('es-CO')}`:'—'}</td>
                <td>
                  ${last?.vencido
                    ? '<span class="badge badge-blocked">Vencida</span>'
                    : last ? '<span class="badge badge-active">Al día</span>'
                    : '<span class="badge badge-pending">Sin registro</span>'}
                </td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-primary btn-sm" onclick="openAddPago('${u.id}','${u.name||u.email}')">+ Registrar pago</button>
                    ${last && !last.vencido ? `<button class="btn btn-danger btn-sm" onclick="marcarVencido('${last.id}')">Marcar vencida</button>` : ''}
                    ${last?.vencido ? `<button class="btn btn-success btn-sm" onclick="marcarAlDia('${last.id}')">Marcar al día</button>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="verHistorialPagos('${u.id}','${u.name||u.email}')">Historial</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

window.openAddPago = function(uid, name) {
  document.getElementById('pago-user-id').value = uid;
  document.getElementById('pago-user-name').textContent = name;
  document.getElementById('pago-amount').value = '';
  document.getElementById('pago-note').value = '';
  document.getElementById('pago-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-pago').classList.add('open');
};

document.getElementById('btn-save-pago')?.addEventListener('click', async () => {
  const uid = document.getElementById('pago-user-id').value;
  const amount = parseFloat(document.getElementById('pago-amount').value);
  const note = document.getElementById('pago-note').value;
  const date = document.getElementById('pago-date').value;
  if (!amount) { toast('Ingresa el monto','error'); return; }
  await addDoc(collection(db,'payments'), {
    userId: uid, amount, note, paymentDate: date,
    vencido: false, registeredBy: currentUser.uid,
    createdAt: serverTimestamp()
  });
  toast('Pago registrado'); closeModal('modal-pago'); loadPagos();
});

window.marcarVencido = async function(id) {
  await updateDoc(doc(db,'payments',id), { vencido: true });
  toast('Marcado como vencido'); loadPagos();
};
window.marcarAlDia = async function(id) {
  await updateDoc(doc(db,'payments',id), { vencido: false });
  toast('Marcado al día'); loadPagos();
};

window.verHistorialPagos = async function(uid, name) {
  const snap = await getDocs(query(collection(db,'payments'), where('userId','==',uid), orderBy('createdAt','desc')));
  const pays = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const body = document.getElementById('modal-historial-pago-body');
  document.getElementById('modal-historial-pago-title').textContent = `Pagos de ${name}`;
  body.innerHTML = pays.length === 0
    ? '<p style="color:var(--muted);font-size:13px">Sin pagos registrados.</p>'
    : `<table><thead><tr><th>Fecha</th><th>Monto</th><th>Nota</th><th>Estado</th></tr></thead><tbody>
        ${pays.map(p=>`<tr>
          <td>${p.paymentDate||formatDate(p.createdAt)}</td>
          <td>$${p.amount?.toLocaleString('es-CO')}</td>
          <td style="color:var(--muted)">${p.note||'—'}</td>
          <td>${p.vencido?'<span class="badge badge-blocked">Vencida</span>':'<span class="badge badge-active">Al día</span>'}</td>
        </tr>`).join('')}
      </tbody></table>`;
  document.getElementById('modal-historial-pago').classList.add('open');
};

// ── RUTINAS ────────────────────────────────────────────
async function loadRutinas() {
  const cont = document.getElementById('rutinas-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
  const role = currentUserData.role;

  if (role === 'user') {
    const snap = await getDocs(query(collection(db,'routines'), where('userId','==',currentUser.uid)));
    const routines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cont.innerHTML = routines.length === 0
      ? `<div class="empty-state"><div class="icon">💪</div><p>Tu entrenador aún no te ha asignado rutinas.</p></div>`
      : routines.map(r => `
          <div class="card">
            <div class="card-header">
              <span class="card-title">${r.title}</span>
              <span style="font-size:12px;color:var(--muted)">${formatDate(r.createdAt)}</span>
            </div>
            <p style="font-size:14px;white-space:pre-wrap;color:var(--text)">${r.content}</p>
          </div>`).join('');
    return;
  }

  // admin or trainer
  const usersSnap = await getDocs(query(collection(db,'users'), where('role','==','user')));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const routinesSnap = await getDocs(query(collection(db,'routines'), orderBy('createdAt','desc')));
  const routines = routinesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const userMap = {}; users.forEach(u => userMap[u.id] = u.name||u.email);

  cont.innerHTML = `
    <div class="page-header"><div></div>
      <button class="btn btn-primary" onclick="openAddRutina()">+ Nueva rutina</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Usuario</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            ${routines.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:32px">No hay rutinas</td></tr>' :
              routines.map(r=>`<tr>
                <td style="font-weight:500">${r.title}</td>
                <td>${userMap[r.userId]||'—'}</td>
                <td style="color:var(--muted)">${formatDate(r.createdAt)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-sm" onclick="openEditRutina('${r.id}','${r.userId}',\`${r.title}\`,\`${r.content}\`)">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRutina('${r.id}')">Eliminar</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const userOptions = users.map(u=>`<option value="${u.id}">${u.name||u.email}</option>`).join('');
  document.getElementById('rutina-user').innerHTML = userOptions;
}

window.openAddRutina = function() {
  document.getElementById('rutina-id').value = '';
  document.getElementById('rutina-title').value = '';
  document.getElementById('rutina-content').value = '';
  document.getElementById('modal-rutina-title').textContent = 'Nueva rutina';
  document.getElementById('modal-rutina').classList.add('open');
};
window.openEditRutina = function(id, userId, title, content) {
  document.getElementById('rutina-id').value = id;
  document.getElementById('rutina-user').value = userId;
  document.getElementById('rutina-title').value = title;
  document.getElementById('rutina-content').value = content;
  document.getElementById('modal-rutina-title').textContent = 'Editar rutina';
  document.getElementById('modal-rutina').classList.add('open');
};
document.getElementById('btn-save-rutina')?.addEventListener('click', async () => {
  const id = document.getElementById('rutina-id').value;
  const data = {
    userId: document.getElementById('rutina-user').value,
    title: document.getElementById('rutina-title').value,
    content: document.getElementById('rutina-content').value,
    assignedBy: currentUser.uid
  };
  if (!data.title||!data.content||!data.userId) { toast('Completa todos los campos','error'); return; }
  if (id) { await updateDoc(doc(db,'routines',id), data); toast('Rutina actualizada'); }
  else { await addDoc(collection(db,'routines'), { ...data, createdAt: serverTimestamp() }); toast('Rutina asignada'); }
  closeModal('modal-rutina'); loadRutinas();
});
window.deleteRutina = async function(id) {
  if (!confirm('¿Eliminar rutina?')) return;
  await deleteDoc(doc(db,'routines',id));
  toast('Rutina eliminada'); loadRutinas();
};

// ── NOTAS (trainer) ────────────────────────────────────
async function loadNotas() {
  const cont = document.getElementById('notas-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
  const usersSnap = await getDocs(query(collection(db,'users'), where('role','==','user')));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const notasSnap = await getDocs(query(collection(db,'trainer_notes'), where('trainerId','==',currentUser.uid), orderBy('updatedAt','desc')));
  const notas = notasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const userMap = {}; users.forEach(u => userMap[u.id] = u.name||u.email);

  cont.innerHTML = `
    <div class="page-header"><div></div>
      <button class="btn btn-primary" onclick="openAddNota()">+ Nueva nota</button>
    </div>
    <div class="card">
      ${notas.length === 0
        ? '<div class="empty-state"><div class="icon">📝</div><p>No tienes notas aún.</p></div>'
        : notas.map(n=>`
          <div style="padding:16px;border-bottom:1px solid var(--border)">
            <div class="flex-between">
              <div>
                <span style="font-weight:600">${userMap[n.userId]||'—'}</span>
                <span style="font-size:12px;color:var(--muted);margin-left:8px">${formatDate(n.updatedAt)}</span>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-secondary btn-sm" onclick="openEditNota('${n.id}','${n.userId}',\`${n.content}\`)">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteNota('${n.id}')">Eliminar</button>
              </div>
            </div>
            <p style="font-size:13px;margin-top:8px;white-space:pre-wrap;color:var(--muted)">${n.content}</p>
          </div>`).join('')}
    </div>`;

  const userOptions = users.map(u=>`<option value="${u.id}">${u.name||u.email}</option>`).join('');
  document.getElementById('nota-user').innerHTML = userOptions;
}

window.openAddNota = function() {
  document.getElementById('nota-id').value = '';
  document.getElementById('nota-content').value = '';
  document.getElementById('modal-nota-title').textContent = 'Nueva nota';
  document.getElementById('modal-nota').classList.add('open');
};
window.openEditNota = function(id, userId, content) {
  document.getElementById('nota-id').value = id;
  document.getElementById('nota-user').value = userId;
  document.getElementById('nota-content').value = content;
  document.getElementById('modal-nota-title').textContent = 'Editar nota';
  document.getElementById('modal-nota').classList.add('open');
};
document.getElementById('btn-save-nota')?.addEventListener('click', async () => {
  const id = document.getElementById('nota-id').value;
  const data = {
    userId: document.getElementById('nota-user').value,
    content: document.getElementById('nota-content').value,
    trainerId: currentUser.uid, updatedAt: serverTimestamp()
  };
  if (!data.content||!data.userId) { toast('Completa todos los campos','error'); return; }
  if (id) { await updateDoc(doc(db,'trainer_notes',id), data); toast('Nota actualizada'); }
  else { await addDoc(collection(db,'trainer_notes'), { ...data, createdAt: serverTimestamp() }); toast('Nota guardada'); }
  closeModal('modal-nota'); loadNotas();
});
window.deleteNota = async function(id) {
  await deleteDoc(doc(db,'trainer_notes',id));
  toast('Nota eliminada'); loadNotas();
};

// ── HISTORIAL (user) ───────────────────────────────────
async function loadHistorial() {
  const cont = document.getElementById('historial-content');
  cont.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;
  const snap = await getDocs(query(collection(db,'bookings'), where('userId','==',currentUser.uid), orderBy('createdAt','desc')));
  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (bookings.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Aún no tienes clases registradas.</p></div>`;
    return;
  }
  cont.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Día</th><th>Fecha</th><th>Horario</th><th>Estado</th></tr></thead>
          <tbody>
            ${bookings.map(b=>`<tr>
              <td style="font-weight:500">${b.dayName||'—'}</td>
              <td style="color:var(--muted)">${b.dateKey||'—'}</td>
              <td>${b.time||'—'}</td>
              <td><span class="badge ${b.status==='activa'?'badge-active':'badge-blocked'}">${b.status}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── PERFIL ─────────────────────────────────────────────
async function loadPerfil() {
  const cont = document.getElementById('perfil-content');
  const u = currentUserData;
  const photo = u.photo || currentUser.photoURL || '';
  cont.innerHTML = `
    <div style="max-width:500px">
      <div class="card" style="text-align:center">
        <div class="profile-avatar-big">
          ${photo ? `<img src="${photo}" style="width:80px;height:80px;border-radius:50%;object-fit:cover">` : (u.name||'U')[0].toUpperCase()}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:24px">${u.email}</div>
        <span class="badge badge-${u.role}">${u.role}</span>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Editar perfil</div>
        <div class="form-group">
          <label class="form-label">Nombre completo</label>
          <input class="form-input" id="perfil-name" value="${u.name||''}" placeholder="Tu nombre">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input class="form-input" id="perfil-phone" value="${u.phone||''}" placeholder="Ej: 300 123 4567">
        </div>
        <div class="form-group">
          <label class="form-label">Nota personal</label>
          <textarea class="form-textarea" id="perfil-bio" placeholder="Algo sobre ti, objetivos, etc.">${u.bio||''}</textarea>
        </div>
        <button class="btn btn-primary" onclick="savePerfil()">Guardar cambios</button>
      </div>
    </div>`;
}

window.savePerfil = async function() {
  const name = document.getElementById('perfil-name').value;
  const phone = document.getElementById('perfil-phone').value;
  const bio = document.getElementById('perfil-bio').value;
  await updateDoc(doc(db,'users',currentUser.uid), { name, phone, bio });
  currentUserData = { ...currentUserData, name, phone, bio };
  document.getElementById('sidebar-name').textContent = name;
  toast('Perfil actualizado');
};

// ── Modal helpers ──────────────────────────────────────
window.closeModal = function(id) {
  document.getElementById(id)?.classList.remove('open');
};
window.navigateTo = navigateTo;
