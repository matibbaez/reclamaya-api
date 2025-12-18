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
}