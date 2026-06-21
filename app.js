/**
 * NAKANO COLLEGE SOUNDS CREW - SYSTEM OPERATIONS MOTOR
 * Persistent Session storage architecture with multi-user validation engines.
 */

// Global Session Variables
let authenticatedUser = ""; 

// Selection Engine States Map -> Holds { "ITEM_CODE": quantity_to_dispatch }
let stagingSelections = {};

// --- DATABASE DATA SYNCHRONIZATION ---
let inventory = JSON.parse(localStorage.getItem('ncsc_store_inventory')) || [
    { code: "SPK-01", name: "RCF 4PRO 5031-A", category: "Speakers", desc: "Active 2-way peak PA speaker", qty: 4 },
    { code: "CBL-10", name: "Speaker Cable 15m", category: "Cables/Wiring", desc: "Heavy duty 10AWG wiring speakON", qty: 6 },
    { code: "MIC-05", name: "Shure SM58 Wireless", category: "Microphones", desc: "Handheld transmitter dynamic mic", qty: 3 },
    { code: "SPD001", name: "SURE sm58", category: "Microphones", desc: "vocal mic", qty: 1 }
];

let checkouts = JSON.parse(localStorage.getItem('ncsc_field_transactions')) || [];

let crewUsers = JSON.parse(localStorage.getItem('ncsc_crew_profiles')) || [
    { username: "admin", password: "admin@ncsc", isAdmin: true },
    { username: "ncsc001sanudha", password: "123", isAdmin: true }
];

const CREW_NAMES_DICTIONARY = {
    "admin": "ADMIN",
    "ncsc001sanudha": "Sanudha"
};

// DOM Observers Hook Setup
document.getElementById('loginForm').addEventListener('submit', runPortalAuthentication);
document.getElementById('itemForm').addEventListener('submit', registerNewItem);
document.getElementById('addMemberForm').addEventListener('submit', runNewUserRegistration);
document.getElementById('logoutBtn').onclick = dropUserSession;
document.getElementById('adminConsoleBtn').onclick = initiateGateSecurityValidation;
document.getElementById('bulkDispatchBtn').onclick = processBulkDispatch;
document.getElementById('downloadReportBtn').onclick = downloadActiveFieldReport; 

// Initialize application presentation pipeline layers
document.addEventListener("DOMContentLoaded", () => {
    refreshDataViews();
});

function runPortalAuthentication(e) {
    e.preventDefault();
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value;
    const errField = document.getElementById('loginError');

    const matchedUser = crewUsers.find(u => u.username.toLowerCase() === userIn.toLowerCase() && u.password === passIn);

    if (matchedUser) {
        authenticatedUser = matchedUser.username.toLowerCase();
        errField.style.display = 'none';
        
        document.getElementById('loginCard').style.display = 'none';
        const overlay = document.getElementById('successOverlay');
        overlay.style.display = 'block';
        
        const printAliasName = CREW_NAMES_DICTIONARY[authenticatedUser] || userIn;
        document.getElementById('welcomeText').innerText = `Welcome, ${printAliasName}`;

        setTimeout(() => {
            overlay.style.display = 'none';
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('systemScreen').style.display = 'block';
            document.body.classList.remove('login-theme');
            document.body.classList.add('dashboard-theme');
            
            document.getElementById('userSessionDisplay').innerText = printAliasName;
            
            if (matchedUser.isAdmin === true || authenticatedUser === "admin" || authenticatedUser === "ncsc001sanudha") {
                document.getElementById('adminConsoleBtn').style.display = 'block';
            } else {
                document.getElementById('adminConsoleBtn').style.display = 'none';
            }
        }, 1800);
    } else {
        errField.style.display = 'block';
    }
}

function initiateGateSecurityValidation() {
    const verificationAttempt = prompt("Enter Security Gate Authorization Code:");
    if (verificationAttempt === "2010211") {
        toggleAdminPanel(true);
    } else if (verificationAttempt !== null) {
        alert("Access Denied: Invalid Console Gate Key Context.");
    }
}

