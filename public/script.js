document.getElementById("leadForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const formData = new FormData(this);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  try {
    const res = await fetch("/submit-lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "changeme" // must match FRONTEND_API_KEY in .env
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // Get the response message container
    const responseBox = document.getElementById("responseMessage");

    if (res.ok && data.success) {
      responseBox.className = "success";
      responseBox.textContent = JSON.stringify(data, null, 2);
      console.log("✅ Lead submitted successfully:", data);
    } else {
      responseBox.className = "error";
      responseBox.textContent = JSON.stringify(data, null, 2);
      console.error("❌ Error submitting lead:", data);
    }
  } catch (err) {
    const responseBox = document.getElementById("responseMessage");
    responseBox.className = "error";
    responseBox.textContent = "Network error: " + err.message;
    console.error("❌ Network error:", err);
  }
});
