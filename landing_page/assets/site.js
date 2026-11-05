const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
const dropButton = document.querySelector('.drop-toggle');
const dropdown = document.querySelector('.dropdown');
function closeDropdown() { dropdown?.classList.remove('open'); dropButton?.setAttribute('aria-expanded', 'false'); }
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open);
});
dropButton?.addEventListener('click', () => {
  const open = dropButton.getAttribute('aria-expanded') !== 'true';
  dropButton.setAttribute('aria-expanded', String(open)); dropdown.classList.toggle('open', open);
});
document.addEventListener('click', event => { if (!dropdown?.contains(event.target)) closeDropdown(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (dropdown?.classList.contains('open')) { closeDropdown(); dropButton.focus(); }
  else if (nav?.classList.contains('open')) { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.focus(); }
});
document.querySelectorAll('[data-focus]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-focus]').forEach(item => {
    item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button));
  });
  let shown = 0;
  document.querySelectorAll('[data-category]').forEach(row => {
    row.hidden = button.dataset.focus !== 'all' && row.dataset.category !== button.dataset.focus;
    if (!row.hidden) shown++;
  });
  document.querySelector('#filter-status').textContent = `Showing ${shown} evaluation areas: ${button.textContent.toLowerCase()}.`;
}));
const form = document.querySelector('#contact-form');
if (form) {
  const requested = new URLSearchParams(location.search).get('topic');
  if ([...form.elements.topic.options].some(option => option.value === requested)) form.elements.topic.value = requested;
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const recipient = document.body.dataset.contactEmail;
    const subject = `LiquidNAT enquiry: ${data.get('topic')}`;
    const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\nCompany: ${data.get('company') || 'Not provided'}\nTopic: ${data.get('topic')}\n\n${data.get('message')}`;
    document.querySelector('#email-copy').value = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;
    document.querySelector('#email-fallback').hidden = false;
    document.querySelector('#form-status').textContent = 'Enquiry prepared. Review and send it in your email app, or copy it below.';
    location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  document.querySelector('.copy-button').addEventListener('click', async event => {
    const copy = document.querySelector('#email-copy');
    try { await navigator.clipboard.writeText(copy.value); event.target.textContent = 'Enquiry copied'; }
    catch { copy.focus(); copy.select(); document.querySelector('#form-status').textContent = 'Select and copy the prepared enquiry with your device’s copy command.'; }
  });
}