function dropUserSession() {
    authenticatedUser = "";
    stagingSelections = {};
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
    
    toggleAdminPanel(false);
    document.getElementById('systemScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('loginCard').style.display = 'block';
    
    document.body.classList.remove('dashboard-theme');
    document.body.classList.add('login-theme');
}

function toggleAdminPanel(show) {
    document.getElementById('adminPanel').style.display = show ? 'block' : 'none';
}

function refreshDataViews() {
    localStorage.setItem('ncsc_field_transactions', JSON.stringify(checkouts));
    localStorage.setItem('ncsc_store_inventory', JSON.stringify(inventory));
    localStorage.setItem('ncsc_crew_profiles', JSON.stringify(crewUsers));
    
    renderInventoryTable();
    renderCheckoutTable();
    renderAdminMemberList();
    updateGlobalCounterBadge();
}

function registerNewItem(e) {
    e.preventDefault();
    const code = document.getElementById('itemCode').value.trim().toUpperCase();
    const name = document.getElementById('itemName').value.trim();
    const category = document.getElementById('itemCategory').value;
    const qty = parseInt(document.getElementById('itemQty').value);
    const desc = document.getElementById('itemDesc').value.trim();

    if(inventory.some(item => item.code === code)) {
        alert("Operation Aborted: Item code identifier already allocated within storage matrices.");
        return;
    }

    inventory.push({ code, name, category, desc, qty });
    document.getElementById('itemForm').reset();
    refreshDataViews();
}

function removeInventoryItem(code) {
    if(confirm(`Are you sure you want to permanently delete item [${code}] from store inventory?`)) {
        inventory = inventory.filter(item => item.code !== code);
        delete stagingSelections[code];
        refreshDataViews();
    }
}

function adjustInventoryQuantity(code, delta) {
    const target = inventory.find(i => i.code === code);
    if (!target) return;
    target.qty = Math.max(0, target.qty + delta);
    
    if (stagingSelections[code] && stagingSelections[code] > target.qty) {
        if(target.qty === 0) {
            delete stagingSelections[code];
        } else {
            stagingSelections[code] = target.qty;
        }
    }
    refreshDataViews();
}

function toggleItemSelection(code, isChecked) {
    const item = inventory.find(i => i.code === code);
    if (!item) return;

    if (isChecked) {
        if (item.qty <= 0) {
            alert("Stock Warning: Cannot check out an out-of-stock item.");
            document.getElementById(`chk_${code}`).checked = false;
            return;
        }
        stagingSelections[code] = 1;
    } else {
        delete stagingSelections[code];
    }
    refreshDataViews();
}

function adjustStagedQuantity(code, delta) {
    if (!stagingSelections[code]) return;

    const item = inventory.find(i => i.code === code);
    if (!item) return;

    const currentStaged = stagingSelections[code];
    const targetQty = currentStaged + delta;

    if (targetQty > item.qty) {
        alert(`Stock Boundary Alert: Only ${item.qty} units available in physical inventory store storage.`);
        return;
    }

    if (targetQty <= 0) {
        delete stagingSelections[code];
    } else {
        stagingSelections[code] = targetQty;
    }
    refreshDataViews();
}

function updateGlobalCounterBadge() {
    const count = Object.keys(stagingSelections).length;
    document.getElementById('globalSelectionCount').innerText = `${count} Line Items Marked`;
}

function processBulkDispatch() {
    const activeSelectedCodes = Object.keys(stagingSelections);

    if (activeSelectedCodes.length === 0) {
        alert("Operation Blocked: Mark at least one item row via the checkboxes before attempting dispatch.");
        return;
    }

    const locationField = document.getElementById('dispatchLocation');
    const location = locationField.value.trim();

    if (!location) {
        alert("Input Required: Please define an operational target location venue point.");
        return;
    }

    const formattedDateString = new Date().toLocaleString('en-US', { hour12: true });
    const automaticCrewId = authenticatedUser || "guest";
    const loggedDisplayName = CREW_NAMES_DICTIONARY[automaticCrewId] || automaticCrewId;

    activeSelectedCodes.forEach(code => {
        const dispatchQty = stagingSelections[code];
        const item = inventory.find(i => i.code === code);

        if (item) {
            item.qty -= dispatchQty;
            
            checkouts.push({
                id: Date.now() + Math.random(),
                code: item.code,
                name: item.name,
                qtyOut: dispatchQty,
                crewId: loggedDisplayName,
                location: location,
                outTime: formattedDateString,
                active: true,
                returnedBy: ""
            });
        }
    });

    stagingSelections = {};
    locationField.value = "";
    refreshDataViews();
    alert("System Verified: Staged deployment batch written out to field operations matrix ledger successfully.");
}

// --- NATIVE PRINT ENGINE - EXPORTS FORMAL LEDGER DIRECTLY TO PDF ---
function downloadActiveFieldReport() {
    if (checkouts.length === 0) {
        alert("Download Halt: The active field operation database ledger is currently empty.");
        return;
    }

    const printWindow = window.open('', '_blank');
    
    let tableRowsHtml = '';
    checkouts.forEach((log) => {
        tableRowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold; color: #1c3faa;">${log.code}</td>
                <td style="padding: 10px;">${log.name}</td>
                <td style="padding: 10px; font-weight: bold; color: #dc2626; text-align: center;">${log.qtyOut}</td>
                <td style="padding: 10px;">${log.crewId}</td>
                <td style="padding: 10px;">${log.location}</td>
                <td style="padding: 10px; font-size: 11px; color: #4a5568;">${log.outTime}</td>
                <td style="padding: 10px; text-align: right;">
                    <span style="padding: 3px 8px; font-size: 10px; font-weight: bold; border-radius: 10px; 
                        ${log.active ? 'background: #fef3c7; color: #92400e;' : 'background: #e2e8f0; color: #475569;'}">
                        ${log.active ? 'IN OPERATIONAL FIELD' : 'RETURNED TO STORE'}
                    </span>
                </td>
            </tr>
        `;
    });

    const printDocumentStructure = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>NCSC_Logistics_Field_Report</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a202c; margin: 30px; }
                .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1c3faa; padding-bottom: 15px; margin-bottom: 30px; }
                .title-block h1 { margin: 0; font-size: 20px; color: #0a1128; letter-spacing: 0.5px; }
                .title-block p { margin: 4px 0 0 0; font-size: 12px; color: #1c3faa; font-weight: bold; text-transform: uppercase; }
                .meta-block { text-align: right; font-size: 12px; color: #718096; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th { background-color: #f7fafc; color: #4a5568; text-transform: uppercase; font-size: 11px; font-weight: 700; text-align: left; padding: 12px 10px; border-bottom: 2px solid #cbd5e1; }
                .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 11px; color: #a0aec0; }
                @media print {
                    body { margin: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div class="title-block">
                    <h1>NAKANO COLLEGE SOUNDS CREW</h1>
                    <p>THE OFFICIAL ASSET & OPERATIONS PLATFORM</p>
                </div>
                <div class="meta-block">
                    <strong>Report Hash:</strong> NCSC-${Date.now()}<br>
                    <strong>Export Date:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Item Model</th>
                        <th style="text-align: center;">Qty Out</th>
                        <th>Crew Member</th>
                        <th>Field Location</th>
                        <th>Out Date/Time</th>
                        <th style="text-align: right;">Deployment Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            <div class="footer">
                2026 All Rights Reserved &copy; Nakano College Sound Crew &bull; Confidential Operational Ledger
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 250);
                };
            <\/script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printDocumentStructure);
    printWindow.document.close();
}

function processReturn(checkoutId) {
    const log = checkouts.find(c => c.id === checkoutId);
    if (!log || !log.active) return;

    const formattedDateString = new Date().toLocaleString('en-US', { hour12: true });
    const originalItem = inventory.find(i => i.code === log.code);
    
    if (originalItem) {
        originalItem.qty += log.qtyOut;
    } else {
        inventory.push({ code: log.code, name: log.name, category: "Accessories", desc: "Re-indexed historical inventory record", qty: log.qtyOut });
    }

    log.active = false;
    log.returnedBy = CREW_NAMES_DICTIONARY[authenticatedUser] || authenticatedUser;
    log.returnTime = formattedDateString;

    refreshDataViews();
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    inventory.forEach(item => {
        const isStaged = stagingSelections.hasOwnProperty(item.code);
        const stagedQty = isStaged ? stagingSelections[item.code] : 0;
        
        const tr = document.createElement('tr');
        if (isStaged) tr.className = "row-selected-active";
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="dispatch-checkbox" id="chk_${item.code}" 
                    ${isStaged ? 'checked' : ''} 
                    onclick="toggleItemSelection('${item.code}', this.checked)">
            </td>
            <td><strong>${item.code}</strong></td>
            <td>${item.name}</td>
            <td><span class="status-tag status-history">${item.category}</span></td>
            <td><strong style="color: var(--brand-blue); font-size:13px;">${item.qty} units</strong></td>
            <td>
                <div class="qty-stepper-container">
                    <button type="button" class="btn-step minus" ${!isStaged ? 'disabled' : ''} onclick="adjustStagedQuantity('${item.code}', -1)">-</button>
                    <span class="qty-display-val" style="color: ${isStaged ? 'var(--mega-green)' : 'var(--text-muted)'};">
                        ${stagedQty}
                    </span>
                    <button type="button" class="btn-step plus" ${!isStaged ? 'disabled' : ''} onclick="adjustStagedQuantity('${item.code}', 1)">+</button>
                </div>
            </td>
            <td style="text-align: right;">
                <button type="button" class="btn-action" style="color:var(--text-muted);" onclick="adjustInventoryQuantity('${item.code}', 1)">+</button>
                <button type="button" class="btn-action" style="color:var(--text-muted);" onclick="adjustInventoryQuantity('${item.code}', -1)">-</button>
                <button type="button" class="btn-action btn-trash" style="margin-left:8px;" onclick="removeInventoryItem('${item.code}')" title="Delete Item">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCheckoutTable() {
    const tbody = document.getElementById('checkoutBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    [...checkouts].reverse().forEach(log => {
        const tr = document.createElement('tr');
        let actionColCell = "";
        
        if(log.active) {
            actionColCell = `<span class="status-tag status-deployed">In Use Field</span>
                             <button type="button" class="btn-action btn-return" onclick="processReturn(${log.id})">Check In</button>`;
        } else {
            actionColCell = `<span class="status-tag status-history">Returned</span>
                             <div class="text-italic" style="margin-top:4px;">By: <strong>${log.returnedBy}</strong><br>${log.returnTime}</div>`;
        }

        tr.innerHTML = `
            <td><strong>${log.code}</strong></td>
            <td>${log.name}</td>
            <td><strong style="color:var(--danger); font-size:14px;">${log.qtyOut}</strong></td>
            <td>👤 <strong>${log.crewId}</strong></td>
            <td>${log.location}</td>
            <td>${log.outTime}</td>
            <td>${actionColCell}</td>
        `;
        tbody.appendChild(tr);
    });
}

function runNewUserRegistration(e) {
    e.preventDefault();
    const u = document.getElementById('newUsername').value.trim().toLowerCase();
    const p = document.getElementById('newPassword').value;

    if(!u || !p) return;
    if(crewUsers.some(user => user.username.toLowerCase() === u)) {
        alert("Registration Exception: Credential handle already reserved within operational index.");
        return;
    }

    crewUsers.push({ username: u, password: p, isAdmin: false });
    document.getElementById('addMemberForm').reset();
    refreshDataViews();
}

function dropUserRecord(username) {
    const cleanUser = username.toLowerCase();
    if(cleanUser === "admin" || cleanUser === "ncsc001sanudha") {
        alert("Authority Violation: Core system root profiles cannot be dropped.");
        return;
    }
    if(confirm(`Confirm extraction of profile resource context: [ ${username.toUpperCase()} ]?`)) {
        crewUsers = crewUsers.filter(u => u.username.toLowerCase() !== cleanUser);
        refreshDataViews();
    }
}

function modifyCrewProfile(oldUsername) {
    const cleanOldUser = oldUsername.toLowerCase();
    const targetUser = crewUsers.find(u => u.username.toLowerCase() === cleanOldUser);
    if (!targetUser) return;

    const actionSelection = prompt("What would you like to update? Type '1' for Username or '2' for Password:");
    
    if (actionSelection === "1") {
        if (cleanOldUser === "admin" || cleanOldUser === "ncsc001sanudha") {
            alert("Authority Violation: Core system root profiles cannot be modified.");
            return;
        }
        const updatedUser = prompt("Enter new username handle:", targetUser.username);
        if (!updatedUser) return;
        const cleanedUser = updatedUser.trim().toLowerCase();
        
        if (cleanedUser !== cleanOldUser && crewUsers.some(user => user.username.toLowerCase() === cleanedUser)) {
            alert("Exception: This handle is already taken.");
            return;
        }
        targetUser.username = cleanedUser;
        alert("Username verified and rewritten successfully.");
    } else if (actionSelection === "2") {
        const updatedPass = prompt("Enter new security password context:", targetUser.password);
        if (!updatedPass) return;
        targetUser.password = updatedPass;
        alert("Security password successfully rewritten.");
    } else {
        alert("Operation cancelled: Invalid option selection input.");
        return;
    }
    
    refreshDataViews();
}

function alterAdminStatus(username, makeAdmin) {
    const target = crewUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if(!target) return;
    
    if (username.toLowerCase() === "admin" || username.toLowerCase() === "ncsc001sanudha") {
        alert("Authority Lockout: Base level administrator definitions are permanently fixed.");
        return;
    }
    
    target.isAdmin = makeAdmin;
    alert(`Status Modified successfully. User context [ ${username.toUpperCase()} ] administrative rank updated.`);
    refreshDataViews();
}

function renderAdminMemberList() {
    const container = document.getElementById('memberList');
    if(!container) return;
    container.innerHTML = '';

    crewUsers.forEach(user => {
        const li = document.createElement('li');
        const roleLabel = user.isAdmin ? "<span style='color:#38bdf8; font-weight:bold;'>[Admin]</span>" : "<span style='color:var(--text-muted);'>[Crew]</span>";
        
        let adminToggleHtmlButton = "";
        if (authenticatedUser === "ncsc001sanudha") {
            if (user.username.toLowerCase() !== "admin" && user.username.toLowerCase() !== "ncsc001sanudha") {
                if (user.isAdmin) {
                    adminToggleHtmlButton = `<button type="button" class="btn-action btn-mgt-lightblue" onclick="alterAdminStatus('${user.username}', false)">Remove Admin</button>`;
                } else {
                    adminToggleHtmlButton = `<button type="button" class="btn-action btn-mgt-lightblue" onclick="alterAdminStatus('${user.username}', true)">Make Admin</button>`;
                }
            }
        }

        li.innerHTML = `
            <span>⚙️ <strong>${user.username}</strong> ${roleLabel} <small style="color:var(--text-muted); font-size:10px;">(Pass: ${user.password})</small></span>
            <div class="member-list-actions">
                ${adminToggleHtmlButton}
                <button type="button" class="btn-action btn-mgt-yellow" onclick="modifyCrewProfile('${user.username}')">Change</button>
                <button type="button" class="btn-action btn-mgt-red" onclick="dropUserRecord('${user.username}')">Delete</button>
            </div>
        `;
        container.appendChild(li);
    });
}