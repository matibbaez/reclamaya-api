import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {

  // ---------------------------------------------------------
  // 1. CARTA DE NO SEGURO (Declaración Jurada del Cliente)
  // ---------------------------------------------------------
  async generarCartaNoSeguro(datos: { nombre: string; dni: string; fecha: string; relato: string; lugar: string; firma?: Buffer }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Título
      doc.font('Helvetica-Bold').fontSize(14).text('DECLARACIÓN JURADA - INEXISTENCIA DE SEGURO', { align: 'center' });
      doc.moveDown(2);

      // Fecha
      const fechaActual = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.font('Helvetica').fontSize(12).text(`Buenos Aires, ${fechaActual}`, { align: 'right' });
      doc.moveDown(2);

      // Cuerpo del texto
      doc.text(
        `Por la presente, yo, ${datos.nombre}, titular del DNI Nº ${datos.dni}, declaro bajo juramento que al momento del siniestro ocurrido el día ${datos.fecha} en ${datos.lugar}, mi vehículo NO poseía cobertura de seguro vigente por cuestiones ajenas a mi voluntad.`,
        { align: 'justify', lineGap: 5 }
      );
      
      doc.moveDown();
      doc.text('Asimismo, describo los hechos ocurridos de la siguiente manera:', { align: 'left' });
      doc.moveDown();
      
      // Relato en cursiva
      doc.font('Helvetica-Oblique').text(`"${datos.relato}"`, { align: 'justify' });
      
      doc.moveDown(4);

      // --- FIRMA ---
      const lineaY = doc.y;
      doc.font('Helvetica').text('__________________________', { align: 'center' });
      
      if (datos.firma) {
          doc.image(datos.firma, (doc.page.width / 2) - 60, lineaY - 40, { width: 120 });
      }

      doc.text('Firma del Solicitante', { align: 'center' });
      doc.text(`DNI: ${datos.dni}`, { align: 'center' });

      doc.end();
    });
  }

  // ---------------------------------------------------------
  // 2. REPRESENTACIÓN LETRADA (Designación Dr. Simonelli)
  // ---------------------------------------------------------
  async generarRepresentacion(datos: { nombre: string; dni: string; fecha: string; firma?: Buffer }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Título
      doc.font('Helvetica-Bold').fontSize(13).text('SE PRESENTA – DESIGNA LETRADO – CONSTITUYE DOMICILIO', { align: 'center' });
      doc.moveDown(2);
      
      // Fecha
      doc.font('Helvetica').fontSize(12).text(`Buenos Aires, ${datos.fecha}`, { align: 'right' });
      doc.moveDown(2);

      // Cuerpo basado en "ESCRITO DE REPRENTACIÓN.odt"
      doc.text(
        `${datos.nombre}, DNI ${datos.dni}, por derecho propio, conjuntamente con mi abogado patrocinante, el Dr. Agustín Exequiel Simonelli, Tº 141, Fº 755, CPACF, CUIT 20-36045548-4, constituyendo domicilio legal en Gallo 1435 piso 9 de Capital Federal, teléfono 11-3336-0425, ante quien corresponda me presento y respetuosamente digo:`,
        { align: 'justify', lineGap: 5 }
      );
      
      doc.moveDown();
      doc.text(
        'Que vengo a presentarme, designando como único letrado patrocinante al Dr. Agustín Exequiel Simonelli, cuyos datos personales se consignaron anteriormente, otorgándole poder suficiente para realizar todas las gestiones extrajudiciales y administrativas necesarias ante la compañía aseguradora correspondiente, a fin de obtener la indemnización por los daños materiales y/o físicos sufridos.',
        { align: 'justify', lineGap: 5 }
      );

      doc.moveDown(4);

      // --- FIRMA ---
      const lineaY = doc.y;
      doc.text('__________________________', { align: 'center' });
      
      if (datos.firma) {
          doc.image(datos.firma, (doc.page.width / 2) - 60, lineaY - 40, { width: 120 });
      }

      doc.text('Firma del Solicitante', { align: 'center' });
      doc.text(`DNI: ${datos.dni}`, { align: 'center' });

      doc.end();
    });
  }

  // ---------------------------------------------------------
  // 3. CONVENIO DE HONORARIOS (20% a resultado)
  // ---------------------------------------------------------
  async generarHonorarios(datos: { nombre: string; dni: string; fecha: string; firma?: Buffer }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Título
      doc.font('Helvetica-Bold').fontSize(14).text('CONVENIO DE HONORARIOS PROFESIONALES', { align: 'center' });
      doc.moveDown(2);

      // Encabezado basado en "convenio de honorarios.odt"
      doc.font('Helvetica').fontSize(12).text(
        `En la ciudad de Buenos Aires, a los ${new Date().getDate()} días del mes de ${new Date().toLocaleString('es-AR', { month: 'long' })} de ${new Date().getFullYear()}, ENTRE: ${datos.nombre}, DNI ${datos.dni}, en adelante “EL CLIENTE”, por una parte, y el señor AGUSTIN EXEQUIEL SIMONELLI, Tº141 Fº755 C.P.A.C.F, CUIT: 20-36045548-4, por otra, en adelante “EL LETRADO”, se conviene celebrar el presente convenio de honorarios:`,
        { align: 'justify', lineGap: 5 }
      );
      doc.moveDown();

      // Cláusulas
      doc.font('Helvetica-Bold').text('PRIMERO:', { continued: true }).font('Helvetica').text(' EL CLIENTE encarga a EL LETRADO y este acepta la labor profesional de letrado patrocinante en el reclamo extrajudicial y/o judicial que iniciará EL CLIENTE por el siniestro denunciado.', { align: 'justify', lineGap: 5 });
      
      doc.moveDown();
      doc.font('Helvetica-Bold').text('SEGUNDO:', { continued: true }).font('Helvetica').text(' El honorario básico de los profesionales se conviene en el 20% (VEINTE POR CIENTO) del monto total que por todo concepto se recaude del pleito o gestión. Dicho porcentaje incorpora todo gasto de letrado, cotizaciones, certificados, tasas, aranceles e impuestos.', { align: 'justify', lineGap: 5 });

      doc.moveDown();
      doc.font('Helvetica-Bold').text('TERCERO:', { continued: true }).font('Helvetica').text(' El pago de honorarios deberá realizarlo EL CLIENTE al LETRADO en efectivo o transferencia bancaria únicamente al momento de percibir el monto que se recaude (Resultado Positivo). En caso de no obtenerse indemnización alguna, el cliente no deberá abonar honorarios.', { align: 'justify', lineGap: 5 });

      doc.moveDown(4);

      // --- FIRMA ---
      const lineaY = doc.y;
      doc.text('__________________________', { align: 'center' });
      
      if (datos.firma) {
          doc.image(datos.firma, (doc.page.width / 2) - 60, lineaY - 40, { width: 120 });
      }

      doc.text('Firma del Solicitante', { align: 'center' });
      doc.text(`DNI: ${datos.dni}`, { align: 'center' });

      doc.end();
    });
  }
}