import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
// Importamos el Enum para saber qué texto mandar
import { ReclamoEstado } from '../reclamos/entities/reclamo.entity';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    // Si no hay API KEY, no explota, pero avisa en consola
    const apiKey = this.configService.get('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('⚠️ ATENCIÓN: No hay RESEND_API_KEY. Los mails no saldrán.');
    }
  }

  // 1. MAIL DE BIENVENIDA (ESTADO: ENVIADO)
  async sendNewReclamoClient(email: string, nombre: string, codigo: string) {
    if (!this.resend) return;

    await this.resend.emails.send({
      from: 'Reclama Ya <onboarding@resend.dev>', // Cuando tengas dominio, ponés 'consultas@reclamaya.com'
      to: email,
      subject: 'Reclamo Enviado - Reclama Ya',
      html: `
        <h1>¡Hola ${nombre}!</h1>
        <p>Gracias por confiar en <strong>Reclama Ya</strong>.</p>
        <p>Hemos recibido su reclamo y ya fue derivado a nuestro equipo.</p>
        <p>Dentro de las próximas <strong>72 horas hábiles</strong>, un tramitador será asignado para comenzar a trabajar en su caso.</p>
        <hr>
        <p><strong>Su Código de Seguimiento:</strong> ${codigo}</p>
        <p>Puede consultar el estado de su trámite en nuestra web con este código.</p>
        <br>
        <p>Atentamente,<br>Equipo ReclamaYa!</p>
      `,
    });
  }

  // 2. NOTIFICACIÓN AL ADMIN (PARA MARCO/AGUSTIN)
  async sendNewReclamoAdmin(data: { nombre: string; dni: string; codigo_seguimiento: string; tipo: string }) {
    if (!this.resend) return;

    await this.resend.emails.send({
      from: 'Sistema <onboarding@resend.dev>',
      to: 'mfbcaneda@gmail.com', // ¡PONÉ ACÁ EL MAIL DE ELLOS!
      subject: `🚨 Nuevo Reclamo: ${data.tipo} - ${data.nombre}`,
      html: `
        <h3>Nuevo Siniestro Ingresado</h3>
        <ul>
          <li><strong>Cliente:</strong> ${data.nombre}</li>
          <li><strong>DNI:</strong> ${data.dni}</li>
          <li><strong>Tipo:</strong> ${data.tipo}</li>
          <li><strong>Código:</strong> ${data.codigo_seguimiento}</li>
        </ul>
        <p>Ingresá al panel para asignar un tramitador.</p>
      `,
    });
  }

  // 3. EL CEREBRO: NOTIFICACIONES DE CAMBIO DE ESTADO (AUTOMÁTICO)
  async sendStatusUpdate(email: string, nombre: string, nuevoEstado: ReclamoEstado) {
    if (!this.resend) return;

    let subject = '';
    let body = '';

    // LÓGICA DE TEXTOS SEGÚN PDF "Emails 2.pdf"
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
          <p>Lo mantendremos informado.</p>
        `;
        break;

      case ReclamoEstado.INICIADO:
        subject = '¡Buenas Noticias! Reclamo Iniciado';
        body = `
          <p>Su reclamo fue <strong>iniciado correctamente</strong> ante la aseguradora.</p>
          <p>A partir de ahora iniciamos las comunicaciones oficiales. La aseguradora analizará las pruebas y pericias antes de hacer una oferta.</p>
          <p>Nos aseguraremos de que cada paso se realice de forma rápida y segura.</p>
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
          <p>Una vez efectuado el pago, se finiquitarán los honorarios profesionales (20%).</p>
          <p>¡Gracias por su confianza!</p>
        `;
        break;

      case ReclamoEstado.INDEMNIZADO: // Final Feliz
        subject = '¡Felicitaciones! Reclamo Cobrado';
        body = `
          <p><strong>Su reclamo fue acordado y cobrado exitosamente.</strong></p>
          <p>Gracias por confiar en Reclama Ya para acompañarlo en este proceso.</p>
          <p>Recuerde que estamos a su disposición para cualquier gestión futura.</p>
        `;
        break;

      case ReclamoEstado.RECHAZADO: // Final Triste
        subject = 'Actualización sobre su reclamo';
        body = `
          <p>Lamentamos informarle que, tras el análisis de nuestro equipo legal, su reclamo fue <strong>rechazado por improcedencia legal</strong>.</p>
          <p>Si desea más información o consultar sobre otros casos, puede contactarnos a través de nuestra plataforma.</p>
        `;
        break;

      default:
        return; // Si es un estado raro, no mandamos nada.
    }

    // ENVIAMOS EL MAIL FINAL
    await this.resend.emails.send({
      from: 'Reclama Ya <onboarding@resend.dev>',
      to: email,
      subject: subject,
      html: `
        <h1>Hola ${nombre},</h1>
        ${body}
        <br>
        <hr>
        <small>Equipo ReclamaYa! - San Martin 930, Tucumán.</small>
      `,
    });

    console.log(`📧 Mail enviado a ${email} por cambio a estado: ${nuevoEstado}`);
  }

  async sendAccountApproved(email: string, nombre: string) {
    if (!this.resend) return;

    await this.resend.emails.send({
      from: 'Reclama Ya <onboarding@resend.dev>',
      to: email,
      subject: '🎉 ¡Tu cuenta ha sido aprobada!',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1>¡Bienvenido a Reclama Ya, ${nombre}!</h1>
          <p>Nos complace informarte que tu cuenta ha sido <strong>verificada y aprobada</strong> por nuestro equipo de administración.</p>
          <p>Ya puedes acceder a la plataforma para gestionar tus siniestros.</p>
          <br>
          <a href="https://reclamaya.com.ar/login" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Login</a>
          <br><br>
          <hr>
          <small>Equipo ReclamaYa!</small>
        </div>
      `,
    });
  }
}