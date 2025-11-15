const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
 * Generate ZPL commands untuk Zebra GT820
 * Format label: 55x33mm landscape
 */
function generateZPL(patientData) {
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

  // ZPL commands untuk Zebra GT820
  // Label size: 55mm x 33mm (landscape) = 2.17" x 1.3"
  // Resolution 203 dpi (8 dots/mm)
  const zpl = `^XA
^MMT
^PW440
^LL264
^LH0,0
^FO10,10^A0N,25,25^FD${nama} (${genderShort})^FS
^FO10,45^A0N,20,20^FDRM : ${noRM}  Tgl Lhr ${tglLahir}^FS
^FO10,75^A0N,20,20^FDNO KTP : ${noKTP}^FS
^FO10,105^A0N,20,20^FD${umurText}^FS
^FO10,135^A0N,18,18^FD${alamat}^FS
^FO80,170^BY2^BCN,60,N,N,N^FD${noRM}^FS
^XZ`;

  return Buffer.from(zpl, 'utf8');
}

/**
 * Mencetak barcode pasien dalam format label 55x33mm landscape
 * @param {Object} patientData - Data pasien dari frontend
 * @param {number} copies - Jumlah salinan (default: 6)
 */
async function printBarcodeLabel(patientData, copies = 6) {
  const PRINTER_SHARE_NAME = "BARCODEPRINTER";
  const hostname = os.hostname();
  const printerInterface = `\\\\${hostname}\\${PRINTER_SHARE_NAME}`;

  console.log(`[BARCODE] Menyiapkan ${copies} salinan barcode untuk dicetak ke: ${printerInterface}`);

  const buffer = generateZPL(patientData);

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
