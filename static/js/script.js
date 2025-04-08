document.addEventListener('DOMContentLoaded', () => {
  const fileForm = document.getElementById('fileForm');
  const textForm = document.getElementById('textForm');
  const result = document.getElementById('result');
  const codeDisplay = document.getElementById('codeDisplay');
  const qrImage = document.getElementById('qrImage');
  const toggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const logo = document.getElementById('clipshare-logo');
  const copyBtn = document.getElementById('copyBtn');
  const copyMsg = document.getElementById('copyMsg');
  const receiveBtn = document.querySelector('#receiveBox button');

  
  fileForm.onsubmit = async function (e) {
    e.preventDefault();
    const formData = new FormData(fileForm);
    const res = await fetch('/upload_file', { method: 'POST', body: formData });
    const data = await res.json();
    showResult(data.code);
  };

  textForm.onsubmit = async function (e) {
    e.preventDefault();
    const text = document.getElementById('text').value;
    const res = await fetch('/upload_text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURIComponent(text)}`
    });
    const data = await res.json();
    showResult(data.code);
  };

  function showResult(code) {
    result.classList.remove('d-none');
    codeDisplay.innerText = `${window.location.origin}/get/${code}`;
    qrImage.src = `/qr/${code}`;

    const numericDiv = document.getElementById('fourDigitCode');
    if (numericDiv) numericDiv.innerText = code;
  }


  const codeInputs = document.querySelectorAll('.code-input');

  codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = input.value;
      if (value.length === 1) {
        if (index < codeInputs.length - 1) {
          codeInputs[index + 1].focus();
        } else {
          receiveBtn.focus(); // ✅ move focus to Receive button
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && input.value === '' && index > 0) {
        codeInputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      const paste = e.clipboardData.getData('text').slice(0, 4);
      e.preventDefault();
      for (let i = 0; i < paste.length && i < codeInputs.length; i++) {
        codeInputs[i].value = paste[i];
      }
      if (paste.length === 4) {
        receiveBtn.focus(); // ✅ focus button after paste
      } else {
        codeInputs[Math.min(paste.length, codeInputs.length - 1)].focus();
      }
    });
  });

  window.receiveSplitCode = function () {
    const code = [...codeInputs].map(input => input.value.trim()).join('');
    if (code.length === 4) 
      {
      codeInputs.forEach(input => input.value = '');
      window.location.href = `/get/${code}`;
    } else {
      document.getElementById('receiveError').classList.remove('d-none');
    }
  };


  window.showSend = function () {
    document.getElementById('sendBox').classList.remove('d-none');
    document.getElementById('receiveBox').classList.add('d-none');
    result.classList.add('d-none');
    document.getElementById('sendBox').scrollIntoView({ behavior: 'smooth' });
  };

  window.showReceive = function () {
    document.getElementById('receiveBox').classList.remove('d-none');
    document.getElementById('sendBox').classList.add('d-none');
    result.classList.add('d-none');
    document.getElementById('receiveBox').scrollIntoView({ behavior: 'smooth' });
  };

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const link = codeDisplay.innerText;
      navigator.clipboard.writeText(link).then(() => {
        copyMsg.classList.remove('d-none');
        setTimeout(() => {
          copyMsg.classList.add('d-none');
        }, 2000);
      });
    });
  }

  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    logo.src = isDark ? '/static/images/logow.png' : '/static/images/logob.png';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  window.onload = () => {
    const theme = localStorage.getItem('theme');
    const isDark = theme === 'dark';
    if (isDark) {
      document.body.classList.add('dark-mode');
      themeIcon.className = 'fas fa-sun';
      logo.src = '/static/images/logow.png';
    } else {
      themeIcon.className = 'fas fa-moon';
      logo.src = '/static/images/logob.png';
    }
  };


  window.receiveContent = function () {
    const code = document.getElementById('receiveCode')?.value.trim();
    if (code) {
      window.location.href = `/get/${code}`;
    }
  };
});
