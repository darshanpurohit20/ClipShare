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
    showReceive();
    document.getElementById('receiveError').classList.remove('d-none');
    codeInputs.forEach(inp => inp.value = '');
    const code = params.get('code') || '';
    for (let i = 0; i < code.length && i < codeInputs.length; i++) {
      codeInputs[i].value = code[i];
      codeInputs[i].classList.toggle('filled', !!code[i]);
    }
    if (codeInputs[0]) codeInputs[0].focus();
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

  // ── Live file preview ──
  const fileInputEl = document.getElementById('file');
  if (fileInputEl) {
    fileInputEl.addEventListener('change', function () {
      const list = document.getElementById('filePreviewList');
      if (!list) return;
      list.innerHTML = '';
      [...this.files].forEach(f => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-file" style="color:var(--accent);font-size:0.75rem;"></i> ${f.name}`;
        list.appendChild(li);
      });
    });
  }

  // ── TTL Custom Input Logic ──
  document.querySelectorAll('input[name="fileTtl"]').forEach(rb => {
    rb.addEventListener('change', () => {
      const fTtlCustom = document.getElementById('fTtlCustom');
      const fCustomContainer = document.getElementById('fileCustomTtlContainer');
      if (fTtlCustom && fCustomContainer) {
        if (fTtlCustom.checked) fCustomContainer.classList.remove('d-none');
        else fCustomContainer.classList.add('d-none');
      }
    });
  });

  document.querySelectorAll('input[name="textTtl"]').forEach(rb => {
    rb.addEventListener('change', () => {
      const tTtlCustom = document.getElementById('tTtlCustom');
      const tCustomContainer = document.getElementById('textCustomTtlContainer');
      if (tTtlCustom && tCustomContainer) {
        if (tTtlCustom.checked) tCustomContainer.classList.remove('d-none');
        else tCustomContainer.classList.add('d-none');
      }
    });
  });

  // ── File upload ──
  if (fileForm) {
    fileForm.onsubmit = async function (e) {
      e.preventDefault();
      const fileInput = document.getElementById('file');
      if (!fileInput.files.length) {
        alert('Please select at least one file.');
        return;
      }
      const btn = fileForm.querySelector('button[type=submit]');
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…';
      btn.disabled = true;
      try {
        const formData = new FormData();
        [...fileInput.files].forEach(f => formData.append('files', f));
        
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

  // ── Show result panel ──
  function showResult(code) {
    if (result) {
      result.classList.remove('d-none');
      result.style.animation = 'none';
      void result.offsetWidth;
      result.style.animation = '';
    }
    if (codeDisplay) codeDisplay.innerText = `${window.location.origin}/get/${code}`;
    if (qrImage) qrImage.src = `/qr/${code}`;
    const numericDiv = document.getElementById('fourDigitCode');
    if (numericDiv) numericDiv.innerText = code;
    if (result) result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── OTP inputs ──
  codeInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.classList.toggle('filled', input.value.length === 1);
      if (input.value.length === 1 && index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      } else if (index === codeInputs.length - 1 && receiveBtn) {
        receiveBtn.focus();
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

  // ── Mode switching ──
  window.showSend = function () {
    const sendBox    = document.getElementById('sendBox');
    const receiveBox = document.getElementById('receiveBox');
    const btnSend    = document.getElementById('btnSend');
    const btnReceive = document.getElementById('btnReceive');

    if (sendBox)    sendBox.classList.remove('d-none');
    if (receiveBox) receiveBox.classList.add('d-none');
    if (result)     result.classList.add('d-none');
    if (btnSend)    btnSend.classList.add('active');
    if (btnReceive) btnReceive.classList.remove('active');
  };

  window.showReceive = function () {
    const sendBox    = document.getElementById('sendBox');
    const receiveBox = document.getElementById('receiveBox');
    const btnSend    = document.getElementById('btnSend');
    const btnReceive = document.getElementById('btnReceive');

    if (receiveBox) receiveBox.classList.remove('d-none');
    if (sendBox)    sendBox.classList.add('d-none');
    if (result)     result.classList.add('d-none');
    if (btnReceive) btnReceive.classList.add('active');
    if (btnSend)    btnSend.classList.remove('active');
    codeInputs.forEach(inp => { inp.value = ''; inp.classList.remove('filled'); });
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
