// Import Firebase directly from CDN networks
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// YOUR EXACT CONFIGURATION FROM SCREEN LABELS
const firebaseConfig = {
  apiKey: "AIzaSyDJSWNdt6p3LuvYIHVvM3BF4xWLU2CsYZA",
  authDomain: "ncsc-portal.firebaseapp.com",
  projectId: "ncsc-portal",
  storageBucket: "ncsc-portal.firebasestorage.app",
  messagingSenderId: "117459296807",
  appId: "1:117459296807:web:8b3cf4c95cf5ffb3a9e402",
  measurementId: "G-DVEWD9D33Y"
};

// Initialize Application Systems
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Keep user authentication tracking in browser local state storage
let currentCrewUser = localStorage.getItem('ncsc_logged_user') || null;

// --- STEP A: USER INTERFACE ROUTING HANDLERS ---
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const userDisplay = document.getElementById('current-user-display');

function checkSession() {
    if (currentCrewUser) {
        loginScreen.style.display = 'none';
        dashboardScreen.style.display = 'block';
        userDisplay.textContent = currentCrewUser.toUpperCase();
    } else {
        loginScreen.style.display = 'flex';
        dashboardScreen.style.display = 'none';
    }
}

// Login verification processor
document.getElementById('login-btn').addEventListener('click', () => {
    const user = document.getElementById('username-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    const errorMsg = document.getElementById('login-error');

    // Default static core user profiles fallback rule
    if ((user === 'admin' && pass === 'admin@ncsc') || 
        (user === 'ncsc001sanudha' && pass === '123') ||
        (user === 'ncsc002minidu' && pass === 'miniduncsc002')) {
        
        currentCrewUser = user;
        localStorage.setItem('ncsc_logged_user', user);
        errorMsg.style.display = 'none';
        checkSession();
    } else {
        // Double-check against dynamic profiles registered via backend database branch
        onValue(ref(db, 'crew_profiles/' + user), (snapshot) => {
            const data = snapshot.val();
            if (data && data.password === pass) {
                currentCrewUser = user;
                localStorage.setItem('ncsc_logged_user', user);
                errorMsg.style.display = 'none';
                checkSession();
            } else {
                errorMsg.style.display = 'block';
            }
        }, { onlyOnce: true });
    }
});

// Log out handler
document.getElementById('logout-btn').addEventListener('click', () => {
    currentCrewUser = null;
    localStorage.removeItem('ncsc_logged_user');
    checkSession();
});

// --- STEP B: CRUCIAL CLOUD SYNC LOGIC (DATABASE BROKER) ---

// 1. Create - Add gear item to store database
document.getElementById('add-item-btn').addEventListener('click', () => {
    const code = document.getElementById('item-code').value.trim().toUpperCase();
    const model = document.getElementById('item-model').value.trim();
    const cat = document.getElementById('item-category').value;
    const qty = parseInt(document.getElementById('item-qty').value) || 0;
    const desc = document.getElementById('item-desc').value.trim();

    if (!code || !model) return alert('Please enter an item code and model variant labels.');

    set(ref(db, 'inventory/' + code), {
        code: code,
        model: model,
        category: cat,
        quantity: qty,
        description: desc
    }).then(() => {
        document.getElementById('gear-form').reset();
    });
});

// 2. Read - Real-time auto rendering inventory dashboard on changes
onValue(ref(db, 'inventory'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '';
    
    if (!data) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#aaa;">No equipment registered in store assets database grid yet.</td></tr>`;
        return;
    }

    Object.keys(data).forEach(key => {
        const item = data[key];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="gear-select-box" data-code="${item.code}"></td>
            <td><strong>${item.code}</strong></td>
            <td>${item.model} <br><small style="color:#777;">${item.description || ''}</small></td>
            <td><span class="category-badge">${item.category}</span></td>
            <td style="color: blue; font-weight: bold;">${item.quantity} units</td>
            <td>
                <div class="qty-adjuster">
                    <button class="qty-btn calc-minus" onclick="this.nextElementSibling.value = Math.max(0, parseInt(this.nextElementSibling.value)-1)">-</button>
                    <input type="number" class="dispatch-val" value="0" min="0" max="${item.quantity}" style="width:50px; text-align:center;">
                    <button class="qty-btn calc-plus" onclick="this.previousElementSibling.value = Math.min(${item.quantity}, parseInt(this.previousElementSibling.value)+1)">+</button>
                </div>
            </td>
            <td>
                <div class="action-btn-row">
                    <button class="ctrl-btn add-stock" data-code="${item.code}" data-current="${item.quantity}">+</button>
                    <button class="ctrl-btn sub-stock" data-code="${item.code}" data-current="${item.quantity}">-</button>
                    <button class="ctrl-btn del-gear" data-code="${item.code}">&times;</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    attachTableControlListeners();
});

function attachTableControlListeners() {
    // Inventory adjustments engine (+ / - / delete master stock values)
    document.querySelectorAll('.add-stock').forEach(btn => btn.addEventListener('click', (e) => {
        const code = e.target.getAttribute('data-code');
        const curr = parseInt(e.target.getAttribute('data-current'));
        update(ref(db, 'inventory/' + code), { quantity: curr + 1 });
    }));

    document.querySelectorAll('.sub-stock').forEach(btn => btn.addEventListener('click', (e) => {
        const code = e.target.getAttribute('data-code');
        const curr = parseInt(e.target.getAttribute('data-current'));
        if (curr > 0) update(ref(db, 'inventory/' + code), { quantity: curr - 1 });
    }));

    document.querySelectorAll('.del-gear').forEach(btn => btn.addEventListener('click', (e) => {
        const code = e.target.getAttribute('data-code');
        if (confirm(`Remove item group ${code} permanently from the main store ledger?`)) {
            remove(ref(db, 'inventory/' + code));
        }
    }));
}

// 3. Dispatch - Push batch array to operations field ledger node
document.getElementById('dispatch-batch-btn').addEventListener('click', () => {
    const destination = document.getElementById('dispatch-location').value.trim();
    if (!destination) return alert('Please enter a target location venue or operational vector route.');

    const checkedBoxes = document.querySelectorAll('.gear-select-box:checked');
    if (checkedBoxes.length === 0) return alert('Select at least one checkbox category line inside the current store matrix inventory checklist layout.');

    checkedBoxes.forEach(box => {
        const row = box.closest('tr');
        const code = box.getAttribute('data-code');
        const modelText = row.cells[2].childNodes[0].textContent.trim();
        const dispatchQty = parseInt(row.querySelector('.dispatch-val').value) || 0;
        const currentStock = parseInt(row.querySelector('.add-stock').getAttribute('data-current'));

        if (dispatchQty <= 0) return;
        if (dispatchQty > currentStock) return alert(`Cannot dispatch ${dispatchQty} units of ${code}. Only ${currentStock} units available.`);

        const timestamp = new Date().toLocaleString();
        const txnId = 'TXN-' + Date.now() + '-' + Math.floor(Math.random() * 100);

        // Update remaining store stocks and push dispatch logging ticket simultaneously
        update(ref(db, 'inventory/' + code), { quantity: currentStock - dispatchQty });
        set(ref(db, 'ledger/' + txnId), {
            id: txnId,
            code: code,
            name: modelText,
            qtyOut: dispatchQty,
            user: currentCrewUser || 'ADMIN',
            location: destination,
            time: timestamp,
            status: 'Active'
        });
    });

    document.getElementById('dispatch-location').value = '';
});

// 4. Read Field Ledger Logs
onValue(ref(db, 'ledger'), (snapshot) => {
    const data = snapshot.val();
    const tbody = document.getElementById('ledger-table-body');
    tbody.innerHTML = '';

    if (!data) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:#888;">No active field deployment vectors monitored on radar at this moment.</td></tr>`;
        return;
    }

    Object.keys(data).forEach(key => {
        const tx = data[key];
        const tr = document.createElement('tr');
        
        let statusBlock = '';
        if (tx.status === 'Active') {
            statusBlock = `<button class="return-btn" data-id="${tx.id}" data-code="${tx.code}" data-qty="${tx.qtyOut}">Complete Recovery / Return to Base</button>`;
        } else {
            statusBlock = `<span class="recovered-badge">Returned ✓</span><br><small style="color:gray;">Logged recovery event tracking safe index.</small>`;
        }

        tr.innerHTML = `
            <td>${tx.code}</td>
            <td>${tx.name}</td>
            <td style="color:red; font-weight:bold;">${tx.qtyOut}</td>
            <td>👤 ${tx.user.toUpperCase()}</td>
            <td>📍 ${tx.location}</td>
            <td>⏱ ${tx.time}</td>
            <td>${statusBlock}</td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.return-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const tid = e.target.getAttribute('data-id');
        const code = e.target.getAttribute('data-code');
        const qty = parseInt(e.target.getAttribute('data-qty'));

        // Query asset root branch, pull current warehouse numbers, return them, flag transaction index
        onValue(ref(db, 'inventory/' + code), (snap) => {
            const gear = snap.val();
            const currentQty = gear ? gear.quantity : 0;
            update(ref(db, 'inventory/' + code), { quantity: currentQty + qty });
            update(ref(db, 'ledger/' + tid), { status: 'Returned' });
        }, { onlyOnce: true });
    }));
});

// --- STEP C: USER PROFILE REGISTRY MANAGEMENT HANDLERS ---
const adminPanel = document.getElementById('admin-panel');
document.getElementById('admin-panel-btn').addEventListener('click', () => {
    const accessCode = prompt("Enter Administration Gate Verification Key:");
    if (accessCode === '2010211') {
        adminPanel.style.display = 'block';
    } else {
        alert("Access Denied. Signature mismatch error.");
    }
});

document.getElementById('close-admin-btn').addEventListener('click', () => adminPanel.style.display = 'none');

document.getElementById('register-crew-btn').addEventListener('click', () => {
    const nu = document.getElementById('new-user').value.trim().toLowerCase();
    const np = document.getElementById('new-pass').value.trim();
    if(!nu || !np) return alert("Fill out credentials field rows.");

    set(ref(db, 'crew_profiles/' + nu), { username: nu, password: np }).then(() => {
        document.getElementById('new-user').value = '';
        document.getElementById('new-pass').value = '';
    });
});

onValue(ref(db, 'crew_profiles'), (snap) => {
    const data = snap.val();
    const list = document.getElementById('crew-profiles-list');
    list.innerHTML = '';
    if(data) {
        Object.keys(data).forEach(k => {
            const li = document.createElement('li');
            li.innerHTML = `⚙️ <strong>${data[k].username}</strong> <button class="del-profile-btn" data-user="${data[k].username}">Delete</button>`;
            list.appendChild(li);
        });
        document.querySelectorAll('.del-profile-btn').forEach(b => b.addEventListener('click', (ev) => {
            const targetUser = ev.target.getAttribute('data-user');
            remove(ref(db, 'crew_profiles/' + targetUser));
        }));
    }
});

// Initial boot check execution run
checkSession();
