import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { ReclamoEstado } from '../reclamos/entities/reclamo.entity';

@Injectable()
export class MailService {
  private resend: Resend;
  private mailFrom: string;
  
  // 🎨 COLORES DE MARCA
  private primaryColor = '#2563eb'; // Blue-600
  private darkColor = '#111827';    // Gris oscuro
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
  // 1. MAILS INICIALES
  // ==========================================
  async sendNewReclamoClient(email: string, nombre: string, codigo: string) {
    if (!this.resend) return;

    const content = `
      <h1 style="color: ${this.darkColor}; font-size: 24px; margin-bottom: 16px;">Hola, ${nombre}</h1>
      <p style="color: #4b5563; font-size: 16px; line-height: 24px;">Gracias por confiar en <strong>Reclama Ya!</strong></p>
      <p style="color: #4b5563; font-size: 16px; line-height: 24px;">Hemos recibido su reclamo y ya fue derivado a nuestro equipo.</p>

      <div style="background-color: #f0f9ff; border-left: 4px solid ${this.primaryColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0c4a6e; font-size: 15px;">
          Dentro de las próximas <strong>72 horas hábiles</strong>, un tramitador será asignado para comenzar a trabajar en su caso.
        </p>
      </div>
      
      <p style="color: #4b5563; font-size: 14px;">Nuestro compromiso es acompañarlo en cada paso para obtener la mejor indemnización.</p>

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

  // 🔔 NUEVO: AVISO AL ADMIN DE NUEVO USUARIO
  async sendNewUserAdmin(data: { nombre: string; email: string; dni: string; rol: string }) {
    if (!this.resend) return;
    const adminEmail = this.configService.get('ADMIN_EMAIL') || 'mfbcaneda@gmail.com';

    const content = `
      <h2 style="color: ${this.primaryColor};">👤 Nuevo Usuario Registrado</h2>
      <p style="font-size: 16px;">Un nuevo usuario se ha registrado en la plataforma y se encuentra en estado <strong>PENDIENTE</strong>.</p>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">Nombre:</td><td style="padding: 8px 0; font-weight: bold;">${data.nombre}</td></tr>
          <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">Email:</td><td style="padding: 8px 0; font-weight: bold;">${data.email}</td></tr>
          <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">DNI:</td><td style="padding: 8px 0; font-weight: bold;">${data.dni}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Rol Solicitado:</td><td style="padding: 8px 0; font-weight: bold; color: ${this.primaryColor};">${data.rol}</td></tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${this.webUrl}/admin/usuarios" style="${this.getButtonStyle()}">Revisar y Aprobar</a>
      </div>
    `;

    await this.sendMail(adminEmail, '🔔 Nuevo Usuario Pendiente de Aprobación', this.getTemplate(content));
  }

  // Notificación Interna (Admin) - Nuevo Reclamo
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

    switch (nuevoEstado) {
      case ReclamoEstado.RECEPCIONADO:
        subject = '📁 Reclamo Recepcionado';
        bodyText = `
          <p>Su reclamo ya cuenta con un <strong>tramitador asignado</strong>, quien está revisando la documentación.</p>
          <ul style="padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Si el reclamo <strong>no es viable legalmente</strong>, le informaremos el rechazo.</li>
            <li>Si <strong>es viable</strong>, en máx 48hs hábiles lo iniciaremos ante la aseguradora.</li>
          </ul>
        `;
        break;
      case ReclamoEstado.INICIADO:
        subject = '¡Buenas noticias!';
        statusColor = '#16a34a'; // Verde
        bodyText = `
          <p><strong>Su reclamo fue iniciado correctamente ante la aseguradora.</strong></p>
          <ul style="padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Iniciamos comunicaciones con el seguro.</li>
            <li>La aseguradora analizará las pruebas y realizará pericias antes de ofertar.</li>
          </ul>
        `;
        break;
      case ReclamoEstado.NEGOCIACION:
        subject = '🤝 Negociación en curso';
        statusColor = '#ea580c'; // Naranja
        bodyText = `
          <p>Estamos gestionando el <strong>monto indemnizatorio</strong> con la aseguradora.</p>
          <p>En breve le informaremos la cifra propuesta.</p>
          <p><strong>Nuestro objetivo es lograr el mejor acuerdo posible para usted.</strong></p>
        `;
        break;
      case ReclamoEstado.INDEMNIZANDO:
        subject = '🎉 Acuerdo Cerrado exitosamente';
        statusColor = '#16a34a';
        bodyText = `
          <p><strong>El acuerdo ya fue cerrado exitosamente.</strong></p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin: 16px 0;">
            <p style="margin:0; color: #166534;">En un plazo máximo de <strong>30 días hábiles</strong>, el monto se acreditará en su cuenta.</p>
          </div>
          <p style="font-size: 14px; color: #6b7280;">* Una vez efectuado el pago, se finiquitarán los honorarios profesionales (20%).</p>
        `;
        break;
      case ReclamoEstado.INDEMNIZADO:
        subject = '¡Felicitaciones!';
        statusColor = '#16a34a';
        bodyText = `
          <p><strong>Su reclamo fue acordado y cobrado exitosamente.</strong></p>
          <p>Gracias por confiar en Reclama Ya! Recuerde que estamos a su disposición.</p>
        `;
        break;
      case ReclamoEstado.RECHAZADO:
        subject = '⚠️ Información sobre su reclamo';
        statusColor = '#dc2626';
        bodyText = `
          <p>Lamentamos informarle que, tras el análisis legal, su reclamo fue <strong>rechazado por improcedencia</strong>.</p>
          <p>Para más información, contáctenos a través de la plataforma.</p>
        `;
        break;
      default: return;
    }

    const content = `
      <h1 style="color: ${this.darkColor}; font-size: 22px;">Novedades en su caso</h1>
      <p style="color: #6b7280; margin-bottom: 20px;">Hola ${nombre}, hay un cambio de estado en el expediente <strong>#${codigo}</strong>.</p>
      
      <div style="text-align: center; margin: 25px 0;">
         <span style="display: inline-block; padding: 8px 24px; background-color: ${statusColor}; color: white; border-radius: 50px; font-weight: bold; font-size: 14px; text-transform: uppercase;">${nuevoEstado}</span>
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
  // 3. ACTUALIZACIÓN DE ESTADO: ADMIN
  // ==========================================
  async sendAdminStatusUpdate(nombreCliente: string, nuevoEstado: string, codigo: string) {
    if (!this.resend) return;
    const adminEmail = this.configService.get('ADMIN_EMAIL') || 'mfbcaneda@gmail.com'; 

    const content = `
      <h3 style="color: ${this.darkColor};">ℹ️ Actualización de Caso</h3>
      <p>Se ha registrado un cambio de estado en el sistema.</p>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
         <p style="margin:5px 0"><strong>Caso:</strong> #${codigo}</p>
         <p style="margin:5px 0"><strong>Cliente:</strong> ${nombreCliente}</p>
         <p style="margin:5px 0"><strong>Nuevo Estado:</strong> <span style="color:${this.primaryColor}; font-weight:bold;">${nuevoEstado}</span></p>
      </div>

      <div style="text-align: center;">
        <a href="${this.webUrl}/admin" style="${this.getButtonStyle()}">Ir al Panel Admin</a>
      </div>
    `;

    await this.sendMail(adminEmail, `[ADMIN] Estado Actualizado #${codigo}`, this.getTemplate(content));
  }

  // ==========================================
  // 4. ACTUALIZACIONES PROFESIONALES (Productor / Broker)
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

  // ==========================================
  // 5. APROBACIÓN DE CUENTA (LEGALTECH)
  // ==========================================
  async sendAccountApproved(email: string, nombre: string) {
    if (!this.resend) return;
    
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${this.darkColor}; font-size: 24px; margin-bottom: 10px;">Bienvenido a nuestro sistema LegalTech</h1>
        
        <p style="color: ${this.primaryColor}; font-weight: bold; font-size: 15px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
          Trazabilidad • Transparencia • Innovación
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 8px; font-style: italic;">
          "Transferencia de administración de gestión en tus siniestros"
        </p>
      </div>

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">

      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Hola <strong>${nombre}</strong>,<br><br>
        Tu cuenta ha sido verificada correctamente. Ya tenés acceso total a la plataforma para comenzar a cargar y gestionar reclamos.
      </p>

      <br>
      <div style="text-align: center;">
        <a href="${this.webUrl}/login" style="${this.getButtonStyle()}">Ingresar a mi Cuenta</a>
      </div>
    `;

    await this.sendMail(email, '🎉 Cuenta Aprobada - Bienvenido a Reclama Ya', this.getTemplate(content));
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

  // 👇 TEMPLATE MAESTRO: LOGO DE TEXTO CSS
  private getTemplate(bodyContent: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,900;1,900&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Montserrat', Verdana, sans-serif;">
        
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 0;">
          <tr>
            <td align="center">
              
              <div style="margin-bottom: 24px;">
                 <a href="${this.webUrl}" style="text-decoration: none; display: inline-block;">
                    <span style="font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 700; color: ${this.darkColor}; letter-spacing: -1px;">Reclama</span>
                    <span style="font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 900; font-style: italic; color: ${this.primaryColor}; margin-left: 1px;">Ya</span>
                    <span style="font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 700; color: ${this.primaryColor};">.</span>
                 </a>
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
                <p style="margin: 4px 0;">© ${new Date().getFullYear()} Reclama Ya.</p>
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

  // Helper botones
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