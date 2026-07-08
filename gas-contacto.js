/**
 * Velkin Data Studios — Google Apps Script
 * Recibe el formulario de contacto, guarda en Sheets, te notifica a ti
 * y manda confirmación automática al lead desde contacto@velkindatastudios.com.
 *
 * SETUP (una sola vez):
 *  1. Antes de nada: en Gmail (la cuenta que va a correr el script) →
 *     Configuración → Cuentas e importación → "Enviar correo como" →
 *     agrega contacto@velkindatastudios.com y verifica el código que
 *     llega a ese buzón (vía webmail de Hostinger). Esto solo afecta el
 *     correo de confirmación AL CLIENTE — el aviso interno hacia ti no
 *     lo necesita, siempre sale desde tu Gmail real.
 *  2. Crea un Google Sheet nuevo (sheets.new) — este script NO se crea
 *     desde dentro del Sheet, así que necesita el ID a mano. Copia el ID
 *     de la URL (entre /d/ y /edit) y pégalo en SPREADSHEET_ID abajo.
 *  3. Abre script.google.com → Nuevo proyecto
 *  4. Pega este código (ya con tu SPREADSHEET_ID puesto)
 *  5. Cambia SHEET_NAME si quieres otro nombre de hoja
 *  6. Guarda (Ctrl+S) → Implementar → Nueva implementación
 *     - Tipo: Aplicación web
 *     - Ejecutar como: Yo (tu cuenta)
 *     - Quién tiene acceso: Cualquier persona
 *  7. Copia la URL que te da → pégala en contacto.html donde dice GAS_URL
 *  8. Listo. Cada envío llega a Sheets, te notifica y confirma al lead.
 *
 *  Si ya tenías el proyecto desplegado y solo cambiaste código: en
 *  Implementar → Administrar implementaciones → lápiz de editar →
 *  Versión: "Nueva versión" → Implementar. Así la misma URL /exec
 *  usa el código actualizado sin que tengas que cambiar nada en el sitio.
 */

const NOTIFICATION_EMAIL = 'contacto@velkindatastudios.com'; // buzón interno donde TÚ recibes el aviso
const SENDER_ALIAS        = 'contacto@velkindatastudios.com'; // remitente del correo al CLIENTE (requiere alias verificado)
const SENDER_NAME         = 'Velkin Data Studios';
const SPREADSHEET_ID      = '1kudziWWJ-9yoHUqao5YLsdZls0gpPGQmer4vhnhaKRk';
const SHEET_NAME          = 'Leads Velkin';

/* ─── HEADERS de hoja ──────────────────────────────── */
// Si el Sheet ya existía antes de agregar el widget de WhatsApp, agrega
// "Canal" manualmente en la celda I1 — este array solo escribe headers
// nuevos cuando el Sheet no existe todavía.
const COLUMNS = [
  'Fecha',
  'Nombre',
  'Empresa',
  'Email',
  'Teléfono',
  'Sitio web',
  'Necesidad',
  'Mensaje',
  'Canal',
];

