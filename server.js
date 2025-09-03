/**
 * server.js
 * Node + Express server that serves the form and forwards validated leads to TrackDrive.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');

const app = express();

const PORT = process.env.PORT || 3000;
const TRACKDRIVE_API_URL = process.env.TRACKDRIVE_API_URL || 'https://lead-prodigy.trackdrive.com/api/v1/leads';
const LEAD_TOKEN = process.env.LEAD_TOKEN;
const TRAFFIC_SOURCE_ID = process.env.TRAFFIC_SOURCE_ID;
const FRONTEND_API_KEY = process.env.FRONTEND_API_KEY || '';
const UPSTREAM_TIMEOUT = parseInt(process.env.UPSTREAM_TIMEOUT || '10000', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(xss());
app.use(express.static(path.join(__dirname, 'public')));

// Utility validators
const stateRegex = /^[A-Z]{2}$/;
const phoneE164Regex = /^\+?[1-9]\d{6,14}$/; // e.g. +17191234567
const digits10Regex = /^\d{10}$/;
const isoDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// List of required fields (as you defined)
const REQUIRED_FIELDS = [
  'caller_id', 'first_name', 'last_name', 'email', 'address', 'address2',
  'city', 'state', 'zip', 'alternate_phone', 'dob', 'source_url',
  'trusted_form_cert_url', 'accident_type', 'currently_represented',
  'needs_attorney', 'person_at_fault', 'hospitalized_or_treated',
  'auto_accident_in_past_2_years', 'date_injured', 'sustain_an_injury',
  'case_description', 'landing_page_url', 'incident_date'
];

// server-side validation
function validateLead(payload) {
  const errors = [];

  // ensure server has static tokens
  if (!LEAD_TOKEN) errors.push('Server error: LEAD_TOKEN not configured.');
  if (!TRAFFIC_SOURCE_ID) errors.push('Server error: TRAFFIC_SOURCE_ID not configured.');

  // presence
  for (const f of REQUIRED_FIELDS) {
    if (!payload[f] && payload[f] !== 0) {
      errors.push(`Missing required field: ${f}`);
    }
  }

  if (payload.caller_id && !phoneE164Regex.test(payload.caller_id)) {
    errors.push('caller_id must be in E.164-ish format (e.g. +17191234567).');
  }

  if (payload.alternate_phone && !digits10Regex.test(String(payload.alternate_phone))) {
    errors.push('alternate_phone must be 10 digits, no special characters.');
  }

  if (payload.state && !stateRegex.test(String(payload.state).toUpperCase())) {
    errors.push('state must be 2-letter US state code (e.g. ME, CA).');
  }

  if (payload.email && !emailRegex.test(String(payload.email))) {
    errors.push('email is invalid.');
  }

  if (payload.dob && !isoDateRegex.test(String(payload.dob))) {
    errors.push('dob must be in YYYY-MM-DD format.');
  }

  if (payload.date_injured && !isoDateRegex.test(String(payload.date_injured))) {
    errors.push('date_injured must be in YYYY-MM-DD format.');
  }

  if (payload.incident_date && !isoDateRegex.test(String(payload.incident_date))) {
    errors.push('incident_date must be in YYYY-MM-DD format.');
  }

  return errors;
}

// helper to get IP address where form was filled
function getIpAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be a comma separated list; take first
    return forwarded.split(',')[0].trim();
  }
  return req.connection.remoteAddress || req.ip;
}

// endpoint that receives form submissions from the browser
app.post('/submit-lead', async (req, res) => {
  try {
    // optional API key check to prevent misuse
    if (FRONTEND_API_KEY) {
      const provided = req.headers['x-api-key'] || req.body.api_key;
      if (!provided || provided !== FRONTEND_API_KEY) {
        return res.status(403).json({ success: false, error: 'Invalid API key' });
      }
    }

    const inbound = req.body || {};

    // Attach ip from server if not provided by client (server-captured)
    if (!inbound.ip_address) {
      inbound.ip_address = getIpAddress(req) || '';
    }

    // Add static values
    inbound.lead_token = LEAD_TOKEN;
    inbound.traffic_source_id = TRAFFIC_SOURCE_ID;

    // Validate
    const errors = validateLead(inbound);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    // Build form-encoded body to match TrackDrive examples
    const params = new URLSearchParams();
    Object.entries(inbound).forEach(([k, v]) => {
      // skip empty
      if (v === undefined || v === null) return;
      const s = String(v).trim();
      if (s === '') return;
      params.append(k, s);
    });

    // Forward to TrackDrive
    const tdResp = await axios.post(TRACKDRIVE_API_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: UPSTREAM_TIMEOUT
    });

    // Return TrackDrive response as-is
    return res.status(tdResp.status).json(tdResp.data);
  } catch (err) {
    // upstream error handling
    if (err.response && err.response.data) {
      return res.status(err.response.status || 500).json({
        success: false,
        error: 'TrackDrive API error',
        details: err.response.data
      });
    }
    console.error('submit-lead error:', err.message || err);
    return res.status(500).json({ success: false, error: err.message || 'server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
