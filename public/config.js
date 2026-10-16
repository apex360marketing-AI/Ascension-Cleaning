// Business details shown on the site.
// TODO(launch): fill these in with Kayla's real details. `npm run prelaunch`
// fails until every value is set, so placeholders can't go live by accident.
window.ASCENSION = {
  phone: '', // TODO(launch): e.g. '250-555-0123' — shown in the menu and footer, used for tap-to-call
  email: '', // TODO(launch): an address on a domain that actually receives mail
  reviewsUrl: '', // TODO(launch): Google Business Profile review link
}

// Phone links: show the real number, or hide the link until there is one.
document.addEventListener('DOMContentLoaded', function () {
  var p = window.ASCENSION.phone
  var links = document.querySelectorAll('[data-biz="phone"]')
  for (var i = 0; i < links.length; i++) {
    var a = links[i]
    if (p) {
      var d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
      a.textContent = p
      a.href = 'tel:+1' + d
    } else {
      ;(a.closest('.ft-phone') || a.closest('b') || a).hidden = true
    }
  }
})
