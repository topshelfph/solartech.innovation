/* ============================================================
   Topshelf Solar Tech — Admin Console
   Front-end implementation (localStorage persistence + simulated telemetry)
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
(function () {
    'use strict';

    // -------- Persistence helpers --------
    const STORE = 'topshelf_admin_v1';
    const defaultState = {
        creds: { user: 'admin', pass: 'solar2026' },
        pricing: { watt: 45, battery: 18000, inverter: 8500, labor: 15000 },
        clients: [],
        devices: [],
        quotes: [],
        sprinklers: [],
        triggers: { dust: true, dustThresh: 40, temp: true, tempThresh: 55, schedule: true, schedTime: '05:30', efficiency: false, rainSkip: true },
        cleaningLog: [],
        alerts: [],
        activity: []
    };

    // Populate the preset <select>s from QB_PRESETS so options stay in sync with Prices.pdf
    (function populateQbPresetDropdown() {
        try {
            const ids = ['qbPreset', 'apPreset', 'mqPreset'];
            if (typeof QB_PRESETS !== 'object') return;
            ids.forEach(id => {
                const sel = document.getElementById(id);
                if (!sel) return;
                // Remove any existing options except the first placeholder
                while (sel.options.length > 1) sel.remove(1);
                Object.entries(QB_PRESETS).forEach(([key, val]) => {
                    const opt = document.createElement('option');
                    opt.value = key;
                    opt.textContent = val.label || key;
                    sel.appendChild(opt);
                });
            });
        } catch (e) { console.error('populateQbPresetDropdown error', e); }
    })();
    function load() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORE) || '{}');
            const merged = Object.assign({}, defaultState, stored);
            merged.creds    = Object.assign({}, defaultState.creds,    stored.creds    || {});
            merged.pricing  = Object.assign({}, defaultState.pricing,  stored.pricing  || {});
            merged.triggers = Object.assign({}, defaultState.triggers, stored.triggers || {});
            if (!merged.creds.user) merged.creds.user = defaultState.creds.user;
            if (!merged.creds.pass) merged.creds.pass = defaultState.creds.pass;
            return merged;
        } catch (e) { return JSON.parse(JSON.stringify(defaultState)); }
    }
    function save() { localStorage.setItem(STORE, JSON.stringify(state)); }
    let state = load();

    // -------- Util --------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const fmtMoney = n => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const uid = (p = 'ID') => p + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const nowStr = () => new Date().toLocaleString('en-PH', { hour12: false });
    function toast(msg, type = 'success') {
        const el = $('#toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'toast show ' + type;
        clearTimeout(toast._t);
        toast._t = setTimeout(() => el.classList.remove('show'), 2800);
    }
    function logActivity(text, type = 'info', icon = 'fa-circle-info') {
        state.activity.unshift({ text, type, icon, time: nowStr() });
        state.activity = state.activity.slice(0, 50);
        save(); renderActivity();
    }
    function pushAlert(text, type = 'warn', icon = 'fa-triangle-exclamation') {
        state.alerts.unshift({ text, type, icon, time: nowStr(), read: false });
        state.alerts = state.alerts.slice(0, 100);
        save(); renderAlerts();
    }

    // -------- AUTH (login UI handled by inline script in admin.html) --------
    $('#logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('admin_auth');
        location.reload();
    });

    // boot() is called by inline script via window.__adminBoot after successful login
    // also called here if the page loads with admin_auth already set in sessionStorage
    function boot() {
        const cu = $('#currentUser'); if (cu) cu.textContent = state.creds.user || 'admin';
        if (state.clients.length === 0) seedDemoData();
        // Phase 18 (v=20260427f) — one-shot reseed: ensure the full Aparri/Gattaran/Carig/Linao roster is present.
        if (!localStorage.getItem('tss_seeded_v18')) {
            seedDemoData(true);
            localStorage.setItem('tss_seeded_v18', '1');
            localStorage.setItem('tss_healed_v17', '1'); // freshly seeded — no need to re-heal
            logActivity('Client roster refreshed — 15 demo clients seeded (Aparri, Gattaran, Camalaniugan, Sta. Ana, Gonzaga, Carig & Linao Tuguegarao)', 'success', 'fa-database');
        }
        // Phase 17 (v=20260427d) — one-shot heal: bring every device back ONLINE.
        if (!localStorage.getItem('tss_healed_v17')) {
            let healed = 0;
            (state.devices || []).forEach(d => {
                if (d.status && d.status !== 'ok') { d.status = 'ok'; healed++; }
                if (d.type === 'panel') { d.soiling = 0; }
            });
            localStorage.setItem('tss_healed_v17', '1');
            if (healed > 0) {
                save();
                logActivity(`System maintenance — ${healed} device(s) restored to ONLINE`, 'success', 'fa-heart-pulse');
            }
        }
        loadSettingsForm();
        bindTriggers();
        renderClients();
        renderDevices();
        renderSprinklers();
        renderQuoteHistory();
        renderActivity();
        renderAlerts();
        renderCleaningLog();
        renderDashboard();
        simulateTelemetry();
        renderDashboard();
    }

    // Expose boot so inline auth script can call it
    window.__adminBoot = boot;

    // If page reloaded while already authenticated, run boot immediately
    if (sessionStorage.getItem('admin_auth') === '1') {
        try { boot(); } catch (err) { console.error('[Admin] boot error:', err); }
    }

    // -------- NAV --------
    $$('.nav-item').forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        $$('.nav-item').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        const v = a.dataset.view;
        $$('.view').forEach(x => x.classList.toggle('active', x.dataset.view === v));
        $('#sidebar').classList.remove('open');
    }));
    $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

    // -------- CLOCK --------
    function tickClock() { $('#liveClock').textContent = new Date().toLocaleTimeString('en-PH', { hour12: false }); }
    setInterval(tickClock, 1000); tickClock();

    // ============ CLIENTS ============
    function renderClients() {
        const tb = $('#clientTable');
        const search = ($('#clientSearch').value || '').toLowerCase();
        const sel = $('#monClientFilter');
        sel.innerHTML = '<option value="">All Clients</option>';
        tb.innerHTML = '';
        state.clients
            .filter(c => !search || c.name.toLowerCase().includes(search) || c.id.toLowerCase().includes(search))
            .forEach(c => {
                const devCount = state.devices.filter(d => d.clientId === c.id).length;
                const faulty = state.devices.filter(d => d.clientId === c.id && d.status === 'fault').length;
                const status = faulty > 0
                    ? `<span class="dot red"></span> ${faulty} Fault`
                    : `<span class="dot green"></span> Healthy`;
                tb.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td><strong>${c.id}</strong></td>
                        <td>${c.name}</td>
                        <td>${c.location || '-'}</td>
                        <td>${devCount}</td>
                        <td>${status}</td>
                        <td>${c.installed || '-'}</td>
                        <td class="actions">
                            <button data-act="view" data-id="${c.id}"><i class="fas fa-eye"></i></button>
                            <button data-act="edit" data-id="${c.id}"><i class="fas fa-pen"></i></button>
                            <button data-act="del" data-id="${c.id}" class="del"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`);
                sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.id} — ${c.name}</option>`);
            });
        $('#statClients').textContent = state.clients.length;
    }
    $('#clientSearch').addEventListener('input', renderClients);
    $('#clientTable').addEventListener('click', e => {
        const btn = e.target.closest('button'); if (!btn) return;
        const id = btn.dataset.id, act = btn.dataset.act;
        if (act === 'del') {
            if (confirm('Delete client ' + id + ' and all associated devices?')) {
                state.clients = state.clients.filter(c => c.id !== id);
                state.devices = state.devices.filter(d => d.clientId !== id);
                state.sprinklers = state.sprinklers.filter(s => s.clientId !== id);
                save(); renderClients(); renderDevices(); renderSprinklers();
                logActivity(`Client ${id} removed`, 'warn', 'fa-user-minus');
            }
        } else if (act === 'edit') openClientModal(id);
        else if (act === 'view') viewClientDetail(id);
    });
    $('#addClientBtn').addEventListener('click', () => openClientModal());

    function openClientModal(editId) {
        const c = editId ? state.clients.find(x => x.id === editId) : null;
        modal('Client', `
            <div class="form-group"><label>Full Name</label><input id="cfName" value="${c?.name || ''}"></div>
            <div class="form-group"><label>Location</label><input id="cfLoc" value="${c?.location || ''}"></div>
            <div class="form-group"><label>Contact #</label><input id="cfPhone" value="${c?.phone || ''}"></div>
            <div class="form-group"><label>System Size (kW)</label><input type="number" id="cfKw" step="0.1" value="${c?.systemKw || 3}"></div>
            <div class="form-group"><label># of Solar Panels</label><input type="number" id="cfPanels" value="${c?.panelCount || 6}"></div>
            <div class="form-group"><label># of Sprinklers</label><input type="number" id="cfSpr" value="${c?.sprinklerCount || 2}"></div>
            <button class="btn-primary" id="cfSave"><i class="fas fa-save"></i> Save</button>
        `);
        $('#cfSave').addEventListener('click', () => {
            const data = {
                id: c?.id || uid('CL'),
                name: $('#cfName').value.trim(),
                location: $('#cfLoc').value.trim(),
                phone: $('#cfPhone').value.trim(),
                systemKw: +$('#cfKw').value,
                panelCount: +$('#cfPanels').value,
                sprinklerCount: +$('#cfSpr').value,
                installed: c?.installed || new Date().toISOString().slice(0, 10)
            };
            if (!data.name) return toast('Name is required', 'error');
            if (c) Object.assign(c, data);
            else {
                state.clients.push(data);
                provisionDevicesForClient(data);
                logActivity(`New client onboarded: ${data.name} (${data.id})`, 'success', 'fa-user-plus');
            }
            save(); closeModal(); renderClients(); renderDevices(); renderSprinklers();
            toast('Client saved');
        });
    }

    // ---- Per-client realistic profile (weather + load shape) ----
    const WEATHER_OPTS = [
        { key: 'sunny',   label: 'Sunny',          icon: 'fa-sun',           irrFactor: 1.00, color: '#f59e0b' },
        { key: 'partly',  label: 'Partly Cloudy',  icon: 'fa-cloud-sun',     irrFactor: 0.78, color: '#fbbf24' },
        { key: 'cloudy',  label: 'Cloudy',         icon: 'fa-cloud',         irrFactor: 0.45, color: '#94a3b8' },
        { key: 'rain',    label: 'Light Rain',     icon: 'fa-cloud-showers-heavy', irrFactor: 0.22, color: '#60a5fa' }
    ];
    function pickWeather() {
        // weighted toward sunny in Cagayan dry season
        const r = Math.random();
        if (r < 0.55) return 'sunny';
        if (r < 0.85) return 'partly';
        if (r < 0.97) return 'cloudy';
        return 'rain';
    }
    function ensureClientProfile(c) {
        if (!c.profile) {
            c.profile = {
                weather: pickWeather(),
                baseLoadKw: +(0.25 + Math.random() * 0.4).toFixed(2),   // always-on load
                peakLoadKw: +(c.systemKw * (0.55 + Math.random() * 0.35)).toFixed(2),
                panelW: 320, // nominal STC wattage per panel
                batteryKwh: +(c.systemKw * 2).toFixed(1) // typical 2 kWh per kW system
            };
        }
    }

    function provisionDevicesForClient(c) {
        ensureClientProfile(c);
        for (let i = 1; i <= c.panelCount; i++) {
            state.devices.push({
                id: uid('PNL'), clientId: c.id, type: 'panel',
                name: `Solar Panel #${i}`, status: 'ok',
                nominalW: c.profile.panelW,
                output: 0, temp: 32, soiling: Math.random() * 18,
                history: [], lastSeen: nowStr()
            });
        }
        state.devices.push({
            id: uid('INV'), clientId: c.id, type: 'inverter', name: 'Hybrid Inverter',
            status: 'ok', capacityW: c.systemKw * 1000, output: 0, temp: 38, efficiency: 0.96,
            history: [], lastSeen: nowStr()
        });
        state.devices.push({
            id: uid('CTR'), clientId: c.id, type: 'controller', name: 'MPPT Charge Controller',
            status: 'ok', voltage: 48, current: 0, history: [], lastSeen: nowStr()
        });
        state.devices.push({
            id: uid('BAT'), clientId: c.id, type: 'battery', name: 'Battery Bank',
            status: 'ok', capacityKwh: c.profile.batteryKwh,
            soc: 70 + Math.random() * 25, voltage: 51.2, currentA: 0, mode: 'idle',
            cycles: Math.floor(Math.random() * 80), health: 98 + Math.random() * 2,
            history: [], lastSeen: nowStr()
        });
        for (let i = 1; i <= c.sprinklerCount; i++) {
            const sid = uid('SPR');
            state.devices.push({ id: sid, clientId: c.id, type: 'sprinkler', name: `Sprinkler Zone ${i}`, status: 'ok', spraying: false, lastSeen: nowStr() });
            state.sprinklers.push({ id: sid, clientId: c.id, name: `${c.name} — Zone ${i}`, spraying: false, lastClean: '—' });
        }
    }

    // Migrate existing devices loaded from localStorage that lack new fields
    function migrateDevices() {
        state.clients.forEach(ensureClientProfile);
        state.devices.forEach(d => {
            if (!d.history) d.history = [];
            if (d.type === 'panel' && !d.nominalW) d.nominalW = 320;
            if (d.type === 'inverter' && !d.capacityW) {
                const c = state.clients.find(x => x.id === d.clientId);
                d.capacityW = c ? c.systemKw * 1000 : 5000;
                d.efficiency = d.efficiency || 0.96;
            }
            if (d.type === 'battery') {
                if (!d.capacityKwh) {
                    const c = state.clients.find(x => x.id === d.clientId);
                    d.capacityKwh = c ? (c.profile ? c.profile.batteryKwh : c.systemKw * 2) : 10;
                }
                if (d.currentA == null) d.currentA = 0;
                if (!d.mode) d.mode = 'idle';
                if (d.cycles == null) d.cycles = 0;
                if (d.health == null) d.health = 99;
            }
        });
    }
    migrateDevices();

    function viewClientDetail(id) {
        const c = state.clients.find(x => x.id === id); if (!c) return;
        const devs = state.devices.filter(d => d.clientId === id);
        const list = devs.map(d => {
            const status = d.status === 'fault' ? '<span class="dot red"></span>' : d.status === 'warn' ? '<span class="dot yellow"></span>' : '<span class="dot green"></span>';
            return `<li style="padding:8px;background:var(--panel-2);margin:4px 0;border-radius:6px">${status} <strong>${d.id}</strong> — ${d.name} <small style="color:var(--muted)">(${d.type})</small></li>`;
        }).join('');
        modal(`Client ${c.id}`, `
            <h4 style="color:var(--primary)">${c.name}</h4>
            <p style="color:var(--muted);margin-bottom:14px">${c.location} • ${c.phone || 'No phone'}</p>
            <div class="recom-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
                <div class="recom-item" style="background:var(--panel-2);padding:10px;border-radius:8px"><small style="color:var(--muted)">System Size</small><strong>${c.systemKw} kW</strong></div>
                <div class="recom-item" style="background:var(--panel-2);padding:10px;border-radius:8px"><small style="color:var(--muted)">Installed</small><strong>${c.installed}</strong></div>
                <div class="recom-item" style="background:var(--panel-2);padding:10px;border-radius:8px"><small style="color:var(--muted)">Panels</small><strong>${c.panelCount}</strong></div>
                <div class="recom-item" style="background:var(--panel-2);padding:10px;border-radius:8px"><small style="color:var(--muted)">Sprinklers</small><strong>${c.sprinklerCount}</strong></div>
            </div>
            <h5 style="margin-bottom:8px;color:var(--primary)">Linked Devices (${devs.length})</h5>
            <ul style="list-style:none;max-height:280px;overflow-y:auto">${list || '<li>No devices</li>'}</ul>
        `);
    }

    // ============ DEVICES (MONITORING) ============
    // Build a small inline SVG sparkline from a numeric history array
    function sparkline(values, color, max) {
        if (!values || values.length < 2) return '';
        const w = 100, h = 22, pad = 2;
        const m = max != null ? max : Math.max.apply(null, values.concat([1]));
        const step = (w - pad * 2) / (values.length - 1);
        const pts = values.map((v, i) => {
            const x = pad + i * step;
            const y = h - pad - (Math.max(0, v) / (m || 1)) * (h - pad * 2);
            return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
        const last = values[values.length - 1];
        const lx = pad + (values.length - 1) * step;
        const ly = h - pad - (Math.max(0, last) / (m || 1)) * (h - pad * 2);
        return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
            <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="1.8" fill="${color}"/>
        </svg>`;
    }

    function weatherInfo(key) {
        return WEATHER_OPTS.find(w => w.key === key) || WEATHER_OPTS[0];
    }

    function renderDevices() {
        const grid = $('#deviceGrid');
        if (!grid) return;
        const cFilter = $('#monClientFilter').value;
        const tFilter = $('#monTypeFilter').value;

        const clientList = cFilter
            ? state.clients.filter(c => c.id === cFilter)
            : state.clients;

        if (clientList.length === 0) {
            grid.innerHTML = '<p class="muted">No clients yet. Add one in the Clients view.</p>';
            return;
        }

        const iconMap = { panel: 'fa-solar-panel', inverter: 'fa-plug-circle-bolt', controller: 'fa-microchip', battery: 'fa-car-battery', sprinkler: 'fa-shower' };

        grid.innerHTML = clientList.map(c => {
            ensureClientProfile(c);
            let devs = state.devices.filter(d => d.clientId === c.id);
            if (tFilter) devs = devs.filter(d => d.type === tFilter);

            const panels   = devs.filter(d => d.type === 'panel');
            const inv      = devs.find(d => d.type === 'inverter');
            const bat      = devs.find(d => d.type === 'battery');
            const genKw    = panels.reduce((s, d) => s + (d.output || 0), 0) / 1000;
            const loadKw   = c._loadNow != null ? c._loadNow : c.profile.baseLoadKw;
            const w        = weatherInfo(c.profile.weather);
            const faults   = devs.filter(d => d.status === 'fault').length;
            const warns    = devs.filter(d => d.status === 'warn').length;
            const statusKey = faults ? 'fault' : warns ? 'warn' : 'ok';
            const statusLbl = faults ? `${faults} FAULT` : warns ? `${warns} WARN` : 'HEALTHY';
            const balance  = genKw - loadKw; // positive = surplus

            const cards = devs.map(d => {
                const cls = d.status === 'fault' ? 'fault' : d.status === 'warn' ? 'warn' : '';
                const tag = d.status === 'fault' ? 'FAULT' : d.status === 'warn' ? 'WARN' : 'ONLINE';
                let stats = '';
                let extra = '';
                if (d.type === 'panel') {
                    const pct = d.nominalW ? (d.output / d.nominalW * 100) : 0;
                    stats = `
                        <div><small>Output</small><strong>${(d.output || 0).toFixed(0)} W</strong></div>
                        <div><small>Yield</small><strong>${pct.toFixed(0)}%</strong></div>
                        <div><small>Cell Temp</small><strong>${(d.temp || 0).toFixed(1)}°C</strong></div>
                        <div><small>Soiling</small><strong>${(d.soiling || 0).toFixed(0)}%</strong></div>`;
                    extra = `<div class="bar"><span style="width:${Math.min(100, Math.max(0, pct)).toFixed(0)}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></span></div>
                             ${sparkline(d.history, '#f59e0b', d.nominalW)}`;
                } else if (d.type === 'inverter') {
                    const kw = (d.output || 0) / 1000;
                    const cap = (d.capacityW || 5000) / 1000;
                    const ld  = cap ? (kw / cap * 100) : 0;
                    stats = `
                        <div><small>AC Output</small><strong>${kw.toFixed(2)} kW</strong></div>
                        <div><small>Load</small><strong>${ld.toFixed(0)}%</strong></div>
                        <div><small>Efficiency</small><strong>${((d.efficiency || 0.96) * 100).toFixed(1)}%</strong></div>
                        <div><small>Temp</small><strong>${(d.temp || 0).toFixed(1)}°C</strong></div>`;
                    extra = `<div class="bar"><span style="width:${Math.min(100, ld).toFixed(0)}%;background:linear-gradient(90deg,#10b981,#34d399)"></span></div>
                             ${sparkline(d.history, '#10b981', d.capacityW)}`;
                } else if (d.type === 'controller') {
                    stats = `
                        <div><small>Voltage</small><strong>${(d.voltage || 0).toFixed(1)} V</strong></div>
                        <div><small>Current</small><strong>${(d.current || 0).toFixed(1)} A</strong></div>
                        <div><small>DC Power</small><strong>${(d.voltage * d.current / 1000).toFixed(2)} kW</strong></div>
                        <div><small>State</small><strong>${(d.current || 0) > 0.5 ? 'MPPT' : 'IDLE'}</strong></div>`;
                    extra = sparkline(d.history, '#60a5fa');
                } else if (d.type === 'battery') {
                    const soc = d.soc || 0;
                    const socColor = soc < 25 ? '#ef4444' : soc < 50 ? '#facc15' : '#10b981';
                    const modeLbl = d.mode === 'charge' ? 'CHARGING ↑' : d.mode === 'discharge' ? 'DISCHARGING ↓' : 'IDLE';
                    stats = `
                        <div><small>State of Charge</small><strong style="color:${socColor}">${soc.toFixed(1)}%</strong></div>
                        <div><small>Mode</small><strong>${modeLbl}</strong></div>
                        <div><small>Voltage</small><strong>${(d.voltage || 0).toFixed(2)} V</strong></div>
                        <div><small>Current</small><strong>${(d.currentA || 0).toFixed(1)} A</strong></div>
                        <div><small>Capacity</small><strong>${(d.capacityKwh || 0).toFixed(1)} kWh</strong></div>
                        <div><small>Health</small><strong>${(d.health || 99).toFixed(0)}%</strong></div>`;
                    extra = `<div class="bar"><span style="width:${Math.min(100, soc).toFixed(0)}%;background:${socColor}"></span></div>
                             ${sparkline(d.history, socColor, 100)}`;
                } else if (d.type === 'sprinkler') {
                    stats = `
                        <div><small>State</small><strong style="color:${d.spraying ? '#10b981' : 'var(--muted)'}">${d.spraying ? 'SPRAYING' : 'IDLE'}</strong></div>
                        <div><small>Last Clean</small><strong>${d.lastClean || '—'}</strong></div>`;
                }

                return `<div class="device-card ${cls}" data-dev-id="${d.id}">
                    <span class="status-tag">${tag}</span>
                    <div class="dev-head">
                        <h4><span class="dev-icon"><i class="fas ${iconMap[d.type]}"></i></span> ${d.name}</h4>
                    </div>
                    <div class="dev-meta">${d.id} • last seen ${d.lastSeen}</div>
                    <div class="dev-stats">${stats}</div>
                    ${extra}
                </div>`;
            }).join('') || '<p class="muted" style="grid-column:1/-1">No devices match the type filter.</p>';

            const balanceLbl = balance >= 0
                ? `<span style="color:#10b981">+${balance.toFixed(2)} kW surplus</span>`
                : `<span style="color:#ef4444">${balance.toFixed(2)} kW deficit</span>`;

            return `
            <section class="client-block status-${statusKey}">
                <header class="client-block-head">
                    <div class="cb-title">
                        <h3><i class="fas fa-house-signal"></i> ${c.name}</h3>
                        <small>${c.id} • ${c.location} • ${c.systemKw} kW system</small>
                    </div>
                    <div class="cb-weather" title="${w.label}">
                        <i class="fas ${w.icon}" style="color:${w.color}"></i>
                        <span>${w.label}</span>
                    </div>
                    <div class="cb-kpis">
                        <div><small>Generation</small><strong style="color:#f59e0b">${genKw.toFixed(2)} kW</strong></div>
                        <div><small>Load</small><strong style="color:#60a5fa">${loadKw.toFixed(2)} kW</strong></div>
                        <div><small>Battery SoC</small><strong>${bat ? bat.soc.toFixed(0) + '%' : '—'}</strong></div>
                        <div><small>Net</small><strong>${balanceLbl}</strong></div>
                    </div>
                    <div class="cb-status ${statusKey}">${statusLbl}</div>
                </header>
                <div class="device-grid">${cards}</div>
            </section>`;
        }).join('');

        const sg = $('#statGen'); if (sg) sg.textContent = state.devices.filter(d => d.type === 'panel').reduce((s, d) => s + (d.output || 0) / 1000, 0).toFixed(2) + ' kW';
        const sp = $('#statPanels'); if (sp) sp.textContent = state.devices.filter(d => d.type === 'panel' && d.status === 'ok').length;
        const sf = $('#statFaults'); if (sf) sf.textContent = state.devices.filter(d => d.status === 'fault').length;
    }
    $('#monClientFilter').addEventListener('change', renderDevices);
    $('#monTypeFilter').addEventListener('change', renderDevices);
    $('#refreshDevices').addEventListener('click', () => { simulateTelemetry(); renderDevices(); toast('Telemetry refreshed'); });

    // ============ TELEMETRY SIMULATOR (physics-ish, real-time) ============
    // Solar irradiance curve based on real local time
    function solarIrradiance(now) {
        const h = now.getHours() + now.getMinutes() / 60;
        // peak at solar noon (~12:30), zero before 5:30 and after 18:30
        if (h < 5.5 || h > 18.5) return 0;
        const x = (h - 5.5) / 13;       // 0..1 across daylight
        return Math.max(0, Math.sin(x * Math.PI));   // smooth bell
    }
    // small per-tick weather drift (each client's weather can change rarely)
    function maybeShiftWeather(c) {
        if (Math.random() < 0.004) {
            const old = c.profile.weather;
            c.profile.weather = pickWeather();
            if (c.profile.weather !== old) {
                logActivity(`${c.name} — weather changed to ${weatherInfo(c.profile.weather).label}`, 'info', weatherInfo(c.profile.weather).icon);
            }
        }
    }
    // Approximate household load at a given hour (kW), normalized to peak
    function loadShape(hour, base, peak) {
        // morning bump (6-8), midday dip, evening peak (17-21)
        const morning = Math.exp(-Math.pow((hour - 7) / 1.4, 2)) * 0.55;
        const evening = Math.exp(-Math.pow((hour - 19) / 1.8, 2));
        const noise   = (Math.random() - 0.5) * 0.08;
        const factor  = Math.min(1, Math.max(0, morning + evening + noise));
        return base + (peak - base) * factor;
    }

    const TICK_SECONDS = 2;
    function simulateTelemetry() {
        const now = new Date();
        const hour = now.getHours() + now.getMinutes() / 60;
        const irr  = solarIrradiance(now);
        let totalGenKw = 0;

        state.clients.forEach(c => {
            ensureClientProfile(c);
            maybeShiftWeather(c);
            const w = weatherInfo(c.profile.weather);
            const localIrr = irr * w.irrFactor * (0.92 + Math.random() * 0.16);  // cloud flicker
            c._loadNow = +loadShape(hour, c.profile.baseLoadKw, c.profile.peakLoadKw).toFixed(3);

            const clientDevs = state.devices.filter(d => d.clientId === c.id);
            const panels = clientDevs.filter(d => d.type === 'panel');
            const inv    = clientDevs.find(d => d.type === 'inverter');
            const ctrl   = clientDevs.find(d => d.type === 'controller');
            const bat    = clientDevs.find(d => d.type === 'battery');

            // --- Panels: physics-ish output ---
            let arrayDcW = 0;
            panels.forEach(p => {
                p.lastSeen = nowStr();
                // tiny chance of fault (0.05% per tick)
                if (p.status === 'ok' && Math.random() < 0.0005) {
                    p.status = 'fault';
                    pushAlert(`${c.name} — ${p.name} (${p.id}) reported fault`, 'error', 'fa-bolt');
                }
                // soiling slowly accumulates; rain washes it
                if (c.profile.weather === 'rain') p.soiling = Math.max(0, p.soiling - 0.6);
                else p.soiling = Math.min(100, p.soiling + 0.02);
                // cell temperature: ambient ~ 28 + irr*25, derate output above 25°C
                const ambient = 27 + localIrr * 22 + (Math.random() - 0.5) * 2;
                p.temp = ambient + localIrr * 8;          // panel temp > ambient under sun
                const tempDerate = Math.max(0, (p.temp - 25) * 0.004);  // 0.4%/°C above 25
                const soilDerate = (p.soiling || 0) / 100 * 0.6;
                if (p.status === 'fault') {
                    p.output = 0;
                } else {
                    p.output = Math.max(0, p.nominalW * localIrr * (1 - tempDerate) * (1 - soilDerate));
                }
                p.history.push(+p.output.toFixed(0));
                if (p.history.length > 60) p.history.shift();
                arrayDcW += p.output;
            });

            // --- Controller: routes DC from array to battery/inverter ---
            if (ctrl) {
                ctrl.lastSeen = nowStr();
                ctrl.voltage = 48 + (Math.random() - 0.5) * 1.2;
                ctrl.current = +(arrayDcW / Math.max(1, ctrl.voltage)).toFixed(1);
                ctrl.history.push(+arrayDcW.toFixed(0));
                if (ctrl.history.length > 60) ctrl.history.shift();
            }

            // --- Inverter: AC output = min(load, gen + battery discharge), clamped to capacity ---
            let invAcW = 0;
            if (inv) {
                inv.lastSeen = nowStr();
                if (inv.status === 'ok' && Math.random() < 0.0003) {
                    inv.status = 'fault';
                    pushAlert(`${c.name} — Inverter (${inv.id}) faulted`, 'error', 'fa-bolt');
                }
                const dcAvailableW = arrayDcW + (bat && bat.soc > 20 ? Math.max(0, c._loadNow * 1000 - arrayDcW) : 0);
                const wanted = Math.min(c._loadNow * 1000, dcAvailableW);
                invAcW = inv.status === 'fault' ? 0 : Math.min(inv.capacityW, wanted) * inv.efficiency;
                inv.output = invAcW;
                // efficiency drifts slightly with load
                const ld = invAcW / Math.max(1, inv.capacityW);
                inv.efficiency = +(0.94 + ld * 0.04 - Math.random() * 0.01).toFixed(3);
                inv.temp = 36 + ld * 18 + (Math.random() - 0.5) * 2;
                inv.history.push(+invAcW.toFixed(0));
                if (inv.history.length > 60) inv.history.shift();
            }

            // --- Battery: integrate SoC from net flow over TICK_SECONDS ---
            if (bat) {
                bat.lastSeen = nowStr();
                const loadW = c._loadNow * 1000;
                // surplus charges, deficit discharges
                const netW  = arrayDcW - loadW;
                const dE_kWh = (netW / 1000) * (TICK_SECONDS / 3600);  // delta energy this tick
                const oldSoc = bat.soc;
                bat.soc = Math.max(5, Math.min(100, bat.soc + (dE_kWh / Math.max(0.1, bat.capacityKwh)) * 100));
                bat.currentA = +(netW / 51.2).toFixed(1);
                bat.voltage = +(48 + (bat.soc / 100) * 6 + (Math.random() - 0.5) * 0.2).toFixed(2);
                bat.mode = netW > 50 ? 'charge' : netW < -50 ? 'discharge' : 'idle';
                if (oldSoc < bat.soc) bat.cycles += dE_kWh / Math.max(0.1, bat.capacityKwh) * 0.5;
                bat.history.push(+bat.soc.toFixed(1));
                if (bat.history.length > 60) bat.history.shift();
                // SoC alerts
                if (bat.soc < 20 && oldSoc >= 20) pushAlert(`${c.name} — battery low (${bat.soc.toFixed(0)}%)`, 'warn', 'fa-battery-quarter');
                if (bat.soc >= 99 && oldSoc < 99) logActivity(`${c.name} — battery fully charged`, 'success', 'fa-battery-full');
            }

            totalGenKw += arrayDcW / 1000;
        });

        const sg = $('#statGen'); if (sg) sg.textContent = totalGenKw.toFixed(2) + ' kW';

        // auto sprinkler triggers
        if (typeof checkAutoTriggers === 'function') checkAutoTriggers();
    }

    // Real-time tick — runs every TICK_SECONDS
    setInterval(() => {
        simulateTelemetry();
        const monView = $('section[data-view="monitoring"]');
        const dashView = $('section[data-view="dashboard"]');
        if (monView && monView.classList.contains('active')) renderDevices();
        if (dashView && dashView.classList.contains('active')) renderDashboard();
        save();
    }, TICK_SECONDS * 1000);

    // ============ DASHBOARD ============
    let genChart;
    function renderDashboard() {
        $('#statClients').textContent = state.clients.length;
        $('#statPanels').textContent = state.devices.filter(d => d.type === 'panel' && d.status === 'ok').length;
        $('#statFaults').textContent = state.devices.filter(d => d.status === 'fault').length;
        const totalGen = state.devices.filter(d => d.type === 'panel').reduce((s, d) => s + (d.output || 0) / 1000, 0);
        $('#statGen').textContent = totalGen.toFixed(1) + ' kWh';

        // Health
        const total = state.devices.length || 1;
        const ok = state.devices.filter(d => d.status === 'ok').length;
        const faults = state.devices.filter(d => d.status === 'fault').length;
        const warns = state.devices.filter(d => d.status === 'warn').length;
        $('#healthList').innerHTML = `
            <div class="health-row"><span class="label">Operational devices</span><span class="val"><span class="dot green"></span>${ok} (${(ok / total * 100).toFixed(0)}%)</span></div>
            <div class="health-row"><span class="label">Faulty devices</span><span class="val"><span class="dot red"></span>${faults}</span></div>
            <div class="health-row"><span class="label">Warnings</span><span class="val"><span class="dot yellow"></span>${warns}</span></div>
            <div class="health-row"><span class="label">Active sprinklers</span><span class="val"><span class="dot green"></span>${state.sprinklers.filter(s => s.spraying).length}/${state.sprinklers.length}</span></div>
            <div class="health-row"><span class="label">Unread alerts</span><span class="val"><span class="dot yellow"></span>${state.alerts.filter(a => !a.read).length}</span></div>
        `;

        // chart
        const ctx = $('#genChart');
        if (ctx && window.Chart) {
            const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            const sun = i => Math.max(0, Math.sin(((i - 6) / 12) * Math.PI));
            const data = labels.map((_, i) => +(sun(i) * (state.devices.filter(d => d.type === 'panel').length * 0.3) + Math.random() * 0.4).toFixed(2));
            if (genChart) { genChart.data.datasets[0].data = data; genChart.update('none'); }
            else {
                genChart = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets: [{ label: 'kWh', data, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.2)', fill: true, tension: .4 }] },
                    options: { responsive: true, plugins: { legend: { labels: { color: '#e2e8f0' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
                });
            }
        }
    }

    function renderActivity() {
        $('#activityFeed').innerHTML = state.activity.slice(0, 12).map(a => `
            <li class="${a.type}"><i class="fas ${a.icon}"></i><span class="meta">${a.text}</span><time>${a.time}</time></li>
        `).join('') || '<li class="meta muted">No activity yet.</li>';
    }

    // ============ ALERTS ============
    function renderAlerts() {
        $('#alertList').innerHTML = state.alerts.map(a => `
            <li class="${a.type}"><i class="fas ${a.icon}"></i><span class="meta">${a.text}</span><time>${a.time}</time></li>
        `).join('') || '<li class="meta muted">No alerts.</li>';
        const unread = state.alerts.filter(a => !a.read).length;
        $('#alertBadge').textContent = unread;
        $('#alertBadge').style.display = unread ? '' : 'none';
    }
    $('.nav-item[data-view="alerts"]').addEventListener('click', () => {
        state.alerts.forEach(a => a.read = true); save(); renderAlerts();
    });

    // ============ QUOTATION — BUILDER (manual, based on Quotation.docx) ============

    /* ---- PRESETS (aligned to Prices.pdf) ---- */
    // Replaced the older Quotation.docx presets with the canonical Price.pdf options.
    const QB_PRESETS = {
        A: {
            label: 'Option A · 1,500W+ Setup',
            dailyKwh: 24.33, systemKw: 3, peakW: 1500,
            rows: [
                { name: 'Solar PV Array',     detail: 'Tier-1 Panels', panelW: 1000, qty: 3, price: 19033.33 },
                { name: 'Hybrid Inverter',    detail: '5kW Dual MPPT High-Voltage (Power Inverter)', invKw: 5,  qty: 1, price: 40000 },
                { name: 'Battery Storage',    detail: '5kWh Battery (1× 5.12kWh unit)', batKwh: 5,  qty: 1, price: 25000 },
                { name: 'Mounting Kit',       detail: 'AL6005-T5 Aluminum Rails (250kph Wind Rating)', qty: 1, price: 15000 },
                { name: 'Electrical BOS',     detail: 'DC/AC Protection, 4mm Solar Cables, Grounding', qty: 1, price: 20000 },
                { name: 'Installation & Labor', detail: 'Professional Engineering & PEE Sign-off', qty: 1, price: 20000 }
            ]
        },
        B: {
            label: 'Option B · 3,500W+ Setup',
            dailyKwh: 34.98, systemKw: 5, peakW: 3500,
            rows: [
                { name: 'Solar PV Array',     detail: 'Tier-1 Panels', panelW: 1000, qty: 5, price: 15700 },
                { name: 'Hybrid Inverter',    detail: '10kW Dual MPPT High-Voltage (Power Inverter)', invKw: 10, qty: 1, price: 95000 },
                { name: 'Battery Storage',    detail: '10kWh Battery (2× 5.12kWh units)', batKwh: 10, qty: 1, price: 87000 },
                { name: 'Mounting Kit',       detail: 'AL6005-T5 Aluminum Rails (250kph Wind Rating)', qty: 1, price: 35000 },
                { name: 'Electrical BOS',     detail: 'DC/AC Protection, 4mm Solar Cables, Grounding', qty: 1, price: 35000 },
                { name: 'Installation & Labor', detail: 'Professional Engineering & PEE Sign-off', qty: 1, price: 75000 }
            ]
        },
        C: {
            label: 'Option C · 5,500W+ Setup',
            dailyKwh: 62.40, systemKw: 7, peakW: 5610,
            rows: [
                { name: 'Solar PV Array',     detail: 'Tier-1 Panels (7 kWp)', panelW: 1000, qty: 7, price: 15714.29 },
                { name: 'Hybrid Inverter',    detail: '12kW Dual MPPT High-Voltage (Power Inverter)', invKw: 12, qty: 1, price: 145000 },
                { name: 'Battery Storage',    detail: '20kWh Battery (4× 5.12kWh units)', batKwh: 20, qty: 1, price: 190000 },
                { name: 'Mounting Kit',       detail: 'AL6005-T5 Aluminum Rails (250kph Wind Rating)', qty: 1, price: 55000 },
                { name: 'Electrical BOS',     detail: 'DC/AC Protection, 4mm Solar Cables, Grounding', qty: 1, price: 45000 },
                { name: 'Installation & Labor', detail: 'Professional Engineering & PEE Sign-off', qty: 1, price: 85000 }
            ]
        }
    };

    // Standard panel wattage choices the maker can pick from.
    const QB_PANEL_WATTS = [60, 120, 240, 500, 620, 1000];

    // Default starter rows when nothing is loaded yet.
    const QB_DEFAULT_ROWS = [
        { name: 'Solar PV Array',           detail: 'Solar Panels',                                      panelW: 1000, qty: 1, price: 25000 },
        { name: 'Hybrid Inverter',          detail: '3kW Hybrid Inverter — Dual MPPT High-Voltage',     invKw: 3,     qty: 1, price: 66000 },
        { name: 'Solar Charge Controller',  detail: '60A MPPT Solar Charge Controller',                  ctrlA: 60,    qty: 1, price: 16000 },
        { name: 'Battery Storage',          detail: 'Battery Bank (12V nominal)',                        batAh: 200,   qty: 1, price: 21600 },
        { name: 'Mounting Kit',             detail: 'AL6005-T5 Aluminum Rails (250kph Wind Rating)',     qty: 1,       price: 15000 },
        { name: 'Electrical BOS',           detail: 'DC/AC Protection, 4mm Solar Cables, Grounding',     qty: 1,       price: 15000 },
        { name: 'Installation & Labor',     detail: 'Professional Engineering & PEE Sign-off',           qty: 1,       price: 20000 }
    ];

    // The component-name dropdown — limits typing variance and drives kind detection.
    const QB_COMPONENT_TYPES = [
        'Solar PV Array',
        'Hybrid Inverter',
        'Solar Charge Controller',
        'Battery Storage',
        'Mounting Kit',
        'Electrical BOS',
        'Installation & Labor',
        'Other'
    ];

    function qbKindOf(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('controller')) return 'controller';
        if (n.includes('solar') || n.includes('panel') || n.includes('pv')) return 'panel';
        if (n.includes('inverter')) return 'inverter';
        if (n.includes('battery')) return 'battery';
        return 'other';
    }

    let qbRows = QB_DEFAULT_ROWS.map(r => ({ ...r }));
    let qbProfile = {
        consumerType: 'residential',
        monthlyBill: '', monthlyKwh: '',
        dailyKwh: '', systemKw: '', peakW: '',
        sunHours: 4.5, sysEff: 0.80
    };
    let qbNetMeter = false;
    const QB_NET_METER_PRICE = 75000;
    // ============ PRORATED PRICING (anchored to a 5,000W reference system = ₱300,500) ============
    // Reference quote (Pricing.pdf): Panels ₱90,000 · Inverter ₱29,000 · Controller ₱43,500 ·
    // Battery ₱43,000 · Mounting ₱30,000 · BOS ₱35,000 · Install ₱30,000 → ₱300,500 / 5,000 W
    // Every line is prorated linearly off the system wattage.
    const QB_PRORATE_REF_W = 5000;
    const QB_PRORATE = {
        panel:      90000 / 5000, // 18.00 ₱/W
        inverter:   29000 / 5000, // 5.80
        controller: 43500 / 5000, // 8.70
        battery:    43000 / 5000, // 8.60
        mounting:   30000 / 5000, // 6.00
        bos:        35000 / 5000, // 7.00
        install:    30000 / 5000  // 6.00
    };
    function qbProrate(systemW) {
        const w = Math.max(0, +systemW || 0);
        const r = k => Math.round(w * QB_PRORATE[k]);
        const out = {
            panel:      r('panel'),
            inverter:   r('inverter'),
            controller: r('controller'),
            battery:    r('battery'),
            mounting:   r('mounting'),
            bos:        r('bos'),
            install:    r('install')
        };
        out.total = out.panel + out.inverter + out.controller + out.battery + out.mounting + out.bos + out.install;
        return out;
    }
    // ============ PRICING TABLES (cost / sell, per Quotation spec) ============
    // Panel pricing (cost & price per panel, by wattage). 60W extrapolated from 120W rate.
    const QB_PANEL_PRICING = {
        60:   { cost: 1500,  price: 3000  },
        120:  { cost: 3000,  price: 6000  },
        240:  { cost: 5000,  price: 7500  },
        500:  { cost: 7500,  price: 12500 },
        620:  { cost: 9000,  price: 15000 },
        1000: { cost: 15000, price: 25000 }
    };
    // Inverter pricing tiers (kW → cost/price & label). >3kW scales linearly at 3kW rate.
    const QB_INVERTER_PRICING = {
        0.22: { cost: 500,   price: 1500,  label: '220W Inverter' },
        1:    { cost: 11000, price: 22000, label: '1kW Hybrid Inverter — Dual MPPT High-Voltage' },
        2:    { cost: 22000, price: 44000, label: '2kW Hybrid Inverter — Dual MPPT High-Voltage' },
        3:    { cost: 33000, price: 66000, label: '3kW Hybrid Inverter — Dual MPPT High-Voltage' }
    };
    const QB_INVERTER_TIERS = [0.22, 1, 2, 3];
    // Solar Charge Controller: 60A per 500W of array. Cost/price per 500W block.
    const QB_CONTROLLER = { ratedAPer500W: 60, costPer500W: 8000, pricePer500W: 16000 };
    // Mounting Kit & Electrical BOS: ₱5,000 cost per 1000W, FLAT ₱15,000 markup added once.
    const QB_MOUNTING_COST_PER_1000W = 5000;
    const QB_MOUNTING_FLAT_MARKUP    = 15000;
    const QB_BOS_COST_PER_1000W      = 5000;
    const QB_BOS_FLAT_MARKUP         = 15000;
    // Battery: add 1300W headroom converted to Ah at 12V nominal (~108 Ah).
    const QB_BATTERY_NOMINAL_V = 12;
    const QB_BATTERY_HEADROOM_W = 1300;
    // System sizing allowances
    const QB_SYSTEM_ALLOWANCE_W   = 1000; // System Size = Total Connected + 1000 W
    const QB_INVERTER_ALLOWANCE_W = 5000; // Inverter Size = System Size + 5000 W
    // Installation kept proportional to system size.
    const QB_INSTALL_PER_KW = 12000;

    // Helpers
    function qbPanelLine(panelW, qty) {
        const p = QB_PANEL_PRICING[panelW];
        if (p) return { unit: p.price, cost: p.cost };
        // fallback: scale from 240W rate
        const ratio = panelW / 240;
        return { unit: Math.round(QB_PANEL_PRICING[240].price * ratio), cost: Math.round(QB_PANEL_PRICING[240].cost * ratio) };
    }
    function qbInverterPick(neededKw) {
        const tier = QB_INVERTER_TIERS.find(t => t >= neededKw);
        if (tier) {
            const r = QB_INVERTER_PRICING[tier];
            return { kw: tier, label: r.label, price: r.price, cost: r.cost };
        }
        // >3kW: scale from 3kW rate (₱11k/kW cost, ₱22k/kW sell), round up to whole kW
        const kw = Math.ceil(neededKw);
        return {
            kw,
            label: `${kw}kW Hybrid Inverter — Dual MPPT High-Voltage`,
            cost: kw * 11000,
            price: kw * 22000
        };
    }
    function qbControllerLine(arrayW) {
        // One controller block per 500W of array
        const blocks = Math.ceil(arrayW / 500);
        const ratedA = blocks * QB_CONTROLLER.ratedAPer500W;
        return {
            qty: blocks,
            ratedA,
            cost: blocks * QB_CONTROLLER.costPer500W,
            price: QB_CONTROLLER.pricePer500W,        // unit price per block
            label: `${ratedA}A MPPT Solar Charge Controller`
        };
    }
    function qbMountingLine(systemW) {
        const blocks = Math.ceil(systemW / 1000);
        const cost = blocks * QB_MOUNTING_COST_PER_1000W;
        return { qty: 1, cost, price: cost + QB_MOUNTING_FLAT_MARKUP };
    }
    function qbBosLine(systemW) {
        const blocks = Math.ceil(systemW / 1000);
        const cost = blocks * QB_BOS_COST_PER_1000W;
        return { qty: 1, cost, price: cost + QB_BOS_FLAT_MARKUP };
    }
    function qbBatteryAh(dailyKwh, consumerType) {
        const backupFrac = QB_BACKUP_HOURS[consumerType] || 0.5;
        const usableWh = (dailyKwh * 1000 * backupFrac) / QB_DOD;
        const baseAh = usableWh / QB_BATTERY_NOMINAL_V;
        const headroomAh = QB_BATTERY_HEADROOM_W / QB_BATTERY_NOMINAL_V;
        // round to nearest 50 Ah, min 100 Ah
        const totalAh = Math.max(100, Math.ceil((baseAh + headroomAh) / 50) * 50);
        return totalAh;
    }
    // LiFePO4 battery: ~₱9 per Wh installed (sell). Cost ≈ 50% of sell (100% markup pattern).
    const QB_BATTERY_PER_WH = 9;
    const QB_BATTERY_COST_RATIO = 0.5;
    function qbBatteryPrice(ah) {
        return Math.round(ah * QB_BATTERY_NOMINAL_V * QB_BATTERY_PER_WH);
    }
    function qbBatteryCost(ah) {
        return Math.round(qbBatteryPrice(ah) * QB_BATTERY_COST_RATIO);
    }

    // Normalize QB_PRESETS so every preset's line prices/costs derive from the
    // central pricing functions (qbPanelLine, qbInverterPick, qbControllerLine, qbBatteryPrice, qbMountingLine, qbBosLine, qbProrate).
    function normalizeQbPresets() {
        if (typeof QB_PRESETS !== 'object') return;
        Object.keys(QB_PRESETS).forEach(k => {
            const p = QB_PRESETS[k];
            if (!p || !Array.isArray(p.rows)) return;
            // Infer arrayW from any panel rows; default panelW to 620W if unspecified.
            let arrayW = 0;
            p.rows.forEach(r => {
                try {
                    if (/panel/i.test(r.name || '')) {
                        let panelW = 620;
                        const m = (r.detail || '').match(/(\d{2,4})\s*w/i);
                        if (m && m[1]) panelW = +m[1];
                        if (r.panelW) panelW = +r.panelW;
                        const qty = +r.qty || 1;
                        arrayW += panelW * qty;
                        // update row spec
                        const pl = qbPanelLine(panelW, qty);
                        r.panelW = panelW; r.price = pl.unit; r.cost = pl.cost;
                    }
                } catch (e) { /* ignore */ }
            });
            const systemW = Math.max(0, arrayW || ((p.systemKw || 0) * 1000) || (p.peakW || 0));
            const pr = qbProrate(systemW || QB_PRORATE_REF_W);
            // Walk rows and set reasonable prices for known component types
            p.rows.forEach(r => {
                try {
                    const name = (r.name || '').toLowerCase();
                    if (name.includes('inverter')) {
                        // try to extract kW
                        let kw = null;
                        const m = (r.detail || '').match(/(\d+(?:\.\d+)?)\s*k\s?w/i) || (r.detail || '').match(/(\d+(?:\.\d+)?)kW/i) || (r.name || '').match(/(\d+(?:\.\d+)?)kW/i);
                        if (m && m[1]) kw = +m[1];
                        if (!kw && p.systemKw) kw = +p.systemKw;
                        if (!kw && systemW) kw = Math.max(1, Math.round(systemW / 1000));
                        const inv = qbInverterPick(kw || 1);
                        r.invKw = inv.kw; r.price = inv.price; r.cost = inv.cost; r.detail = inv.label;
                    } else if (name.includes('controller')) {
                        const ctrl = qbControllerLine(arrayW || systemW || 1000);
                        r.qty = ctrl.qty; r.price = ctrl.price || ctrl.pricePer500W || QB_CONTROLLER.pricePer500W; r.cost = ctrl.cost;
                    } else if (name.includes('battery')) {
                        // try to extract Ah or kWh
                        let ah = r.batAh || null;
                        const mk = (r.detail || '').match(/(\d+(?:\.\d+)?)\s*kwh/i);
                        if (!ah) {
                            const ma = (r.detail || '').match(/(\d{2,4})\s*ah/i);
                            if (ma && ma[1]) ah = +ma[1];
                        }
                        if (!ah && mk) {
                            ah = Math.round((+mk[1] * 1000) / QB_BATTERY_NOMINAL_V);
                        }
                        if (!ah) ah = qbBatteryAh(p.dailyKwh || 0, p.consumerType || 'residential');
                        r.batAh = ah; r.price = qbBatteryPrice(ah); r.cost = qbBatteryCost(ah);
                    } else if (name.includes('mount') || name.includes('mounting')) {
                        const mline = qbMountingLine(systemW || arrayW || 1000);
                        r.qty = mline.qty || 1; r.price = mline.price; r.cost = mline.cost;
                    } else if (name.includes('balance of system') || name.includes('electrical bos') || name.includes('bos')) {
                        const bline = qbBosLine(systemW || arrayW || 1000);
                        r.qty = bline.qty || 1; r.price = bline.price; r.cost = bline.cost;
                    } else if (name.includes('installation') || name.includes('install')) {
                        r.price = pr.install; r.cost = Math.round(pr.install * 0.5);
                    } else if (/solar pv array|solar panel/i.test(r.name || '')) {
                        // ensure price/cost already set from earlier panel pass
                        if (!r.price) {
                            const pl = qbPanelLine(r.panelW || 620, +r.qty || 1);
                            r.price = pl.unit; r.cost = pl.cost;
                        }
                    }
                } catch (e) { /* ignore per-row errors */ }
            });
        });
    }

    // Default per-component pricing used by the Auto-Size engine (₱) — legacy, kept for compat
    const QB_UNIT_PRICES = {
        panelPerWatt: 16,
        inverterPerKw: 9000,
        batteryPerKwh: 9000,
        mountingPerKw: 7500,
        bosPerKw: 7000,
        installPerKw: 12000
    };
    // Backup-autonomy multipliers (battery sizing)
    const QB_BACKUP_HOURS = { residential: 0.65, business: 0.30, commercial: 0.50 };
    // Depth-of-Discharge for LiFePO4
    const QB_DOD = 0.85;

    function qbReadProfile() {
        qbProfile.consumerType = $('#qbConsumerType').value || 'residential';
        qbProfile.monthlyBill  = +$('#qbMonthlyBill').value || 0;
        qbProfile.monthlyKwh   = +$('#qbMonthlyKwh').value || 0;
        qbProfile.dailyKwh     = +$('#qbDailyKwh').value || 0;
        qbProfile.systemKw     = +$('#qbSystemKw').value || 0;
        qbProfile.peakW        = +$('#qbPeakW').value || 0;
        qbProfile.sunHours     = +$('#qbSunHours').value || 4.5;
        qbProfile.sysEff       = +$('#qbSysEff').value || 0.80;
        qbProfile.panelWPref   = $('#qbPanelW') ? $('#qbPanelW').value : 'auto';
    }

    function qbWriteProfile() {
        $('#qbConsumerType').value = qbProfile.consumerType || 'residential';
        $('#qbMonthlyBill').value  = qbProfile.monthlyBill || '';
        $('#qbMonthlyKwh').value   = qbProfile.monthlyKwh || '';
        $('#qbDailyKwh').value     = qbProfile.dailyKwh || '';
        $('#qbSystemKw').value     = qbProfile.systemKw || '';
        $('#qbPeakW').value        = qbProfile.peakW || '';
        $('#qbSunHours').value     = qbProfile.sunHours || 4.5;
        $('#qbSysEff').value       = qbProfile.sysEff || 0.80;
    }

    /* ---- AUTO-SIZE ENGINE ----
       Computes wattage and component sizing from consumption (kWh) or monthly bill —
       no appliance breakdown required. Uses standard PH solar engineering formulas.
    */
    function qbAutoSize() {
        qbReadProfile();
        const rate = +$('#qbRate').value || 12.27;
        // 1) Resolve daily kWh from any of: daily, monthly, monthly bill (used for battery autonomy)
        let dailyKwh = qbProfile.dailyKwh;
        if (!dailyKwh && qbProfile.monthlyKwh) dailyKwh = qbProfile.monthlyKwh / 30;
        if (!dailyKwh && qbProfile.monthlyBill && rate > 0) dailyKwh = (qbProfile.monthlyBill / rate) / 30;

        // 2) BASE = Total Connected Wattage. Prefer the explicit Peak Load (W) input.
        //    Otherwise fall back to deriving it from daily kWh (kWh / sun-hours / efficiency × 1000).
        const sun = qbProfile.sunHours || 4.5;
        const eff = qbProfile.sysEff || 0.80;
        let totalConnectedW = +qbProfile.peakW || 0;
        if (!totalConnectedW) {
            if (!dailyKwh || dailyKwh <= 0) {
                toast('Enter Peak Load (W), or Daily kWh / Monthly kWh / Monthly Bill first', 'error');
                return;
            }
            totalConnectedW = Math.round((dailyKwh / (sun * eff)) * 1000);
        }
        // If kWh wasn't given, derive a daily figure from connected load (5 h equivalent run-time)
        if (!dailyKwh || dailyKwh <= 0) {
            dailyKwh = (totalConnectedW * sun * eff) / 1000;
        }

        // 3) System Size = Total Connected + 1000W allowance, rounded up to 0.5 kW
        const systemW  = totalConnectedW + QB_SYSTEM_ALLOWANCE_W;
        const systemKw = Math.max(0.5, Math.ceil(systemW / 500) / 2);
        const peakW    = Math.round(systemKw * 1000);

        // 4) Pick a panel wattage: respect user preference, else 1000W for ≥3kW, 500W for 1–3kW, 240W otherwise
        let panelW;
        if (qbProfile.panelWPref && qbProfile.panelWPref !== 'auto') {
            panelW = +qbProfile.panelWPref;
        } else {
            panelW = 240;
            if (systemKw >= 3) panelW = 1000;
            else if (systemKw >= 1) panelW = 500;
        }
        const panelQty = Math.ceil((systemKw * 1000) / panelW);
        const arrayW   = panelQty * panelW;

        // 5) Inverter sizing = System Size + 5000W allowance, then pick from tier table
        const invNeededKw = (peakW + QB_INVERTER_ALLOWANCE_W) / 1000;
        const inv = qbInverterPick(invNeededKw);

        // 6) Battery sizing in Ah at 12V nominal, with +1300W headroom baked in
        const batAh = qbBatteryAh(dailyKwh, qbProfile.consumerType);

        // 7) Solar Charge Controller — 60A per 500W of array
        const ctrl = qbControllerLine(arrayW);

        // 8) Pricing per component — explicit cost & sell from QB_PANEL_PRICING / QB_INVERTER_PRICING /
        //    QB_CONTROLLER / qbMountingLine / qbBosLine. Each row carries a `cost` for Net-Proceed tracking.
        const panelLine = qbPanelLine(panelW, panelQty);          // { unit (price), cost } per panel
        const ctrlLine  = ctrl;                                    // { qty, ratedA, cost (total), price (per block), label }
        const mount     = qbMountingLine(arrayW);                  // { qty, cost, price }
        const bos       = qbBosLine(arrayW);                       // { qty, cost, price }
        const batPrice  = qbBatteryPrice(batAh);
        const batCost   = qbBatteryCost(batAh);
        // Installation: keep prorated price (user did not redefine); cost = 50% of price
        const pr        = qbProrate(peakW);
        const instPrice = pr.install;
        const instCost  = Math.round(instPrice * 0.5);

        // 9) Update profile + rebuild rows
        qbProfile.dailyKwh = +dailyKwh.toFixed(2);
        qbProfile.systemKw = systemKw;
        qbProfile.peakW    = totalConnectedW;
        qbWriteProfile();

        qbRows = [
            { name: 'Solar PV Array',          detail: `Solar Panels (${(arrayW / 1000).toFixed(2)} kWp)`, panelW, qty: panelQty, price: panelLine.unit, cost: panelLine.cost },
            { name: 'Hybrid Inverter',         detail: inv.label,                                                          invKw: inv.kw, qty: 1, price: inv.price, cost: inv.cost },
            { name: 'Solar Charge Controller', detail: ctrlLine.label,                                                     ctrlA: ctrlLine.ratedA, qty: ctrlLine.qty, price: ctrlLine.price, cost: Math.round(ctrlLine.cost / Math.max(1, ctrlLine.qty)) },
            { name: 'Battery Storage',         detail: `Battery Bank (${QB_BATTERY_NOMINAL_V}V nominal, includes ${QB_BATTERY_HEADROOM_W}W headroom)`, batAh, qty: 1, price: batPrice, cost: batCost },
            { name: 'Mounting Kit',            detail: 'AL6005-T5 Aluminum Rails (250kph Wind Rating)',                    qty: 1, price: mount.price, cost: mount.cost },
            { name: 'Electrical BOS',          detail: 'DC/AC Protection, 4mm Solar Cables, Grounding',                    qty: 1, price: bos.price, cost: bos.cost },
            { name: 'Installation & Labor',    detail: 'Professional Engineering & PEE Sign-off',                          qty: 1, price: instPrice, cost: instCost }
        ];
        qbRenderRows();

        const note = `<i class="fas fa-circle-info"></i> Total Connected <strong>${totalConnectedW.toLocaleString()} W</strong> ` +
            `+ 1 kW allowance = <strong>${systemKw} kW system</strong> · ` +
            `${panelQty} × ${panelW}W panels · ${inv.kw}kW inverter (system + 5 kW) · ${ctrl.ratedA}A controller · ${batAh} Ah battery. ` +
            `All figures are editable below.`;
        const el = $('#qbSizingNote'); if (el) el.innerHTML = note;
        toast('System auto-sized', 'success');
    }

    function qbRenderRows() {
        const tb = $('#qbRows'); if (!tb) return;
        tb.innerHTML = qbRows.map((r, i) => {
            const kind = qbKindOf(r.name);
            // spec column: kind-specific input
            let specHtml = '';
            if (kind === 'panel') {
                const opts = QB_PANEL_WATTS.map(w => `<option value="${w}" ${+r.panelW === w ? 'selected' : ''}>${w}W</option>`).join('');
                specHtml = `<div class="qb-spec-row">
                    <select class="qb-edit" data-i="${i}" data-f="panelW">${opts}</select>
                    <input type="text" class="qb-edit qb-detail" data-i="${i}" data-f="detail" value="${r.detail || ''}" placeholder="Technical detail">
                </div>`;
            } else if (kind === 'inverter') {
                specHtml = `<div class="qb-spec-row">
                    <input type="number" class="qb-edit qb-num" data-i="${i}" data-f="invKw" value="${r.invKw || ''}" min="0" step="0.5" placeholder="kW"><span class="qb-unit">kW</span>
                    <input type="text" class="qb-edit qb-detail" data-i="${i}" data-f="detail" value="${r.detail || ''}" placeholder="Technical detail">
                </div>`;
            } else if (kind === 'battery') {
                specHtml = `<div class="qb-spec-row">
                    <input type="number" class="qb-edit qb-num" data-i="${i}" data-f="batAh" value="${r.batAh || ''}" min="0" step="10" placeholder="Ah"><span class="qb-unit">Ah</span>
                    <input type="text" class="qb-edit qb-detail" data-i="${i}" data-f="detail" value="${r.detail || ''}" placeholder="Technical detail">
                </div>`;
            } else if (kind === 'controller') {
                specHtml = `<div class="qb-spec-row">
                    <input type="number" class="qb-edit qb-num" data-i="${i}" data-f="ctrlA" value="${r.ctrlA || ''}" min="0" step="10" placeholder="A"><span class="qb-unit">A</span>
                    <input type="text" class="qb-edit qb-detail" data-i="${i}" data-f="detail" value="${r.detail || ''}" placeholder="Technical detail">
                </div>`;
            } else {
                specHtml = `<input type="text" class="qb-edit qb-detail" data-i="${i}" data-f="detail" value="${r.detail || ''}" placeholder="Technical detail">`;
            }

            const compOpts = QB_COMPONENT_TYPES.map(t => `<option ${t === r.name ? 'selected' : ''}>${t}</option>`).join('');
            const isCustom = !QB_COMPONENT_TYPES.includes(r.name);
            const nameCell = isCustom
                ? `<input type="text" class="qb-edit" data-i="${i}" data-f="name" value="${r.name}">`
                : `<select class="qb-edit" data-i="${i}" data-f="name">${compOpts}<option ${isCustom ? 'selected' : ''}>${isCustom ? r.name : '— custom —'}</option></select>`;

            const subtotal = (+r.qty || 0) * (+r.price || 0);
            return `<tr>
                <td>${nameCell}</td>
                <td>${specHtml}</td>
                <td><input type="number" class="qb-edit qb-num" data-i="${i}" data-f="qty" value="${r.qty}" min="1"></td>
                <td><input type="number" class="qb-edit qb-num" data-i="${i}" data-f="price" value="${r.price}" min="0" step="0.01"></td>
                <td class="qb-sub">${fmtMoney(subtotal)}</td>
                <td><button class="qb-del" data-i="${i}" title="Remove">×</button></td>
            </tr>`;
        }).join('');
        qbRenderSummary();
    }

    function qbCalcTotal() {
        const componentTotal = qbRows.reduce((s, r) => s + (+r.qty || 0) * (+r.price || 0), 0);
        const componentCost  = qbRows.reduce((s, r) => s + (+r.qty || 0) * (+r.cost  || 0), 0);
        const netMeter = qbNetMeter ? QB_NET_METER_PRICE : 0;
        const total = componentTotal + netMeter;
        // Net Proceed = total sell price minus total component cost (admin-only metric).
        // Net-meter / permitting fee passes through (no internal cost) so it is excluded.
        const netProceed = componentTotal - componentCost;
        return { componentTotal, componentCost, netMeter, total, netProceed };
    }

    function qbRenderSummary() {
        const t = qbCalcTotal();
        qbReadProfile();
        const profile = `
            <div class="qb-profile">
                <div><small>Daily Consumption</small><strong>${(qbProfile.dailyKwh || 0).toFixed(2)} kWh</strong></div>
                <div><small>System Size</small><strong>${(qbProfile.systemKw || 0).toFixed(2)} kW</strong></div>
                <div><small>Peak Load</small><strong>${(qbProfile.peakW || 0).toLocaleString()} W</strong></div>
                <div><small>Sun Hours</small><strong>${qbProfile.sunHours} h</strong></div>
            </div>`;

        const breakdown = qbRows.map(r => {
            const sub = (+r.qty || 0) * (+r.price || 0);
            return `<div class="qb-line"><span>${r.name}${r.qty > 1 ? ` × ${r.qty}` : ''}</span><span>${fmtMoney(sub)}</span></div>`;
        }).join('');

        const netLine = qbNetMeter
            ? `<div class="qb-line netmeter"><span>Net Metering &amp; Permitting</span><span>${fmtMoney(t.netMeter)}</span></div>` : '';

        // Net Proceed (admin-only — never rendered into printQuote/PDF).
        const margin = t.componentTotal > 0 ? (t.netProceed / t.componentTotal * 100) : 0;
        const netProceedBlock = `
            <div class="qb-net-proceed" data-print-hide="1">
                <div class="qb-np-title"><i class="fas fa-coins"></i> Net Proceed (internal — not printed)</div>
                <div class="qb-line"><span>Total Component Cost</span><span>${fmtMoney(t.componentCost)}</span></div>
                <div class="qb-line"><span>Total Sell (components)</span><span>${fmtMoney(t.componentTotal)}</span></div>
                <div class="qb-line np-total"><span>Net Proceed</span><span>${fmtMoney(t.netProceed)} <small>(${margin.toFixed(1)}% margin)</small></span></div>
            </div>`;

        $('#qbSummary').innerHTML = `
            ${profile}
            <div class="qb-cost-list">
                ${breakdown}
                <div class="qb-line subtotal"><span>Total Investment</span><span>${fmtMoney(t.componentTotal)}</span></div>
                ${netLine}
                <div class="qb-line grand"><span>GRAND TOTAL</span><span>${fmtMoney(t.total)}</span></div>
            </div>
            ${netProceedBlock}
        `;
        qbRenderRoi();
    }

    function qbRenderRoi() {
        const rate = +$('#qbRate').value || 0;
        const days = +$('#qbDays').value || 365;
        const t = qbCalcTotal();
        const dailyKwh = +qbProfile.dailyKwh || 0;
        const monthlyBill = +(qbProfile.monthlyBill) || 0;
        $('#qbRoi').innerHTML = buildRoiHTML({
            systemCost: t.total, dailyKwh, rate, days, monthlyBillCurrent: monthlyBill
        });
    }

    /* ---- Unified comprehensive ROI block (used by both QB auto-size and AP appliance flows) ---- */
    function buildRoiHTML(opts) {
        const { systemCost, dailyKwh, rate, days, monthlyBillCurrent } = opts;
        if (!dailyKwh || !rate || !systemCost) {
            return `<p class="muted">Enter Daily Consumption &amp; Rate to compute ROI.</p>`;
        }
        const monthlyKwh = dailyKwh * 30;
        const monthlyBill = monthlyBillCurrent > 0 ? monthlyBillCurrent : monthlyKwh * rate;
        const annualSavings = dailyKwh * days * rate;
        const monthlySavings = annualSavings / 12;
        const payback = annualSavings > 0 ? systemCost / annualSavings : 0;
        const paybackYears = Math.floor(payback);
        const paybackMonths = Math.round((payback - paybackYears) * 12);
        const lifetime25 = annualSavings * 25;
        const cum5  = annualSavings * 5;
        const cum10 = annualSavings * 10;
        const roiPct = systemCost > 0 ? ((lifetime25 - systemCost) / systemCost * 100) : 0;
        const beDate = (() => {
            if (!payback || !isFinite(payback)) return '—';
            const d = new Date(); d.setMonth(d.getMonth() + Math.round(payback * 12));
            return d.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
        })();
        return `
            <div class="qb-roi-comp">
                <div class="qb-roi-grid">
                    <div><small>Current Monthly Bill</small><strong>${fmtMoney(monthlyBill)}</strong></div>
                    <div><small>Monthly Bill w/ Solar</small><strong class="text-good">₱0 – ₱500</strong></div>
                    <div><small>Monthly Savings</small><strong class="text-good">${fmtMoney(monthlySavings)}</strong></div>
                    <div><small>Annual Savings</small><strong class="text-good">${fmtMoney(annualSavings)}</strong></div>
                </div>
                <div class="qb-roi-grid">
                    <div><small>Payback Period</small><strong>${paybackYears} yr ${paybackMonths} mo</strong></div>
                    <div><small>Break-even Date</small><strong>${beDate}</strong></div>
                    <div><small>System Investment</small><strong>${fmtMoney(systemCost)}</strong></div>
                    <div><small>25-yr ROI</small><strong class="text-good">${roiPct.toFixed(0)}%</strong></div>
                </div>
                <div class="qb-roi-grid">
                    <div><small>5-yr Cumulative Savings</small><strong>${fmtMoney(cum5)}</strong></div>
                    <div><small>10-yr Cumulative Savings</small><strong>${fmtMoney(cum10)}</strong></div>
                    <div><small>25-yr Lifetime Savings</small><strong class="text-good">${fmtMoney(lifetime25)}</strong></div>
                    <div><small>Net Lifetime Profit</small><strong class="text-good">${fmtMoney(lifetime25 - systemCost)}</strong></div>
                </div>
                <p class="muted qb-roi-note"><i class="fas fa-info-circle"></i> Savings assume 100 % daytime offset against ₱${rate.toFixed(2)}/kWh. Actual savings vary with usage pattern, weather and net-metering availability. Inflation of grid tariffs not modelled — real lifetime savings are typically higher.</p>
            </div>`;
    }

    function qbBreakEven(years) {
        if (!years || !isFinite(years)) return '—';
        const d = new Date(); d.setMonth(d.getMonth() + Math.round(years * 12));
        return d.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
    }

    /* ---- Wire up events ---- */
    $('#qbAddRowBtn').addEventListener('click', () => {
        qbRows.push({ name: 'Other', detail: '', qty: 1, price: 0 });
        qbRenderRows();
    });

    $('#qbRows').addEventListener('input', e => {
        const inp = e.target.closest('.qb-edit'); if (!inp) return;
        const i = +inp.dataset.i, f = inp.dataset.f;
        if (!qbRows[i]) return;
        let v = inp.value;
        if (['qty', 'price', 'panelW', 'invKw', 'batAh', 'ctrlA'].includes(f)) v = +v;
        qbRows[i][f] = v;
        // For numeric/spec changes we don't need a full row re-render; just update subtotal cell
        if (f === 'qty' || f === 'price') {
            const tr = inp.closest('tr');
            const sub = (+qbRows[i].qty || 0) * (+qbRows[i].price || 0);
            tr.querySelector('.qb-sub').textContent = fmtMoney(sub);
            qbRenderSummary();
        } else {
            qbRenderSummary();
        }
    });

    $('#qbRows').addEventListener('change', e => {
        const inp = e.target.closest('.qb-edit'); if (!inp) return;
        if (inp.dataset.f === 'name') qbRenderRows(); // re-render to swap spec input type
    });

    $('#qbRows').addEventListener('click', e => {
        const b = e.target.closest('.qb-del'); if (!b) return;
        qbRows.splice(+b.dataset.i, 1); qbRenderRows();
    });

    ['#qbDailyKwh', '#qbSystemKw', '#qbPeakW', '#qbSunHours', '#qbRate', '#qbDays',
     '#qbConsumerType', '#qbMonthlyBill', '#qbMonthlyKwh', '#qbSysEff', '#qbPanelW'].forEach(sel => {
        const el = $(sel); if (!el) return;
        el.addEventListener('input', () => { qbReadProfile(); qbRenderSummary(); });
        el.addEventListener('change', () => { qbReadProfile(); qbRenderSummary(); });
    });

    const _autoBtn = $('#qbAutoSizeBtn'); if (_autoBtn) _autoBtn.addEventListener('click', qbAutoSize);

    $('#qbNetMeter').addEventListener('change', e => { qbNetMeter = e.target.checked; qbRenderSummary(); });

    $('#qbPreset').addEventListener('change', e => {
        const k = e.target.value; if (!k || !QB_PRESETS[k]) return;
        const p = QB_PRESETS[k];
        if (!confirm(`Load preset: ${p.label}? This replaces current rows.`)) {
            e.target.value = ''; return;
        }
        qbProfile = { dailyKwh: p.dailyKwh, systemKw: p.systemKw, peakW: p.peakW, sunHours: 4.5 };
        qbRows = p.rows.map(r => ({ ...r }));
        qbWriteProfile();
        qbRenderRows();
        toast(`${p.label} loaded`, 'success');
        e.target.value = '';
    });

    function qbBuildItems() {
        const items = qbRows
            .filter(r => +r.qty > 0 && +r.price >= 0)
            .map(r => {
                let d = r.name;
                if (r.detail) d += ' — ' + r.detail;
                if (qbKindOf(r.name) === 'panel' && r.panelW) d = `${r.qty} × ${r.panelW}W ${r.name}` + (r.detail ? ' — ' + r.detail : '');
                else if (qbKindOf(r.name) === 'inverter' && r.invKw) d = `${r.invKw}kW ${r.name}` + (r.detail ? ' — ' + r.detail : '');
                else if (qbKindOf(r.name) === 'battery' && r.batAh) d = `${r.batAh} Ah ${r.name}` + (r.detail ? ' — ' + r.detail : '');
                else if (qbKindOf(r.name) === 'controller' && r.ctrlA) d = `${r.ctrlA}A ${r.name}` + (r.detail ? ' — ' + r.detail : '');
                return { d, q: +r.qty, p: +r.price };
            });
        if (qbNetMeter) items.push({
            d: 'Net Metering & Permitting (LGU + DIS/DAS + Meter + ERC + Docs + EE Cert.)',
            q: 1, p: QB_NET_METER_PRICE
        });
        return items;
    }

    function qbReadTerms() {
        const get = sel => { const e = $(sel); return e ? (e.value || '').trim() : ''; };
        return {
            quoteNo:       get('#qbQuoteNo'),
            validity:      +($('#qbValidity')?.value) || 30,
            projectTitle:  get('#qbProjectTitle'),
            scope:         get('#qbScope'),
            inclusions:    get('#qbInclusions'),
            exclusions:    get('#qbExclusions'),
            payment:       get('#qbPayment'),
            warranty:      get('#qbWarranty'),
            notes:         get('#qbNotes')
        };
    }

    $('#generateQuoteBtn').addEventListener('click', () => {
        qbReadProfile();
        const t = qbCalcTotal();
        if (t.total <= 0) return toast('Add components with prices first', 'error');
        const name = $('#autoClientName').value.trim() || 'Walk-in';
        const loc  = $('#autoClientLoc').value.trim() || '-';
        const terms = qbReadTerms();
        const q = {
            id: terms.quoteNo || uid('Q'),
            client: name, location: loc, date: new Date().toISOString().slice(0, 10),
            type: 'builder',
            items: qbBuildItems(),
            total: t.total,
            meta: {
                profile: { ...qbProfile },
                componentTotal: t.componentTotal,
                netMeter: qbNetMeter,
                rate: +$('#qbRate').value || 12.27,
                terms
            }
        };
        state.quotes.unshift(q); save(); renderQuoteHistory();
        logActivity(`Quote ${q.id} (${fmtMoney(t.total)}) saved for ${name}`, 'success', 'fa-file-invoice');
        toast('Quotation saved');
    });

    $('#printQuoteBtn').addEventListener('click', () => {
        qbReadProfile();
        const t = qbCalcTotal();
        if (t.total <= 0) return toast('Add components first', 'error');
        const terms = qbReadTerms();
        printQuote({
            id: terms.quoteNo || uid('Q'),
            client: $('#autoClientName').value || 'Walk-in',
            location: $('#autoClientLoc').value || '-',
            items: qbBuildItems(),
            total: t.total,
            date: new Date().toISOString().slice(0, 10),
            meta: { profile: { ...qbProfile }, terms, netMeter: qbNetMeter, rate: +$('#qbRate').value || 12.27 }
        });
    });

    // initial render — read defaults from DOM so summary shows correct values on first load
    // Normalize presets to use centralized pricing and refresh preset dropdown
    try { normalizeQbPresets(); } catch (e) { console.error('normalizeQbPresets failed', e); }
    try { if (typeof populateQbPresetDropdown === 'function') populateQbPresetDropdown(); } catch (e) { /* ignored */ }
    qbReadProfile();
    qbRenderRows();

    // ============ QUOTATION — APPLIANCE-BASED (priced from total appliance wattage) ============
    // Common Philippine household / business appliance wattage reference
    const AP_COMMON = [
        { n: 'LED Bulb (9W)',                w: 9 },
        { n: 'LED Bulb (15W)',               w: 15 },
        { n: 'Ceiling Fan',                  w: 75 },
        { n: 'Stand / Electric Fan',         w: 60 },
        { n: 'Refrigerator (small)',         w: 120 },
        { n: 'Refrigerator (2-door)',        w: 250 },
        { n: 'Chest Freezer',                w: 350 },
        { n: 'Television (LED 32")',         w: 60 },
        { n: 'Television (LED 55")',         w: 110 },
        { n: 'Laptop',                       w: 65 },
        { n: 'Desktop PC',                   w: 250 },
        { n: 'Wi-Fi Router',                 w: 15 },
        { n: 'Printer',                      w: 50 },
        { n: 'Aircon — Window 0.75HP',       w: 720 },
        { n: 'Aircon — Window 1.0HP',        w: 920 },
        { n: 'Aircon — Split 1.0HP Inverter',w: 750 },
        { n: 'Aircon — Split 1.5HP Inverter',w: 1100 },
        { n: 'Aircon — Split 2.0HP Inverter',w: 1500 },
        { n: 'Electric Iron',                w: 1000 },
        { n: 'Microwave Oven',               w: 1200 },
        { n: 'Rice Cooker',                  w: 400 },
        { n: 'Electric Kettle',              w: 1500 },
        { n: 'Washing Machine',              w: 500 },
        { n: 'Water Pump (0.5HP)',           w: 370 },
        { n: 'Water Pump (1.0HP)',           w: 750 },
        { n: 'Water Heater',                 w: 1500 },
        { n: 'Hair Dryer',                   w: 1200 },
        { n: 'CCTV (4-cam DVR)',             w: 40 },
        { n: 'Welding Machine',              w: 4000 },
        { n: 'Custom — enter manually',      w: 0 }
    ];

    // Quick-load presets (preselected appliance lists)
    const AP_PRESETS = {
        basic: [
            { n: 'LED Bulb (9W)',     w: 9,   q: 6, h: 5 },
            { n: 'Stand / Electric Fan', w: 60, q: 2, h: 8 },
            { n: 'Refrigerator (small)', w: 120, q: 1, h: 24 },
            { n: 'Television (LED 32")', w: 60, q: 1, h: 6 },
            { n: 'Wi-Fi Router',      w: 15,  q: 1, h: 24 },
            { n: 'Rice Cooker',       w: 400, q: 1, h: 1 }
        ],
        family: [
            { n: 'LED Bulb (15W)',    w: 15,  q: 8, h: 5 },
            { n: 'Ceiling Fan',       w: 75,  q: 2, h: 10 },
            { n: 'Refrigerator (2-door)', w: 250, q: 1, h: 24 },
            { n: 'Television (LED 55")', w: 110, q: 1, h: 6 },
            { n: 'Aircon — Split 1.0HP Inverter', w: 750, q: 1, h: 8 },
            { n: 'Washing Machine',   w: 500, q: 1, h: 1 },
            { n: 'Microwave Oven',    w: 1200, q: 1, h: 0.5 },
            { n: 'Rice Cooker',       w: 400, q: 1, h: 1 },
            { n: 'Electric Iron',     w: 1000, q: 1, h: 0.5 },
            { n: 'Wi-Fi Router',      w: 15,  q: 1, h: 24 }
        ],
        office: [
            { n: 'LED Bulb (15W)',    w: 15,  q: 10, h: 9 },
            { n: 'Desktop PC',        w: 250, q: 5, h: 9 },
            { n: 'Laptop',            w: 65,  q: 3, h: 9 },
            { n: 'Printer',           w: 50,  q: 2, h: 4 },
            { n: 'Aircon — Split 1.5HP Inverter', w: 1100, q: 2, h: 9 },
            { n: 'Refrigerator (small)', w: 120, q: 1, h: 24 },
            { n: 'CCTV (4-cam DVR)',  w: 40,  q: 1, h: 24 },
            { n: 'Wi-Fi Router',      w: 15,  q: 1, h: 24 }
        ],
        store: [
            { n: 'LED Bulb (15W)',    w: 15,  q: 12, h: 12 },
            { n: 'Aircon — Split 2.0HP Inverter', w: 1500, q: 2, h: 12 },
            { n: 'Refrigerator (2-door)', w: 250, q: 2, h: 24 },
            { n: 'Chest Freezer',     w: 350, q: 1, h: 24 },
            { n: 'Television (LED 32")', w: 60, q: 2, h: 12 },
            { n: 'CCTV (4-cam DVR)',  w: 40,  q: 1, h: 24 },
            { n: 'Wi-Fi Router',      w: 15,  q: 1, h: 24 }
        ],
        /* ---- Phase 18 (v=20260427e) Commercial / Industrial presets ---- */
        printing: [
            { n: 'LED Tube Light (18W)',                   w: 18,    q: 30, h: 12 },
            { n: 'High-Bay LED (150W)',                    w: 150,   q: 6,  h: 12 },
            { n: 'Heidelberg Offset Press (5.5kW motor)',  w: 5500,  q: 1,  h: 8 },
            { n: 'Digital Production Press (Konica/Xerox)',w: 2400,  q: 2,  h: 8 },
            { n: 'Large-Format Plotter (Epson 64")',       w: 1500,  q: 1,  h: 6 },
            { n: 'CTP Plate Setter',                       w: 2000,  q: 1,  h: 4 },
            { n: 'Paper Cutter (Polar 78cm)',              w: 1800,  q: 1,  h: 3 },
            { n: 'Folding Machine',                        w: 750,   q: 1,  h: 4 },
            { n: 'Saddle Stitcher / Binder',               w: 1100,  q: 1,  h: 3 },
            { n: 'Lamination Machine',                     w: 1500,  q: 1,  h: 3 },
            { n: 'Air Compressor (5HP)',                   w: 3700,  q: 1,  h: 6 },
            { n: 'Industrial Exhaust Blower',              w: 750,   q: 2,  h: 10 },
            { n: 'Aircon — Cassette 3.0HP Inverter',       w: 2400,  q: 3,  h: 10 },
            { n: 'Pre-press Workstation (PC)',             w: 350,   q: 4,  h: 9 },
            { n: 'Office PC',                              w: 250,   q: 4,  h: 9 },
            { n: 'Wi-Fi Router + Network Switch',          w: 35,    q: 2,  h: 24 },
            { n: 'CCTV (8-cam NVR)',                       w: 80,    q: 1,  h: 24 },
            { n: 'Refrigerator (small)',                   w: 120,   q: 1,  h: 24 }
        ],
        dealership: [
            { n: 'High-Bay LED Showroom Light (200W)',     w: 200,   q: 20, h: 14 },
            { n: 'LED Floodlight — Lot Perimeter (100W)',  w: 100,   q: 12, h: 12 },
            { n: 'LED Tube Light (18W)',                   w: 18,    q: 40, h: 12 },
            { n: 'Aircon — Floor-mounted 5.0HP Inverter',  w: 3700,  q: 4,  h: 12 },
            { n: 'Aircon — Split 2.0HP Inverter (offices)',w: 1500,  q: 6,  h: 10 },
            { n: '2-Post Hydraulic Lift (4-ton)',          w: 2200,  q: 3,  h: 5 },
            { n: '4-Post Alignment Lift',                  w: 3000,  q: 1,  h: 4 },
            { n: 'Tire Changer (truck)',                   w: 2200,  q: 1,  h: 4 },
            { n: 'Wheel Balancer',                         w: 750,   q: 1,  h: 3 },
            { n: 'Air Compressor (10HP screw)',            w: 7500,  q: 1,  h: 8 },
            { n: 'High-Pressure Washer (5HP)',             w: 3700,  q: 2,  h: 4 },
            { n: 'Welding Machine (MIG/MMA 250A)',         w: 8000,  q: 1,  h: 3 },
            { n: 'Spray Booth + Bake Oven (15kW)',         w: 15000, q: 1,  h: 4 },
            { n: 'Paint Mixer / Shaker',                   w: 750,   q: 1,  h: 2 },
            { n: 'EV / Battery Charger Bay (7.4kW)',       w: 7400,  q: 2,  h: 6 },
            { n: 'Showroom Sound + Display TVs',           w: 200,   q: 4,  h: 12 },
            { n: 'Office PC + Workstation',                w: 250,   q: 8,  h: 9 },
            { n: 'Printer / Scanner (multifunction)',      w: 800,   q: 2,  h: 3 },
            { n: 'Refrigerator (2-door)',                  w: 250,   q: 2,  h: 24 },
            { n: 'Microwave + Pantry Coffee Maker',        w: 2000,  q: 1,  h: 1 },
            { n: 'CCTV (16-cam NVR + monitors)',           w: 200,   q: 1,  h: 24 },
            { n: 'Wi-Fi Router + Network Switch',          w: 50,    q: 2,  h: 24 }
        ],
        hardware: [
            { n: 'High-Bay LED Warehouse Light (150W)',    w: 150,   q: 18, h: 12 },
            { n: 'LED Tube Light (18W) — display area',    w: 18,    q: 40, h: 12 },
            { n: 'Aircon — Cassette 3.0HP Inverter',       w: 2400,  q: 4,  h: 12 },
            { n: 'Aircon — Split 1.5HP Inverter (offices)',w: 1100,  q: 3,  h: 10 },
            { n: 'Industrial Ceiling Fan (HVLS)',          w: 1500,  q: 2,  h: 12 },
            { n: 'Forklift Battery Charger (48V/80A)',     w: 4500,  q: 2,  h: 8 },
            { n: 'Paint Tinting Machine',                  w: 750,   q: 1,  h: 4 },
            { n: 'Paint Shaker',                           w: 500,   q: 1,  h: 3 },
            { n: 'Bench Grinder / Wood Cutter (display)',  w: 1500,  q: 1,  h: 2 },
            { n: 'Air Compressor (5HP)',                   w: 3700,  q: 1,  h: 4 },
            { n: 'POS Terminal (PC + thermal printer)',    w: 200,   q: 4,  h: 12 },
            { n: 'Office PC',                              w: 250,   q: 5,  h: 9 },
            { n: 'Receipt / Invoice Printer',              w: 80,    q: 4,  h: 8 },
            { n: 'CCTV (16-cam NVR)',                      w: 150,   q: 1,  h: 24 },
            { n: 'Refrigerator (drinks)',                  w: 250,   q: 1,  h: 24 },
            { n: 'Microwave Oven (pantry)',                w: 1200,  q: 1,  h: 0.5 },
            { n: 'Wi-Fi Router + Network Switch',          w: 50,    q: 2,  h: 24 }
        ],
        resort: [
            { n: 'LED Garden / Pathway Light (15W)',       w: 15,    q: 60, h: 12 },
            { n: 'LED Floodlight — Pool / Facade (50W)',   w: 50,    q: 20, h: 12 },
            { n: 'LED Bulb — Guest Rooms (9W)',            w: 9,     q: 80, h: 6 },
            { n: 'Aircon — Split 1.0HP Inverter (rooms)',  w: 750,   q: 20, h: 10 },
            { n: 'Aircon — Cassette 3.0HP (lobby/restaurant)', w: 2400, q: 3, h: 14 },
            { n: 'Refrigerator — Walk-in Chiller',         w: 2200,  q: 1,  h: 24 },
            { n: 'Chest Freezer (commercial)',             w: 800,   q: 2,  h: 24 },
            { n: 'Beverage Cooler / Display',              w: 350,   q: 2,  h: 24 },
            { n: 'Ice Maker (commercial 100kg/day)',       w: 1200,  q: 1,  h: 24 },
            { n: 'Commercial Range / Induction',           w: 5000,  q: 1,  h: 6 },
            { n: 'Commercial Oven',                        w: 4000,  q: 1,  h: 4 },
            { n: 'Range Hood Exhaust Blower',              w: 750,   q: 1,  h: 8 },
            { n: 'Pool Pump (3HP)',                        w: 2200,  q: 1,  h: 12 },
            { n: 'Pool Heater / Heat-Pump',                w: 4500,  q: 1,  h: 8 },
            { n: 'Water Pressure Pump (2HP)',              w: 1500,  q: 2,  h: 8 },
            { n: 'Water Heater — Solar / Electric Boost',  w: 3000,  q: 4,  h: 4 },
            { n: 'Laundry Washer (commercial 15kg)',       q: 1,     w: 2200, h: 4 },
            { n: 'Laundry Dryer (commercial)',             w: 5000,  q: 1,  h: 3 },
            { n: 'Iron Press (laundry)',                   w: 1800,  q: 1,  h: 2 },
            { n: 'Television (LED 50") — guest rooms',     w: 90,    q: 20, h: 6 },
            { n: 'Wi-Fi Access Point',                     w: 12,    q: 8,  h: 24 },
            { n: 'CCTV (32-cam NVR + monitors)',           w: 250,   q: 1,  h: 24 },
            { n: 'Sound System (lobby / pool bar)',        w: 400,   q: 1,  h: 12 }
        ],
        hotel: [
            { n: 'LED Downlight — Hallway (12W)',          w: 12,    q: 80, h: 24 },
            { n: 'LED Bulb — Guest Rooms (9W)',            w: 9,     q: 200, h: 6 },
            { n: 'LED Floodlight — Facade (50W)',          w: 50,    q: 16, h: 12 },
            { n: 'Aircon — Split 1.0HP Inverter (rooms)',  w: 750,   q: 50, h: 12 },
            { n: 'Aircon — VRF / Central System (lobby)',  w: 12000, q: 1,  h: 14 },
            { n: 'Aircon — Cassette 3.0HP (function rooms)', w: 2400, q: 4, h: 8 },
            { n: 'Mini-Bar Fridge (guest room)',           w: 80,    q: 50, h: 24 },
            { n: 'Refrigerator — Walk-in Chiller',         w: 2200,  q: 1,  h: 24 },
            { n: 'Chest Freezer (kitchen)',                w: 800,   q: 2,  h: 24 },
            { n: 'Commercial Range / Induction',           w: 6000,  q: 2,  h: 8 },
            { n: 'Commercial Oven',                        w: 4000,  q: 2,  h: 6 },
            { n: 'Dishwasher (commercial)',                w: 7500,  q: 1,  h: 4 },
            { n: 'Range Hood Exhaust Blower',              w: 1500,  q: 1,  h: 10 },
            { n: 'Elevator Motor (15HP)',                  w: 11000, q: 2,  h: 8 },
            { n: 'Booster / Pressure Pump (5HP)',          w: 3700,  q: 2,  h: 8 },
            { n: 'Water Heater (centralized boiler)',      w: 18000, q: 1,  h: 6 },
            { n: 'Laundry Washer (commercial 25kg)',       w: 4000,  q: 2,  h: 6 },
            { n: 'Laundry Dryer (commercial)',             w: 6000,  q: 2,  h: 5 },
            { n: 'Television (LED 55") — guest rooms',     w: 110,   q: 50, h: 5 },
            { n: 'Front Desk PC + POS',                    w: 300,   q: 3,  h: 24 },
            { n: 'Office PC + Printer',                    w: 350,   q: 5,  h: 9 },
            { n: 'Wi-Fi Access Point',                     w: 12,    q: 20, h: 24 },
            { n: 'CCTV (64-cam NVR + monitors)',           w: 400,   q: 1,  h: 24 },
            { n: 'Sound + AV (function room)',             w: 800,   q: 1,  h: 6 }
        ],
        barangay: [
            { n: 'LED Tube Light (18W)',                   w: 18,    q: 16, h: 10 },
            { n: 'LED Floodlight — Facade / Plaza (50W)',  w: 50,    q: 6,  h: 12 },
            { n: 'Aircon — Split 1.5HP Inverter (offices)',w: 1100,  q: 3,  h: 9 },
            { n: 'Aircon — Split 2.0HP (session hall)',    w: 1500,  q: 1,  h: 6 },
            { n: 'Ceiling Fan',                            w: 75,    q: 6,  h: 10 },
            { n: 'Refrigerator (medicine / health post)',  w: 250,   q: 1,  h: 24 },
            { n: 'Water Dispenser',                        w: 500,   q: 1,  h: 12 },
            { n: 'Office PC',                              w: 250,   q: 4,  h: 9 },
            { n: 'Laptop',                                 w: 65,    q: 2,  h: 9 },
            { n: 'Multifunction Printer',                  w: 100,   q: 2,  h: 4 },
            { n: 'Public-Address / Sound System',          w: 300,   q: 1,  h: 4 },
            { n: 'Television (LED 43") — info display',    w: 80,    q: 1,  h: 10 },
            { n: 'CCTV (8-cam NVR)',                       w: 80,    q: 1,  h: 24 },
            { n: 'Wi-Fi Router',                           w: 15,    q: 1,  h: 24 },
            { n: 'Streetlight (LED 80W) — barangay-owned', w: 80,    q: 12, h: 12 }
        ],
        municipal: [
            { n: 'LED Tube Light (18W)',                   w: 18,    q: 80, h: 10 },
            { n: 'LED Downlight — Lobby (12W)',            w: 12,    q: 40, h: 12 },
            { n: 'LED Floodlight — Facade / Plaza (100W)', w: 100,   q: 12, h: 12 },
            { n: 'Aircon — Split 1.5HP Inverter (offices)',w: 1100,  q: 20, h: 9 },
            { n: 'Aircon — Cassette 3.0HP (session hall)', w: 2400,  q: 4,  h: 6 },
            { n: 'Aircon — Split 2.0HP Inverter (depts.)', w: 1500,  q: 10, h: 9 },
            { n: 'Ceiling Fan',                            w: 75,    q: 20, h: 10 },
            { n: 'Refrigerator (pantry / health office)',  w: 250,   q: 4,  h: 24 },
            { n: 'Water Dispenser',                        w: 500,   q: 6,  h: 12 },
            { n: 'Office PC',                              w: 250,   q: 50, h: 9 },
            { n: 'Laptop',                                 w: 65,    q: 20, h: 9 },
            { n: 'Multifunction Printer / Copier',         w: 800,   q: 8,  h: 4 },
            { n: 'Server Rack (UPS + 2 servers)',          w: 1500,  q: 1,  h: 24 },
            { n: 'Public-Address / Sound System',          w: 600,   q: 1,  h: 4 },
            { n: 'Television (LED 55") — info display',    w: 110,   q: 4,  h: 10 },
            { n: 'Projector + Screen (session hall)',      w: 400,   q: 1,  h: 4 },
            { n: 'CCTV (32-cam NVR + monitors)',           w: 250,   q: 1,  h: 24 },
            { n: 'Wi-Fi Access Point',                     w: 12,    q: 6,  h: 24 },
            { n: 'Elevator Motor (10HP)',                  w: 7500,  q: 1,  h: 10 },
            { n: 'Water Pump (5HP)',                       w: 3700,  q: 2,  h: 8 },
            { n: 'Streetlight (LED 80W) — municipal-owned', w: 80,   q: 30, h: 12 }
        ]
    };

    let apRows = [];
    let apComponents = []; // populated by apBuildQuote
    let apProfile = { dailyKwh: 0, peakW: 0, systemKw: 0, sunHours: 4.5, sysEff: 0.80, consumerType: 'residential', diversity: 0.70 };
    let apNetMeter = false;
    let apHasBuilt = false;
    // 'appliances' — itemized appliance lines + components
    // 'bill'       — single aggregate "Estimated Load" line + components (no itemization)
    let apMode = 'appliances';
    let apBillSource = null; // { dailyKwh, peakW, basis: 'bill'|'kwh', billAmt, kwhAmt }

    function apTotals() {
        let kwh = 0, peakW = 0;
        apRows.forEach(r => {
            const w = +r.w || 0, q = +r.q || 0, h = +r.h || 0;
            kwh += (w * q * h) / 1000;
            peakW += w * q;
        });
        return { kwh, peakW };
    }

    function apRenderRows() {
        const tb = $('#apRows'); if (!tb) return;
        if (!apRows.length) {
            tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">
                No appliances added yet. Click <strong>Add Appliance</strong> or load a preset to begin.</td></tr>`;
        } else {
            const opts = AP_COMMON.map(a => `<option value="${a.n}" data-w="${a.w}">${a.n}${a.w ? ` — ${a.w}W` : ''}</option>`).join('');
            tb.innerHTML = apRows.map((r, i) => {
                const w = +r.w || 0, q = +r.q || 0, h = +r.h || 0;
                const sub = (w * q * h) / 1000;
                const peak = w * q;
                const isCommon = AP_COMMON.some(a => a.n === r.n);
                const nameCell = isCommon
                    ? `<select class="qb-edit ap-edit" data-i="${i}" data-f="n">${opts.replace(`value="${r.n}"`, `value="${r.n}" selected`)}</select>`
                    : `<input type="text" class="qb-edit ap-edit" data-i="${i}" data-f="n" value="${r.n}" placeholder="Appliance / equipment name">`;
                return `<tr>
                    <td>${nameCell}</td>
                    <td><input type="number" class="qb-edit qb-num ap-edit" data-i="${i}" data-f="w" value="${w}" min="0" step="1"></td>
                    <td><input type="number" class="qb-edit qb-num ap-edit" data-i="${i}" data-f="q" value="${q}" min="1" step="1"></td>
                    <td><input type="number" class="qb-edit qb-num ap-edit" data-i="${i}" data-f="h" value="${h}" min="0" max="24" step="0.25"></td>
                    <td class="num-col ap-sub-kwh">${sub.toFixed(2)}</td>
                    <td class="num-col ap-sub-peak">${peak.toLocaleString()}</td>
                    <td><button class="qb-del" data-i="${i}" title="Remove">×</button></td>
                </tr>`;
            }).join('');
        }
        const t = apTotals();
        $('#apTotalKwh').textContent = `${t.kwh.toFixed(2)} kWh`;
        $('#apTotalPeak').textContent = `${t.peakW.toLocaleString()} W`;
    }

    function apReadParams() {
        apProfile.consumerType = $('#apConsumerType').value || 'residential';
        apProfile.sunHours     = +$('#apSunHours').value || 4.5;
        apProfile.sysEff       = +$('#apSysEff').value || 0.80;
        apProfile.diversity    = +$('#apDiversity').value || 0.70;
        apProfile.panelWPref   = $('#apPanelW') ? $('#apPanelW').value : 'auto';
    }

    /* ---- Shared sizing helper: from a daily kWh figure (and optional peakW) compute the
           component pricing & set apProfile/apComponents. Used by BOTH the appliance flow
           and the monthly-bill flow. */
    function apSizeFromEnergy(dailyKwh, peakWHint) {
        const sun = apProfile.sunHours, eff = apProfile.sysEff;
        // BASE = Total Connected Wattage from appliance list (sum of W × Qty).
        // If the caller did not supply one (bill-mode), derive from daily kWh / sun-hours / efficiency.
        let totalConnectedW = peakWHint || 0;
        if (!totalConnectedW) {
            totalConnectedW = Math.round((dailyKwh / (sun * eff)) * 1000);
        }
        if (!dailyKwh || dailyKwh <= 0) {
            dailyKwh = (totalConnectedW * sun * eff) / 1000;
        }

        // System Size = Total Connected Wattage + 1000 W allowance (NO rounding —
        // panel count must reflect the raw appliance load + allowance, per spec).
        const systemW  = totalConnectedW + QB_SYSTEM_ALLOWANCE_W;
        const systemKw = +(systemW / 1000).toFixed(2);
        const peakW    = systemW;

        let panelW;
        if (apProfile.panelWPref && apProfile.panelWPref !== 'auto') {
            panelW = +apProfile.panelWPref;
        } else {
            panelW = 240;
            if (systemKw >= 3) panelW = 1000;
            else if (systemKw >= 1) panelW = 500;
        }
        // Number of panels covers (Total Connected Wattage + 1000 W) using selected panel size.
        const panelQty = Math.max(1, Math.ceil(systemW / panelW));
        const arrayW   = panelQty * panelW;

        // Inverter = Total Connected Wattage + 50 % (1.5 ×), rounded up to next 0.5 kW.
        const invKwNeeded = (totalConnectedW * 1.5) / 1000;
        const inv = qbInverterPick(invKwNeeded);
        // Battery in Ah at 12V (with 1300W headroom baked in)
        const batAh = qbBatteryAh(dailyKwh, apProfile.consumerType);
        // Charge controller — 60A per 500W
        const ctrl = qbControllerLine(arrayW);

        const panelLine = qbPanelLine(panelW, panelQty);
        const mount     = qbMountingLine(arrayW);
        const bos       = qbBosLine(arrayW);
        const batPrice  = qbBatteryPrice(batAh);
        const batCost   = qbBatteryCost(batAh);
        // Installation: keep prorated price (user did not redefine)
        const pr        = qbProrate(peakW);
        const instPrice = pr.install;
        const instCost  = Math.round(instPrice * 0.5);
        // Per-unit cost for the controller (ctrl.cost is total across ctrl.qty units)
        const ctrlCostPerUnit = Math.round((ctrl.cost || 0) / Math.max(1, ctrl.qty || 1));

        apProfile.dailyKwh = +dailyKwh.toFixed(2);
        apProfile.peakW    = totalConnectedW;
        apProfile.systemKw = systemKw;

        apComponents = [
            { d: `${panelQty} × ${panelW}W Solar Panels (${(arrayW / 1000).toFixed(2)} kWp)`, q: panelQty, p: panelLine.unit, c: panelLine.cost },
            { d: inv.label.replace(/TOPCon|N-Type/gi, '').replace(/\s+/g, ' ').trim(), q: 1, p: inv.price, c: inv.cost },
            { d: ctrl.label, q: ctrl.qty, p: ctrl.price, c: ctrlCostPerUnit },
            { d: `${batAh} Ah Battery Bank (${QB_BATTERY_NOMINAL_V}V nominal, includes ${QB_BATTERY_HEADROOM_W}W headroom)`.replace(/Lithium|LiFePO4/gi, '').replace(/\s+/g, ' ').trim(), q: 1, p: batPrice, c: batCost },
            { d: 'Mounting Kit — AL6005-T5 Aluminum Rails (250kph wind rating)', q: 1, p: mount.price, c: mount.cost },
            { d: 'Electrical Balance of System — DC/AC protection, 4mm solar cable, grounding', q: 1, p: bos.price, c: bos.cost },
            { d: 'Installation, Engineering & PEE Sign-off', q: 1, p: instPrice, c: instCost }
        ];
        return { systemKw, panelW, panelQty, invKw: inv.kw, batAh, peakW, totalConnectedW };
    }

    function apBuildQuote() {
        if (!apRows.length) { toast('Add at least one appliance first', 'error'); return; }
        apReadParams();
        const t = apTotals();
        if (t.kwh <= 0) { toast('Set Watts, Qty and Hrs/day for your appliances', 'error'); return; }

        apMode = 'appliances';
        apBillSource = null;
        const r = apSizeFromEnergy(t.kwh, t.peakW);
        apHasBuilt = true;
        apRenderSummary();

        const div = apProfile.diversity;
        const note = `<i class="fas fa-circle-info"></i> Total Connected <strong>${t.peakW.toLocaleString()} W</strong> ` +
            `(from appliance list) and <strong>${t.kwh.toFixed(2)} kWh/day</strong>: ` +
            `${r.systemKw} kW array (Total Connected + 1 kW) · ${r.panelQty} × ${r.panelW}W panels · ${r.invKw}kW inverter (Total Connected + 50%) · ${r.batAh} Ah battery.`;
        const el = $('#apSizingNote'); if (el) el.innerHTML = note;
        toast('Quote built from appliance wattage', 'success');
    }

    /* ---- Build quote from monthly bill OR monthly kWh — no appliance itemization ---- */
    function apBuildFromBill() {
        apReadParams();
        const rate = +$('#apRate').value || 12.27;
        const billAmt = +($('#apMonthlyBill')?.value) || 0;
        const kwhAmt  = +($('#apMonthlyKwh')?.value) || 0;
        let dailyKwh = 0, basis = '', basisDetail = '';
        if (kwhAmt > 0) {
            dailyKwh = kwhAmt / 30;
            basis = 'kwh';
            basisDetail = `${kwhAmt.toLocaleString()} kWh/month`;
        } else if (billAmt > 0 && rate > 0) {
            dailyKwh = (billAmt / rate) / 30;
            basis = 'bill';
            basisDetail = `₱${billAmt.toLocaleString()}/month ÷ ₱${rate.toFixed(2)}/kWh`;
        } else {
            toast('Enter Monthly Bill or Monthly kWh first', 'error');
            return;
        }

        apMode = 'bill';
        const r = apSizeFromEnergy(dailyKwh, 0);
        apBillSource = { dailyKwh, peakW: apProfile.peakW, basis, billAmt, kwhAmt };
        apHasBuilt = true;
        apRenderSummary();

        const note = `<i class="fas fa-circle-info"></i> Sized from <strong>${basisDetail}</strong> ` +
            `→ <strong>${dailyKwh.toFixed(2)} kWh/day</strong>: ` +
            `${r.systemKw} kW array (Total Connected + 1 kW) · ${r.panelQty} × ${r.panelW}W panels · ${r.invKw}kW inverter (Total Connected + 50%) · ${r.batAh} Ah battery. ` +
            `<em>Appliance list ignored — quotation uses an aggregate load line.</em>`;
        const el = $('#apSizingNote'); if (el) el.innerHTML = note;
        toast('Quote built from monthly bill', 'success');
    }

    function apCalcTotal() {
        const componentTotal = apComponents.reduce((s, it) => s + (+it.q || 0) * (+it.p || 0), 0);
        const componentCost  = apComponents.reduce((s, it) => s + (+it.q || 0) * (+it.c || 0), 0);
        const netMeter = apNetMeter ? QB_NET_METER_PRICE : 0;
        const total = componentTotal + netMeter;
        // Net Proceed = sell − cost on components only (net-meter is pass-through, no cost)
        const netProceed = componentTotal - componentCost;
        return { componentTotal, componentCost, netMeter, total, netProceed };
    }

    /* ---- Auto-fit appliance Hrs/day so the appliance list aggregates to the
           daily kWh implied by Monthly Bill (or Monthly kWh). Each appliance's
           hours are scaled proportionally; rows with 0 hours seed at 1 h/day so
           they participate in the distribution. ---- */
    function apFitHoursFromBill() {
        if (!apRows.length) { toast('Add at least one appliance first', 'error'); return; }
        const rate = +($('#apRate')?.value) || 12.27;
        const billAmt = +($('#apMonthlyBill')?.value) || 0;
        const kwhAmt  = +($('#apMonthlyKwh')?.value) || 0;
        let targetDaily = 0, basisDetail = '';
        if (kwhAmt > 0) { targetDaily = kwhAmt / 30; basisDetail = `${kwhAmt.toLocaleString()} kWh/mo`; }
        else if (billAmt > 0 && rate > 0) { targetDaily = (billAmt / rate) / 30; basisDetail = `₱${billAmt.toLocaleString()}/mo`; }
        else { toast('Enter Monthly Bill or Monthly kWh first', 'error'); return; }

        // Seed any zero-hour rows so they take part in the distribution.
        let seeded = 0;
        apRows.forEach(r => {
            const w = +r.w || 0, q = +r.q || 1;
            if (w > 0 && q > 0 && (!+r.h || +r.h <= 0)) { r.h = 1; seeded++; }
        });
        // Current daily kWh (after seeding).
        let currentDaily = 0;
        apRows.forEach(r => {
            const w = +r.w || 0, q = +r.q || 1, h = +r.h || 0;
            currentDaily += (w * q * h) / 1000;
        });
        if (currentDaily <= 0) { toast('Set Watts and Qty for at least one appliance first', 'error'); return; }
        const factor = targetDaily / currentDaily;
        apRows.forEach(r => {
            const w = +r.w || 0, q = +r.q || 1, h = +r.h || 0;
            if (w > 0 && q > 0 && h > 0) {
                let nh = h * factor;
                // Clamp to 0–24 h/day and round to 0.25.
                nh = Math.min(24, Math.max(0, Math.round(nh * 4) / 4));
                r.h = nh;
            }
        });
        apRenderRows();
        if (apHasBuilt) apRenderSummary();
        const t = apTotals();
        toast(`Hours scaled ×${factor.toFixed(2)} to fit ${basisDetail} → ${t.kwh.toFixed(2)} kWh/day` + (seeded ? ` (seeded ${seeded} row${seeded > 1 ? 's' : ''})` : ''), 'success');
    }

    function apRenderSummary() {
        const t = apTotals();
        const tot = apCalcTotal();
        // In bill-mode the appliance totals are not relevant — show derived figures instead
        const peakDisplay = (apMode === 'bill' && apHasBuilt)
            ? `${(apProfile.peakW || 0).toLocaleString()} W est.`
            : `${t.peakW.toLocaleString()} W`;
        const kwhDisplay = (apMode === 'bill' && apHasBuilt)
            ? `${(apProfile.dailyKwh || 0).toFixed(2)} kWh`
            : `${t.kwh.toFixed(2)} kWh`;
        const sourceLabel = (apMode === 'bill' && apBillSource)
            ? (apBillSource.basis === 'kwh'
                ? `From bill: ${apBillSource.kwhAmt.toLocaleString()} kWh/mo`
                : `From bill: ₱${apBillSource.billAmt.toLocaleString()}/mo`)
            : `${apRows.filter(r => +r.w > 0).length} appliance(s)`;
        const profile = `
            <div class="qb-profile">
                <div><small>${apMode === 'bill' ? 'Source' : 'Total Connected'}</small><strong>${apMode === 'bill' ? sourceLabel : peakDisplay}</strong></div>
                <div><small>Daily Consumption</small><strong>${kwhDisplay}</strong></div>
                <div><small>System Size</small><strong>${(apProfile.systemKw || 0).toFixed(2)} kW</strong></div>
                <div><small>${apMode === 'bill' ? 'Estimated Peak' : 'Diversity'}</small><strong>${apMode === 'bill' ? peakDisplay : ((+$('#apDiversity').value || 0.7) * 100).toFixed(0) + '%'}</strong></div>
            </div>`;

        if (!apHasBuilt || !apComponents.length) {
            $('#apSummary').innerHTML = profile +
                `<p class="muted" style="margin-top:10px"><i class="fas fa-circle-info"></i> Click <strong>Build Quote from Wattage</strong> to itemize appliances, or <strong>Build from Monthly Bill</strong> for an aggregate quote.</p>`;
            $('#apRoi').innerHTML = '';
            return;
        }

        const breakdown = apComponents.map((it, i) => {
            const sub = (+it.q || 0) * (+it.p || 0);
            return `
            <div class="qb-line ap-edit-line">
                <span class="ap-desc" title="${(it.d || '').replace(/"/g, '&quot;')}">${it.d}</span>
                <span class="ap-edit-fields">
                    <input type="number" class="ap-edit ap-edit-qty" data-i="${i}" data-f="q" value="${+it.q || 0}" min="0" step="1" title="Quantity">
                    <span class="ap-edit-x">×</span>
                    <input type="number" class="ap-edit ap-edit-price" data-i="${i}" data-f="p" value="${+it.p || 0}" min="0" step="1" title="Unit price (₱)">
                    <span class="ap-edit-eq">=</span>
                    <span class="ap-edit-sub" data-i="${i}">${fmtMoney(sub)}</span>
                    <input type="number" class="ap-edit ap-edit-cost" data-i="${i}" data-f="c" value="${+it.c || 0}" min="0" step="1" title="Unit cost (₱) — internal, not printed" data-print-hide="1">
                </span>
            </div>`;
        }).join('');
        const netLine = apNetMeter
            ? `<div class="qb-line netmeter"><span>Net Metering &amp; Permitting</span><span>${fmtMoney(tot.netMeter)}</span></div>` : '';
        const modeBadge = apMode === 'bill'
            ? `<div class="qb-line" style="background:rgba(14,165,233,.08);color:#0ea5e9;font-size:.78rem"><span><i class="fas fa-receipt"></i> Aggregate Mode (no appliance itemization)</span><span></span></div>` : '';

        // Net Proceed (admin-only — never rendered into printQuote/PDF).
        const margin = tot.componentTotal > 0 ? (tot.netProceed / tot.componentTotal * 100) : 0;
        const netProceedBlock = `
            <div class="qb-net-proceed" data-print-hide="1">
                <div class="qb-np-title"><i class="fas fa-coins"></i> Net Proceed (internal — not printed)</div>
                <div class="qb-line"><span>Total Component Cost</span><span>${fmtMoney(tot.componentCost)}</span></div>
                <div class="qb-line"><span>Total Sell (components)</span><span>${fmtMoney(tot.componentTotal)}</span></div>
                <div class="qb-line np-total"><span>Net Proceed</span><span>${fmtMoney(tot.netProceed)} <small>(${margin.toFixed(1)}% margin)</small></span></div>
            </div>`;

        $('#apSummary').innerHTML = `
            ${profile}
            ${modeBadge}
            <div class="qb-cost-list">
                ${breakdown}
                <div class="qb-line subtotal"><span>Total Investment</span><span>${fmtMoney(tot.componentTotal)}</span></div>
                ${netLine}
                <div class="qb-line grand"><span>GRAND TOTAL</span><span>${fmtMoney(tot.total)}</span></div>
            </div>
            ${netProceedBlock}
        `;
        apRenderRoi();
    }

    function apRenderRoi() {
        const rate = +$('#apRate').value || 0;
        const days = +$('#apDays').value || 365;
        const tot = apCalcTotal();
        const dailyKwh = +apProfile.dailyKwh || 0;
        // Prefer the actual monthly bill the user typed (if any) so the ROI panel
        // can compare apples to apples against the grid bill.
        const billAmt = +($('#apMonthlyBill')?.value) || 0;
        const kwhAmt  = +($('#apMonthlyKwh')?.value) || 0;
        const monthlyBillCurrent = billAmt > 0 ? billAmt : (kwhAmt > 0 ? kwhAmt * rate : 0);
        if (!apHasBuilt) {
            $('#apRoi').innerHTML = `<p class="muted">Build the quote first to compute ROI.</p>`;
            return;
        }
        $('#apRoi').innerHTML = buildRoiHTML({
            systemCost: tot.total, dailyKwh, rate, days, monthlyBillCurrent
        });
    }

    function apReadTerms() {
        const get = sel => { const e = $(sel); return e ? (e.value || '').trim() : ''; };
        return {
            quoteNo:      get('#apQuoteNo'),
            validity:     +($('#apValidity')?.value) || 30,
            projectTitle: get('#apProjectTitle'),
            notes:        get('#apNotes')
        };
    }

    function apBuildItems() {
        const items = [];
        if (apMode === 'bill' && apBillSource) {
            // Aggregate — no appliance itemization. Single descriptive line.
            const src = apBillSource;
            const label = src.basis === 'kwh'
                ? `Estimated load — ${src.kwhAmt.toLocaleString()} kWh/month (≈ ${src.dailyKwh.toFixed(2)} kWh/day)`
                : `Estimated load — ₱${src.billAmt.toLocaleString()}/month bill (≈ ${src.dailyKwh.toFixed(2)} kWh/day)`;
            items.push({ d: '— ESTIMATED ELECTRICAL LOAD —', q: 0, p: 0, _section: true });
            items.push({ d: label, q: 1, p: 0 });
            items.push({ d: '— SOLAR SYSTEM COMPONENTS —', q: 0, p: 0, _section: true });
        } else {
            // Appliance itemized mode
            const validApps = apRows.filter(r => +r.w > 0 && +r.q > 0);
            if (validApps.length) {
                items.push({ d: '— APPLIANCE / EQUIPMENT LOAD —', q: 0, p: 0, _section: true });
                validApps.forEach(r => {
                    const w = +r.w, q = +r.q, h = +r.h || 0;
                    const dailyKwh = ((w * q * h) / 1000).toFixed(2);
                    items.push({
                        d: `${r.n} — ${w}W × ${h}h/day  (${dailyKwh} kWh/day)`,
                        q: q, p: 0
                    });
                });
                items.push({ d: '— SOLAR SYSTEM COMPONENTS —', q: 0, p: 0, _section: true });
            }
        }
        apComponents.forEach(it => items.push({ ...it }));
        if (apNetMeter) items.push({
            d: 'Net Metering & Permitting (LGU + DIS/DAS + Meter + ERC + Docs + EE Cert.)',
            q: 1, p: QB_NET_METER_PRICE
        });
        return items;
    }

    /* ---- Wire up appliance-based events ---- */
    $('#apAddRowBtn')?.addEventListener('click', () => {
        apRows.push({ n: 'LED Bulb (9W)', w: 9, q: 1, h: 5 });
        apRenderRows();
    });
    $('#apClearBtn')?.addEventListener('click', () => {
        if (!apRows.length) return;
        if (!confirm('Clear all appliances?')) return;
        apRows = []; apComponents = []; apHasBuilt = false;
        apRenderRows(); apRenderSummary();
    });
    $('#apRows')?.addEventListener('input', e => {
        const inp = e.target.closest('.ap-edit'); if (!inp) return;
        const i = +inp.dataset.i, f = inp.dataset.f;
        if (!apRows[i]) return;
        let v = inp.value;
        if (['w', 'q', 'h'].includes(f)) v = +v;
        apRows[i][f] = v;
        // recompute totals & this row's derived cells
        const t = apTotals();
        $('#apTotalKwh').textContent = `${t.kwh.toFixed(2)} kWh`;
        $('#apTotalPeak').textContent = `${t.peakW.toLocaleString()} W`;
        const tr = inp.closest('tr');
        if (tr) {
            const r = apRows[i];
            const w = +r.w || 0, q = +r.q || 0, h = +r.h || 0;
            tr.querySelector('.ap-sub-kwh').textContent = ((w * q * h) / 1000).toFixed(2);
            tr.querySelector('.ap-sub-peak').textContent = (w * q).toLocaleString();
        }
    });
    $('#apRows')?.addEventListener('change', e => {
        // If user picks a known appliance from <select>, auto-fill its watts
        const sel = e.target.closest('select.ap-edit'); if (!sel || sel.dataset.f !== 'n') return;
        const i = +sel.dataset.i; if (!apRows[i]) return;
        const opt = sel.selectedOptions[0];
        const w = +opt?.dataset.w || 0;
        // "Custom — enter manually" → clear name so the row re-renders as a text input
        if (sel.value === 'Custom — enter manually') {
            apRows[i].n = '';
            apRows[i].w = 0;
        } else {
            apRows[i].n = sel.value;
            if (w > 0) apRows[i].w = w;
        }
        apRenderRows();
    });
    $('#apRows')?.addEventListener('click', e => {
        const b = e.target.closest('.qb-del'); if (!b) return;
        apRows.splice(+b.dataset.i, 1);
        apRenderRows();
    });
    $('#apPreset')?.addEventListener('change', e => {
        const k = e.target.value; if (!k) return;
        const list = AP_PRESETS[k]; if (!list) return;
        apRows = list.map(x => ({ ...x }));
        apComponents = []; apHasBuilt = false;
        apRenderRows(); apRenderSummary();
        toast(`${k.charAt(0).toUpperCase() + k.slice(1)} preset loaded`, 'success');
        e.target.value = '';
    });
    ['apConsumerType', 'apSunHours', 'apSysEff', 'apDiversity', 'apRate', 'apDays'].forEach(id => {
        const el = $('#' + id); if (!el) return;
        el.addEventListener('input', () => { apReadParams(); if (apHasBuilt) apRenderSummary(); else { const t = apTotals(); $('#apTotalKwh').textContent = `${t.kwh.toFixed(2)} kWh`; $('#apTotalPeak').textContent = `${t.peakW.toLocaleString()} W`; } });
        el.addEventListener('change', () => { apReadParams(); if (apHasBuilt) apRenderSummary(); });
    });
    $('#apNetMeter')?.addEventListener('change', e => { apNetMeter = e.target.checked; if (apHasBuilt) apRenderSummary(); });
    $('#apBuildQuoteBtn')?.addEventListener('click', apBuildQuote);
    $('#apBuildFromBillBtn')?.addEventListener('click', apBuildFromBill);
    $('#apFitHoursBtn')?.addEventListener('click', apFitHoursFromBill);

    // Live edit of computed quotation rows (qty / unit price) once Build Quote has populated apComponents.
    $('#apSummary')?.addEventListener('input', e => {
        const inp = e.target.closest('.ap-edit'); if (!inp) return;
        const i = +inp.dataset.i, f = inp.dataset.f;
        if (!apComponents[i]) return;
        const v = Math.max(0, +inp.value || 0);
        apComponents[i][f] = v;
        // update only the affected subtotal cell + footer totals (no full re-render → preserves focus)
        const subEl = inp.closest('.ap-edit-line')?.querySelector('.ap-edit-sub');
        if (subEl) subEl.textContent = fmtMoney((+apComponents[i].q || 0) * (+apComponents[i].p || 0));
        const tot = apCalcTotal();
        const cost = $('#apSummary');
        const lines = cost?.querySelectorAll('.qb-cost-list .qb-line');
        if (lines) {
            lines.forEach(l => {
                if (l.classList.contains('subtotal')) l.lastElementChild.textContent = fmtMoney(tot.componentTotal);
                else if (l.classList.contains('grand')) l.lastElementChild.textContent = fmtMoney(tot.total);
            });
        }
        // refresh Net Proceed block (admin-only)
        const npLines = cost?.querySelectorAll('.qb-net-proceed .qb-line');
        if (npLines && npLines.length >= 3) {
            const margin = tot.componentTotal > 0 ? (tot.netProceed / tot.componentTotal * 100) : 0;
            npLines[0].lastElementChild.textContent = fmtMoney(tot.componentCost);
            npLines[1].lastElementChild.textContent = fmtMoney(tot.componentTotal);
            npLines[2].lastElementChild.innerHTML = `${fmtMoney(tot.netProceed)} <small>(${margin.toFixed(1)}% margin)</small>`;
        }
        apRenderRoi();
    });
    $('#apSaveQuoteBtn')?.addEventListener('click', () => {
        if (!apHasBuilt) return toast('Click "Build Quote from Wattage" first', 'error');
        const tot = apCalcTotal();
        if (tot.total <= 0) return toast('Quote total is zero', 'error');
        const terms = apReadTerms();
        const q = {
            id: terms.quoteNo || uid('Q'),
            client: $('#apClientName').value.trim() || 'Walk-in',
            location: $('#apClientLoc').value.trim() || '-',
            date: new Date().toISOString().slice(0, 10),
            type: 'appliance',
            items: apBuildItems(),
            total: tot.total,
            meta: {
                profile: { ...apProfile },
                appliances: apRows.map(r => ({ ...r })),
                componentTotal: tot.componentTotal,
                netMeter: apNetMeter,
                rate: +$('#apRate').value || 12.27,
                terms
            }
        };
        state.quotes.unshift(q); save(); renderQuoteHistory();
        logActivity(`Appliance-based quote ${q.id} (${fmtMoney(tot.total)}) saved`, 'success', 'fa-file-invoice');
        toast('Appliance-based quotation saved');
    });
    $('#apPrintQuoteBtn')?.addEventListener('click', () => {
        if (!apHasBuilt) return toast('Click "Build Quote from Wattage" first', 'error');
        const tot = apCalcTotal();
        if (tot.total <= 0) return toast('Quote total is zero', 'error');
        const terms = apReadTerms();
        printQuote({
            id: terms.quoteNo || uid('Q'),
            client: $('#apClientName').value || 'Walk-in',
            location: $('#apClientLoc').value || '-',
            items: apBuildItems(),
            total: tot.total,
            date: new Date().toISOString().slice(0, 10),
            meta: { profile: { ...apProfile }, terms, netMeter: apNetMeter, rate: +$('#apRate').value || 12.27 }
        });
    });

    // initial render of appliance pane
    apRenderRows();
    apRenderSummary();

    // ============ QUOTATION — MANUAL PRICED (auto wattage, manual amounts) ============
    let mqAppRows = [];           // appliance list — same shape as apRows {n,w,q,h}
    let mqQuoteRows = [];         // quotation lines — {d, q, p, c} (c = unit cost, internal)
    let mqNetMeter = false;
    const MQ_STANDARD_LINES = [
        { d: 'Solar PV Array — Solar Panels',                                                q: 1, p: 0 },
        { d: 'Hybrid Inverter',                                                              q: 1, p: 0 },
        { d: 'Solar Charge Controller (60A per 500W)',                                       q: 1, p: 0 },
        { d: 'Battery Bank (12V nominal)',                                                   q: 1, p: 0 },
        { d: 'Mounting Kit — AL6005-T5 Aluminum Rails (250kph wind rating)',                 q: 1, p: 0 },
        { d: 'Electrical Balance of System — DC/AC protection, 4mm solar cable, grounding', q: 1, p: 0 },
        { d: 'Installation, Engineering & PEE Sign-off',                                     q: 1, p: 0 }
    ];

    function mqTotals() {
        let kwh = 0, peakW = 0;
        mqAppRows.forEach(r => {
            const w = +r.w || 0, q = +r.q || 0, h = +r.h || 0;
            kwh += (w * q * h) / 1000;
            peakW += w * q;
        });
        return { kwh, peakW };
    }

    function mqRenderAppRows() {
        const tb = $('#mqRows'); if (!tb) return;
        if (!mqAppRows.length) {
            tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">
                No appliances added yet. Click <strong>Add Appliance</strong> or load a preset.</td></tr>`;
        } else {
            const opts = AP_COMMON.map(a => `<option value="${a.n}" data-w="${a.w}">${a.n}${a.w ? ` — ${a.w}W` : ''}</option>`).join('');
            tb.innerHTML = mqAppRows.map((r, i) => {
                const w = +r.w || 0, q = +r.q || 0, h = +r.h || 0;
                const sub = (w * q * h) / 1000;
                const peak = w * q;
                const isCommon = AP_COMMON.some(a => a.n === r.n);
                const nameCell = isCommon
                    ? `<select class="qb-edit mq-app-edit" data-i="${i}" data-f="n">${opts.replace(`value="${r.n}"`, `value="${r.n}" selected`)}</select>`
                    : `<input type="text" class="qb-edit mq-app-edit" data-i="${i}" data-f="n" value="${r.n}" placeholder="Appliance / equipment name">`;
                return `<tr>
                    <td>${nameCell}</td>
                    <td><input type="number" class="qb-edit qb-num mq-app-edit" data-i="${i}" data-f="w" value="${w}" min="0" step="1"></td>
                    <td><input type="number" class="qb-edit qb-num mq-app-edit" data-i="${i}" data-f="q" value="${q}" min="1" step="1"></td>
                    <td><input type="number" class="qb-edit qb-num mq-app-edit" data-i="${i}" data-f="h" value="${h}" min="0" max="24" step="0.25"></td>
                    <td class="num-col mq-sub-kwh">${sub.toFixed(2)}</td>
                    <td class="num-col mq-sub-peak">${peak.toLocaleString()}</td>
                    <td><button class="qb-del mq-app-del" data-i="${i}" title="Remove">×</button></td>
                </tr>`;
            }).join('');
        }
        const t = mqTotals();
        $('#mqTotalKwh').textContent = `${t.kwh.toFixed(2)} kWh`;
        $('#mqTotalPeak').textContent = `${t.peakW.toLocaleString()} W`;
    }

    function mqRenderQuoteRows() {
        const tb = $('#mqQuoteRows'); if (!tb) return;
        if (!mqQuoteRows.length) {
            tb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">
                No quotation lines yet. Click <strong>Seed Standard Lines</strong> for a template, or <strong>Add Line</strong> for a custom row.</td></tr>`;
        } else {
            tb.innerHTML = mqQuoteRows.map((r, i) => {
                const q = +r.q || 0, p = +r.p || 0, c = +r.c || 0, sub = q * p;
                return `<tr>
                    <td><input type="text" class="qb-edit mq-quote-edit" data-i="${i}" data-f="d" value="${(r.d || '').replace(/"/g, '&quot;')}" placeholder="Line description"></td>
                    <td><input type="number" class="qb-edit qb-num mq-quote-edit" data-i="${i}" data-f="q" value="${q}" min="0" step="1"></td>
                    <td><input type="number" class="qb-edit qb-num mq-quote-edit" data-i="${i}" data-f="p" value="${p}" min="0" step="0.01"></td>
                    <td class="num-col mq-cost-col" data-print-hide="1"><input type="number" class="qb-edit qb-num mq-quote-edit" data-i="${i}" data-f="c" value="${c}" min="0" step="0.01" title="Internal unit cost — not printed"></td>
                    <td class="num-col mq-sub-amt">${fmtMoney(sub)}</td>
                    <td><button class="qb-del mq-quote-del" data-i="${i}" title="Remove">×</button></td>
                </tr>`;
            }).join('');
        }
        mqUpdateTotals();
    }

    function mqUpdateTotals() {
        const sub  = mqQuoteRows.reduce((s, r) => s + (+r.q || 0) * (+r.p || 0), 0);
        const cost = mqQuoteRows.reduce((s, r) => s + (+r.q || 0) * (+r.c || 0), 0);
        const grand = sub + (mqNetMeter ? QB_NET_METER_PRICE : 0);
        const np = sub - cost;
        const margin = sub > 0 ? (np / sub * 100) : 0;
        const subEl = $('#mqComponentsTotal'); if (subEl) subEl.textContent = fmtMoney(sub);
        const grandEl = $('#mqGrandTotal'); if (grandEl) grandEl.textContent = fmtMoney(grand);
        const costEl = $('#mqCostTotal'); if (costEl) costEl.textContent = fmtMoney(cost);
        const npEl  = $('#mqNetProceed'); if (npEl) npEl.innerHTML = `${fmtMoney(np)} <small>(${margin.toFixed(1)}%)</small>`;
    }

    function mqBuildItems() {
        const items = [];
        const validApps = mqAppRows.filter(r => +r.w > 0 && +r.q > 0);
        if (validApps.length) {
            items.push({ d: '— APPLIANCE / EQUIPMENT LOAD —', q: 0, p: 0, _section: true });
            validApps.forEach(r => {
                const w = +r.w, q = +r.q, h = +r.h || 0;
                const dailyKwh = ((w * q * h) / 1000).toFixed(2);
                items.push({ d: `${r.n} — ${w}W × ${h}h/day  (${dailyKwh} kWh/day)`, q: q, p: 0 });
            });
            items.push({ d: '— SOLAR SYSTEM COMPONENTS —', q: 0, p: 0, _section: true });
        }
        mqQuoteRows.forEach(r => items.push({ d: r.d || '', q: +r.q || 0, p: +r.p || 0 }));
        if (mqNetMeter) items.push({
            d: 'Net Metering & Permitting (LGU + DIS/DAS + Meter + ERC + Docs + EE Cert.)',
            q: 1, p: QB_NET_METER_PRICE
        });
        return items;
    }

    function mqReadTerms() {
        const get = sel => { const e = $(sel); return e ? (e.value || '').trim() : ''; };
        return {
            quoteNo:      get('#mqQuoteNo'),
            validity:     +($('#mqValidity')?.value) || 30,
            projectTitle: get('#mqProjectTitle'),
            notes:        get('#mqNotes')
        };
    }

    /* ---- Wire up Manual Priced events ---- */
    $('#mqAddRowBtn')?.addEventListener('click', () => {
        mqAppRows.push({ n: 'LED Bulb (9W)', w: 9, q: 1, h: 5 });
        mqRenderAppRows();
    });
    $('#mqClearBtn')?.addEventListener('click', () => {
        if (!mqAppRows.length) return;
        if (!confirm('Clear all appliances?')) return;
        mqAppRows = [];
        mqRenderAppRows();
    });
    $('#mqRows')?.addEventListener('input', e => {
        const inp = e.target.closest('.mq-app-edit'); if (!inp) return;
        const i = +inp.dataset.i, f = inp.dataset.f;
        if (!mqAppRows[i]) return;
        let v = inp.value;
        if (['w', 'q', 'h'].includes(f)) v = +v;
        mqAppRows[i][f] = v;
        const t = mqTotals();
        $('#mqTotalKwh').textContent = `${t.kwh.toFixed(2)} kWh`;
        $('#mqTotalPeak').textContent = `${t.peakW.toLocaleString()} W`;
        const tr = inp.closest('tr');
        if (tr) {
            const r = mqAppRows[i];
            const w = +r.w || 0, q = +r.q || 0, h = +r.h || 0;
            tr.querySelector('.mq-sub-kwh').textContent = ((w * q * h) / 1000).toFixed(2);
            tr.querySelector('.mq-sub-peak').textContent = (w * q).toLocaleString();
        }
    });
    $('#mqRows')?.addEventListener('change', e => {
        const sel = e.target.closest('select.mq-app-edit'); if (!sel || sel.dataset.f !== 'n') return;
        const i = +sel.dataset.i; if (!mqAppRows[i]) return;
        const opt = sel.selectedOptions[0];
        const w = +opt?.dataset.w || 0;
        if (sel.value === 'Custom — enter manually') {
            mqAppRows[i].n = '';
            mqAppRows[i].w = 0;
        } else {
            mqAppRows[i].n = sel.value;
            if (w > 0) mqAppRows[i].w = w;
        }
        mqRenderAppRows();
    });
    $('#mqRows')?.addEventListener('click', e => {
        const b = e.target.closest('.mq-app-del'); if (!b) return;
        mqAppRows.splice(+b.dataset.i, 1);
        mqRenderAppRows();
    });
    $('#mqPreset')?.addEventListener('change', e => {
        const k = e.target.value; if (!k) return;
        const list = AP_PRESETS[k]; if (!list) return;
        mqAppRows = list.map(x => ({ ...x }));
        mqRenderAppRows();
        toast(`${k.charAt(0).toUpperCase() + k.slice(1)} preset loaded`, 'success');
        e.target.value = '';
    });

    // Quotation rows
    $('#mqSeedBtn')?.addEventListener('click', () => {
        if (mqQuoteRows.length && !confirm('Replace existing lines with the standard template?')) return;
        // Derive system size from appliance list (Total Connected + 1 kW allowance, 0.5 kW step)
        const t = mqTotals();
        const totalConnectedW = t.peakW || 0;
        const systemKw = totalConnectedW > 0
            ? Math.max(0.5, Math.ceil((totalConnectedW + QB_SYSTEM_ALLOWANCE_W) / 500) / 2)
            : 5;
        const systemW = Math.round(systemKw * 1000);
        const pr = qbProrate(systemW);
        const halfCost = v => Math.round((+v || 0) * 0.5);
        mqQuoteRows = [
            { d: 'Solar PV Array',                     q: 1, p: pr.panel,      c: halfCost(pr.panel) },
            { d: 'Hybrid Inverter',                    q: 1, p: pr.inverter,   c: halfCost(pr.inverter) },
            { d: 'Solar Charge Controller',            q: 1, p: pr.controller, c: halfCost(pr.controller) },
            { d: 'Battery Bank',                       q: 1, p: pr.battery,    c: halfCost(pr.battery) },
            { d: 'Mounting Kit',                       q: 1, p: pr.mounting,   c: halfCost(pr.mounting) },
            { d: 'Electrical Balance of System',       q: 1, p: pr.bos,        c: halfCost(pr.bos) },
            { d: 'Installation, Engineering & PEE Sign-off', q: 1, p: pr.install, c: halfCost(pr.install) }
        ];
        mqRenderQuoteRows();
        toast(`Seeded ${systemKw} kW system @ ₱${pr.total.toLocaleString()}`, 'success');
    });
    $('#mqAddQuoteRowBtn')?.addEventListener('click', () => {
        mqQuoteRows.push({ d: '', q: 1, p: 0, c: 0 });
        mqRenderQuoteRows();
    });
    $('#mqClearQuoteBtn')?.addEventListener('click', () => {
        if (!mqQuoteRows.length) return;
        if (!confirm('Clear all quotation lines?')) return;
        mqQuoteRows = [];
        mqRenderQuoteRows();
    });
    $('#mqQuoteRows')?.addEventListener('input', e => {
        const inp = e.target.closest('.mq-quote-edit'); if (!inp) return;
        const i = +inp.dataset.i, f = inp.dataset.f;
        if (!mqQuoteRows[i]) return;
        let v = inp.value;
        if (['q', 'p', 'c'].includes(f)) v = +v;
        mqQuoteRows[i][f] = v;
        const tr = inp.closest('tr');
        if (tr) {
            const r = mqQuoteRows[i];
            const sub = (+r.q || 0) * (+r.p || 0);
            tr.querySelector('.mq-sub-amt').textContent = fmtMoney(sub);
        }
        mqUpdateTotals();
    });
    $('#mqQuoteRows')?.addEventListener('click', e => {
        const b = e.target.closest('.mq-quote-del'); if (!b) return;
        mqQuoteRows.splice(+b.dataset.i, 1);
        mqRenderQuoteRows();
    });
    $('#mqNetMeter')?.addEventListener('change', e => { mqNetMeter = e.target.checked; mqUpdateTotals(); });

    $('#mqSaveQuoteBtn')?.addEventListener('click', () => {
        const sub = mqQuoteRows.reduce((s, r) => s + (+r.q || 0) * (+r.p || 0), 0);
        const total = sub + (mqNetMeter ? QB_NET_METER_PRICE : 0);
        if (total <= 0) return toast('Enter at least one line with a price', 'error');
        const terms = mqReadTerms();
        const t = mqTotals();
        const q = {
            id: terms.quoteNo || uid('Q'),
            client: $('#mqClientName').value.trim() || 'Walk-in',
            location: $('#mqClientLoc').value.trim() || '-',
            date: new Date().toISOString().slice(0, 10),
            type: 'manual-priced',
            items: mqBuildItems(),
            total,
            meta: {
                profile: { dailyKwh: +t.kwh.toFixed(2), peakW: t.peakW, systemKw: 0, consumerType: 'manual', sunHours: 0, sysEff: 0 },
                appliances: mqAppRows.map(r => ({ ...r })),
                componentTotal: sub,
                netMeter: mqNetMeter,
                terms
            }
        };
        state.quotes.unshift(q); save(); renderQuoteHistory();
        logActivity(`Manual-priced quote ${q.id} (${fmtMoney(total)}) saved`, 'success', 'fa-file-invoice');
        toast('Manual quotation saved');
    });
    $('#mqPrintQuoteBtn')?.addEventListener('click', () => {
        const sub = mqQuoteRows.reduce((s, r) => s + (+r.q || 0) * (+r.p || 0), 0);
        const total = sub + (mqNetMeter ? QB_NET_METER_PRICE : 0);
        if (total <= 0) return toast('Enter at least one line with a price', 'error');
        const terms = mqReadTerms();
        const t = mqTotals();
        printQuote({
            id: terms.quoteNo || uid('Q'),
            client: $('#mqClientName').value || 'Walk-in',
            location: $('#mqClientLoc').value || '-',
            items: mqBuildItems(),
            total,
            date: new Date().toISOString().slice(0, 10),
            meta: {
                profile: { dailyKwh: +t.kwh.toFixed(2), peakW: t.peakW, systemKw: 0, consumerType: 'manual', sunHours: 0, sysEff: 0 },
                terms,
                netMeter: mqNetMeter
            }
        });
    });

    // initial render
    mqRenderAppRows();
    mqRenderQuoteRows();

    // ============ QUOTATION — MANUAL ============
    let manualItems = [];
    function renderManualItems() {
        let total = 0, totalCost = 0;
        $('#manualItems').innerHTML = manualItems.map((it, i) => {
            const sub = it.q * it.p; total += sub;
            totalCost += it.q * (+it.c || 0);
            return `<tr><td>${it.d}</td><td>${it.q}</td><td>${fmtMoney(it.p)}</td><td class="mq-cost-col" data-print-hide="1">${fmtMoney(+it.c || 0)}</td><td>${fmtMoney(sub)}</td>
                <td><button class="del" data-i="${i}" style="background:var(--red);color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer">×</button></td></tr>`;
        }).join('');
        $('#manualTotal').textContent = fmtMoney(total);
        const np = total - totalCost;
        const margin = total > 0 ? (np / total * 100) : 0;
        const ctEl = $('#manualCostTotal'); if (ctEl) ctEl.textContent = fmtMoney(totalCost);
        const npEl = $('#manualNetProceed'); if (npEl) npEl.innerHTML = `${fmtMoney(np)} <small>(${margin.toFixed(1)}%)</small>`;
    }
    $('#manualItems').addEventListener('click', e => {
        const b = e.target.closest('button.del'); if (!b) return;
        manualItems.splice(+b.dataset.i, 1); renderManualItems();
    });
    $('#addManualItem').addEventListener('click', () => {
        const d = $('#mItem').value.trim(), q = +$('#mQty').value, p = +$('#mPrice').value;
        const c = +($('#mCost')?.value) || 0;
        if (!d || !q || !p) return toast('Fill item fields', 'error');
        manualItems.push({ d, q, p, c });
        $('#mItem').value = ''; $('#mPrice').value = ''; if ($('#mCost')) $('#mCost').value = '';
        renderManualItems();
    });
    $('#saveManualQuote').addEventListener('click', () => {
        if (!manualItems.length) return toast('Add items first', 'error');
        const total = manualItems.reduce((s, it) => s + it.q * it.p, 0);
        const q = {
            id: uid('Q'), client: $('#mClient').value || 'Walk-in', location: $('#mLocation').value || '-',
            date: $('#mDate').value || new Date().toISOString().slice(0, 10),
            type: 'manual', items: [...manualItems], total
        };
        state.quotes.unshift(q); save(); renderQuoteHistory();
        manualItems = []; renderManualItems();
        logActivity(`Manual quote ${q.id} saved`, 'success', 'fa-file-invoice');
        toast('Manual quote saved');
    });
    $('#printManualQuote').addEventListener('click', () => {
        if (!manualItems.length) return toast('Add items first', 'error');
        printQuote({
            client: $('#mClient').value || 'Walk-in', location: $('#mLocation').value || '-',
            items: manualItems, total: manualItems.reduce((s, it) => s + it.q * it.p, 0),
            date: $('#mDate').value || new Date().toISOString().slice(0, 10)
        });
    });

    function renderQuoteHistory() {
        $('#quoteHistoryTable').innerHTML = state.quotes.map(q => `
            <tr>
                <td><strong>${q.id}</strong></td>
                <td>${q.client}</td>
                <td>${q.date}</td>
                <td><span class="status-pill">${q.type}</span></td>
                <td>${fmtMoney(q.total)}</td>
                <td class="actions">
                    <button data-act="print" data-id="${q.id}"><i class="fas fa-print"></i></button>
                    <button data-act="del" data-id="${q.id}" class="del"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No quotations yet.</td></tr>';
    }
    $('#quoteHistoryTable').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const q = state.quotes.find(x => x.id === b.dataset.id); if (!q) return;
        if (b.dataset.act === 'del') { if (confirm('Delete quote ' + q.id + '?')) { state.quotes = state.quotes.filter(x => x.id !== q.id); save(); renderQuoteHistory(); } }
        else if (b.dataset.act === 'print') printQuote(q);
    });

    function printQuote(q) {
        // Customer-facing print → format each component line as
        //   "Canonical Category — Spec (rating)"
        // matching the Pricing.pdf reference (e.g.
        //   "Solar PV Array — Solar Panels (6200 W)").
        const PRINT_CANON = [
            { rx: /solar\s*pv\s*array|pv\s*array|solar\s*panels?/i, label: 'Solar PV Array' },
            { rx: /hybrid\s*inverter|\binverter\b/i, label: 'Hybrid Inverter' },
            { rx: /solar\s*charge\s*controller|mppt|charge\s*controller|controller/i, label: 'Solar Charge Controller' },
            { rx: /battery\s*bank|battery\s*storage|\bbattery\b/i, label: 'Battery Bank' },
            { rx: /mounting\s*kit|aluminum\s*rails|\bmounting\b|\brails\b/i,                      label: 'Mounting Kit' },
            { rx: /balance\s*of\s*system|\bbos\b|electrical\s*bos|dc\/ac/i,                       label: 'Electrical Balance of System' },
            { rx: /installation|engineering|pee\s*sign[- ]?off|labor/i,                           label: 'Installation, Engineering & PEE Sign-off' },
            { rx: /net\s*metering|permitting/i,                                                   label: 'Net Metering & Permitting' }
        ];
        const escRe = (str) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const cleanDesc = (raw) => {
            if (!raw) return '';
            let s = String(raw).trim();
            // Strip leading "N × YW " (e.g. "5 × 1000W ")
            s = s.replace(/^\s*\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*W\s+/i, '');
            // Strip lone leading qty "N × "
            s = s.replace(/^\s*\d+(?:\.\d+)?\s*[×x]\s+/i, '');
            // Match a canonical category and prepend "Canonical — " unless the
            // canonical name is already present in the line.
            for (const c of PRINT_CANON) {
                if (!c.rx.test(s)) continue;
                if (new RegExp(escRe(c.label), 'i').test(s)) return s;
                return `${c.label} — ${s}`;
            }
            return s;
        };

        const rows = q.items.map(it => {
            if (it._section) {
                return `<tr class="sec"><td colspan="4"><strong>${it.d}</strong></td></tr>`;
            }
            const qtyCell = it.q > 0 ? it.q : '';
            const priceCell = it.p > 0 ? fmtMoney(it.p) : '<span style="color:#888">included</span>';
            const subCell = it.p > 0 && it.q > 0 ? fmtMoney(it.q * it.p) : '<span style="color:#888">—</span>';
            return `<tr><td>${cleanDesc(it.d)}</td><td class="col-qty">${qtyCell}</td><td class="col-unit">${priceCell}</td><td class="col-sub">${subCell}</td></tr>`;
        }).join('');
        const meta = q.meta || {};
        const terms = meta.terms || {};
        const profile = meta.profile || {};
        const validity = terms.validity || 30;

        const fmtBlock = (title, txt, icon) => {
            if (!txt) return '';
            const html = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
            return `<div class="block"><h3>${icon} ${title}</h3><div class="block-body">${html}</div></div>`;
        };

        const profileBlock = (profile.dailyKwh || profile.systemKw) ? `
            <div class="block">
                <h3>⚡ Energy Profile &amp; System Sizing</h3>
                <table class="kv">
                    <tr><td>Consumer Type</td><td>${(profile.consumerType || '—').toString().replace(/^\w/, c => c.toUpperCase())}</td>
                        <td>System Size</td><td>${(+profile.systemKw || 0).toFixed(2)} kW</td></tr>
                    <tr><td>Daily Consumption</td><td>${(+profile.dailyKwh || 0).toFixed(2)} kWh</td>
                        <td>Peak Load</td><td>${(+profile.peakW || 0).toLocaleString()} W</td></tr>
                    <tr><td>Sun Hours</td><td>${profile.sunHours || 4.5} h/day</td>
                        <td>System Efficiency</td><td>${((profile.sysEff || 0.8) * 100).toFixed(0)}%</td></tr>
                </table>
            </div>` : '';

        const rate = meta.rate || 12.27;
        const dailyKwh = +profile.dailyKwh || 0;
        const annualSavings = dailyKwh * 365 * rate;
        const payback = annualSavings > 0 ? (q.total / annualSavings) : 0;
        const roiBlock = annualSavings > 0 ? `
            <div class="block">
                <h3>📈 Return on Investment (CAGELCO II @ ₱${rate.toFixed(2)}/kWh)</h3>
                <table class="kv">
                    <tr><td>Annual Savings</td><td><strong>${fmtMoney(annualSavings)}</strong></td>
                        <td>Payback Period</td><td><strong>${payback.toFixed(2)} years</strong></td></tr>
                    <tr><td>25-yr Lifetime Savings</td><td colspan="3"><strong>${fmtMoney(annualSavings * 25)}</strong></td></tr>
                </table>
            </div>` : '';

        const html = `<!DOCTYPE html><html><head><title>Quotation ${q.id || ''}</title>
            <style>
                @page{size:A4;margin:18mm}
                html,body{margin:0;padding:0}
                body{font-family:Arial,sans-serif;color:#111;font-size:13px;line-height:1.45}
                h1{color:#f59e0b;margin:0 0 4px 0;font-size:20px}
                h2{color:#f59e0b;font-size:15px;margin:18px 0 8px}
                h3{color:#111;font-size:13px;margin:10px 0 6px;border-bottom:1px solid #f59e0b;padding-bottom:3px}
                table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
                th,td{border:1px solid #999;padding:7px 8px;text-align:left;vertical-align:top}
                th{background:#fff7e6;color:#92400e}
                table.kv td{border:1px solid #ddd;padding:5px 8px}
                table.kv td:nth-child(odd){background:#fafafa;color:#555;width:22%}
                tr.sec td{background:#fff3d6;color:#92400e;letter-spacing:.5px;font-size:11.5px}
                /* Print: hide Qty + Unit Price columns — quotation shows description + total only */
                @media print{
                    .col-qty, th.qty-col, .col-unit, th.price-col{display:none!important}
                }
                .total{font-size:1.25rem;text-align:right;color:#f59e0b;font-weight:bold;padding:10px;border-top:2px solid #f59e0b;margin-top:6px}
                .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f59e0b;padding-bottom:10px;margin-bottom:10px;gap:14px}
                .brand{display:flex;align-items:center;gap:14px}
                .brand-logo{width:64px;height:64px;object-fit:contain;border-radius:50%;border:1px solid #f59e0b;background:#fff;padding:2px;flex:0 0 64px}
                .head h1{margin-bottom:2px} .head p{margin:2px 0;font-size:11px;color:#555}
                .meta{text-align:right;font-size:11px}
                .meta strong{color:#f59e0b;font-size:14px;display:block}
                .block{margin:12px 0;page-break-inside:avoid}
                .block-body{font-size:12px;background:#fafafa;padding:8px 12px;border-left:3px solid #f59e0b;border-radius:3px}
                .footer{margin-top:24px;padding-top:14px;border-top:1px solid #ccc;font-size:10.5px;color:#666;display:flex;justify-content:space-between}
                .sig{margin-top:32px;display:flex;justify-content:space-between;gap:30px;page-break-inside:avoid}
                .sig div{flex:1;text-align:center;border-top:1px solid #333;padding-top:5px;font-size:11px}
            </style></head><body>
            <div class="head">
                <div class="brand">
                    <img src="${new URL('logopdf.png', location.href).href}" alt="Topshelf Solar Tech Logo" class="brand-logo">
                    <div>
                        <h1>TOPSHELF SOLAR TECH &amp; INNOVATIONS</h1>
                        <p>Tuguegarao City, Cagayan • 09560233864</p>
                        <p>topshelfsolartech.com</p>
                    </div>
                </div>
                <div class="meta">
                    <strong>QUOTATION</strong>
                    No. ${q.id || uid('Q')}<br>
                    Date: ${q.date}<br>
                    Valid for: ${validity} days
                </div>
            </div>

            <table class="kv" style="margin-top:0">
                <tr><td>Client</td><td><strong>${q.client}</strong></td><td>Location</td><td>${q.location || '-'}</td></tr>
                ${terms.projectTitle ? `<tr><td>Project</td><td colspan="3"><strong>${terms.projectTitle}</strong></td></tr>` : ''}
            </table>

            ${profileBlock}

            <h2>Itemized Components</h2>
            <table><thead><tr><th>Description</th><th class="qty-col">Qty</th><th class="price-col">Unit Price</th><th class="sub-col">Subtotal</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <div class="total">GRAND TOTAL: ${fmtMoney(q.total)}</div>

            ${roiBlock}
            ${fmtBlock('Scope of Work', terms.scope, '🛠')}
            ${fmtBlock('Inclusions', terms.inclusions, '✅')}
            ${fmtBlock('Exclusions', terms.exclusions, '⛔')}
            ${fmtBlock('Payment Terms', terms.payment, '💳')}
            ${fmtBlock('Warranty', terms.warranty, '🛡')}
            ${fmtBlock('Notes / Remarks', terms.notes, '📝')}

            <div class="sig">
                <div>Prepared by<br><br>____________________________<br><small>Topshelf Solar Tech &amp; Innovations</small></div>
                <div>Conforme<br><br>____________________________<br><small>${q.client}</small></div>
            </div>

            <div class="footer">
                <span>This quotation is valid for ${validity} days from the date issued.</span>
                <span>Thank you for choosing Topshelf Solar Tech.</span>
            </div>
            </body></html>`;

        // Use a hidden iframe so the print dialog inherits the parent page URL
        // (avoids the "about:blank" footer that browsers add to popup windows).
        const oldFrame = document.getElementById('quotePrintFrame');
        if (oldFrame) oldFrame.remove();
        const iframe = document.createElement('iframe');
        iframe.id = 'quotePrintFrame';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.className = 'print-frame';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
        // Override the parent page title briefly so the print dialog shows the quote name
        const prevTitle = document.title;
        document.title = `Quotation ${q.id || ''} - ${q.client || ''}`.trim();
        const restore = () => { document.title = prevTitle; };
        let printed = false;
        const triggerPrint = () => {
            if (printed) return; printed = true;
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
            catch (e) { console.warn('Print failed', e); }
            setTimeout(restore, 1000);
        };
        iframe.onload = () => {
            // Wait for logo image (and any other assets) to finish loading
            // before opening the print dialog so the logo appears in the preview.
            const imgs = Array.from(iframe.contentWindow.document.images || []);
            const pending = imgs.filter(im => !im.complete);
            if (pending.length === 0) { setTimeout(triggerPrint, 200); return; }
            let left = pending.length;
            const done = () => { if (--left <= 0) setTimeout(triggerPrint, 100); };
            pending.forEach(im => { im.addEventListener('load', done); im.addEventListener('error', done); });
            // Fallback: print after 2s regardless
            setTimeout(triggerPrint, 2000);
        };
    }

    // ============ TABS ============
    // Scope pane-toggling to the same view/section as the clicked tab so multiple
    // tab groups across the app don't interfere with each other.
    $$('.tab').forEach(t => t.addEventListener('click', () => {
        const grp = t.parentElement;                  // .tabs
        const scope = grp.closest('.view') || grp.parentElement || document;
        $$('.tab', grp).forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const target = t.dataset.tab;
        $$('.tab-pane', scope).forEach(p => p.classList.toggle('active', p.dataset.pane === target));
    }));

    // ============ SPRINKLERS ============
    function renderSprinklers() {
        $('#sprinklerList').innerHTML = state.sprinklers.map(s => {
            const cls = s.spraying ? 'spraying' : '';
            const icon = s.spraying ? '<span class="spray-anim"><i class="fas fa-droplet"></i></span>' : '<i class="fas fa-shower" style="color:var(--blue)"></i>';
            return `<div class="sprinkler-item ${cls}">
                ${icon}
                <div class="sp-info"><strong>${s.name}</strong><small>${s.id} • Last clean: ${s.lastClean || '—'}</small></div>
                <button data-id="${s.id}" data-act="toggle">${s.spraying ? 'Stop' : 'Spray Now'}</button>
            </div>`;
        }).join('') || '<p class="muted">No sprinklers installed.</p>';
    }
    $('#sprinklerList').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        toggleSprinkler(b.dataset.id, true);
    });

    function toggleSprinkler(id, manual) {
        const s = state.sprinklers.find(x => x.id === id); if (!s) return;
        const dev = state.devices.find(d => d.id === id);
        if (s.spraying) {
            s.spraying = false; if (dev) dev.spraying = false;
            s.lastClean = nowStr();
            state.cleaningLog.unshift({ text: `${s.name} cleaning cycle completed${manual ? ' (manual)' : ''}`, type: 'success', icon: 'fa-circle-check', time: nowStr() });
        } else {
            // rain-skip check
            if (state.triggers.rainSkip && Math.random() < 0.05) {
                state.cleaningLog.unshift({ text: `${s.name}: cleaning cancelled (rain detected)`, type: 'warn', icon: 'fa-cloud-rain', time: nowStr() });
                save(); renderCleaningLog();
                toast('Rain detected — cleaning skipped', 'warn');
                return;
            }
            s.spraying = true; if (dev) dev.spraying = true;
            state.cleaningLog.unshift({ text: `${s.name} cleaning started${manual ? ' (manual trigger)' : ''}`, type: 'info', icon: 'fa-droplet', time: nowStr() });
            // auto-stop after 8 seconds
            setTimeout(() => toggleSprinkler(id, false), 8000);
        }
        // reset soiling on panels of same client
        if (!s.spraying) {
            state.devices.forEach(d => { if (d.clientId === s.clientId && d.type === 'panel') d.soiling = Math.max(0, (d.soiling || 0) - 30); });
        }
        state.cleaningLog = state.cleaningLog.slice(0, 50);
        save(); renderSprinklers(); renderCleaningLog();
    }

    function renderCleaningLog() {
        $('#cleaningLog').innerHTML = state.cleaningLog.slice(0, 20).map(l =>
            `<li class="${l.type}"><i class="fas ${l.icon}"></i><span class="meta">${l.text}</span><time>${l.time}</time></li>`
        ).join('') || '<li class="meta muted">No cleaning history yet.</li>';
    }

    // Bind trigger inputs
    function bindTriggers() {
        const t = state.triggers;
        $('#trigDust').checked = t.dust;
        $('#dustThresh').value = t.dustThresh;
        $('#trigTemp').checked = t.temp;
        $('#tempThresh').value = t.tempThresh;
        $('#trigSchedule').checked = t.schedule;
        $('#schedTime').value = t.schedTime;
        $('#trigEfficiency').checked = t.efficiency;
        $('#trigRainSkip').checked = t.rainSkip;
        ['trigDust', 'trigTemp', 'trigSchedule', 'trigEfficiency', 'trigRainSkip', 'dustThresh', 'tempThresh', 'schedTime'].forEach(id => {
            $('#' + id).addEventListener('change', () => {
                state.triggers = {
                    dust: $('#trigDust').checked, dustThresh: +$('#dustThresh').value,
                    temp: $('#trigTemp').checked, tempThresh: +$('#tempThresh').value,
                    schedule: $('#trigSchedule').checked, schedTime: $('#schedTime').value,
                    efficiency: $('#trigEfficiency').checked, rainSkip: $('#trigRainSkip').checked
                };
                save();
                toast('Trigger settings updated');
            });
        });
    }

    let lastSchedRun = '';
    function checkAutoTriggers() {
        const t = state.triggers;
        // dust trigger
        if (t.dust) {
            state.sprinklers.forEach(s => {
                if (s.spraying) return;
                const dirty = state.devices.find(d => d.clientId === s.clientId && d.type === 'panel' && (d.soiling || 0) > t.dustThresh);
                if (dirty) {
                    state.cleaningLog.unshift({ text: `${s.name} auto-triggered: panel soiling ${dirty.soiling.toFixed(0)}% > ${t.dustThresh}%`, type: 'info', icon: 'fa-bolt', time: nowStr() });
                    toggleSprinkler(s.id, false);
                }
            });
        }
        // temp trigger
        if (t.temp) {
            state.sprinklers.forEach(s => {
                if (s.spraying) return;
                const hot = state.devices.find(d => d.clientId === s.clientId && d.type === 'panel' && (d.temp || 0) > t.tempThresh);
                if (hot) {
                    state.cleaningLog.unshift({ text: `${s.name} auto-triggered: panel temp ${hot.temp.toFixed(1)}°C > ${t.tempThresh}°C`, type: 'warn', icon: 'fa-temperature-high', time: nowStr() });
                    toggleSprinkler(s.id, false);
                }
            });
        }
        // scheduled trigger
        if (t.schedule) {
            const now = new Date();
            const hhmm = now.toTimeString().slice(0, 5);
            const key = now.toISOString().slice(0, 10) + ' ' + t.schedTime;
            if (hhmm === t.schedTime && lastSchedRun !== key) {
                lastSchedRun = key;
                state.sprinklers.forEach(s => { if (!s.spraying) toggleSprinkler(s.id, false); });
                state.cleaningLog.unshift({ text: `Scheduled cleaning ran (${t.schedTime})`, type: 'success', icon: 'fa-clock', time: nowStr() });
            }
        }
        renderCleaningLog();
    }

    // ============ SETTINGS ============
    $('#saveCreds').addEventListener('click', () => {
        const u = $('#setUser').value.trim(), p = $('#setPass').value;
        if (u) state.creds.user = u;
        if (p) state.creds.pass = p;
        save(); toast('Credentials updated. Use them on next login.');
        $('#currentUser').textContent = state.creds.user;
    });
    $('#savePricing').addEventListener('click', () => {
        state.pricing = {
            watt: +$('#priceWatt').value, battery: +$('#priceBattery').value,
            inverter: +$('#priceInverter').value, labor: +$('#priceLabor').value
        };
        save(); toast('Pricing saved');
    });
    $('#exportData').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `topshelf-admin-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    });
    $('#seedData').addEventListener('click', () => { seedDemoData(true); toast('Demo data loaded'); });
    $('#resetData').addEventListener('click', () => {
        if (confirm('This will erase ALL admin data and return to defaults. Continue?')) {
            localStorage.removeItem(STORE);
            location.reload();
        }
    });

    function loadSettingsForm() {
        $('#priceWatt').value = state.pricing.watt;
        $('#priceBattery').value = state.pricing.battery;
        $('#priceInverter').value = state.pricing.inverter;
        $('#priceLabor').value = state.pricing.labor;
    }

    // ============ MODAL ============
    function modal(title, html) {
        $('#modalTitle').textContent = title;
        $('#modalBody').innerHTML = html;
        $('#modalOverlay').hidden = false;
    }
    function closeModal() { $('#modalOverlay').hidden = true; }
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });

    // ============ DEMO DATA ============
    function seedDemoData(force) {
        if (!force && state.clients.length > 0) return;
        if (force) { state.clients = []; state.devices = []; state.sprinklers = []; }
        const demo = [
            { name: 'Pedro Reyes',         location: 'Aparri, Cagayan',                phone: '09171110001', systemKw: 8,  panelCount: 12, sprinklerCount: 3 },
            { name: 'Maria Santos',        location: 'Gattaran, Cagayan',              phone: '09171110002', systemKw: 3,  panelCount: 6,  sprinklerCount: 1 },
            { name: 'Jose Bautista',       location: 'Camalaniugan, Cagayan',          phone: '09171110003', systemKw: 5,  panelCount: 8,  sprinklerCount: 2 },
            { name: 'Ana Villanueva',      location: 'Sta. Ana, Cagayan',              phone: '09171110004', systemKw: 10, panelCount: 16, sprinklerCount: 4 },
            { name: 'Ramon Aquino',        location: 'Gonzaga, Cagayan',               phone: '09171110005', systemKw: 6,  panelCount: 10, sprinklerCount: 2 },
            { name: 'Liza Domingo',        location: 'Aparri, Cagayan',                phone: '09171110006', systemKw: 4,  panelCount: 8,  sprinklerCount: 2 },
            { name: 'Eduardo Macaraeg',    location: 'Aparri, Cagayan',                phone: '09171110007', systemKw: 12, panelCount: 18, sprinklerCount: 5 },
            { name: 'Cristina Pascual',    location: 'Gattaran, Cagayan',              phone: '09171110008', systemKw: 5,  panelCount: 8,  sprinklerCount: 2 },
            { name: 'Antonio Gabriel',     location: 'Gattaran, Cagayan',              phone: '09171110009', systemKw: 7,  panelCount: 11, sprinklerCount: 3 },
            { name: 'Rosario Mendoza',     location: 'Carig, Tuguegarao City',         phone: '09171110010', systemKw: 6,  panelCount: 10, sprinklerCount: 2 },
            { name: 'Benjamin Tolentino',  location: 'Carig, Tuguegarao City',         phone: '09171110011', systemKw: 9,  panelCount: 14, sprinklerCount: 3 },
            { name: 'Margarita Salonga',   location: 'Carig, Tuguegarao City',         phone: '09171110012', systemKw: 4,  panelCount: 8,  sprinklerCount: 1 },
            { name: 'Felipe Cabrera',      location: 'Linao, Tuguegarao City',         phone: '09171110013', systemKw: 5,  panelCount: 8,  sprinklerCount: 2 },
            { name: 'Teresita Galvez',     location: 'Linao, Tuguegarao City',         phone: '09171110014', systemKw: 8,  panelCount: 12, sprinklerCount: 3 },
            { name: 'Rolando Esguerra',    location: 'Linao, Tuguegarao City',         phone: '09171110015', systemKw: 10, panelCount: 16, sprinklerCount: 4 }
        ];
        demo.forEach(d => {
            const c = { id: uid('CL'), ...d, installed: '2025-' + String(Math.floor(Math.random() * 12) + 1).padStart(2, '0') + '-15' };
            state.clients.push(c);
            provisionDevicesForClient(c);
        });
        // All devices start ONLINE — no seeded faults (Phase 17).
        logActivity('Demo data loaded — 15 clients provisioned (Aparri, Gattaran, Camalaniugan, Sta. Ana, Gonzaga, Carig & Linao Tuguegarao)', 'success', 'fa-flask');
        save();
        renderClients(); renderDevices(); renderSprinklers();
    }

})();
}); // end DOMContentLoaded
