import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { ReclamoEstado } from '../reclamos/entities/reclamo.entity';

@Injectable()
export class MailService {
  private resend: Resend;
  private mailFrom: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('RESEND_API_KEY');
    
    // 2. LEER DEL .ENV (O usar fallback para desarrollo local)
    // Esto te permite cambiar el mail desde Vercel sin tocar código
    this.mailFrom = this.configService.get('MAIL_FROM') || 'onboarding@resend.dev';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('⚠️ ATENCIÓN: No hay RESEND_API_KEY. Los mails no saldrán.');
    }
  }

  // ==========================================
  // 1. MAILS INICIALES (ALTA DE RECLAMO)
  // ==========================================

  // Para el Cliente (Confirmación de envío)
  async sendNewReclamoClient(email: string, nombre: string, codigo: string) {
    if (!this.resend) return;
    await this.sendMail(email, 'Reclamo Enviado - Reclama Ya', `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1>¡Hola ${nombre}!</h1>
          <p>Gracias por confiar en <strong>Reclama Ya</strong>.</p>
          <p>Hemos recibido su reclamo y ya fue derivado a nuestro equipo.</p>
          <p>Dentro de las próximas <strong>72 horas hábiles</strong>, un tramitador será asignado para comenzar a trabajar en su caso.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 18px;"><strong>Su Código de Seguimiento:</strong> <span style="color: #3b82f6;">${codigo}</span></p>
          <p>Puede consultar el estado de su trámite en nuestra web con este código.</p>
          <br>
          <p style="color: #666; font-size: 12px;">Atentamente,<br>Equipo ReclamaYa!</p>
        </div>
    `);
  }

  // Para el Admin (Alerta de nuevo caso)
  async sendNewReclamoAdmin(data: { nombre: string; dni: string; codigo_seguimiento: string; tipo: string }) {
    if (!this.resend) return;
    
    // Leemos el mail del admin del .env, si no está, usa el tuyo como respaldo
    const adminEmail = this.configService.get('ADMIN_EMAIL') || 'mfbcaneda@gmail.com'; 
    
    await this.sendMail(adminEmail, `🚨 Nuevo Reclamo: ${data.tipo}`, `
        <h3>Nuevo Siniestro Ingresado</h3>
        <ul>
          <li><strong>Cliente:</strong> ${data.nombre}</li>
          <li><strong>DNI:</strong> ${data.dni}</li>
          <li><strong>Tipo:</strong> ${data.tipo}</li>
          <li><strong>Código:</strong> ${data.codigo_seguimiento}</li>
        </ul>
        <p>Ingresá al panel para asignar un tramitador.</p>
    `);
  }

  // ==========================================
  // 2. ACTUALIZACIÓN DE ESTADO: CLIENTE (Explicativo)
  // ==========================================
  async sendClientStatusUpdate(email: string, nombre: string, nuevoEstado: ReclamoEstado, codigo: string) {
    if (!this.resend) return;

    let subject = '';
    let body = '';

    // Textos explicativos según PDF para el CLIENTE
    switch (nuevoEstado) {
      case ReclamoEstado.RECEPCIONADO:
        subject = 'Reclamo Recepcionado - Reclama Ya';
        body = `
          <p>Su reclamo ya cuenta con un <strong>tramitador asignado</strong>, quien está revisando la documentación enviada.</p>
          <p>En esta etapa:</p>
          <ul>
            <li>Si el reclamo no es viable, le informaremos el rechazo.</li>
            <li>Si es viable, en 48hs hábiles lo iniciaremos ante la aseguradora.</li>
          </ul>
        `;
        break;

      case ReclamoEstado.INICIADO:
        subject = '¡Buenas Noticias! Reclamo Iniciado';
        body = `
          <p>Su reclamo fue <strong>iniciado correctamente</strong> ante la aseguradora.</p>
          <p>A partir de ahora iniciamos las comunicaciones oficiales. La aseguradora analizará las pruebas y pericias antes de hacer una oferta.</p>
        `;
        break;

      case ReclamoEstado.NEGOCIACION:
        subject = 'En etapa de Negociación';
        body = `
          <p>Estamos <strong>gestionando el monto indemnizatorio</strong> con la aseguradora.</p>
          <p>En breve le informaremos la cifra propuesta para su conciliación.</p>
          <p>Nuestro objetivo es lograr el mejor acuerdo posible para usted.</p>
        `;
        break;

      case ReclamoEstado.INDEMNIZANDO:
        subject = 'Acuerdo Cerrado - Indemnizando';
        body = `
          <p><strong>El acuerdo ya fue cerrado exitosamente.</strong></p>
          <p>En un plazo máximo de <strong>30 días hábiles</strong>, el monto acordado se acreditará en su cuenta bancaria.</p>
          <p>Una vez efectuado el pago, se finiquitarán los honorarios profesionales.</p>
        `;
        break;

      case ReclamoEstado.INDEMNIZADO:
        subject = '¡Felicitaciones! Reclamo Cobrado';
        body = `
          <p><strong>Su reclamo fue acordado y cobrado exitosamente.</strong></p>
          <p>Gracias por confiar en Reclama Ya para acompañarlo en este proceso.</p>
        `;
        break;

      case ReclamoEstado.RECHAZADO:
        subject = 'Actualización sobre su reclamo';
        body = `
          <p>Lamentamos informarle que, tras el análisis de nuestro equipo legal, su reclamo fue <strong>rechazado por improcedencia legal</strong>.</p>
          <p>Si desea más información, contáctenos.</p>
        `;
        break;

      default:
        return; // Si el estado no requiere mail, salimos.
    }

    // HTML Final Cliente
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Hola ${nombre},</h2>
        <p>Hay novedades en tu caso <strong>#${codigo}</strong>:</p>
        <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 15px 0;">
             ${body}
        </div>
        <p>Lo mantendremos informado.</p>
        <br>
        <hr style="border: 0; border-top: 1px solid #eee;">
        <small style="color: #999;">Equipo ReclamaYa!</small>
      </div>
    `;

    await this.sendMail(email, subject, html);
  }

  // ==========================================
  // 3. ACTUALIZACIÓN DE ESTADO: PRODUCTOR (Profesional)
  // ==========================================
  async sendProducerStatusUpdate(email: string, nombreProductor: string, estado: string, codigo: string, nombreCliente: string) {
    if (!this.resend) return;

    const subject = `Actualización Caso #${codigo} - Cliente: ${nombreCliente}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h3>Estimado Colega, ${nombreProductor}:</h3>
        <p>Le notificamos un avance en la gestión del siniestro de su asegurado.</p>
        
        <div style="background: #fff7ed; padding: 15px; border: 1px solid #fed7aa; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Expediente:</strong> #${codigo}</p>
          <p style="margin: 5px 0;"><strong>Asegurado:</strong> ${nombreCliente}</p>
          <p style="margin: 5px 0;"><strong>Nuevo Estado:</strong> <span style="color: #f97316; font-weight: bold;">${estado}</span></p>
        </div>

        <p>Continuamos con la gestión. Le avisaremos ante cualquier novedad.</p>
        <br>
        <p><em>Equipo de ReclamaYa</em></p>
      </div>
    `;

    await this.sendMail(email, subject, html);
  }

  // ==========================================
  // 4. ACTUALIZACIÓN DE ESTADO: BROKER (Reporte)
  // ==========================================
  async sendBrokerStatusUpdate(email: string, nombreBroker: string, estado: string, codigo: string, nombreProductor: string, nombreCliente: string) {
    if (!this.resend) return;

    const subject = `Reporte Red: Novedad Caso #${codigo}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h3>Hola, ${nombreBroker} (Organizador)</h3>
        <p>Se registró movimiento en un caso perteneciente a su red de productores.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Productor:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${nombreProductor}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Cliente:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${nombreCliente}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Nuevo Estado:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #166534; font-weight: bold;">${estado}</td>
          </tr>
        </table>

        <p style="color: #64748b; font-size: 13px;">Este es un aviso automático de seguimiento de cartera.</p>
      </div>
    `;

    await this.sendMail(email, subject, html);
  }

  // ==========================================
  // 5. CUENTA APROBADA (USER)
  // ==========================================
  async sendAccountApproved(email: string, nombre: string) {
    if (!this.resend) return;

    await this.sendMail(email, '🎉 ¡Tu cuenta ha sido aprobada!', `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1>¡Bienvenido a Reclama Ya, ${nombre}!</h1>
          <p>Nos complace informarte que tu cuenta ha sido <strong>verificada y aprobada</strong>.</p>
          <p>Ya puedes acceder a la plataforma para gestionar tus siniestros.</p>
          <br>
          <a href="https://reclamaya.com.ar/login" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Login</a>
        </div>
    `);
  }

  // ==========================================
  // MÉTODO PRIVADO DE ENVÍO (RESEND)
  // ==========================================
  private async sendMail(to: string, subject: string, html: string) {
    if (!this.resend) return; 

    try {
      // CORRECCIÓN: Usamos la variable de clase 'this.mailFrom' 
      // en lugar del texto fijo 'onboarding@resend.dev'
      const from = this.mailFrom; 
      
      await this.resend.emails.send({
        from, 
        to,
        subject,
        html,
      });
      console.log(`📧 Mail enviado a ${to} desde ${from} | Asunto: ${subject}`);
    } catch (error) {
      console.error(`❌ Error enviando mail a ${to}:`, error);
    }
  }
}