    // ============ QUOTATION — BUILDER (manual, based on Quotation.docx) ============

    /* ---- PRESETS from Quotation.docx ---- */
    // Each preset mirrors a complete option from the source document.
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
    const QB_PANEL_WATTS = [60, 120, 240, 500, 1000];

    // Default starter rows when nothing is loaded yet.
    const QB_DEFAULT_ROWS = [
        { name: 'Solar PV Array',       detail: 'Tier-1 Panels', panelW: 1000, qty: 1, price: 15700 },
        { name: 'Hybrid Inverter',      detail: 'kW Dual MPPT (Power Inverter)', invKw: 5,  qty: 1, price: 40000 },
        { name: 'Battery Storage',      detail: 'Battery', batKwh: 5,  qty: 1, price: 25000 },
        { name: 'Mounting Kit',         detail: 'AL6005-T5 Aluminum Rails (250kph Wind Rating)', qty: 1, price: 15000 },
        { name: 'Electrical BOS',       detail: 'DC/AC Protection, 4mm Solar Cables, Grounding', qty: 1, price: 20000 },
        { name: 'Installation & Labor', detail: 'Professional Engineering & PEE Sign-off', qty: 1, price: 20000 }
    ];

    // The component-name dropdown — limits typing variance and drives kind detection.
    const QB_COMPONENT_TYPES = [
        'Solar PV Array',
        'Hybrid Inverter',
        'Battery Storage',
        'Mounting Kit',
        'Electrical BOS',
        'Installation & Labor',
        'Other'
    ];

    function qbKindOf(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('solar') || n.includes('panel') || n.includes('pv')) return 'panel';
        if (n.includes('inverter')) return 'inverter';
        if (n.includes('battery')) return 'battery';
        return 'other';
    }

    let qbRows = QB_DEFAULT_ROWS.map(r => ({ ...r }));
    let qbProfile = { dailyKwh: '', systemKw: '', peakW: '', sunHours: 4.5 };
    let qbNetMeter = false;
    const QB_NET_METER_PRICE = 75000;

    function qbReadProfile() {
        qbProfile.dailyKwh = +$('#qbDailyKwh').value || 0;
        qbProfile.systemKw = +$('#qbSystemKw').value || 0;
        qbProfile.peakW    = +$('#qbPeakW').value || 0;
        qbProfile.sunHours = +$('#qbSunHours').value || 4.5;
    }

    function qbWriteProfile() {
        $('#qbDailyKwh').value = qbProfile.dailyKwh || '';
        $('#qbSystemKw').value = qbProfile.systemKw || '';
        $('#qbPeakW').value    = qbProfile.peakW || '';
        $('#qbSunHours').value = qbProfile.sunHours || 4.5;
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
                    <input type="number" class="qb-edit qb-num" data-i="${i}" data-f="batKwh" value="${r.batKwh || ''}" min="0" step="0.1" placeholder="kWh"><span class="qb-unit">kWh</span>
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
        const netMeter = qbNetMeter ? QB_NET_METER_PRICE : 0;
        return { componentTotal, netMeter, total: componentTotal + netMeter };
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

        $('#qbSummary').innerHTML = `
            ${profile}
            <div class="qb-cost-list">
                ${breakdown}
                <div class="qb-line subtotal"><span>Total Investment</span><span>${fmtMoney(t.componentTotal)}</span></div>
                ${netLine}
                <div class="qb-line grand"><span>GRAND TOTAL</span><span>${fmtMoney(t.total)}</span></div>
            </div>
        `;
        qbRenderRoi();
    }

    function qbRenderRoi() {
        const rate = +$('#qbRate').value || 0;
        const days = +$('#qbDays').value || 365;
        const t = qbCalcTotal();
        const dailyKwh = +qbProfile.dailyKwh || 0;
        const annualSavings = dailyKwh * days * rate;
        const payback = annualSavings > 0 ? (t.total / annualSavings) : 0;
        const lifetime = annualSavings * 25;
        $('#qbRoi').innerHTML = annualSavings > 0 ? `
            <div class="qb-roi-grid">
                <div><small>Annual Savings</small><strong>${fmtMoney(annualSavings)}</strong></div>
                <div><small>Payback Period</small><strong>${payback.toFixed(2)} years</strong></div>
                <div><small>25-yr Lifetime Savings</small><strong>${fmtMoney(lifetime)}</strong></div>
                <div><small>Break-even Date</small><strong>${qbBreakEven(payback)}</strong></div>
            </div>` : `<p class="muted">Enter Daily Consumption &amp; Rate to compute ROI.</p>`;
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
        if (['qty', 'price', 'panelW', 'invKw', 'batKwh'].includes(f)) v = +v;
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

    ['#qbDailyKwh', '#qbSystemKw', '#qbPeakW', '#qbSunHours', '#qbRate', '#qbDays'].forEach(sel => {
        $(sel).addEventListener('input', () => { qbReadProfile(); qbRenderSummary(); });
    });

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
                else if (qbKindOf(r.name) === 'battery' && r.batKwh) d = `${r.batKwh}kWh ${r.name}` + (r.detail ? ' — ' + r.detail : '');
                return { d, q: +r.qty, p: +r.price };
            });
        if (qbNetMeter) items.push({
            d: 'Net Metering & Permitting (LGU + DIS/DAS + Meter + ERC + Docs + EE Cert.)',
            q: 1, p: QB_NET_METER_PRICE
        });
        return items;
    }

    $('#generateQuoteBtn').addEventListener('click', () => {
        qbReadProfile();
        const t = qbCalcTotal();
        if (t.total <= 0) return toast('Add components with prices first', 'error');
        const name = $('#autoClientName').value.trim() || 'Walk-in';
        const loc  = $('#autoClientLoc').value.trim() || '-';
        const q = {
            id: uid('Q'),
            client: name, location: loc, date: new Date().toISOString().slice(0, 10),
            type: 'builder',
            items: qbBuildItems(),
            total: t.total,
            meta: {
                profile: { ...qbProfile },
                componentTotal: t.componentTotal,
                netMeter: qbNetMeter,
                rate: +$('#qbRate').value || 12.27
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
        printQuote({
            client: $('#autoClientName').value || 'Walk-in',
            location: $('#autoClientLoc').value || '-',
            items: qbBuildItems(),
            total: t.total,
            date: new Date().toISOString().slice(0, 10),
            meta: { profile: { ...qbProfile } }
        });
    });

    // initial render
    qbRenderRows();

