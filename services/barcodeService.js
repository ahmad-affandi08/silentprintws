const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

function generateZPL(patientData) {
  const peserta = patientData.peserta || {};
  const noRM = peserta.NORM || peserta.mr?.noMR || "";
  const nama = (peserta.NAMA_LENGKAP || peserta.nama || "").toUpperCase();
  const _genderRaw = (peserta.JENIS_KELAMIN || peserta.sex || "").toString();
  const genderShort = /p/i.test(_genderRaw) ? "P" : "L";

  const dobDate = new Date(peserta.TANGGAL_LAHIR || peserta.tglLahir);
  const day = dobDate.getDate().toString().padStart(2, '0');
  const month = (dobDate.getMonth() + 1).toString().padStart(2, '0');
  const year = dobDate.getFullYear();
  const tglLahir = `${day}-${month}-${year}`;

  const noKTP = peserta.NIK || peserta.nik || "-";
  const alamat = (peserta.alamat || "").substring(0, 50);
  const umurText = calculateAge(peserta.TANGGAL_LAHIR || peserta.tglLahir);

  const zpl = `^XA
^PW450
^LL250
^LH5,5
^FO30,30^A0N,28,28^FD${nama} (${genderShort})^FS
^FO30,60^A0N,20,20^FDRM : ${noRM}  Tgl Lhr ${tglLahir}^FS
^FO30,88^A0N,20,20^FDNO KTP : ${noKTP}^FS
^FO30,115^A0N,20,20^FD${umurText}^FS
^FO30,140^A0N,20,20^FD${alamat}^FS
^FO30,165^BY2,2,70^BCN,70,N,N,N^FD${noRM}^FS
^XZ`;

  return Buffer.from(zpl, "utf8");
}

async function sendToPrinter(printerPath, buffer, copyNum) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `barcode-${Date.now()}-${copyNum}.tmp`);
    
    fs.writeFile(tempFile, buffer, (err) => {
      if (err) return reject(err);

      const command = `print.bat "${tempFile}" "${printerPath}"`;

      exec(command, (error, stdout, stderr) => {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (error) return reject(error);
        resolve(true);
      });
    });
  });
}

const DEFAULT_BARCODE_COPIES = 6;

async function printBarcodeLabel(patientData, copies) {
  if (typeof copies !== 'number' || Number.isNaN(copies)) {
    copies = DEFAULT_BARCODE_COPIES;
  }

  const hostname = os.hostname();
  const PRINTER_OPTIONS = [
    `\\\\${hostname}\\BARCODEPRINTER`,
    `\\\\${hostname}\\XPRINTER`
  ];

  const buffer = generateZPL(patientData);
  let lastError = null;

  for (const printerInterface of PRINTER_OPTIONS) {
    try {
      for (let i = 0; i < copies; i++) {
        await sendToPrinter(printerInterface, buffer, i + 1);
      }
      return true;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw new Error("Gagal mencetak: Printer Zebra maupun Xprinter tidak merespon. " + lastError?.message);
}

module.exports = { printBarcodeLabel };