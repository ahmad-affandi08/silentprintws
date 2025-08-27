const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Tambahkan parameter "copies" dengan nilai default 2
async function printQueueTicket(queueNumber, poliName, printLabel = "Poli Tujuan", copies = 2) {
  
  const PRINTER_SHARE_NAME = "SILENTPRINTER"; 
  const hostname = os.hostname();
  const printerInterface = `\\\\${hostname}\\${PRINTER_SHARE_NAME}`;
  
  console.log(`[PRINT] Menyiapkan ${copies} salinan untuk dicetak ke: ${printerInterface}`);

  const thermalPrinter = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'tcp://127.0.0.1:9100', // Dummy interface
  });

  // --- Layout Ringkas ---
  thermalPrinter.alignCenter();
  thermalPrinter.bold(true);
  thermalPrinter.println('RSUD dr. Soeratno Gemolong');
  thermalPrinter.bold(false);
  thermalPrinter.println('--------------------------------');
  thermalPrinter.println('NOMOR ANTRIAN');
  thermalPrinter.setTextSize(4, 4); 
  thermalPrinter.println(String(queueNumber));
  thermalPrinter.setTextSize(1, 1); 
  thermalPrinter.println(`${printLabel}:`);
  thermalPrinter.bold(true);
  thermalPrinter.println(poliName); 
  thermalPrinter.bold(false);
  thermalPrinter.println('--------------------------------');
  thermalPrinter.println('Silakan tunggu panggilan Anda.');
  thermalPrinter.cut();
  // --- Akhir Layout ---

  const buffer = thermalPrinter.getBuffer();
  
  // --- PERUBAHAN UTAMA: PERULANGAN (LOOP) UNTUK MENCETAK ---
  for (let i = 0; i < copies; i++) {
    const copyNum = i + 1;
    console.log(`[PRINT] Memproses salinan ke-${copyNum}...`);
    
    // Proses pencetakan dibungkus dalam Promise agar berjalan berurutan
    await new Promise((resolve, reject) => {
      const tempFile = path.join(os.tmpdir(), `printjob-${Date.now()}-${copyNum}.tmp`);
      
      // 1. Tulis buffer ke file sementara
      fs.writeFile(tempFile, buffer, (err) => {
        if (err) {
          console.error(`[PRINT] Gagal menulis file sementara untuk salinan ke-${copyNum}:`, err);
          return reject(err);
        }

        // 2. Siapkan perintah untuk menjalankan print.bat
        const command = `print.bat "${tempFile}" "${printerInterface}"`;
        
        // 3. Eksekusi skrip .bat
        exec(command, (error, stdout, stderr) => {
          fs.unlinkSync(tempFile); // Selalu hapus file sementara
          if (error) {
            console.error(`[PRINT] Gagal eksekusi print.bat untuk salinan ke-${copyNum}:`, error.message);
            return reject(error);
          }
          console.log(`[PRINT] Skrip print.bat untuk salinan ke-${copyNum} berhasil.`);
          resolve(true);
        });
      });
    });
  }
  // --- AKHIR PERUBAHAN ---
  
  return true; // Mengindikasikan semua proses loop selesai
}

module.exports = { printQueueTicket };