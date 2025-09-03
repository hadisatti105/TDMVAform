const form = document.getElementById('leadForm');
const resultEl = document.getElementById('result');

// Optionally set to match FRONTEND_API_KEY in .env if used
const apiKey = ''; // set if using FRONTEND_API_KEY

const stateRegex = /^[A-Za-z]{2}$/;
const phoneE164Regex = /^\+?[1-9]\d{6,14}$/;
const digits10Regex = /^\d{10}$/;
const isoDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientValidate(data) {
  const errs = [];
  if (!data.caller_id || !phoneE164Regex.test(data.caller_id)) errs.push('caller_id must look like +17191234567');
  if (!data.alternate_phone || !digits10Regex.test(data.alternate_phone)) errs.push('alternate_phone must be 10 digits');
  if (!data.state || !stateRegex.test(data.state)) errs.push('state must be 2 letters');
  if (!data.email || !emailRegex.test(data.email)) errs.push('email looks invalid');
  if (!data.dob || !isoDateRegex.test(data.dob)) errs.push('dob must be YYYY-MM-DD');
  if (!data.date_injured || !isoDateRegex.test(data.date_injured)) errs.push('date_injured must be YYYY-MM-DD');
  if (!data.incident_date || !isoDateRegex.test(data.incident_date)) errs.push('incident_date must be YYYY-MM-DD');

  // presence of the other required fields
  const required = [
    'first_name','last_name','address','address2','city','zip',
    'source_url','trusted_form_cert_url','landing_page_url',
    'accident_type','currently_represented','needs_attorney','person_at_fault',
    'hospitalized_or_treated','auto_accident_in_past_2_years','sustain_an_injury','case_description'
  ];
  for (const r of required) {
    if (!data[r] || String(data[r]).trim() === '') errs.push(`${r} is required`);
  }
  return errs;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultEl.textContent = 'Validating...';

  const formData = new FormData(form);
  const body = {};
  for (const [k,v] of formData.entries()) {
    if (v === null || v === '') continue;
    // convert date inputs to YYYY-MM-DD (they already are)
    body[k] = v;
  }

  const errors = clientValidate(body);
  if (errors.length) {
    resultEl.textContent = 'Validation errors:\n' + errors.join('\n');
    return;
  }

  resultEl.textContent = 'Submitting lead...';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey; // if you configured FRONTEND_API_KEY

    const resp = await fetch('/submit-lead', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      resultEl.textContent = `Error (${resp.status}): ${JSON.stringify(data, null, 2)}`;
      return;
    }
    resultEl.textContent = `Success:\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    resultEl.textContent = 'Network error: ' + err.message;
  }
});
