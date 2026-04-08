const fs = require('fs');

try {
  let content = fs.readFileSync('public/app.js', 'utf8');

  // Inject dashboard-stats fetching and rendering into renderDashboard
  // We'll replace the static dashboard-stats section in the HTML string, and also append the fetch logic.
  
  const dashboardHtmlRegex = /<section class="dashboard-stats" id="dashboard-stats">[\s\S]*?<\/section>/;
  const newDashboardStatsHtml = `
        <section class="dashboard-stats" id="dashboard-stats">
          <article class="stat-card">
            <h3>Daily Revenue</h3>
            <div class="stat-value" id="stat-rev-day">₹0.00</div>
          </article>
          <article class="stat-card">
            <h3>Monthly Revenue</h3>
            <div class="stat-value" id="stat-rev-month">₹0.00</div>
          </article>
          <article class="stat-card">
            <h3>Yearly Revenue</h3>
            <div class="stat-value" id="stat-rev-year">₹0.00</div>
          </article>
          <article class="stat-card">
            <h3>Total Unique Customers</h3>
            <div class="stat-value" id="stat-customers">0</div>
          </article>
        </section>
  `;
  content = content.replace(dashboardHtmlRegex, newDashboardStatsHtml);

  // We need to inject the fetch for /api/dashboard-stats inside renderDashboard().
  // find: `try {\n      const response = await fetch("/api/purchases");\n      if (!response.ok) return;`
  // and append dash-stats fetch right before it.
  const appendFetchStats = `
      // Dashboard Stats Fetch
      const statsRes = await fetch("/api/dashboard-stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const f = val => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);
        document.getElementById("stat-rev-day").textContent = f(statsData.revenueDay);
        document.getElementById("stat-rev-month").textContent = f(statsData.revenueMonth);
        document.getElementById("stat-rev-year").textContent = f(statsData.revenueYear);
        document.getElementById("stat-customers").textContent = statsData.totalCustomers;
      }
      `;
  
  content = content.replace(
    /try \{\s*const response = await fetch\("\/api\/purchases"\);/, 
    appendFetchStats + '\n      try {\n      const response = await fetch("/api/purchases");'
  );

  // Render Customers - Add Camera capture logic
  // Update the form
  const addCameraHtml = `
          <label>
            <span>Customer Photo (Camera)</span>
            <div id="camera-container" style="display:flex; flex-direction:column; gap:8px;">
              <video id="camera-stream" width="100%" height="auto" autoplay playsinline style="background:#000; border-radius: 8px; display:none;"></video>
              <canvas id="camera-canvas" style="display:none;"></canvas>
              <img id="photo-preview" src="" style="display:none; width: 100%; border-radius: 8px;"/>
              <input type="hidden" name="photo" id="photo-data" />
              <button type="button" id="start-camera-btn" style="background:var(--color-cyan); color:black; border:none; padding:8px; border-radius:4px; cursor:pointer;">Start Camera</button>
              <button type="button" id="take-photo-btn" style="display:none; background:var(--color-black); color:var(--color-cyan); border:1px solid var(--color-cyan); padding:8px; border-radius:4px; cursor:pointer;">Capture Photo</button>
            </div>
          </label>
          <button type="submit">Save Customer</button>
  `;
  content = content.replace(/<button type="submit">Save Customer<\/button>/, addCameraHtml);

  // Inject Camera wiring inside renderCustomers
  const cameraScript = `
    const startCamBtn = document.getElementById("start-camera-btn");
    const takePhotoBtn = document.getElementById("take-photo-btn");
    const video = document.getElementById("camera-stream");
    const canvas = document.getElementById("camera-canvas");
    const photoPreview = document.getElementById("photo-preview");
    const photoData = document.getElementById("photo-data");
    
    let stream = null;
    if (startCamBtn) {
      startCamBtn.addEventListener("click", async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          video.srcObject = stream;
          video.style.display = "block";
          photoPreview.style.display = "none";
          startCamBtn.style.display = "none";
          takePhotoBtn.style.display = "inline-block";
        } catch (e) {
          console.error("Camera access denied", e);
          alert("Camera access denied or not available.");
        }
      });
      takePhotoBtn.addEventListener("click", () => {
        if (!stream) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        photoPreview.src = dataUrl;
        photoData.value = dataUrl;
        video.style.display = "none";
        photoPreview.style.display = "block";
        takePhotoBtn.style.display = "none";
        startCamBtn.style.display = "inline-block";
        startCamBtn.textContent = "Retake Photo";
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      });
    }
  `;
  
  content = content.replace(
    /form\.addEventListener\("submit", async \(event\) => \{/,
    cameraScript + '\n    form.addEventListener("submit", async (event) => {'
  );

  // Customer List Item update to display thumbnail
  const customerListHtml = `
      innerHTML += \`
        <article class="data-row">
          <div style="display:flex; align-items:center; gap: 16px;">
            \${customer.photo ? \`<img src="\${customer.photo}" style="width:48px;height:48px;object-fit:cover;border-radius:24px;border:1px solid var(--color-cyan);"/>\` : \`<div style="width:48px;height:48px;border-radius:24px;background:#333;display:flex;align-items:center;justify-content:center;color:var(--color-cyan);font-weight:bold;">\${customer.name.charAt(0).toUpperCase()}</div>\`}
            <div>
              <h3>\${customer.name}</h3>
              <p class="muted">Age: \${customer.age} | \${customer.phone || 'No phone'}</p>
            </div>
          </div>
        </article>
      \`;
  `;
  content = content.replace(
    /innerHTML \+= `\s*<article class="data-row">\s*<h3>\$\{customer\.name\}<\/h3>\s*<p class="muted">Age: \$\{customer\.age\} \| \$\{customer\.phone \|\| 'No phone'\}<\/p>\s*<\/article>\s*`;/g,
    customerListHtml
  );

  // Check if renderHistory already exists
  if (!content.includes('async function renderHistory()')) {
    const renderHistoryFn = `
  async function renderHistory() {
    appRoot.innerHTML = \`
      <section class="section-card">
        <div class="section-header">
          <div>
            <h2>Customer History</h2>
            <p class="muted">Search and review customer details and purchases</p>
          </div>
        </div>
        <div class="search-bar" style="margin-bottom: 24px;">
          <input type="text" id="history-search" placeholder="Search by name, phone, or age..." style="width: 100%; padding: 12px; background: rgba(0,0,0,0.4); border: 1px solid var(--color-cyan); color: white; border-radius: 8px;">
        </div>
        <div id="history-results" class="data-grid">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </section>
      <dialog id="history-modal" class="glass-card" style="padding:0; border:1px solid var(--color-cyan); background:rgba(0,0,0,0.9); border-radius:12px; min-width:300px; width:100%; max-width:500px; top: 50%; transform: translateY(-50%); margin:0 auto;">
         <div id="history-modal-content" style="padding:24px; color:white; max-height:80vh; overflow-y:auto;"></div>
         <div style="padding:16px; text-align:right; border-top:1px solid rgba(0,255,255,0.2);">
           <button type="button" id="close-history-modal" style="background:var(--color-cyan); color:black; padding:8px 16px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Close</button>
         </div>
      </dialog>
    \`;

    try {
      const respCust = await fetch("/api/customers");
      const respPurch = await fetch("/api/purchases");
      if (!respCust.ok || !respPurch.ok) return;
      
      const allCustomers = await respCust.json();
      const allPurchases = await respPurch.json();
      const resultsContainer = document.getElementById("history-results");
      const searchInput = document.getElementById("history-search");
      const modal = document.getElementById("history-modal");
      const closeBtn = document.getElementById("close-history-modal");
      const modalContent = document.getElementById("history-modal-content");

      closeBtn.addEventListener("click", () => modal.close());

      const renderList = (data) => {
        if (!data.length) {
          resultsContainer.innerHTML = '<p class="muted">No customers found.</p>';
          return;
        }
        let html = '';
        data.forEach(c => {
          html += \`
            <article class="data-row" style="cursor:pointer;" onclick="window.showCustomerHistory(\${c.id})">
              <div style="display:flex; align-items:center; gap: 16px;">
                \${c.photo ? \`<img src="\${c.photo}" style="width:48px;height:48px;object-fit:cover;border-radius:24px;border:1px solid var(--color-cyan);"/>\` : \`<div style="width:48px;height:48px;border-radius:24px;background:#333;display:flex;align-items:center;justify-content:center;color:var(--color-cyan);font-weight:bold;">\${c.name.charAt(0).toUpperCase()}</div>\`}
                <div>
                  <h3>\${c.name}</h3>
                  <p class="muted">Age: \${c.age} | \${c.phone || 'No phone'}</p>
                </div>
              </div>
            </article>
          \`;
        });
        resultsContainer.innerHTML = html;
      };

      window.showCustomerHistory = (custId) => {
        const cust = allCustomers.find(c => c.id === custId);
        const purchs = allPurchases.filter(p => p.customerId === custId);
        if (!cust) return;
        
        let purchHtml = '';
        if (purchs.length) {
          purchs.forEach(p => {
             purchHtml += \`
               <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed rgba(255,255,255,0.2);">
                 <div>\${p.productName}</div>
                 <div class="muted" style="font-size:0.8rem;">Amount: \${p.amount} | Date: \${new Date(p.createdAt).toLocaleDateString()}</div>
               </div>
             \`;
          });
        } else {
          purchHtml = '<p class="muted">No purchases.</p>';
        }

        modalContent.innerHTML = \`
          <div style="display:flex; align-items:center; gap: 16px; margin-bottom: 24px;">
            \${cust.photo ? \`<img src="\${cust.photo}" style="width:80px;height:80px;object-fit:cover;border-radius:40px;border:2px solid var(--color-cyan);"/>\` : \`<div style="width:80px;height:80px;border-radius:40px;background:#333;display:flex;align-items:center;justify-content:center;color:var(--color-cyan);font-weight:bold;font-size:2rem;">\${cust.name.charAt(0).toUpperCase()}</div>\`}
            <div>
              <h2 style="margin:0; color:var(--color-cyan);">\${cust.name}</h2>
              <p class="muted" style="margin:4px 0 0 0;">Age: \${cust.age}</p>
              <p class="muted" style="margin:0;">Phone: \${cust.phone || 'N/A'}</p>
              <p class="muted" style="margin:0;">Joined: \${new Date(cust.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <h3 style="margin-bottom:12px; border-bottom:1px solid rgba(0,255,255,0.3); padding-bottom:8px;">Purchase History (\${purchs.length})</h3>
          \${purchHtml}
        \`;
        modal.showModal();
      };

      searchInput.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allCustomers.filter(c => 
          c.name.toLowerCase().includes(q) || 
          String(c.phone || '').toLowerCase().includes(q) ||
          String(c.age).includes(q)
        );
        renderList(filtered);
      });

      renderList(allCustomers);
    } catch (e) {
      console.error(e);
      document.getElementById("history-results").innerHTML = '<p class="status-line error">Failed to load history</p>';
    }
  }
`;
    content += renderHistoryFn;
  }

  fs.writeFileSync('public/app.js', content);
  console.log('patched app.js dashboard, camera and history views correctly');
} catch (e) {
  console.error(e);
}
