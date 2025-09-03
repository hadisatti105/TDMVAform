// server.js
require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch"); // v2
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(express.static("public")); // serve index.html, style.css, script.js

// ✅ Secure API key check
const FRONTEND_API_KEY = process.env.FRONTEND_API_KEY || "changeme";

// ✅ Required tokens
const LEAD_TOKEN = process.env.LEAD_TOKEN;
const TRAFFIC_SOURCE_ID = process.env.TRAFFIC_SOURCE_ID;

if (!LEAD_TOKEN || !TRAFFIC_SOURCE_ID) {
  console.error("❌ ERROR: LEAD_TOKEN or TRAFFIC_SOURCE_ID not configured in .env");
  process.exit(1);
}

// ✅ Lead submission endpoint
app.post("/submit-lead", async (req, res) => {
  try {
    // Check API key
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== FRONTEND_API_KEY) {
      return res.status(403).json({ success: false, error: "Invalid API key" });
    }

    // Collect data from frontend
    const leadData = req.body;

    // Build params (always append static values server-side)
    const params = new URLSearchParams({
      ...leadData,
      lead_token: LEAD_TOKEN,
      traffic_source_id: TRAFFIC_SOURCE_ID,
      ip_address: req.ip || req.connection.remoteAddress || "0.0.0.0"
    });

    // Send to TrackDrive
    const response = await fetch("https://lead-prodigy.trackdrive.com/api/v1/leads", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await response.text(); // raw response
    console.log("🔍 TrackDrive raw response:", text);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Server error: Unable to submit lead",
        details: text
      });
    }

    return res.json(JSON.parse(text));
  } catch (err) {
    console.error("❌ Exception:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
