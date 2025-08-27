const express = require('express');
const cors = require('cors');
const { printQueueTicket } = require('./services/printService'); // Mengimpor fungsi cetak

const app = express();
const PORT = 3007; // Port untuk server lokal

// Middleware
app.use(cors()); // Mengizinkan request dari browser
app.use(express.json()); // Mengizinkan server membaca body JSON

/**
 * Endpoint untuk menerima perintah cetak
 * Method: POST
 * URL: http://localhost:3007/print
 */
app.post('/print', async (req, res) => {
  console.log('[SERVER] Menerima request cetak:', req.body);
  
  const { queueNumber, poliName, printLabel, copies } = req.body;

  if (!queueNumber || !poliName) {
    return res.status(400).json({ success: false, message: 'queueNumber dan poliName wajib diisi.' });
  }

  try {
    // Memanggil fungsi cetak dari printService.js
    // Catatan: parameter diubah agar cocok dengan file printService.js Anda
    await printQueueTicket(queueNumber, poliName, printLabel, copies);
    res.status(200).json({ success: true, message: 'Perintah cetak berhasil diproses.' });
  } catch (error) {
    console.error('[SERVER] Gagal saat proses cetak:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mencetak.', error: error.message });
  }
});

// Menjalankan server
app.listen(PORT, () => {
  console.log(`Print service lokal berjalan di http://localhost:${PORT}`);
});