const fs = require('fs');

try {
  let content = fs.readFileSync('public/app.js', 'utf8');

  // Fix Camera Bug - The previous patch put camera initialization inside wireSignup.
  // We need to remove it from wireSignup and put it inside renderCustomers.
  
  // 1. Remove it from wireSignup
  const badScriptStart = 'const startCamBtn = document.getElementById("start-camera-btn");';
  const badScriptEnd = 'stream = null;\n      });\n    }';
  
  if (content.includes(badScriptStart)) {
    const startIdx = content.indexOf(badScriptStart);
    const endIdx = content.indexOf(badScriptEnd) + badScriptEnd.length;
    content = content.substring(0, startIdx) + content.substring(endIdx);
  }

  // 2. Add it to renderCustomers
  const cameraInitLogic = `
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
  
  // We need to inject it at the end of renderCustomers, right after bindForm("customers-form", ... )
  content = content.replace(
    /bindForm\("customers-form", "\/api\/customers", renderCustomers\);/,
    'bindForm("customers-form", "/api/customers", renderCustomers);\n' + cameraInitLogic
  );

  fs.writeFileSync('public/app.js', content);
  console.log('patched app.js camera logic');
} catch (e) {
  console.error(e);
}
