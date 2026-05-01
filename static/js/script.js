document.addEventListener('DOMContentLoaded', () => {
  const fileForm    = document.getElementById('fileForm');
  const textForm    = document.getElementById('textForm');
  const result      = document.getElementById('result');
  const codeDisplay = document.getElementById('codeDisplay');
  const qrImage     = document.getElementById('qrImage');
  const toggleBtn   = document.getElementById('theme-toggle');
  const themeIcon   = document.getElementById('theme-icon');
  const logo        = document.getElementById('clipshare-logo');
  const copyMsg     = document.getElementById('copyMsg');
  const codeInputs  = document.querySelectorAll('.code-input');
  const receiveBtn  = document.querySelector('#receiveBox .receive-btn') ||
                      document.querySelector('#receiveBox button');

  // ── Apply saved theme on load ──
  (function applyTheme() {
    const saved = localStorage.getItem('theme');
    const isDark = saved === null ? true : saved === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    if (themeIcon) themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    if (logo) logo.src = isDark ? '/static/images/logow.png' : '/static/images/logob.png';
  })();

  // ── Theme toggle ──
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      if (themeIcon) themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      if (logo) logo.src = isDark ? '/static/images/logow.png' : '/static/images/logob.png';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  // ── Error redirect handling ──
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'invalid') {
    // Clean URL immediately so it never blocks interaction on refresh
    const errCode = params.get('code') || '';
    window.history.replaceState({}, '', '/');

    // Show toast
    const toastMsg = errCode
      ? `Code <strong>${errCode}</strong> was not found or has expired.`
      : 'Code not found or expired.';
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(toastMsg);
    }

    // Switch to receive tab WITHOUT clearing inputs
    const sendBox    = document.getElementById('sendBox');
    const receiveBox = document.getElementById('receiveBox');
    const btnSend    = document.getElementById('btnSend');
    const btnReceive = document.getElementById('btnReceive');
    if (receiveBox) receiveBox.classList.remove('d-none');
    if (sendBox)    sendBox.classList.add('d-none');
    if (btnReceive) btnReceive.classList.add('active');
    if (btnSend)    btnSend.classList.remove('active');

    // Pre-fill digits
    codeInputs.forEach((inp, i) => {
      inp.value = errCode[i] || '';
      inp.classList.toggle('filled', !!errCode[i]);
    });
    if (codeInputs[0]) codeInputs[0].focus();
  }

  // ── Add Text / Back to Files ──
  const addTextBtn    = document.getElementById('addTextBtn');
  const backToFileBtn = document.getElementById('backToFileBtn');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const filePanel     = document.getElementById('filePanel');
  const textPanel     = document.getElementById('textPanel');

  if (addTextBtn) {
    addTextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (filePanel) filePanel.style.display = 'none';
      if (textPanel) { textPanel.style.display = 'block'; document.getElementById('text')?.focus(); }
    });
  }

  if (backToFileBtn) {
    backToFileBtn.addEventListener('click', () => {
      if (textPanel) textPanel.style.display = 'none';
      if (filePanel) filePanel.style.display = 'block';
    });
  }

  // Select Files button clicks the hidden input directly
  if (selectFilesBtn) {
    selectFilesBtn.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('file')?.click();
    });
  }

  // ── Drag & Drop ──
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const fileInput = document.getElementById('file');
      if (e.dataTransfer.files.length) {
        const dt = new DataTransfer();
        [...e.dataTransfer.files].forEach(f => dt.items.add(f));
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // ── File list state ──
  let selectedFiles = [];

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderFileList() {
    const list     = document.getElementById('filePreviewList');
    const dropZoneEl = document.getElementById('dropZone');
    if (!list) return;
    list.innerHTML = '';

    if (selectedFiles.length === 0) {
      if (dropZoneEl) dropZoneEl.style.display = '';
      return;
    }
    if (dropZoneEl) dropZoneEl.style.display = 'none';

    selectedFiles.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="file-row-icon">
          <i class="far fa-file"></i>
        </div>
        <div class="file-row-info">
          <div class="file-row-name">${f.name}</div>
          <div class="file-row-size">${formatBytes(f.size)}</div>
        </div>
        <button class="file-row-remove" data-idx="${i}" type="button" title="Remove">
          <i class="fas fa-xmark"></i>
        </button>`;
      list.appendChild(li);
    });

    list.querySelectorAll('.file-row-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFiles.splice(parseInt(btn.dataset.idx), 1);
        renderFileList();
      });
    });
  }

  // ── Live file preview ──
  const fileInputEl = document.getElementById('file');
  if (fileInputEl) {
    fileInputEl.addEventListener('change', function () {
      [...this.files].forEach(f => selectedFiles.push(f));
      renderFileList();
    });
  }

  // Add More Files button (reuses same hidden input)
  const fileMoreEl = document.getElementById('fileMore');
  if (fileMoreEl) {
    fileMoreEl.addEventListener('change', function () {
      [...this.files].forEach(f => selectedFiles.push(f));
      renderFileList();
    });
  }

  // ── TTL Custom toggle ──
  function bindTtlCustom(groupName, wrapId, inputId) {
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(rb => {
      rb.addEventListener('change', () => {
        const wrap = document.getElementById(wrapId);
        const isCustom = rb.value === 'custom' && rb.checked;
        if (wrap) {
          wrap.style.display = isCustom ? 'block' : 'none';
          if (isCustom) {
            wrap.style.animation = 'none';
            void wrap.offsetWidth;
            wrap.style.animation = '';
            document.getElementById(inputId)?.focus();
          }
        }
      });
    });

    // Also handle label click directly for + pill
    const customRb = document.querySelector(`input[name="${groupName}"][value="custom"]`);
    const customLabel = customRb ? document.querySelector(`label[for="${customRb.id}"]`) : null;
    if (customLabel && customRb) {
      customLabel.addEventListener('click', e => {
        e.preventDefault();
        customRb.checked = true;
        customRb.dispatchEvent(new Event('change'));
        // update pill active states
        document.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
          const lbl = document.querySelector(`label[for="${r.id}"]`);
          if (lbl) lbl.classList.toggle('active-pill', r.checked);
        });
      });
    }
  }

  bindTtlCustom('fileTtl', 'fileCustomTtlWrap', 'fileCustomTtl');
  bindTtlCustom('textTtl', 'textCustomTtlWrap', 'textCustomTtl');

  // ── Paste-to-Upload (Ctrl+V / Cmd+V) ──
  document.addEventListener('paste', async (e) => {
    // Only act on the home page Send panel, skip if user is typing in an input/textarea
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (!document.getElementById('sendBox') || document.getElementById('sendBox').classList.contains('d-none')) return;

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for pasted files first (images, copied files, screenshots)
    if (clipboardData.files && clipboardData.files.length > 0) {
      e.preventDefault();
      const formData = new FormData();
      [...clipboardData.files].forEach(f => {
        // Give unnamed blobs a sensible filename
        const name = f.name || `paste_${Date.now()}.${f.type.split('/')[1] || 'bin'}`;
        formData.append('files', f, name);
      });
      let ttl = document.querySelector('input[name="fileTtl"]:checked')?.value || '1440';
      if (ttl === 'custom') ttl = document.getElementById('fileCustomTtl')?.value || '1440';
      formData.append('ttl', ttl);

      // Show uploading state
      const banner = document.getElementById('resultBanner');
      if (banner) { banner.style.display = 'flex'; banner.querySelector('span').innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#7c6fff;margin-right:6px;"></i> Uploading pasted file…'; }

      try {
        const res = await fetch('/upload_files', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.code) showResult(data.code);
        else alert(data.error || 'Upload failed.');
      } catch (err) { alert('Paste upload failed.'); }
      return;
    }

    // Check for pasted text
    const pastedText = clipboardData.getData('text/plain');
    if (pastedText && pastedText.trim()) {
      e.preventDefault();
      let ttl = document.querySelector('input[name="textTtl"]:checked')?.value || '1440';
      if (ttl === 'custom') ttl = document.getElementById('textCustomTtl')?.value || '1440';

      // Show uploading state
      const banner = document.getElementById('resultBanner');
      if (banner) { banner.style.display = 'flex'; banner.querySelector('span').innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#7c6fff;margin-right:6px;"></i> Uploading pasted text…'; }

      try {
        const res = await fetch('/upload_text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `text=${encodeURIComponent(pastedText.trim())}&ttl=${encodeURIComponent(ttl)}`
        });
        const data = await res.json();
        if (data.code) showResult(data.code);
        else alert(data.error || 'Upload failed.');
      } catch (err) { alert('Paste upload failed.'); }
      return;
    }
  });

  // ── File upload ──
  if (fileForm) {
    fileForm.onsubmit = async function (e) {
      e.preventDefault();
      if (!selectedFiles.length) {
        alert('Please select at least one file.');
        return;
      }
      const btn = fileForm.querySelector('button[type=submit]');
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…';
      btn.disabled = true;
      try {
        const formData = new FormData();
        selectedFiles.forEach(f => formData.append('files', f));
        let ttl = document.querySelector('input[name="fileTtl"]:checked')?.value || '1440';
        if (ttl === 'custom') {
          ttl = document.getElementById('fileCustomTtl')?.value || '1440';
        }
        formData.append('ttl', ttl);

        const res  = await fetch('/upload_files', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.code) {
          showResult(data.code);
        } else {
          alert(data.error || 'Upload failed. Please try again.');
        }
      } finally {
        btn.innerHTML = origHTML;
        btn.disabled = false;
      }
    };
  }

  // ── Text upload ──
  if (textForm) {
    textForm.onsubmit = async function (e) {
      e.preventDefault();
      const text = document.getElementById('text').value.trim();
      if (!text) { alert('Please enter some text.'); return; }
      const btn = textForm.querySelector('button[type=submit]');
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…';
      btn.disabled = true;
      try {
        let ttl = document.querySelector('input[name="textTtl"]:checked')?.value || '1440';
        if (ttl === 'custom') {
          ttl = document.getElementById('textCustomTtl')?.value || '1440';
        }

        const res  = await fetch('/upload_text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `text=${encodeURIComponent(text)}&ttl=${encodeURIComponent(ttl)}`
        });
        const data = await res.json();
        if (data.code) showResult(data.code);
      } finally {
        btn.innerHTML = origHTML;
        btn.disabled = false;
      }
    };
  }

  // ── Show result ──
  function showResult(code) {
    const url = `${window.location.origin}/get/${code}`;

    // hidden spans (used by copyLinkText)
    if (codeDisplay) codeDisplay.innerText = url;
    if (qrImage)     qrImage.src = `/qr/${code}`;

    // inline banner
    const banner = document.getElementById('resultBanner');
    if (banner) banner.style.display = 'flex';

    // inline code block
    const codeBlock = document.getElementById('codeBlock');
    const fourDigit = document.getElementById('fourDigitCode');
    if (codeBlock) codeBlock.style.display = 'flex';
    if (fourDigit) fourDigit.innerText = code;

    // QR modal button
    const showQrBtn = document.getElementById('showQrBtn');
    if (showQrBtn) {
      showQrBtn.onclick = () => openQrModal(url, code);
    }

    // hide old result panel if present
    if (result) result.classList.add('d-none');
  }

  // ── QR Modal ──
  window.openQrModal = function(url, code) {
    const modal = document.getElementById('qrModal');
    const img   = document.getElementById('qrModalImage');
    const link  = document.getElementById('qrModalLink');
    if (!modal) return;
    if (img)  img.src  = `/qr/${code}`;
    if (link) { link.href = url; link.innerText = url; }
    modal.style.display = 'flex';
  };

  window.closeQrModal = function(e) {
    if (e.target === document.getElementById('qrModal')) {
      document.getElementById('qrModal').style.display = 'none';
    }
  };

  // ── OTP inputs ──
  codeInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.classList.toggle('filled', input.value.length === 1);
      if (input.value.length === 1 && index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      } else if (index === codeInputs.length - 1 && input.value.length === 1) {
        setTimeout(() => receiveSplitCode(), 120);
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (input.value === '' && index > 0) {
          codeInputs[index - 1].value = '';
          codeInputs[index - 1].classList.remove('filled');
          codeInputs[index - 1].focus();
        } else {
          input.classList.remove('filled');
        }
      }
    });

    input.addEventListener('paste', e => {
      const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
      e.preventDefault();
      codeInputs.forEach((inp, i) => {
        inp.value = paste[i] || '';
        inp.classList.toggle('filled', !!paste[i]);
      });
      const next = codeInputs[Math.min(paste.length, codeInputs.length - 1)] || codeInputs[0];
      next.focus();
    });
  });

  // ── Receive ──
  window.receiveSplitCode = function () {
    const code = [...codeInputs].map(inp => inp.value.trim()).join('');
    if (code.length === 4) {
      window.location.href = `/get/${code}`;
    } else {
      const err = document.getElementById('receiveError');
      if (err) err.classList.remove('d-none');
    }
  };

  // ── Mode switching (smooth crossfade, no layout shift) ──
  function switchPanel(showId, hideId, activateBtn, deactivateBtn, afterSwitch) {
    const panel = document.querySelector('.min-panel');
    const showEl = document.getElementById(showId);
    const hideEl = document.getElementById(hideId);
    const btnOn  = document.getElementById(activateBtn);
    const btnOff = document.getElementById(deactivateBtn);

    if (btnOn)  btnOn.classList.add('active');
    if (btnOff) btnOff.classList.remove('active');

    if (panel) panel.classList.add('panel-switching');

    setTimeout(() => {
      if (showEl) showEl.classList.remove('d-none');
      if (hideEl) hideEl.classList.add('d-none');
      if (result) result.classList.add('d-none');
      if (afterSwitch) afterSwitch();
      if (panel) panel.classList.remove('panel-switching');
    }, 180);
  }

  window.showSend = function () {
    switchPanel('sendBox', 'receiveBox', 'btnSend', 'btnReceive');
  };

  window.showReceive = function () {
    switchPanel('receiveBox', 'sendBox', 'btnReceive', 'btnSend', () => {
      codeInputs.forEach(inp => { inp.value = ''; inp.classList.remove('filled'); });
    });
  };

  // ── Copy link ──
  window.copyLinkText = function () {
    const linkText = document.getElementById('codeDisplay')?.innerText?.trim();
    const msg      = document.getElementById('copyMsg');
    if (!linkText) return;

    function flash() {
      if (!msg) return;
      msg.classList.remove('d-none');
      msg.style.display = 'inline-block';
      setTimeout(() => { msg.classList.add('d-none'); msg.style.display = ''; }, 2000);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(linkText).then(flash).catch(() => fallbackCopy(linkText));
    } else {
      fallbackCopy(linkText);
    }

    function fallbackCopy(text) {
      const tmp = document.createElement('textarea');
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); flash(); } catch (_) {}
      document.body.removeChild(tmp);
    }
  };

});
