const fs = require('fs');

try {
  let content = fs.readFileSync('public/app.js', 'utf8');

  // 1. Update loaders
  content = content.replace(
    /analytics: \w+\n\s*\};/,
    match => match.replace('};', '  history: renderHistory\n  };')
  );

  // 2. Update pageConfig
  content = content.replace(
    /analytics:\s*\{\s*title:\s*"Analytics"\s*\}\n\s*\};/,
    match => match.replace('};', '  history: { title: "Customer History" }\n  };')
  );

  // 3. Update auth check
  content = content.replace(
    /if \(page === "login"\) \{\n\s*wireLogin\(\);\n\s*return;\n\s*\}/,
    `if (page === "login" || page === "signup") {
    if (page === "login") wireLogin();
    if (page === "signup") wireSignup();
    return;
  }`
  );

  // 4. Add wireSignup underneath wireLogin
  const wireSignupFunc = `
  function wireSignup() {
    const form = document.getElementById("signup-form");
    const message = document.getElementById("signup-message");
    if (!form || !message) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        shopName: String(formData.get("shopName") || "")
      };

      setStatus(message, "Creating account...", "success");

      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
          setStatus(message, result.error || "Signup failed", "error");
          return;
        }
        setStatus(message, "Account created! Redirecting...", "success");
        window.location.href = result.redirectTo || "/dashboard";
      } catch (err) {
        setStatus(message, "Network error", "error");
      }
    });
  }
`;
  if (!content.includes('function wireSignup()')) {
    content = content.replace(/function setStatus\(/, wireSignupFunc + '\n  function setStatus(');
  }

  // 5. Update Dashboard Stats (Revenue + Customer Deduplication)
  // We need to find fetch("/api/analytics") or wherever it renders stats
  // Let's add real-time revenue and real customer logic to renderDashboard

  // 6. Customers Page Camera
  // We need to modify renderCustomers to add a camera capture.
  // Actually, we'll just parse the file and inject a patch script.
  fs.writeFileSync('public/app.js', content);
  console.log('patched basic routes successfully');
} catch (e) {
  console.error(e);
}
