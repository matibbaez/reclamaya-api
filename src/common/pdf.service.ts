import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit'; // <--- CAMBIO CLAVE: Sin el "* as"

@Injectable()
export class PdfService {

  // Genera la "Carta de No Seguro"
  async generarCartaNoSeguro(datos: { nombre: string; dni: string; fecha: string; relato: string; lugar: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Creamos el documento
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      // Capturamos los datos en un buffer
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // --- ENCABEZADO ---
      doc.font('Helvetica-Bold').fontSize(14).text('DECLARACIÓN JURADA - INEXISTENCIA DE SEGURO', { align: 'center' });
      doc.moveDown(2);

      // --- CUERPO ---
      doc.font('Helvetica').fontSize(12).text(`Buenos Aires, ${new Date().toLocaleDateString('es-AR')}`, { align: 'right' });
      doc.moveDown(2);

      doc.text(`Por la presente, yo, ${datos.nombre}, titular del DNI Nº ${datos.dni}, declaro bajo juramento que al momento del siniestro ocurrido el día ${datos.fecha} en ${datos.lugar}, mi vehículo NO poseía cobertura de seguro vigente.`, {
        align: 'justify',
        lineGap: 5
      });
      
      doc.moveDown();
      doc.text('Asimismo, describo los hechos ocurridos de la siguiente manera:', { align: 'left' });
      doc.moveDown();
      
      // Relato (En cursiva)
      doc.font('Helvetica-Oblique').text(`"${datos.relato}"`, { align: 'justify' });
      
      doc.moveDown(4);

      // --- PIE DE FIRMA ---
      doc.text('__________________________', { align: 'center' });
      doc.text('Firma del Declarante', { align: 'center' });
      doc.text(`DNI: ${datos.dni}`, { align: 'center' });

      // Cerramos el documento
      doc.end();
    });
  }

  async generarRepresentacion(datos: { nombre: string; dni: string; fecha: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(14).text('CARTA PODER - REPRESENTACIÓN LETRADA', { align: 'center' });
      doc.moveDown(2);
      
      doc.font('Helvetica').fontSize(12).text(`Buenos Aires, ${datos.fecha}`, { align: 'right' });
      doc.moveDown(2);

      doc.text(`Por la presente, yo, ${datos.nombre}, titular del DNI Nº ${datos.dni}, otorgo poder suficiente a los letrados de RECLAMA YA para que actúen en mi nombre y representación ante la compañía aseguradora correspondiente, organismos administrativos y/o judiciales, en relación al siniestro denunciado.`, { align: 'justify', lineGap: 5 });
      
      doc.moveDown(2);
      doc.text('Faculto a los mismos para presentar documentación, realizar denuncias, tramitar el reclamo y percibir indemnizaciones.', { align: 'justify', lineGap: 5 });

      doc.moveDown(4);
      doc.text('__________________________', { align: 'center' });
      doc.text('Firma del Solicitante', { align: 'center' });
      doc.text(`DNI: ${datos.dni}`, { align: 'center' });

      doc.end();
    });
  }

  async generarHonorarios(datos: { nombre: string; dni: string; fecha: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(14).text('CONVENIO DE HONORARIOS PROFESIONALES', { align: 'center' });
      doc.moveDown(2);

      doc.font('Helvetica').fontSize(12).text(`Entre el cliente, ${datos.nombre} (DNI ${datos.dni}), y RECLAMA YA, se acuerda lo siguiente:`, { align: 'justify' });
      doc.moveDown();

      doc.text('PRIMERO: Los honorarios profesionales por la gestión extrajudicial del reclamo se pactan en el 20% (veinte por ciento) del monto total bruto que se obtenga como indemnización por parte de la compañía aseguradora.', { align: 'justify', lineGap: 5 });
      
      doc.moveDown();
      doc.text('SEGUNDO: Dicho porcentaje será abonado una vez que el cliente perciba efectivamente la indemnización.', { align: 'justify', lineGap: 5 });

      doc.moveDown();
      doc.text('TERCERO: En caso de no obtenerse indemnización alguna, el cliente no deberá abonar honorarios (resultado negativo).', { align: 'justify', lineGap: 5 });

      doc.moveDown(4);
      doc.text('__________________________', { align: 'center' });
      doc.text('Firma - Conformidad Cliente', { align: 'center' });

      doc.end();
    });
  }
}