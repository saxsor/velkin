/**
 * Velkin Data Studios — Widget flotante de WhatsApp
 * Se inyecta a sí mismo (markup + estilos) en cualquier página que
 * incluya este script. Captura nombre + WhatsApp (+ mensaje opcional),
 * abre el chat con el mensaje precargado y, en paralelo, notifica el
 * lead al mismo Google Apps Script que usa el formulario de contacto
 * (así llega el aviso aunque la persona no confirme el envío en WhatsApp).
 */
(function () {
  const WHATSAPP_NUMBER = '525566782995';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbz1OYpmsbuaFNitztFbN0J4kXDU42TDEKnESeKqwt4YZCTvGn8Q5kxsAnHETYsxhyJ0/exec';

  const css = `
#vk-wa-fab{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:10000;font-family:"Archivo","Helvetica Neue",Arial,sans-serif;}
#vk-wa-btn{width:56px;height:56px;border-radius:50%;background:#10151C;border:1px solid #232B34;color:#7FD1B8;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:border-color .2s ease,transform .2s ease;}
#vk-wa-btn:hover{border-color:rgba(127,209,184,.45);transform:translateY(-2px);}
#vk-wa-btn:active{transform:translateY(0);}
#vk-wa-panel{position:absolute;right:0;bottom:72px;width:308px;max-width:calc(100vw - 40px);background:#10151C;border:1px solid #232B34;border-radius:16px;box-shadow:0 20px 48px rgba(0,0,0,.45);overflow:hidden;}
#vk-wa-panel[hidden]{display:none;}
.vk-wa-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #232B34;}
.vk-wa-head span{font-size:14px;font-weight:600;color:#E7E6DD;}
#vk-wa-close{background:none;border:none;color:#9A9A8E;font-size:18px;line-height:1;cursor:pointer;padding:2px;}
#vk-wa-close:hover{color:#E7E6DD;}
.vk-wa-body{padding:18px;}
.vk-wa-sub{margin:0 0 14px;font-size:12.5px;line-height:1.6;color:#9A9A8E;}
.vk-wa-body label{display:block;font-size:12px;color:#9A9A8E;margin-bottom:12px;}
.vk-wa-opt{color:#5C5B50;font-weight:400;}
.vk-wa-body input,.vk-wa-body textarea{width:100%;margin-top:6px;background:#0A0E13;border:1px solid #232B34;border-radius:8px;padding:10px 12px;font-size:14px;color:#E7E6DD;font-family:inherit;resize:vertical;}
.vk-wa-body input:focus,.vk-wa-body textarea:focus{outline:none;border-color:rgba(127,209,184,.45);}
.vk-wa-err{display:block;font-size:12px;color:#D2532F;margin:-4px 0 12px;}
.vk-wa-err[hidden]{display:none;}
#vk-wa-submit{width:100%;background:#3E9B82;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .2s ease,opacity .2s ease;}
#vk-wa-submit:hover{background:#369078;}
#vk-wa-submit:disabled{opacity:.65;cursor:not-allowed;}
.vk-wa-success{padding:20px 18px;}
.vk-wa-success[hidden]{display:none;}
.vk-wa-success p{margin:0;font-size:13.5px;line-height:1.6;color:#E7E6DD;}
.vk-wa-success strong{color:#7FD1B8;}
@media (max-width:480px){#vk-wa-panel{width:calc(100vw - 40px);}}
`;

  const html = `
<button id="vk-wa-btn" type="button" aria-label="Abrir chat de WhatsApp" aria-expanded="false">
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.7.44 3.36 1.28 4.82L2.05 22l5.4-1.42a9.87 9.87 0 0 0 4.59 1.17h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.07c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.02.29-3.4-.71-2.87-1.2-4.72-4.13-4.86-4.32-.14-.19-1.16-1.55-1.16-2.96 0-1.4.74-2.09 1-2.38.26-.28.57-.35.76-.35h.55c.18 0 .41-.03.63.49.24.57.8 1.97.87 2.11.07.15.11.31.02.5-.09.19-.13.31-.27.47-.13.16-.28.36-.4.48-.13.13-.27.28-.11.55.15.28.68 1.14 1.47 1.85 1.01.92 1.87 1.2 2.14 1.34.28.14.44.12.6-.07.16-.19.68-.8.87-1.07.18-.28.36-.23.6-.14.24.09 1.55.75 1.82.89.27.14.44.2.51.32.07.12.07.68-.17 1.36z"/></svg>
</button>
<div id="vk-wa-panel" hidden>
  <div class="vk-wa-head">
    <span>Hablemos por WhatsApp</span>
    <button id="vk-wa-close" type="button" aria-label="Cerrar">&times;</button>
  </div>
  <div class="vk-wa-body" id="vk-wa-form-wrap">
    <p class="vk-wa-sub">Déjanos tu nombre y tu WhatsApp. Te abrimos el chat con tu mensaje listo — solo lo confirmas.</p>
    <label>Nombre
      <input id="vk-wa-nombre" type="text" placeholder="Tu nombre" autocomplete="name">
    </label>
    <label>WhatsApp
      <input id="vk-wa-tel" type="tel" placeholder="55 1234 5678" autocomplete="tel">
    </label>
    <label>Mensaje <span class="vk-wa-opt">(opcional)</span>
      <textarea id="vk-wa-msg" rows="3" placeholder="¿En qué podemos ayudarte?"></textarea>
    </label>
    <span class="vk-wa-err" id="vk-wa-err" hidden>Escribe tu nombre y un WhatsApp válido para continuar.</span>
    <button id="vk-wa-submit" type="button">Continuar a WhatsApp &rarr;</button>
  </div>
  <div class="vk-wa-success" id="vk-wa-success" hidden>
    <p><strong>¡Listo!</strong> Abrimos WhatsApp con tu mensaje. Solo confírmalo ahí para enviarlo.</p>
  </div>
</div>`;

  function init() {
    const styleTag = document.createElement('style');
    styleTag.textContent = css;
    document.head.appendChild(styleTag);

    const fab = document.createElement('div');
    fab.id = 'vk-wa-fab';
    fab.innerHTML = html;
    document.body.appendChild(fab);

    const btn = fab.querySelector('#vk-wa-btn');
    const panel = fab.querySelector('#vk-wa-panel');
    const closeBtn = fab.querySelector('#vk-wa-close');
    const formWrap = fab.querySelector('#vk-wa-form-wrap');
    const success = fab.querySelector('#vk-wa-success');
    const nombreEl = fab.querySelector('#vk-wa-nombre');
    const telEl = fab.querySelector('#vk-wa-tel');
    const msgEl = fab.querySelector('#vk-wa-msg');
    const errEl = fab.querySelector('#vk-wa-err');
    const submitBtn = fab.querySelector('#vk-wa-submit');

    function openPanel() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      nombreEl.focus();
    }
    function closePanel() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
    closeBtn.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) closePanel();
    });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !fab.contains(e.target)) closePanel();
    });

    submitBtn.addEventListener('click', () => {
      const nombre = nombreEl.value.trim();
      const tel = telEl.value.trim();
      const mensaje = msgEl.value.trim();
      const telDigits = tel.replace(/[^0-9]/g, '');

      if (!nombre || telDigits.length < 10) {
        errEl.hidden = false;
        return;
      }
      errEl.hidden = true;

      const texto = `Hola, soy ${nombre}. ${mensaje || 'Quiero platicar sobre un proyecto con Velkin Data Studios.'}`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');

      if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'whatsapp_widget' });
      if (typeof gtag === 'function') gtag('event', 'generate_lead', { lead_source: 'whatsapp_widget' });

      fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal: 'whatsapp_widget',
          nombre,
          telefono: tel,
          mensaje: mensaje || '(sin mensaje adicional)',
          sitio: location.pathname,
          fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        }),
      }).catch(() => {});

      formWrap.hidden = true;
      success.hidden = false;
      setTimeout(() => {
        closePanel();
        formWrap.hidden = false;
        success.hidden = true;
        nombreEl.value = '';
        telEl.value = '';
        msgEl.value = '';
      }, 3000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