/* ─── doPost ───────────────────────────────────────── */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    appendToSheet(data);

    if (data.canal === 'whatsapp_widget') {
      sendWhatsAppLeadNotification(data);
    } else {
      sendNotificationEmail(data);
      sendConfirmationEmail(data);
    }
  } catch (err) {
    Logger.log('Error: ' + err.message);
  }

  try {
    sendMetaConversionEvent(JSON.parse(e.postData.contents));
  } catch (err) {
    console.error('Meta CAPI error: ' + err.message);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─── Meta Conversions API ─────────────────────────────
 * Envía server-side el mismo evento "Lead" que ya dispara el Pixel en
 * el navegador, usando el mismo event_id para que Meta deduplique (no
 * cuenta doble). Recupera conversiones que el Pixel de navegador pierde
 * por bloqueadores de anuncios o restricciones de iOS/Safari.
 *
 * SETUP (una sola vez, en este proyecto de Apps Script):
 *  1. Configuración del proyecto (ícono de engranaje) → Propiedades
 *     del script → Añadir propiedad del script:
 *       - META_PIXEL_ID     = 1535038168109647
 *       - META_CAPI_TOKEN   = (el token de Conversions API de Events
 *         Manager → tu Pixel → Configuración → Conversions API)
 *  El token NUNCA va escrito en este código — solo vive en Script
 *  Properties, que no se exporta ni se ve en el repo de GitHub.
 */
function sendMetaConversionEvent(data) {
  const props = PropertiesService.getScriptProperties();
  const pixelId = props.getProperty('META_PIXEL_ID');
  const token = props.getProperty('META_CAPI_TOKEN');
  if (!pixelId || !token) {
    console.error('Meta CAPI: faltan META_PIXEL_ID / META_CAPI_TOKEN en Script Properties, se omite.');
    return;
  }

  const userData = {};
  if (data.email) userData.em = [sha256Hex(normalizeEmail(data.email))];
  if (data.telefono) userData.ph = [sha256Hex(normalizePhone(data.telefono))];
  if (data.fbp) userData.fbp = data.fbp;
  if (data.fbc) userData.fbc = data.fbc;
  if (data.user_agent) userData.client_user_agent = data.user_agent;

  const eventPayload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: data.event_id || undefined,
      action_source: 'website',
      event_source_url: data.pagina || 'https://velkindatastudios.com/contacto.html',
      user_data: userData,
      custom_data: {
        content_name: data.canal === 'whatsapp_widget' ? 'whatsapp_widget' : 'contact_form',
      },
    }],
  };

  const response = UrlFetchApp.fetch(
    `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(eventPayload),
      muteHttpExceptions: true,
    }
  );

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status >= 200 && status < 300) {
    console.log('Meta CAPI OK (' + status + '): ' + body);
  } else {
    console.error('Meta CAPI FAILED (' + status + '): ' + body);
  }
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizePhone(phone) {
  // Meta espera dígitos con código de país, sin '+', sin espacios/guiones.
  let digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 10) digits = '52' + digits; // asume MX si viene sin lada país
  return digits;
}

function sha256Hex(input) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/* ─── Guardar en Sheets ────────────────────────────── */
function appendToSheet(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, COLUMNS.length)
         .setValues([COLUMNS])
         .setFontWeight('bold')
         .setBackground('#3E9B82')
         .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    data.fecha     || new Date().toLocaleString('es-MX'),
    data.nombre    || '',
    data.empresa   || '',
    data.email     || '',
    data.telefono  || '',
    data.sitio     || '—',
    data.necesidad || '',
    data.mensaje   || '',
    data.canal === 'whatsapp_widget' ? 'WhatsApp' : 'Formulario web',
  ]);
}

/* ─── Email de notificación ────────────────────────── */
function sendNotificationEmail(data) {
  const subject = `[Velkin Data Studios] Nuevo lead — ${data.nombre} · ${data.empresa}`;

  const html = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#10151C;color:#E7E6DD;border-radius:12px;overflow:hidden;border:1px solid #232B34;">

  <!-- Header -->
  <div style="background:#3E9B82;padding:28px 32px;">
    <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;font-family:monospace;">Velkin Data Studios</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Nuevo diagnóstico recibido</h1>
  </div>

  <!-- Body -->
  <div style="padding:32px;">

    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;width:36%;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Nombre</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <strong style="font-size:15px;">${escapeHtml(data.nombre)}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Empresa</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:14px;">${escapeHtml(data.empresa)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Email</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <a href="mailto:${escapeHtml(data.email)}" style="color:#7FD1B8;font-size:14px;">${escapeHtml(data.email)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">WhatsApp</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <a href="https://wa.me/${sanitizePhone(data.telefono)}" style="color:#D2532F;font-size:14px;">${escapeHtml(data.telefono)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Sitio web</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:14px;">${data.sitio && data.sitio !== '—' ? `<a href="${escapeHtml(data.sitio)}" style="color:#7FD1B8;">${escapeHtml(data.sitio)}</a>` : '<span style="color:#5C5B50;">—</span>'}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Necesita</span>
        </td>
        <td style="padding:10px 0;">
          <span style="background:#303B47;border-radius:6px;padding:4px 10px;font-size:13px;">${escapeHtml(data.necesidad)}</span>
        </td>
      </tr>
    </table>

    <!-- Mensaje -->
    <div style="margin-top:24px;background:#161C24;border:1px solid #232B34;border-radius:10px;padding:20px;">
      <p style="margin:0 0 8px;font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Mensaje</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#E7E6DD;">${escapeHtml(data.mensaje).replace(/\n/g, '<br>')}</p>
    </div>

    <!-- Actions -->
    <div style="margin-top:24px;display:flex;gap:12px;">
      <a href="mailto:${escapeHtml(data.email)}?subject=Re: Diagnóstico Velkin Data Studios"
         style="display:inline-block;background:#3E9B82;color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Responder por email
      </a>
      <a href="https://wa.me/${sanitizePhone(data.telefono)}"
         style="display:inline-block;background:#232B34;color:#E7E6DD;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid #303B47;">
        Abrir WhatsApp
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:20px 32px;border-top:1px solid #232B34;">
    <p style="margin:0;font-size:12px;color:#5C5B50;">
      Enviado desde el formulario de diagnóstico de velkindatastudios.com · ${data.fecha || ''}
    </p>
  </div>

</div>`;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, '', { htmlBody: html });
}

