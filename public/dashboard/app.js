// Ascension Lead Desk — Kayla's view of every website lead.
// Sign-in goes through window.AscAuth (src/dashboard-auth.js, @netlify/identity);
// data comes from /api/leads (netlify/functions/leads.mts). Everything a
// visitor typed is untrusted: it only ever reaches the page through esc().
;(function () {
  'use strict'

  // ── Vocabulary ──────────────────────────────────────────────────────────
  var KINDS = {
    quote: 'Quote request',
    booking: 'Booking',
    commercial: 'Commercial walkthrough',
    referral_signup: 'Referral sign-up',
    referral_invite: 'Referral invite',
    partner: 'Partner program',
    gift_card_request: 'Gift card request',
    newsletter: 'Seasonal list',
  }
  var STATUSES = [
    { id: 'new', label: 'New', hint: 'Not answered yet' },
    { id: 'contacted', label: 'Contacted', hint: 'You’ve reached out' },
    { id: 'quoted', label: 'Quoted', hint: 'Price sent, waiting on them' },
    { id: 'booked', label: 'Booked', hint: 'On the calendar' },
    { id: 'lost', label: 'Closed', hint: 'Not going ahead' },
  ]
  var STATUS = {}
  STATUSES.forEach(function (s) { STATUS[s.id] = s })

  // Form field ids on the website → words Kayla would use.
  var FIELD = {
    'q-name': 'Name', 'q-email': 'Email', 'q-phone': 'Phone', 'q-addr': 'Address', 'q-postal': 'Postal code',
    'q-type': 'Service', 'q-beds': 'Bedrooms', 'q-baths': 'Bathrooms', 'q-sqft': 'Square feet', 'q-date': 'Preferred date',
    'q-desc': 'Details', 'q-hrs': 'Hours', 'q-add': 'Add-ons', qex: 'Extras',
    'hc-svc': 'Service', 'hc-freq': 'How often', 'hc-area': 'Area', 'hc-type': 'Type',
    'b-name': 'Name', 'b-email': 'Email', 'b-phone': 'Phone', 'b-svc': 'Service', 'b-type': 'Type',
    'bk-date': 'Date', 'bk-slot': 'Time', 'd-notes': 'Notes',
    'c-biz': 'Business', 'c-name': 'Contact', 'c-email': 'Email', 'c-phone': 'Phone', 'c-type': 'Business type',
    'c-sqft': 'Square feet', 'c-freq': 'How often',
    'r-name': 'Their name', 'r-email': 'Their email', 'r-fname': 'Friend’s name', 'r-femail': 'Friend’s email',
    'p-name': 'Name', 'p-email': 'Email', 'p-phone': 'Phone', 'p-co': 'Company', 'p-role': 'Role', 'p-area': 'Area',
    'p-vol': 'Referrals a month',
    'gf-amt': 'Amount', 'gf-custom': 'Custom amount', 'gf-from': 'From', 'gf-to': 'To', 'gf-email': 'Recipient email',
    'gf-msg': 'Message', 'gf-date': 'Send on', 'gf-pfrom': 'From', 'gf-pto': 'To', 'gf-pmsg': 'Message',
    'jr-email': 'Email',
    photo_count: 'Photos (ask them to text these)', estimate_low: 'Estimate from', estimate_high: 'Estimate to',
    code: 'Referral code', amount: 'Amount', date: 'Date', slot: 'Time',
  }
  function fieldLabel(k) {
    if (FIELD[k]) return FIELD[k]
    var s = String(k).replace(/^[a-z]{1,3}-/, '').replace(/[-_]+/g, ' ').trim()
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : k
  }

  // ── Small helpers ───────────────────────────────────────────────────────
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  var DAY = 86400000
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x }
  function startOfWeek(d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x } // Monday
  var fmtDay = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' })
  var fmtFull = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  var fmtTime = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' })
  function ago(iso) {
    var t = new Date(iso).getTime(), s = (Date.now() - t) / 1000
    if (s < 60) return 'just now'
    if (s < 3600) return Math.floor(s / 60) + ' min ago'
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago'
    if (s < 86400 * 2) return 'yesterday'
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' days ago'
    return fmtDay.format(new Date(t))
  }
  function prettyPhone(p) {
    var d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
    return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : p
  }
  function displayName(l) { return l.name || l.email || prettyPhone(l.phone) || 'No name given' }
  function pill(status) {
    var s = STATUS[status] || STATUS.new
    return '<span class="pill pill--' + esc(s.id) + '">' + esc(s.label) + '</span>'
  }
  var toastTimer
  function toast(msg) {
    var t = $('#toast')
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { t.classList.remove('show') }, 3200)
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's') }

  // ── API ─────────────────────────────────────────────────────────────────
  function api(path, opts) {
    opts = opts || {}
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} }
    if (opts.body) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(opts.body)
    }
    return fetch(path, init).then(function (r) {
      if (r.status === 401) { showGate('login', 'Your session ended. Sign in again.'); throw new Error('signed out') }
      return r.json().catch(function () { return {} }).then(function (b) {
        if (!r.ok) throw new Error(b.error || 'HTTP ' + r.status)
        return b
      })
    })
  }

  // ── State ───────────────────────────────────────────────────────────────
  var state = {
    user: null,
    leads: [],
    loaded: false,
    loadError: '',
    updatedAt: null,
    filter: { status: 'all', kind: 'all', q: '' },
    route: 'overview',
    visible: [], // the list currently on screen, for j/k and drawer prev/next
    kb: -1,
    open: null,
  }

  // ── Auth gate ───────────────────────────────────────────────────────────
  var Auth = window.AscAuth
  var pending = null // { type:'invite', token } | { type:'recovery', user }

  function showGate(screen, msg, isErr) {
    $('#boot').hidden = true
    $('#app').hidden = true
    closeDrawer()
    $('#gate').hidden = false
    $$('[data-screen]').forEach(function (el) { el.hidden = el.getAttribute('data-screen') !== screen })
    var box = $('[data-screen="' + screen + '"] .gate-msg')
    if (box) {
      box.hidden = !msg
      box.textContent = msg || ''
      box.classList.toggle('err', !!isErr)
    }
    var first = $('[data-screen="' + screen + '"] input')
    if (first) setTimeout(function () { first.focus() }, 50)
  }

  function gateBusy(form, busy) {
    var b = $('button[type="submit"]', form)
    if (b) { b.disabled = busy; b.dataset.label = b.dataset.label || b.textContent; b.textContent = busy ? 'One moment…' : b.dataset.label }
  }

  function enter(user) {
    state.user = user
    if (!user.roles || user.roles.indexOf('admin') === -1) {
      $('#dn-email').textContent = user.email || ''
      return showGate('denied')
    }
    $('#gate').hidden = true
    $('#boot').hidden = true
    $('#app').hidden = false
    $$('[data-user-name]').forEach(function (el) { el.textContent = user.name || 'Signed in' })
    $$('[data-user-email]').forEach(function (el) { el.textContent = user.email || '' })
    route()
    load()
  }

  function bindGate() {
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var to = b.getAttribute('data-go')
        if (to === 'forgot') $('#fg-email').value = $('#li-email').value
        showGate(to)
      })
    })

    $('#f-login').addEventListener('submit', function (e) {
      e.preventDefault()
      var f = e.target, email = $('#li-email').value.trim(), pass = $('#li-pass').value
      if (!email || !pass) return showGate('login', 'Enter your email and password.', true)
      gateBusy(f, true)
      Auth.login(email, pass)
        .then(function (u) { $('#li-pass').value = ''; enter(u) })
        .catch(function (err) { showGate('login', Auth.explain(err), true) })
        .then(function () { gateBusy(f, false) })
    })

    $('#f-forgot').addEventListener('submit', function (e) {
      e.preventDefault()
      var f = e.target, email = $('#fg-email').value.trim()
      if (!email) return showGate('forgot', 'Enter the email you sign in with.', true)
      gateBusy(f, true)
      Auth.requestPasswordRecovery(email)
        .then(function () { showGate('login', 'If that email has an account, a reset link is on its way.') })
        .catch(function (err) { showGate('forgot', Auth.explain(err), true) })
        .then(function () { gateBusy(f, false) })
    })

    $('#f-setpw').addEventListener('submit', function (e) {
      e.preventDefault()
      var f = e.target, a = $('#sp-pass').value, b = $('#sp-pass2').value
      if (a.length < 8) return showGate('setpw', 'Use at least 8 characters.', true)
      if (a !== b) return showGate('setpw', 'Those two passwords don’t match.', true)
      gateBusy(f, true)
      var done = pending && pending.type === 'invite'
        ? Auth.acceptInvite(pending.token, a)
        : Auth.updateUser({ password: a })
      done
        // signing in again sets the session cookie the dashboard API reads
        .then(function (u) { return Auth.login(u.email, a) })
        .then(function (u) { pending = null; $('#sp-pass').value = $('#sp-pass2').value = ''; enter(u); toast('Password saved. Welcome in.') })
        .catch(function (err) { showGate('setpw', Auth.explain(err), true) })
        .then(function () { gateBusy(f, false) })
    })

    $('#dn-out').addEventListener('click', signOut)
    $$('[data-signout]').forEach(function (b) { b.addEventListener('click', signOut) })
  }

  function signOut() {
    Promise.resolve(Auth.logout()).catch(function () {}).then(function () {
      state.user = null
      state.leads = []
      state.loaded = false
      showGate('login', 'You’re signed out.')
    })
  }

  function boot() {
    if (!Auth) {
      $('#boot').hidden = true
      return showGate('login', 'The sign-in script didn’t load. Refresh the page; if it keeps happening, redeploy the site.', true)
    }
    bindGate()
    Auth.handleAuthCallback()
      .then(function (r) {
        if (!r) return Auth.getUser().then(function (u) { return u ? enter(u) : showGate('login') })
        history.replaceState(null, '', location.pathname + '#/overview')
        if (r.type === 'invite') {
          pending = { type: 'invite', token: r.token }
          $('#sp-eyebrow').textContent = 'You’re invited'
          $('#sp-title').textContent = 'Set up your account'
          return showGate('setpw')
        }
        if (r.type === 'recovery') {
          pending = { type: 'recovery' }
          $('#sp-eyebrow').textContent = 'Reset password'
          $('#sp-title').textContent = 'Choose a new password'
          return showGate('setpw')
        }
        return r.user ? enter(r.user) : showGate('login')
      })
      .catch(function (err) { showGate('login', Auth.explain(err), true) })
  }

  // ── Data ────────────────────────────────────────────────────────────────
  function load(quiet) {
    return api('/api/leads')
      .then(function (b) {
        state.leads = b.leads || []
        state.loaded = true
        state.loadError = ''
        state.updatedAt = new Date()
        if (state.open) state.open = byId(state.open.id) || null
        badges()
        // On a list, refresh rows only so search focus and typing survive
        if ($('#list')) { refreshCounts(); renderTable() } else render()
        if (state.open) renderDrawer()
      })
      .catch(function (err) {
        if (err.message === 'signed out') return
        state.loaded = true
        state.loadError = err.message
        if (!quiet) render()
      })
  }
  function byId(id) { for (var i = 0; i < state.leads.length; i++) if (state.leads[i].id === id) return state.leads[i]; return null }
  function count(status) { return state.leads.filter(function (l) { return l.status === status }).length }

  function badges() {
    var n = count('new')
    $$('[data-new-count]').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n })
    document.title = (n ? '(' + n + ') ' : '') + 'Lead Desk — Ascension'
  }

  // ── Routing ─────────────────────────────────────────────────────────────
  // #/overview · #/inbox · #/leads?status=booked&kind=quote · #/guide
  function route() {
    var h = location.hash.replace(/^#\/?/, '')
    var path = h.split('?')[0] || 'overview'
    var params = new URLSearchParams(h.split('?')[1] || '')
    if (['overview', 'inbox', 'leads', 'guide'].indexOf(path) === -1) path = 'overview'
    state.route = path
    if (path === 'inbox') state.filter = { status: 'new', kind: 'all', q: '' }
    if (path === 'leads') {
      state.filter.status = params.get('status') || 'all'
      state.filter.kind = params.get('kind') || 'all'
      if (!params.get('keep')) state.filter.q = ''
    }
    state.kb = -1
    $$('[data-route]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-route') === path) })
    render()
    window.scrollTo(0, 0)
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash }

  function render() {
    if ($('#app').hidden) return
    var v = $('#view')
    if (state.route === 'overview') v.innerHTML = viewOverview()
    else if (state.route === 'guide') v.innerHTML = viewGuide()
    else { v.innerHTML = viewLeads(); renderTable() }
    v.className = 'main view'
    bindView()
  }

  function pageHead(eyebrow, title, extra) {
    var stamp = state.updatedAt ? 'Updated ' + fmtTime.format(state.updatedAt) : ''
    return '<header class="page-hd"><div><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1></div>' +
      '<div class="acts">' + (extra || '') + '<span class="stamp" aria-live="polite">' + esc(stamp) + '</span>' +
      '<button class="btn btn--sm" type="button" data-refresh><svg aria-hidden="true"><use href="#i-refresh"/></svg>Refresh</button></div></header>'
  }

  function errorPanel() {
    return '<section class="panel"><div class="empty"><svg class="mk" aria-hidden="true"><use href="#i-mk"/></svg>' +
      '<h3>Couldn’t load leads</h3><p>' + esc(state.loadError) + '. Check your connection, then try again.</p>' +
      '<button class="btn" type="button" data-refresh>Try again</button></div></section>'
  }

  // ── Overview ────────────────────────────────────────────────────────────
  function viewOverview() {
    var hour = new Date().getHours()
    var hi = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
    var first = state.user && state.user.name ? ', ' + state.user.name.split(/\s+/)[0] : ''
    var head = pageHead('Overview', hi + first)
    if (!state.loaded) return head + skeletonOverview()
    if (state.loadError && !state.leads.length) return head + errorPanel()

    var L = state.leads, now = new Date()
    var wk = startOfWeek(now).getTime(), lastWk = wk - 7 * DAY
    var month = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    var t = function (l) { return new Date(l.createdAt).getTime() }
    var nNew = count('new')
    var thisWeek = L.filter(function (l) { return t(l) >= wk }).length
    var prevWeek = L.filter(function (l) { return t(l) >= lastWk && t(l) < wk }).length
    var bookedMonth = L.filter(function (l) { return l.status === 'booked' && new Date(l.updatedAt).getTime() >= month }).length
    var recent = L.filter(function (l) { return t(l) >= now.getTime() - 90 * DAY })
    var won = recent.filter(function (l) { return l.status === 'booked' }).length
    var closed = won + recent.filter(function (l) { return l.status === 'lost' }).length
    var oldestNew = L.filter(function (l) { return l.status === 'new' }).slice(-1)[0]

    var delta = thisWeek - prevWeek
    var weekNote = prevWeek || thisWeek
      ? (delta === 0 ? 'Same as last week' : Math.abs(delta) + (delta > 0 ? ' more' : ' fewer') + ' than last week')
      : 'None yet this week'

    var kpis = '<div class="kpis">' +
      kpi('Waiting on you', nNew, nNew ? 'Oldest came in ' + ago(oldestNew.createdAt) : 'All caught up', '#/inbox', nNew > 0) +
      kpi('This week', thisWeek, weekNote, '#/leads') +
      kpi('Booked this month', bookedMonth, plural(count('booked'), 'booking') + ' in total', '#/leads?status=booked') +
      kpi('Win rate · 90 days', closed ? Math.round((won / closed) * 100) + '%' : '—', closed ? won + ' of ' + plural(closed, 'closed lead') : 'Mark leads Booked or Closed to see this', '#/leads?status=booked') +
      '</div>'

    var pipe = '<div class="pipe" role="list" aria-label="Leads by stage">' + STATUSES.map(function (s) {
      return '<button type="button" role="listitem" data-href="#/leads?status=' + s.id + '" title="' + esc(s.hint) + '"><span>' + esc(s.label) + '</span><b class="num">' + count(s.id) + '</b></button>'
    }).join('') + '</div>'

    if (!L.length) return head + kpis + emptyFirst()

    var recentRows = L.slice(0, 7).map(function (l) {
      return '<button class="rrow" type="button" data-open="' + l.id + '"><span class="rrow-name">' + esc(displayName(l)) + '</span>' +
        pill(l.status) + '<span class="rrow-meta">' + esc(KINDS[l.kind] || l.kind) + ' · ' + esc(ago(l.createdAt)) + '</span></button>'
    }).join('')

    return head + kpis + pipe +
      '<div class="grid-2">' +
        '<section class="panel panel--lit"><div class="panel-hd"><h2>Leads per week</h2><span class="muted" style="font-size:12.5px">Last 12 weeks</span></div><div class="panel-bd">' + weeklyChart(L) + '</div></section>' +
        '<section class="panel"><div class="panel-hd"><h2>Latest</h2><button class="link" type="button" data-href="#/leads">See all →</button></div><div class="panel-bd"><div class="rows">' + recentRows + '</div></div></section>' +
      '</div>' +
      '<section class="panel"><div class="panel-hd"><h2>Where they come from</h2><span class="muted" style="font-size:12.5px">Which website form, all time</span></div><div class="panel-bd">' + kindBars(L) + '</div></section>'
  }

  function kpi(label, value, note, href, hot) {
    return '<button type="button" class="kpi panel' + (hot ? ' kpi--hot panel--lit' : '') + '" data-href="' + href + '">' +
      '<span class="lbl">' + esc(label) + '</span><b class="num">' + esc(value) + '</b><small>' + esc(note) + '</small></button>'
  }

  function skeletonOverview() {
    var tile = '<div class="kpi panel"><span class="sk" style="width:50%"></span><span class="sk" style="height:42px;width:40%;margin:8px 0"></span><span class="sk" style="width:70%"></span></div>'
    return '<div class="kpis">' + tile + tile + tile + tile + '</div><div class="grid-2"><div class="panel" style="height:300px"></div><div class="panel" style="height:300px"></div></div>'
  }

  function emptyFirst() {
    return '<section class="panel panel--lit"><div class="empty"><svg class="mk" aria-hidden="true"><use href="#i-mk"/></svg>' +
      '<h3>No leads yet</h3><p>When someone asks for a quote, books, or joins a list on the website, it shows up here within seconds — and still goes to GoHighLevel as before.</p>' +
      '<a class="btn" href="/#quote" target="_blank" rel="noopener">Open the quote form</a></div></section>'
  }

  // Single series, so no legend: the panel title names it. Bars get a hover tooltip.
  function weeklyChart(L) {
    var weeks = 12, w0 = startOfWeek(new Date()).getTime() - (weeks - 1) * 7 * DAY
    var buckets = []
    for (var i = 0; i < weeks; i++) buckets.push({ start: w0 + i * 7 * DAY, n: 0 })
    L.forEach(function (l) {
      var i = Math.floor((new Date(l.createdAt).getTime() - w0) / (7 * DAY))
      if (i >= 0 && i < weeks) buckets[i].n++
    })
    var max = Math.max.apply(null, buckets.map(function (b) { return b.n }))
    var step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : Math.ceil(max / 5 / 5) * 5
    var top = Math.max(step, Math.ceil(max / step) * step)
    var W = 640, H = 230, ml = 30, mr = 6, mt = 10, mb = 28
    var pw = W - ml - mr, ph = H - mt - mb, slot = pw / weeks, bw = Math.min(30, slot - 8)
    var y = function (v) { return mt + ph - (v / top) * ph }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Leads per week for the last 12 weeks">'
    s += '<g class="grid">'
    for (var v = 0; v <= top; v += step) s += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>'
    s += '</g><g class="axis">'
    for (v = 0; v <= top; v += step) s += '<text x="' + (ml - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>'
    buckets.forEach(function (b, i) {
      if (i % 2 === (weeks - 1) % 2) s += '<text x="' + (ml + slot * i + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(fmtDay.format(new Date(b.start))) + '</text>'
    })
    s += '</g>'
    buckets.forEach(function (b, i) {
      var x = ml + slot * i + (slot - bw) / 2, yt = y(b.n), h = mt + ph - yt, r = Math.min(4, h)
      if (b.n) s += '<path class="bar" data-i="' + i + '" d="M' + x + ',' + (mt + ph) + 'V' + (yt + r) + 'Q' + x + ',' + yt + ' ' + (x + r) + ',' + yt + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + yt + ' ' + (x + bw) + ',' + (yt + r) + 'V' + (mt + ph) + 'Z"/>'
      var end = new Date(b.start + 6 * DAY)
      s += '<rect class="hit" x="' + (ml + slot * i) + '" y="' + mt + '" width="' + slot + '" height="' + ph + '" data-tip="' +
        esc(plural(b.n, 'lead')) + '|' + esc(fmtDay.format(new Date(b.start)) + ' – ' + fmtDay.format(end)) + '" data-x="' + ((ml + slot * i + slot / 2) / W) + '" data-y="' + (yt / H) + '"/>'
    })
    s += '</svg>'
    var total = buckets.reduce(function (t, b) { return t + b.n }, 0)
    var best = buckets.reduce(function (a, b) { return b.n > a.n ? b : a }, buckets[0])
    var facts = '<div class="facts">' +
      '<div><b class="num">' + total + '</b><span>Leads in 12 weeks</span></div>' +
      '<div><b class="num">' + (Math.round((total / weeks) * 10) / 10) + '</b><span>Average a week</span></div>' +
      '<div><b class="num">' + (best.n ? esc(fmtDay.format(new Date(best.start))) : '—') + '</b><span>Busiest week' + (best.n ? ' (' + best.n + ')' : '') + '</span></div></div>'
    return '<div class="chart" data-chart>' + s + '<div class="tip" role="presentation"></div></div>' + facts
  }

  function kindBars(L) {
    var c = {}
    L.forEach(function (l) { c[l.kind] = (c[l.kind] || 0) + 1 })
    var rows = Object.keys(c).sort(function (a, b) { return c[b] - c[a] })
    var max = c[rows[0]] || 1
    return '<div class="hbars">' + rows.map(function (k) {
      return '<button type="button" class="hb" data-href="#/leads?kind=' + encodeURIComponent(k) + '"><span class="hb-lbl">' + esc(KINDS[k] || k) + '</span>' +
        '<span class="hb-track"><span class="hb-fill" style="width:' + Math.max(2, (c[k] / max) * 100) + '%"></span></span><span class="hb-n num">' + c[k] + '</span></button>'
    }).join('') + '</div>'
  }

  // ── Leads list ──────────────────────────────────────────────────────────
  function viewLeads() {
    var inbox = state.route === 'inbox'
    var head = pageHead(inbox ? 'Inbox' : 'Leads', inbox ? 'New leads' : 'All leads')
    if (state.loaded && state.loadError && !state.leads.length) return head + errorPanel()
    var f = state.filter
    var seg = '<div class="seg" role="group" aria-label="Filter by stage">' +
      [{ id: 'all', label: 'All' }].concat(STATUSES).map(function (s) {
        var n = s.id === 'all' ? state.leads.length : count(s.id)
        return '<button type="button" data-status="' + s.id + '" class="' + (f.status === s.id ? 'on' : '') + '" aria-pressed="' + (f.status === s.id) + '">' + esc(s.label) + ' <i>' + n + '</i></button>'
      }).join('') + '</div>'
    var kinds = '<select class="sel" id="f-kind" aria-label="Filter by form"><option value="all">Every form</option>' +
      Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (f.kind === k ? ' selected' : '') + '>' + esc(KINDS[k]) + '</option>' }).join('') + '</select>'
    var search = '<label class="search"><svg aria-hidden="true"><use href="#i-search"/></svg><input class="in" id="f-q" type="search" placeholder="Search name, email, phone, notes…" value="' + esc(f.q) + '" aria-label="Search leads"><kbd aria-hidden="true">/</kbd></label>'
    return head + '<div class="filters">' + seg + kinds + search + '</div><section class="panel" id="list"></section>'
  }

  function matches(l) {
    var f = state.filter
    if (f.status !== 'all' && l.status !== f.status) return false
    if (f.kind !== 'all' && l.kind !== f.kind) return false
    if (!f.q) return true
    var q = f.q.toLowerCase(), qd = q.replace(/\D/g, '')
    var hay = [l.name, l.email, l.notes, KINDS[l.kind]].concat(
      Object.keys(l.fields || {}).map(function (k) { return l.fields[k] }),
      Object.keys(l.extra || {}).map(function (k) { return l.extra[k] }),
    ).join(' ').toLowerCase()
    return hay.indexOf(q) !== -1 || (qd.length >= 3 && String(l.phone).indexOf(qd) !== -1)
  }

  function renderTable() {
    var box = $('#list')
    if (!box) return
    if (!state.loaded) {
      var sk = ''
      for (var i = 0; i < 6; i++) sk += '<tr><td><span class="sk" style="width:60%"></span></td><td><span class="sk" style="width:70%"></span></td><td><span class="sk" style="width:50%"></span></td><td><span class="sk" style="width:60px"></span></td><td></td></tr>'
      box.innerHTML = '<table class="table"><tbody>' + sk + '</tbody></table>'
      return
    }
    state.visible = state.leads.filter(matches)
    if (!state.visible.length) {
      var f = state.filter, filtered = f.status !== 'all' || f.kind !== 'all' || f.q
      box.innerHTML = '<div class="empty"><svg class="mk" aria-hidden="true"><use href="#i-mk"/></svg>' +
        (state.route === 'inbox' && !f.q
          ? '<h3>All caught up</h3><p>Every lead has been answered. New ones appear here the moment they come in.</p><button class="btn" type="button" data-href="#/leads">See all leads</button>'
          : filtered
            ? '<h3>Nothing matches</h3><p>No leads fit these filters. Try a different stage or form, or clear the search.</p><button class="btn" type="button" data-clear>Clear filters</button>'
            : '<h3>No leads yet</h3><p>Website forms land here within seconds of being sent.</p>') +
        '</div>'
      bindView(box)
      return
    }
    var rows = state.visible.map(function (l, i) {
      var sub = [l.email, prettyPhone(l.phone)].filter(Boolean).join(' · ')
      var ghl = l.ghlDelivered === true ? 'Sent to GHL' : l.ghlDelivered === false ? 'GHL failed' : '—'
      return '<tr data-open="' + l.id + '" data-i="' + i + '" class="' + (l.status === 'new' ? 'unread' : '') + (i === state.kb ? ' kb' : '') + '" tabindex="0">' +
        '<td class="c-name"><span class="t-name">' + esc(displayName(l)) + '</span><span class="t-sub">' + esc(sub) + '</span></td>' +
        '<td class="c-kind"><span class="t-kind">' + esc(KINDS[l.kind] || l.kind) + '</span></td>' +
        '<td class="c-when"><span class="t-when" title="' + esc(fmtFull.format(new Date(l.createdAt))) + '">' + esc(ago(l.createdAt)) + '</span></td>' +
        '<td class="c-status">' + pill(l.status) + '</td>' +
        '<td class="c-ghl"><span class="t-ghl' + (l.ghlDelivered === false ? ' bad' : '') + '">' + ghl + '</span></td></tr>'
    }).join('')
    box.innerHTML = '<table class="table"><thead><tr><th>Who</th><th>Form</th><th>Received</th><th>Stage</th><th>CRM</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="list-foot"><span>' + plural(state.visible.length, 'lead') + (state.visible.length < state.leads.length ? ' of ' + state.leads.length : '') + '</span>' +
      '<span>Tip: <kbd>J</kbd> <kbd>K</kbd> to move, <kbd>Enter</kbd> to open</span></div>'
    bindView(box)
  }

  // ── Guide ───────────────────────────────────────────────────────────────
  function viewGuide() {
    return pageHead('Help', 'How it works') + '<div class="guide">' +
      '<section class="step panel panel--lit"><span class="eyebrow">01 · Where leads come from</span><h3>Every website form</h3>' +
      '<p>Quotes, bookings, commercial walkthroughs, referrals, partners, gift cards and the seasonal list all land here within seconds. They still go to <b>GoHighLevel</b> exactly as before — the <b>CRM</b> column shows whether GHL accepted each one.</p>' +
      '<p>Photos people attach stay on their phone for privacy. When a lead says it has photos, text them and ask for them.</p></section>' +
      '<section class="step panel"><span class="eyebrow">02 · Working a lead</span><h3>Move it along</h3><ul>' +
      STATUSES.map(function (s) { return '<li><b>' + esc(s.label) + '</b> — ' + esc(s.hint) + '</li>' }).join('') +
      '</ul><p style="margin-top:10px">Tapping <b>Call</b>, <b>Text</b> or <b>Email</b> on a new lead marks it Contacted for you. Notes save as you type.</p></section>' +
      '<section class="step panel"><span class="eyebrow">03 · Shortcuts</span><h3>Move faster</h3><div class="keys">' +
      '<kbd>/</kbd><span>Search leads</span><kbd>J</kbd><span>Next lead</span><kbd>K</kbd><span>Previous lead</span>' +
      '<kbd>Enter</kbd><span>Open the highlighted lead</span><kbd>Esc</kbd><span>Close a lead</span>' +
      '<kbd>1</kbd><span>Overview</span><kbd>2</kbd><span>New leads</span><kbd>3</kbd><span>All leads</span></div></section>' +
      '<section class="step panel"><span class="eyebrow">04 · Adding someone</span><h3>Give a team member access</h3><ol>' +
      '<li>In Netlify, open the site and go to <b>Identity</b>.</li><li>Click <b>Invite users</b> and enter their email. They’ll get a link to choose a password.</li>' +
      '<li>Once they’ve accepted, click their name and add the role <b>admin</b>.</li></ol>' +
      '<p style="margin-top:10px">Forgot a password? Use <b>Forgot password?</b> on the sign-in screen.</p></section>' +
      '</div>'
  }

  // ── Lead drawer ─────────────────────────────────────────────────────────
  var lastFocus = null
  function openLead(id) {
    var l = byId(Number(id))
    if (!l) return
    if (!state.visible.length || state.visible.indexOf(l) === -1) state.visible = state.route === 'overview' ? state.leads.slice() : state.leads.filter(matches)
    state.open = l
    if (!$('#ovl').classList.contains('open')) lastFocus = document.activeElement
    renderDrawer()
    var o = $('#ovl')
    o.classList.add('open')
    o.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
    setTimeout(function () { $('.x', o).focus() }, 60)
  }
  function closeDrawer() {
    var o = $('#ovl')
    if (!o || !o.classList.contains('open')) return
    flushNotes()
    o.classList.remove('open')
    o.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
    state.open = null
    if (lastFocus && lastFocus.focus) lastFocus.focus()
  }

  function renderDrawer() {
    var l = state.open
    if (!l) return
    $('#dw-kind').textContent = KINDS[l.kind] || l.kind
    $('#dw-title').textContent = displayName(l)
    $('#dw-when').textContent = 'Came in ' + ago(l.createdAt) + ' · ' + fmtFull.format(new Date(l.createdAt))

    var tel = String(l.phone || '').replace(/[^\d+]/g, '')
    var acts = ''
    if (tel) acts += '<a class="btn" data-contact href="tel:' + esc(tel) + '"><svg aria-hidden="true"><use href="#i-phone"/></svg>Call</a><a class="btn" data-contact href="sms:' + esc(tel) + '"><svg aria-hidden="true"><use href="#i-sms"/></svg>Text</a>'
    if (l.email) acts += '<a class="btn" data-contact href="mailto:' + esc(l.email) + '?subject=' + encodeURIComponent('Your Ascension ' + (KINDS[l.kind] || 'request').toLowerCase()) + '"><svg aria-hidden="true"><use href="#i-mail"/></svg>Email</a>'

    var shown = { name: l.name, email: l.email }
    var sent = Object.keys(l.fields || {}).filter(function (k) {
      var v = l.fields[k]
      if (/email/i.test(k) && v.toLowerCase() === l.email) return false
      if (/phone/i.test(k) && v.replace(/\D/g, '').slice(-10) === String(l.phone).replace(/\D/g, '').slice(-10)) return false
      return !(v === shown.name && /(^|-)f?name$/i.test(k))
    }).map(function (k) { return [fieldLabel(k), l.fields[k]] })
    Object.keys(l.extra || {}).forEach(function (k) { sent.push([fieldLabel(k), l.extra[k]]) })
    var kv = function (pairs) { return '<dl class="kv">' + pairs.map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>' }).join('') + '</dl>' }

    var ghl = l.ghlDelivered === true ? 'Yes' : l.ghlDelivered === false ? 'No — GHL didn’t accept it. Add them by hand.' : 'Not connected (no webhook set)'

    $('#dw-body').innerHTML =
      '<section class="dw-sec"><h3>Contact</h3>' +
        '<div class="contact-line">' + (l.email ? '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>' : '') + (l.phone ? '<a href="tel:' + esc(tel) + '">' + esc(prettyPhone(l.phone)) + '</a>' : '') + (!l.email && !l.phone ? '<span class="muted">No contact details</span>' : '') + '</div>' +
        (acts ? '<div class="contact">' + acts + '</div>' : '') + '</section>' +
      '<section class="dw-sec"><h3>Stage</h3><div class="status-pick" role="group" aria-label="Stage">' +
        STATUSES.map(function (s) { return '<button type="button" data-set="' + s.id + '" class="' + (l.status === s.id ? 'on' : '') + '" aria-pressed="' + (l.status === s.id) + '" title="' + esc(s.hint) + '">' + esc(s.label) + '</button>' }).join('') +
      '</div></section>' +
      '<section class="dw-sec"><h3><label for="dw-notes">Your notes</label></h3><textarea class="ta" id="dw-notes" placeholder="Called Tues, wants a Friday slot. Has a dog.">' + esc(l.notes) + '</textarea><div class="save-state" id="dw-save" aria-live="polite"></div></section>' +
      (sent.length ? '<section class="dw-sec"><h3>What they sent</h3>' + kv(sent) + '</section>' : '') +
      '<section class="dw-sec"><h3>Details</h3>' + kv([['Received', fmtFull.format(new Date(l.createdAt))], ['Form', KINDS[l.kind] || l.kind], ['Page', l.page || '—'], ['In GoHighLevel', ghl]]) + '</section>'

    var i = state.visible.indexOf(l)
    $('#dw-prev').disabled = i <= 0
    $('#dw-next').disabled = i === -1 || i >= state.visible.length - 1

    $$('[data-set]', $('#dw-body')).forEach(function (b) {
      b.addEventListener('click', function () { setStatus(l, b.getAttribute('data-set')) })
    })
    $$('[data-contact]', $('#dw-body')).forEach(function (a) {
      a.addEventListener('click', function () { if (l.status === 'new') setStatus(l, 'contacted', 'Marked as contacted') })
    })
    var ta = $('#dw-notes')
    ta.addEventListener('input', function () { $('#dw-save').textContent = 'Saving…'; clearTimeout(noteTimer); noteTimer = setTimeout(flushNotes, 700) })
    ta.addEventListener('blur', flushNotes)
  }

  function step(dir) {
    var i = state.visible.indexOf(state.open)
    var n = state.visible[i + dir]
    if (!n) return
    flushNotes()
    openLead(n.id)
  }

  function setStatus(l, status, msg) {
    if (l.status === status) return
    var before = l.status
    l.status = status
    afterChange(l)
    api('/api/leads/' + l.id, { method: 'PATCH', body: { status: status } })
      .then(function (b) { Object.assign(l, b.lead); afterChange(l); toast(msg || 'Moved to ' + STATUS[status].label) })
      .catch(function (err) { if (err.message === 'signed out') return; l.status = before; afterChange(l); toast('Couldn’t save that change. Try again.') })
  }

  var noteTimer
  function flushNotes() {
    clearTimeout(noteTimer)
    var l = state.open, ta = $('#dw-notes')
    if (!l || !ta || ta.value === l.notes) return
    var val = ta.value, before = l.notes
    l.notes = val
    api('/api/leads/' + l.id, { method: 'PATCH', body: { notes: val } })
      .then(function () { var s = $('#dw-save'); if (s && state.open === l) s.textContent = 'Saved ' + fmtTime.format(new Date()) })
      .catch(function (err) { if (err.message === 'signed out') return; var s = $('#dw-save'); if (s) s.textContent = 'Not saved — check your connection'; if (l.notes === val) l.notes = before })
  }

  function afterChange(l) {
    badges()
    if (state.open === l) {
      $$('[data-set]').forEach(function (b) { var on = b.getAttribute('data-set') === l.status; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on) })
    }
    // Keep the list stable under the drawer; refresh it fully once closed.
    if (state.route === 'overview') render()
    else {
      refreshCounts()
      var row = $('tr[data-open="' + l.id + '"]')
      if (row) { row.querySelector('.c-status').innerHTML = pill(l.status); row.classList.toggle('unread', l.status === 'new') }
    }
  }

  function refreshCounts() {
    $$('.seg [data-status] i').forEach(function (i) {
      var s = i.parentNode.getAttribute('data-status')
      i.textContent = s === 'all' ? state.leads.length : count(s)
    })
  }

  function deleteOpen() {
    var l = state.open
    if (!l) return
    if (!confirm('Delete the lead from ' + displayName(l) + '? This can’t be undone. (It stays in GoHighLevel.)')) return
    api('/api/leads/' + l.id, { method: 'DELETE' })
      .then(function () {
        var next = state.visible[state.visible.indexOf(l) + 1] || state.visible[state.visible.indexOf(l) - 1]
        state.leads = state.leads.filter(function (x) { return x !== l })
        state.visible = state.visible.filter(function (x) { return x !== l })
        badges()
        toast('Lead deleted')
        if (next) openLead(next.id)
        else closeDrawer()
        if (state.route === 'overview') render()
        else renderTable()
      })
      .catch(function (err) { if (err.message !== 'signed out') toast('Couldn’t delete it. Try again.') })
  }

  // ── Events ──────────────────────────────────────────────────────────────
  function bindView(root) {
    root = root || $('#view')
    $$('[data-href]', root).forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-href')) }) })
    $$('[data-open]', root).forEach(function (el) {
      el.addEventListener('click', function () { openLead(el.getAttribute('data-open')) })
      if (el.tagName === 'TR') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') openLead(el.getAttribute('data-open')) })
    })
    $$('[data-refresh]', root).forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; load().then(function () { toast('Up to date') }) }) })
    $$('[data-clear]', root).forEach(function (b) {
      b.addEventListener('click', function () { state.filter = { status: 'all', kind: 'all', q: '' }; go('#/leads') })
    })
    $$('[data-status]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-status')
        if (state.route === 'inbox' && s !== 'new') return go('#/leads?keep=1&status=' + s)
        state.filter.status = s
        $$('[data-status]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on) })
        state.kb = -1
        renderTable()
      })
    })
    var k = $('#f-kind', root)
    if (k) k.addEventListener('change', function () { state.filter.kind = k.value; state.kb = -1; renderTable() })
    var q = $('#f-q', root)
    if (q) q.addEventListener('input', function () { state.filter.q = q.value.trim(); state.kb = -1; renderTable() })
    $$('[data-chart]', root).forEach(bindChart)
  }

  function bindChart(c) {
    var tip = $('.tip', c)
    $$('.hit', c).forEach(function (h, i) {
      h.addEventListener('mouseenter', function () {
        var p = h.getAttribute('data-tip').split('|')
        tip.innerHTML = '<b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span>'
        tip.style.left = parseFloat(h.getAttribute('data-x')) * 100 + '%'
        tip.style.top = parseFloat(h.getAttribute('data-y')) * 100 + '%'
        tip.classList.add('show')
        $$('.bar', c).forEach(function (b) { b.classList.toggle('dim', b.getAttribute('data-i') !== String(i)) })
      })
      h.addEventListener('mouseleave', function () { tip.classList.remove('show'); $$('.bar', c).forEach(function (b) { b.classList.remove('dim') }) })
    })
  }

  function moveKb(dir) {
    var rows = $$('#list tbody tr[data-open]')
    if (!rows.length) return
    state.kb = Math.max(0, Math.min(rows.length - 1, state.kb + dir))
    rows.forEach(function (r, i) { r.classList.toggle('kb', i === state.kb) })
    rows[state.kb].focus({ preventScroll: true })
    rows[state.kb].scrollIntoView({ block: 'nearest' })
  }

  document.addEventListener('keydown', function (e) {
    if ($('#app').hidden || e.metaKey || e.ctrlKey || e.altKey) return
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    var drawer = $('#ovl').classList.contains('open')
    if (e.key === 'Escape') {
      if (drawer) return closeDrawer()
      if (typing) return e.target.blur()
    }
    if (typing) return
    if (drawer) {
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
      return
    }
    if (e.key === '/') { var q = $('#f-q'); if (q) { e.preventDefault(); q.focus() } else { e.preventDefault(); go('#/leads') } }
    if (e.key === 'j') moveKb(1)
    if (e.key === 'k') moveKb(-1)
    if (e.key === '1') go('#/overview')
    if (e.key === '2') go('#/inbox')
    if (e.key === '3') go('#/leads')
  })

  $('#ovl').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeDrawer() })
  $('[data-close]').addEventListener('click', closeDrawer)
  $('#dw-prev').addEventListener('click', function () { step(-1) })
  $('#dw-next').addEventListener('click', function () { step(1) })
  $('#dw-del').addEventListener('click', deleteOpen)
  // Trap focus inside the open drawer
  $('#ovl').addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return
    var f = $$('a[href],button:not([disabled]),textarea,input', $('.drawer'))
    if (!f.length) return
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  })
  window.addEventListener('hashchange', function () { closeDrawer(); route() })

  // New leads show up without a reload; paused while the tab is hidden.
  setInterval(function () { if (state.user && !$('#app').hidden && !document.hidden && !$('#ovl').classList.contains('open')) load(true) }, 60000)
  document.addEventListener('visibilitychange', function () { if (!document.hidden && state.user && !$('#app').hidden) load(true) })
  // Relative times ("5 min ago") stay true
  setInterval(function () { if (!$('#app').hidden && !$('#ovl').classList.contains('open') && state.route !== 'guide' && !/^(INPUT|SELECT)$/.test((document.activeElement || {}).tagName)) render() }, 120000)

  boot()
})()
