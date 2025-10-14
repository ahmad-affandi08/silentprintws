const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function printQueueTicket(
  queueNumber,
  poliName,
  printLabel = "Poli Tujuan",
  copies = 2
) {
  const PRINTER_SHARE_NAME = "SILENTPRINTER";
  const hostname = os.hostname();
  // Ensure UNC path starts with double backslashes: \\HOSTNAME\SHARE
  const printerInterface = `\\\\${hostname}\\${PRINTER_SHARE_NAME}`;

  console.log(`[PRINT] Menyiapkan ${copies} salinan untuk dicetak ke: ${printerInterface}`);

  const thermalPrinter = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'tcp://127.0.0.1:9100', // Dummy interface
    characterSet: "SLOVENIA",
    removeSpecialCharacters: false,
    lineCharacter: "-"
  });

  const now = new Date();
  const timestamp = now.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short"
  });

  // --- Layout lebih menarik untuk kertas 58mm ---
  thermalPrinter.alignCenter();

  // Header
  thermalPrinter.bold(true);
  thermalPrinter.println("================================");
  thermalPrinter.println("  RSUD dr. Soeratno Gemolong  ");
  thermalPrinter.println("================================");
  thermalPrinter.bold(false);
  thermalPrinter.newLine();

  // Judul
  thermalPrinter.println("NOMOR ANTRIAN");
  thermalPrinter.setTextSize(4, 4);
  thermalPrinter.bold(true);
  thermalPrinter.println(String(queueNumber));
  thermalPrinter.bold(false);
  thermalPrinter.setTextSize(1, 1);
  thermalPrinter.newLine();

  // Poli tujuan dengan border
  thermalPrinter.println("================");
  thermalPrinter.println(`${printLabel.toUpperCase()}:`);
  thermalPrinter.bold(true);
  thermalPrinter.println(poliName.toUpperCase());
  thermalPrinter.bold(false);
  thermalPrinter.println("================");
  thermalPrinter.newLine();

  // Instruksi kecil
  thermalPrinter.setTextSize(0, 0);
  thermalPrinter.println("Silakan tunggu panggilan Anda.");
  thermalPrinter.newLine();

  // Footer timestamp
  thermalPrinter.setTextSize(0, 0);
  thermalPrinter.println(`Dicetak: ${timestamp}`);
  thermalPrinter.newLine();

  thermalPrinter.cut();

  const buffer = thermalPrinter.getBuffer();

  // --- Loop untuk jumlah salinan ---
  for (let i = 0; i < copies; i++) {
    const copyNum = i + 1;
    console.log(`[PRINT] Memproses salinan ke-${copyNum}...`);

    await new Promise((resolve, reject) => {
      const tempFile = path.join(os.tmpdir(), `printjob-${Date.now()}-${copyNum}.tmp`);

      fs.writeFile(tempFile, buffer, (err) => {
        if (err) {
          console.error(`[PRINT] Gagal menulis file sementara untuk salinan ke-${copyNum}:`, err);
          return reject(err);
        }

        const command = `print.bat "${tempFile}" "${printerInterface}"`;

        exec(command, (error, stdout, stderr) => {
          fs.unlinkSync(tempFile);
          if (error) {
            console.error(`[PRINT] Gagal eksekusi print.bat untuk salinan ke-${copyNum}:`, error.message);
            return reject(error);
          }
          console.log(`[PRINT] Salinan ke-${copyNum} berhasil dicetak.`);
          resolve(true);
        });
      });
    });
  }

  return true;
}

async function printApmTicket(datas, copies = 1) {
  try {
    const queueNumber = datas.nomorantrean || '';
    const poliName = datas.namapolirs || '';
    const huruf = datas.huruf || '';
    const antreanPoli = datas.antreanpoli || '';

    const PRINTER_SHARE_NAME = "SILENTPRINTER";
    const hostname = os.hostname();
    const printerInterface = `\\\\${hostname}\\${PRINTER_SHARE_NAME}`;

    console.log(`[PRINT-APM] Menyiapkan print APM untuk: ${queueNumber} / ${poliName}`);

    const thermalPrinter = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'tcp://1227.0.0.1:9100', // Sesuaikan dengan interface Anda
      characterSet: "SLOVENIA",
      removeSpecialCharacters: false,
      lineCharacter: "-"
    });

    const now = new Date();
    const timestamp = now.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });

   
    thermalPrinter.alignCenter();

    thermalPrinter.setTextSize(0, 0);
    thermalPrinter.println("Poliklinik");

    thermalPrinter.setTextSize(0, 0);
    thermalPrinter.bold(false);
    thermalPrinter.println("RSUD dr. Soeratno Gemolong");
    thermalPrinter.bold(false);

    thermalPrinter.setTextSize(0, 0);
    thermalPrinter.println("-------------------------------");
    thermalPrinter.println("Karcis Tunggu Loket");
    thermalPrinter.println("Pendaftaran Onsite");
    thermalPrinter.println("-------------------------------");

    
    thermalPrinter.newLine();
    thermalPrinter.setTextSize(3, 3);
    thermalPrinter.bold(true);
    thermalPrinter.println(String(queueNumber)); 
    thermalPrinter.bold(false);

    
    thermalPrinter.setTextSize(0, 0);
    thermalPrinter.println("-------------------------------");

    thermalPrinter.setTextSize(1, 1);
    thermalPrinter.println(String(poliName)); 

    thermalPrinter.setTextSize(0, 0);
    thermalPrinter.println("-------------------------------");

    const secondaryQueue = huruf ? `${huruf}-${antreanPoli}` : `${antreanPoli}`;
    if (secondaryQueue && secondaryQueue.trim() !== '' && secondaryQueue.trim() !== '-') {
      thermalPrinter.setTextSize(3, 3);
      thermalPrinter.bold(true);
      thermalPrinter.println(String(secondaryQueue)); 
      thermalPrinter.bold(false);
    }

    thermalPrinter.newLine();
    thermalPrinter.setTextSize(0, 0);
    thermalPrinter.println("Silakan menunggu nomor Anda dipanggil.");
    thermalPrinter.println(`Dicetak: ${timestamp}`);

    thermalPrinter.cut();

    
    const buffer = thermalPrinter.getBuffer();

    for (let i = 0; i < copies; i++) {
      const copyNum = i + 1;
      await new Promise((resolve, reject) => {
        const tempFile = path.join(os.tmpdir(), `printjob-apm-${Date.now()}-${copyNum}.tmp`);
        fs.writeFile(tempFile, buffer, (err) => {
          if (err) return reject(err);
          const command = `print.bat "${tempFile}" "${printerInterface}"`;
          exec(command, (error, stdout, stderr) => {
            try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
            if (error) return reject(error);
            console.log(`[PRINT-APM] Salinan ke-${copyNum} berhasil dicetak.`);
            resolve(true);
          });
        });
      });
    }

    return true;
  } catch (e) {
    console.error('[PRINT-APM] Error saat mencetak APM ticket:', e.message || e);
    throw e;
  }
}
module.exports = { printQueueTicket, printApmTicket };