/* ─── Email de notificación — widget de WhatsApp ─────*/
function sendWhatsAppLeadNotification(data) {
  const subject = `[Velkin Data Studios] Nuevo lead por WhatsApp — ${data.nombre}`;

  const html = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#10151C;color:#E7E6DD;border-radius:12px;overflow:hidden;border:1px solid #232B34;">

  <div style="background:#3E9B82;padding:28px 32px;">
    <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;font-family:monospace;">Velkin Data Studios</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Lead quiere hablar por WhatsApp</h1>
  </div>

  <div style="padding:32px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;width:36%;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Nombre</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <strong style="font-size:15px;">${escapeHtml(data.nombre)}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">WhatsApp</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #232B34;">
          <a href="https://wa.me/${sanitizePhone(data.telefono)}" style="color:#7FD1B8;font-size:14px;">${escapeHtml(data.telefono)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;">
          <span style="font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Página</span>
        </td>
        <td style="padding:10px 0;">
          <span style="font-size:14px;">${escapeHtml(data.sitio) || '—'}</span>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;background:#161C24;border:1px solid #232B34;border-radius:10px;padding:20px;">
      <p style="margin:0 0 8px;font-size:11px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;color:#9A9A8E;">Mensaje</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#E7E6DD;">${escapeHtml(data.mensaje).replace(/\n/g, '<br>')}</p>
    </div>

    <div style="margin-top:24px;">
      <a href="https://wa.me/${sanitizePhone(data.telefono)}"
         style="display:inline-block;background:#3E9B82;color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Abrir WhatsApp
      </a>
    </div>
  </div>

  <div style="padding:20px 32px;border-top:1px solid #232B34;">
    <p style="margin:0;font-size:12px;color:#5C5B50;">
      Enviado desde el widget de WhatsApp de velkindatastudios.com · ${data.fecha || ''}
    </p>
  </div>

</div>`;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, '', { htmlBody: html });
}

/* ─── Email de confirmación al lead ───────────────────*/
function sendConfirmationEmail(data) {
  if (!data.email) return;

  const subject = 'Recibimos tu diagnóstico — Velkin Data Studios';

  const html = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#10151C;color:#E7E6DD;border-radius:12px;overflow:hidden;border:1px solid #232B34;">

  <div style="background:#3E9B82;padding:28px 32px;">
    <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;font-family:monospace;">Velkin Data Studios</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Recibimos tu formulario</h1>
  </div>

  <div style="padding:32px;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hola ${escapeHtml(data.nombre)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Ya tenemos tu información. Revisamos lo que nos compartiste sobre ${escapeHtml(data.empresa)} y te respondemos en menos de 24 horas hábiles con algo concreto — no una propuesta genérica.</p>
    <p style="margin:0;font-size:15px;line-height:1.7;">Si tienes prisa o quieres agregar contexto, responde este correo directamente.</p>
  </div>

  <div style="padding:20px 32px;border-top:1px solid #232B34;">
    <p style="margin:0;font-size:12px;color:#5C5B50;">Velkin Data Studios · velkindatastudios.com</p>
  </div>

</div>`;

  GmailApp.sendEmail(data.email, subject, '', {
    htmlBody: html,
    from: SENDER_ALIAS,
    name: SENDER_NAME,
    replyTo: SENDER_ALIAS,
  });
}

/* ─── Helpers ──────────────────────────────────────── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^0-9+]/g, '');
}
