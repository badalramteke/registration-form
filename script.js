// Registration client — posts FormData to Apps Script Web App and shows QR full-size
document.addEventListener("DOMContentLoaded", () => {
  // 1) Configure your deployed Apps Script Web App URL (ends with /exec)
  const AS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwdjkWlaz7xwAfEwHJ8qxdajU-ygX2n87h1rs7RoN4XvtS9304A0alcNMWme8ev6fEXhw/exec";

  // Optional: override the payment QR image URL (if empty, uses the <img src> from HTML)
  const PAYMENT_QR_URL = "";

  // Sanity check for URL shape
  (function sanityCheckUrl() {
    try {
      const u = new URL(AS_SCRIPT_URL);
      if (!u.pathname.endsWith("/exec")) {
        console.warn(
          "AS_SCRIPT_URL should end with /exec (not /dev). Use the deployed Web App URL."
        );
      }
    } catch {
      console.warn(
        "AS_SCRIPT_URL is not a valid URL. Paste your Apps Script Web App /exec URL."
      );
    }
  })();

  // Elements
  const form = document.getElementById("regForm");
  const qrInput = document.getElementById("qrfile");
  const statusEl = document.getElementById("status");
  const qrPreview = document.getElementById("qrPreview");

  const payQrImg = document.getElementById("payQr");
  const clearBtn = document.getElementById("clearQr");

  // Optional elements that may or may not exist in HTML
  const viewQrFullBtn = document.getElementById("viewQrFull");
  const qrModal = document.getElementById("qrModal");
  const qrModalImg = document.getElementById("qrModalImg");
  const closeQrBtn = document.getElementById("closeQr");
  const openQrNewTab = document.getElementById("openQrNewTab");
  const openQrNewTabInline = document.getElementById("openQrNewTabInline");
  const downloadBtn = document.getElementById("downloadQrBtn");
  const copyBtn = document.getElementById("copyQrBtn");
  const payQrLink = document.getElementById("payQrLink");

  function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#ff4d4f" : "";
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result || "";
          const base64 = String(result).split(",")[1] || "";
          resolve(base64);
        } catch {
          reject(new Error("Could not read file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  // Build multipart body and send with no custom headers (avoids CORS preflight)
  async function uploadToAppsScript(payload, qrFile) {
    if (!AS_SCRIPT_URL) throw new Error("AS_SCRIPT_URL not set");

    const body = new FormData();
    Object.entries(payload).forEach(([k, v]) => body.append(k, v || ""));

    if (qrFile) {
      body.append("qrFilename", qrFile.name);
      body.append("qrBase64", await readFileAsBase64(qrFile));
    }

    const resp = await fetch(AS_SCRIPT_URL, { method: "POST", body });
    const text = await resp.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Bad response: " + text);
    }
    if (!json.success) throw new Error(json.error || "Upload failed");
    return json;
  }

  function setupQrPreview() {
    if (!qrInput || !qrPreview) return;
    qrInput.addEventListener("change", () => {
      qrPreview.innerHTML = "";
      const file = qrInput.files && qrInput.files[0];
      if (!file) return;
      const info = document.createElement("div");
      info.textContent = `Selected: ${file.name}`;
      qrPreview.appendChild(info);
      if (file.type && file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = "320px"; // larger preview for readability
        img.className = "qr-crisp"; // render sharply
        img.style.display = "block";
        img.onload = () => URL.revokeObjectURL(img.src);
        qrPreview.appendChild(img);
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        qrInput.value = "";
        qrPreview.innerHTML = "";
      });
    }
  }

  function setupPaymentQr() {
    // Determine final QR URL
    const qrUrl =
      PAYMENT_QR_URL || (payQrImg ? payQrImg.getAttribute("src") : "");

    // Show QR at intrinsic size inside its container
    if (payQrImg) {
      if (qrUrl) {
        payQrImg.src = qrUrl;
        // keep inline small for cleaner UI; modal shows full size
        payQrImg.style.width = "10rem"; // 160px (w-40)
        payQrImg.style.height = "auto";
      } else {
        payQrImg.alt = "Payment QR not configured";
      }
    }

    // Wire links/buttons if present
    if (openQrNewTabInline && qrUrl) openQrNewTabInline.href = qrUrl;
    if (openQrNewTab && qrUrl) openQrNewTab.href = qrUrl;
    if (qrModalImg && qrUrl) qrModalImg.src = qrUrl;

    const openModal = () => {
      if (!qrModal) return;
      qrModal.classList.remove("hidden");
    };
    const closeModal = () => {
      if (!qrModal) return;
      qrModal.classList.add("hidden");
    };

    if (viewQrFullBtn) viewQrFullBtn.addEventListener("click", openModal);
    if (closeQrBtn) closeQrBtn.addEventListener("click", closeModal);
    if (qrModal) {
      qrModal.addEventListener("click", (ev) => {
        if (ev.target === qrModal) closeModal();
      });
    }
    if (qrModalImg) {
      qrModalImg.style.maxWidth = "min(90vw, 1200px)"; // fit to viewport
      qrModalImg.style.height = "auto";
      qrModalImg.addEventListener("click", () => {
        const zoomed = qrModalImg.dataset.zoom === "1";
        if (zoomed) {
          qrModalImg.dataset.zoom = "0";
          qrModalImg.style.maxWidth = "min(90vw, 1200px)";
        } else {
          qrModalImg.dataset.zoom = "1";
          qrModalImg.style.maxWidth = "none"; // original pixel size
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }

    if (downloadBtn && qrUrl) {
      downloadBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = qrUrl;
        a.download = "payment-qr.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
    if (copyBtn && qrUrl) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(qrUrl);
          alert("QR link copied to clipboard");
        } catch (e) {
          console.error(e);
          alert("Copy failed — try manually.");
        }
      });
    }
    if (payQrLink) {
      payQrLink.href = qrUrl || "#";
    }
  }

  // Guard: ensure form exists
  if (!form) {
    console.warn('Registration form not found (id="regForm").');
    setupPaymentQr();
    setupQrPreview();
    return;
  }

  // Wire helpers
  setupPaymentQr();
  setupQrPreview();

  // Submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("Submitting...");

    try {
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name") || "",
        roll: fd.get("roll") || "",
        email: fd.get("email") || "",
        branch: fd.get("branch") || "",
        phone: fd.get("phone") || "",
        pitch: fd.get("pitch") || "",
      };

      const qrFile =
        qrInput && qrInput.files && qrInput.files[0] ? qrInput.files[0] : null;

      // Basic validation
      if (!payload.name || !payload.roll || !payload.email || !payload.branch) {
        setStatus("Please fill required fields.", true);
        return;
      }
      if (qrFile && !qrFile.type.startsWith("image/")) {
        setStatus("Please upload an image file (PNG/JPG).", true);
        return;
      }
      if (qrFile && qrFile.size > 5 * 1024 * 1024) {
        setStatus("Image too large. Max 5MB.", true);
        return;
      }

      await uploadToAppsScript(payload, qrFile);
      setStatus("Uploaded QR & saved.");
      form.reset();
      if (qrPreview) qrPreview.innerHTML = "";
      alert("Registration successful.");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + (err.message || String(err)), true);
      alert("Submission failed: " + (err.message || String(err)));
    }
  });
});
