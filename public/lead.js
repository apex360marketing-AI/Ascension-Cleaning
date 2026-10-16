// Sends website forms to /.netlify/functions/lead, which forwards them to
// Kayla's GoHighLevel account. Tested in tests/site.test.mjs.
(function () {
  var ENDPOINT = '/.netlify/functions/lead'
  var HONEYPOT = 'website'

  // Typed fields and ticked boxes only. File inputs (photos of someone's home)
  // and password fields never leave the browser.
  function collect(root) {
    var out = {}
    if (!root) return out
    var els = root.querySelectorAll('input,select,textarea')
    for (var i = 0; i < els.length; i++) {
      var el = els[i]
      var key = el.id || el.name
      if (!key || el.name === HONEYPOT || el.type === 'file' || el.type === 'password') continue
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (!el.checked) continue
        var v = el.value || 'yes'
        out[key] = out[key] ? out[key] + ', ' + v : v
        continue
      }
      var s = String(el.value || '').trim()
      if (s) out[key] = s.slice(0, 2000)
    }
    return out
  }

  function sorry() {
    var ph = window.ASCENSION && window.ASCENSION.phone
    var msg = ph
      ? 'That didn’t go through. Please try again, or call or text ' + ph + '.'
      : 'That didn’t go through. Please try again in a minute.'
    if (typeof toast === 'function') toast(msg)
    else console.error(msg)
  }

  // Resolves true when Kayla's CRM accepted the lead, false otherwise.
  window.sendLead = function (kind, root, extra) {
    var hp = root && root.querySelector ? root.querySelector('[name="' + HONEYPOT + '"]') : null
    var body = {
      kind: kind,
      fields: collect(root),
      extra: extra || {},
      page: location.pathname + location.hash,
      website: hp ? hp.value : '',
      elapsed_ms: Math.round(performance.now()),
    }
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then(function (r) {
        if (!r.ok) throw new Error('lead ' + r.status)
        return true
      })
      .catch(function () {
        // the page already showed its "done" panel — give the form back
        if (root && root.tagName === 'FORM' && root.hidden) {
          root.hidden = false
          var done = document.getElementById(String(root.id).replace(/-form$/, '-ok'))
          if (done) done.hidden = true
        }
        sorry()
        return false
      })
  }

  // A hidden honeypot field in every form: invisible to people, filled by bots.
  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form')
    for (var i = 0; i < forms.length; i++) {
      var hp = document.createElement('input')
      hp.type = 'text'
      hp.name = HONEYPOT
      hp.tabIndex = -1
      hp.autocomplete = 'off'
      hp.setAttribute('aria-hidden', 'true')
      hp.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;opacity:0'
      forms[i].appendChild(hp)
    }
  })
})()
