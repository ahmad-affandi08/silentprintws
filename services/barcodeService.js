const { createCanvas } = require('canvas');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const JsBarcode = require('jsbarcode');

/**
 * Menghasilkan barcode CODE39 dari noRM
 * @param {string} noRM - Nomor Rekam Medis
 * @returns {Buffer} - Buffer gambar PNG barcode
 */
function generateBarcodeImage(noRM) {
  const canvas = createCanvas(200, 100);
  JsBarcode(canvas, noRM, {
    format: 'CODE39',
    width: 2,
    height: 100,
    displayValue: false,
    margin: 0
  });
  
  return canvas.toBuffer('image/png');
}

/**
 * Menghitung usia dari tanggal lahir
 * @param {string | Date} dateOfBirth - Tanggal lahir
 * @returns {string} Format usia: "X Thn/ Y bln/ Z hr"
 */
function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  
  years = Math.max(0, years);
  months = Math.max(0, months);
  days = Math.max(0, days);
  
  return `${years} Thn/ ${months} bln/ ${days} hr`;
}

/**
 * Mencetak barcode pasien dalam format label 55x33mm landscape
 * @param {Object} patientData - Data pasien dari frontend
 * @param {number} copies - Jumlah salinan (default: 1)
 */
async function printBarcodeLabel(patientData, copies = 1) {
  const PRINTER_SHARE_NAME = "BARCODEPRINTER";
  const hostname = os.hostname();
  const printerInterface = `\\\\${hostname}\\${PRINTER_SHARE_NAME}`;

  console.log(`[BARCODE] Menyiapkan ${copies} salinan barcode untuk dicetak ke: ${printerInterface}`);

  const peserta = patientData.peserta || {};
  const noRM = peserta.NORM || peserta.mr?.noMR || '';
  const nama = (peserta.NAMA_LENGKAP || peserta.nama || '').toUpperCase();
  const _genderRaw = (peserta.JENIS_KELAMIN || peserta.sex || '').toString();
  const genderShort = /p/i.test(_genderRaw) ? 'P' : 'L';
  
  const tglLahir = new Date(peserta.TANGGAL_LAHIR || peserta.tglLahir).toLocaleDateString(
    'id-ID',
    { day: '2-digit', month: '2-digit', year: 'numeric' }
  );
  
  const noKTP = peserta.NIK || peserta.nik || '-';
  const alamat = (peserta.alamat || '').substring(0, 50);
  const umurText = calculateAge(peserta.TANGGAL_LAHIR || peserta.tglLahir);

  // Generate barcode image
  const barcodeBuffer = generateBarcodeImage(noRM);

  const thermalPrinter = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'tcp://127.0.0.1:9100', // Dummy interface
    characterSet: "SLOVENIA",
    removeSpecialCharacters: false,
    lineCharacter: "-"
  });

  // Layout barcode label (sesuai design frontend: 55x33mm landscape)
  thermalPrinter.alignLeft();
  thermalPrinter.setTextSize(1, 1);
  thermalPrinter.bold(true);
  
  // Baris 1: Nama & Gender
  thermalPrinter.println(`${nama} (${genderShort})`);
  thermalPrinter.newLine();
  
  // Baris 2: RM & Tgl Lahir
  thermalPrinter.bold(true);
  thermalPrinter.println(`RM : ${noRM} Tgl Lhr ${tglLahir}`);
  
  // Baris 3: NO KTP
  thermalPrinter.println(`NO KTP : ${noKTP}`);
  
  // Baris 4: Umur
  thermalPrinter.println(`${umurText}`);
  
  // Baris 5: Alamat
  thermalPrinter.setTextSize(0, 0);
  thermalPrinter.println(alamat);
  thermalPrinter.bold(false);
  thermalPrinter.newLine();

  // Barcode image (embedded sebagai image jika printer mendukung)
  // Catatan: node-thermal-printer mendukung printImage untuk beberapa printer
  try {
    await thermalPrinter.printImage(barcodeBuffer);
  } catch (err) {
    console.warn('[BARCODE] Printer tidak mendukung image, skip barcode image:', err.message);
    // Fallback: print noRM sebagai teks
    thermalPrinter.alignCenter();
    thermalPrinter.println(noRM);
  }

  thermalPrinter.newLine();
  thermalPrinter.cut();

  const buffer = thermalPrinter.getBuffer();

  // Loop untuk jumlah salinan
  for (let i = 0; i < copies; i++) {
    const copyNum = i + 1;
    console.log(`[BARCODE] Memproses salinan ke-${copyNum}...`);

    await new Promise((resolve, reject) => {
      const tempFile = path.join(os.tmpdir(), `barcode-${Date.now()}-${copyNum}.tmp`);

      fs.writeFile(tempFile, buffer, (err) => {
        if (err) {
          console.error(`[BARCODE] Gagal menulis file sementara untuk salinan ke-${copyNum}:`, err);
          return reject(err);
        }

        const command = `print.bat "${tempFile}" "${printerInterface}"`;

        exec(command, (error, stdout, stderr) => {
          fs.unlinkSync(tempFile);
          if (error) {
            console.error(`[BARCODE] Gagal eksekusi print.bat untuk salinan ke-${copyNum}:`, error.message);
            return reject(error);
          }
          console.log(`[BARCODE] Salinan ke-${copyNum} berhasil dicetak.`);
          resolve(true);
        });
      });
    });
  }

  return true;
}

module.exports = { printBarcodeLabel };
