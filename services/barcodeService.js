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
  const noRM = peserta.NORM || peserta.mr?.noMR || "";
  const nama = (peserta.NAMA_LENGKAP || peserta.nama || "").toUpperCase();
  const _genderRaw = (peserta.JENIS_KELAMIN || peserta.sex || "").toString();
  const genderShort = /p/i.test(_genderRaw) ? "P" : "L";

  const tglLahir = new Date(
    peserta.TANGGAL_LAHIR || peserta.tglLahir
  ).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const noKTP = peserta.NIK || peserta.nik || "-";
  const alamat = (peserta.alamat || "").substring(0, 50);
  const umurText = calculateAge(peserta.TANGGAL_LAHIR || peserta.tglLahir);

  const zpl = `^XA
^PW450
^LL250
^LH0,0

^FO30,30^A0N,28,28^FD${nama} (${genderShort})^FS

^FO30,60^A0N,20,20^FDRM : ${noRM}  Tgl Lhr ${tglLahir}^FS
^FO30,88^A0N,20,20^FDNO KTP : ${noKTP}^FS
^FO30,115^A0N,20,20^FD${umurText}^FS
^FO30,140^A0N,20,20^FD${alamat}^FS

^FO30,165^BY3,2,80^BCN,80,N,N,N^FD${noRM}^FS

^XZ`;

  return Buffer.from(zpl, "utf8");
}


/**
 * Mencetak barcode pasien dalam format label 55x33mm landscape
 * @param {Object} patientData - Data pasien dari frontend
 * @param {number} copies - Jumlah salinan (default: 6)
 */
// Fixed backend default for barcode copies
const DEFAULT_BARCODE_COPIES = 6;

async function printBarcodeLabel(patientData, copies) {
  // Determine final copies: use explicit numeric `copies` if provided, otherwise use server default (6)
  if (typeof copies !== 'number' || Number.isNaN(copies)) {
    copies = DEFAULT_BARCODE_COPIES;
  }

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
