import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { ReclamoEstado } from '../reclamos/entities/reclamo.entity';

@Injectable()
export class MailService {
  private resend: Resend;
  private mailFrom: string;
  
  // 🎨 CONFIGURACIÓN DE DISEÑO
  // Recuerda subir tu logo a la carpeta 'public' del front y poner la URL aquí
  private logoUrl = 'https://reclamaya.ar/logo-email.png'; 
  private primaryColor = '#2563eb'; // Azul Royal (Blue-600)
  private webUrl = 'https://reclamaya.ar';

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('RESEND_API_KEY');
    this.mailFrom = this.configService.get('MAIL_FROM') || 'no-reply@reclamaya.ar';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('⚠️ ATENCIÓN: No hay RESEND_API_KEY. Los mails no saldrán.');
    }
  }

  // ==========================================
  // 1. MAILS INICIALES (ALTA DE RECLAMO)
  // ==========================================

  // TEXTO FUENTE PDF: "1) Reclamo Enviado"
  async sendNewReclamoClient(email: string, nombre: string, codigo: string) {
    if (!this.resend) return;

    const content = `
      <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">Hola, ${nombre}</h1>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
        Gracias por confiar en <strong>Reclama Ya!</strong>
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
        Hemos recibido su reclamo y ya fue derivado a nuestro equipo.
      </p>

      <div style="background-color: #f0f9ff; border-left: 4px solid ${this.primaryColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0c4a6e; font-size: 15px;">
          Dentro de las próximas <strong>72 horas hábiles</strong>, un tramitador será asignado para comenzar a trabajar en su caso.
        </p>
      </div>
      
      <p style="color: #4b5563; font-size: 14px;">
        Nuestro compromiso es acompañarlo en cada paso del proceso para que obtenga la mejor y más rápida indemnización.
      </p>

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <p style="text-align: center; font-size: 14px; color: #6b7280; margin-bottom: 8px;">Su Código de Seguimiento:</p>
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: ${this.primaryColor}; background: #eff6ff; padding: 10px 20px; border-radius: 8px; border: 1px dashed ${this.primaryColor};">${codigo}</span>
      </div>

      <div style="text-align: center;">
        <a href="${this.webUrl}/consultar-tramite" style="${this.getButtonStyle()}">Ver Estado del Trámite</a>
      </div>
    `;

    await this.sendMail(email, '✅ Reclamo Enviado Exitosamente', this.getTemplate(content));
  }

  // Notificación Interna (Admin)
  async sendNewReclamoAdmin(data: { nombre: string; dni: string; codigo_seguimiento: string; tipo: string }) {
    if (!this.resend) return;
    const adminEmail = this.configService.get('ADMIN_EMAIL') || 'mfbcaneda@gmail.com'; 
    
    const content = `
      <h2 style="color: #be123c;">🚨 Nuevo Siniestro Ingresado</h2>
      <p>Se requiere asignación de tramitador (Plazo: 72hs hábiles).</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">Cliente:</td><td style="padding: 8px 0; font-weight: bold;">${data.nombre}</td></tr>
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">DNI:</td><td style="padding: 8px 0; font-weight: bold;">${data.dni}</td></tr>
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">Tipo:</td><td style="padding: 8px 0; font-weight: bold;">${data.tipo}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Código:</td><td style="padding: 8px 0; font-weight: bold; color: ${this.primaryColor};">${data.codigo_seguimiento}</td></tr>
      </table>
      <br>
      <div style="text-align: center;">
        <a href="${this.webUrl}/admin" style="${this.getButtonStyle()}">Ir al Panel Admin</a>
      </div>
    `;

    await this.sendMail(adminEmail, `[ADMIN] Nuevo Caso: ${data.tipo}`, this.getTemplate(content));
  }

  // ==========================================
  // 2. ACTUALIZACIÓN DE ESTADO: CLIENTE
  // ==========================================
  async sendClientStatusUpdate(email: string, nombre: string, nuevoEstado: ReclamoEstado, codigo: string) {
    if (!this.resend) return;

    let subject = '';
    let bodyText = '';
    let statusColor = this.primaryColor;

    [cite_start]// LÓGICA BASADA EN PDF "Emails 2.pdf" [cite: 14, 31, 43, 53, 62, 75]
    switch (nuevoEstado) {
      
      // TEXTO PDF: "2) Reclamo Recepcionado"
      case ReclamoEstado.RECEPCIONADO:
        subject = '📁 Reclamo Recepcionado';
        bodyText = `
          <p>Su reclamo ya cuenta con un <strong>tramitador asignado</strong>, quien está revisando la documentación enviada.</p>
          <p>En esta etapa:</p>
          <ul style="padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Si el reclamo <strong>no es viable legalmente</strong>, le informaremos el rechazo por improcedencia legal.</li>
            <li>Si el reclamo <strong>es viable</strong>, en un plazo máximo de <strong>48 horas hábiles</strong> lo iniciaremos ante la aseguradora correspondiente.</li>
          </ul>
          <p>Lo mantendremos informado sobre cada avance.</p>
        `;
        break;

      // TEXTO PDF: "3) Reclamo Iniciado"
      case ReclamoEstado.INICIADO:
        subject = '¡Buenas noticias!'; // Segun PDF: "¡Buenas noticias!"
        statusColor = '#16a34a'; // Verde
        bodyText = `
          <p><strong>Su reclamo fue iniciado correctamente ante la aseguradora.</strong></p>
          <p>A partir de ahora:</p>
          <ul style="padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Iniciamos comunicaciones con el seguro.</li>
            <li>La aseguradora analizará las pruebas y realizará las pericias necesarias antes de hacer una oferta.</li>
          </ul>
          <p>Nos aseguraremos de que cada paso se realice de forma rápida y segura.</p>
        `;
        break;

      // TEXTO PDF: "4) Negociación"
      case ReclamoEstado.NEGOCIACION:
        subject = '🤝 Negociación en curso';
        statusColor = '#ea580c'; // Naranja
        bodyText = `
          <p>Estamos gestionando el <strong>monto indemnizatorio</strong> con la aseguradora.</p>
          <p>En breve le informaremos la cifra propuesta para su conciliación.</p>
          <p><strong>Nuestro objetivo es lograr el mejor acuerdo posible para usted.</strong></p>
        `;
        break;

      // TEXTO PDF: "5) Indemnizando"
      case ReclamoEstado.INDEMNIZANDO:
        subject = '🎉 Acuerdo Cerrado exitosamente';
        statusColor = '#16a34a'; // Verde
        bodyText = `
          <p><strong>El acuerdo ya fue cerrado exitosamente.</strong></p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin: 16px 0;">
            <p style="margin:0; color: #166534;">En un plazo máximo de <strong>30 días hábiles</strong>, el monto acordado se acreditará en su cuenta bancaria.</p>
          </div>
          <p style="font-size: 14px; color: #6b7280;">* Una vez efectuado el pago, se finiquitarán los honorarios profesionales correspondientes al 20%.</p>
          <p>Gracias por su confianza.</p>
        `;
        break;

      // TEXTO PDF: "6) Indemnizado / Reclamo Terminado"
      case ReclamoEstado.INDEMNIZADO:
        subject = '¡Felicitaciones!'; // Segun PDF
        statusColor = '#16a34a'; // Verde
        bodyText = `
          <p><strong>Su reclamo fue acordado y cobrado exitosamente.</strong></p>
          <p>Gracias por confiar en Reclama Ya! para acompañarlo en este proceso.</p>
          <p>Recuerde que estamos a su disposición para cualquier gestión futura.</p>
        `;
        break;

      // TEXTO PDF: "7) Rechazado"
      case ReclamoEstado.RECHAZADO:
        subject = '⚠️ Información sobre su reclamo';
        statusColor = '#dc2626'; // Rojo
        bodyText = `
          <p>Lamentamos informarle que, tras el análisis de nuestro equipo legal, su reclamo fue <strong>rechazado por improcedencia legal</strong>.</p>
          <p>Si desea más información o consultar sobre otros casos, puede contactarnos a través de nuestra plataforma.</p>
        `;
        break;

      default: return;
    }

    const content = `
      <h1 style="color: #111827; font-size: 22px;">Novedades en su caso</h1>
      <p style="color: #6b7280; margin-bottom: 20px;">Hola ${nombre}, hay un cambio de estado en el expediente <strong>#${codigo}</strong>.</p>
      
      <div style="text-align: center; margin: 25px 0;">
         <span style="display: inline-block; padding: 8px 24px; background-color: ${statusColor}; color: white; border-radius: 50px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${nuevoEstado}</span>
      </div>

      <div style="background-color: #ffffff; padding: 10px 0; color: #374151; line-height: 1.6; font-size: 16px;">
        ${bodyText}
      </div>

      <br>
      <div style="text-align: center;">
        <a href="${this.webUrl}/consultar-tramite" style="${this.getButtonStyle()}">Ver Detalle en la Web</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getTemplate(content));
  }

  // ==========================================
  // 3. ACTUALIZACIONES PROFESIONALES (Productor / Broker)
  // ==========================================
  async sendProducerStatusUpdate(email: string, nombreProductor: string, estado: string, codigo: string, nombreCliente: string) {
    if (!this.resend) return;
    const content = `
      <h3>Estimado Colega, ${nombreProductor}</h3>
      <p>Notificamos avance en siniestro de su cartera.</p>
      <div style="background: #fff7ed; padding: 15px; border-left: 4px solid #f97316; margin: 20px 0;">
         <p style="margin:5px 0"><strong>Caso:</strong> #${codigo}</p>
         <p style="margin:5px 0"><strong>Asegurado:</strong> ${nombreCliente}</p>
         <p style="margin:5px 0"><strong>Nuevo Estado:</strong> <span style="color:#f97316; font-weight:bold;">${estado}</span></p>
      </div>
    `;
    await this.sendMail(email, `Actualización Caso #${codigo}`, this.getTemplate(content));
  }

  async sendBrokerStatusUpdate(email: string, nombreBroker: string, estado: string, codigo: string, nombreProductor: string, nombreCliente: string) {
    if (!this.resend) return;
    const content = `
      <h3>Reporte de Red: ${nombreBroker}</h3>
      <p>Movimiento registrado en su organización.</p>
       <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;">Productor</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${nombreProductor}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e2e8f0;">Cliente</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${nombreCliente}</td></tr>
          <tr style="background: #f0fdf4;"><td style="padding: 10px; border: 1px solid #e2e8f0;">Estado</td><td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${estado}</td></tr>
        </table>
    `;
    await this.sendMail(email, `Novedad Red - Caso #${codigo}`, this.getTemplate(content));
  }

  async sendAccountApproved(email: string, nombre: string) {
    if (!this.resend) return;
    const content = `
      <h1>¡Cuenta Aprobada! 🎉</h1>
      <p>Hola ${nombre}, tu cuenta ha sido verificada correctamente.</p>
      <p>Ya tienes acceso total a la plataforma para cargar siniestros y gestionar tu cartera.</p>
      <br>
      <div style="text-align: center;">
        <a href="${this.webUrl}/login" style="${this.getButtonStyle()}">Ingresar a mi Cuenta</a>
      </div>
    `;
    await this.sendMail(email, 'Bienvenido a Reclama Ya', this.getTemplate(content));
  }

  // ==========================================
  // 🛠️ MÉTODOS PRIVADOS (CORE Y DISEÑO)
  // ==========================================

  private async sendMail(to: string, subject: string, html: string) {
    if (!this.resend) return;
    try {
      await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject,
        html,
      });
      console.log(`📧 Mail enviado a ${to} desde ${this.mailFrom} | Asunto: ${subject}`);
    } catch (error) {
      console.error(`❌ Error enviando mail a ${to}:`, error);
    }
  }

  // 👇 TEMPLATE MAESTRO "ENTERPRISE"
  private getTemplate(bodyContent: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 0;">
          <tr>
            <td align="center">
              
              <div style="margin-bottom: 24px;">
                 <h2 style="color: ${this.primaryColor}; margin: 0; font-weight: 800; letter-spacing: -1px; font-size: 28px;">Reclama<span style="color: #111827;">Ya!</span></h2>
                 </div>

              <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <tr>
                  <td height="6" style="background-color: ${this.primaryColor};"></td>
                </tr>

                <tr>
                  <td style="padding: 40px 40px;">
                    ${bodyContent}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 40px 40px 40px; color: #6b7280; font-size: 14px;">
                    <p style="margin: 0;">Atentamente,</p>
                    <p style="margin: 5px 0; font-weight: bold; color: #374151;">Equipo ReclamaYa!</p>
                  </td>
                </tr>

              </table>

              <div style="margin-top: 24px; text-align: center; color: #9ca3af; font-size: 12px;">
                <p style="margin: 4px 0;">San Martin 930, 5° Piso - San Miguel de Tucumán - Tucumán - Argentina</p>
                <p style="margin: 4px 0;">© ${new Date().getFullYear()} Reclama Ya. Todos los derechos reservados.</p>
                <p style="margin: 12px 0;">
                  <a href="${this.webUrl}" style="color: #9ca3af; text-decoration: underline;">Web</a> | 
                  <a href="mailto:contacto@reclamaya.ar" style="color: #9ca3af; text-decoration: underline;">Contacto</a>
                </p>
              </div>

            </td>
          </tr>
        </table>

      </body>
      </html>
    `;
  }

  // Helper para botones
  private getButtonStyle(): string {
    return `
      display: inline-block;
      background-color: ${this.primaryColor};
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
  }
}