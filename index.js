const express = require('express');
const cors = require('cors');
const { printQueueTicket, printApmTicket } = require('./services/printService'); // Mengimpor fungsi cetak

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
// Dedicated APM print route
app.post('/print/apm', async (req, res) => {
  console.log('[SERVER] Menerima request cetak APM');
  const body = req.body || {};

  if (!body.datas) {
    return res.status(400).json({ success: false, message: 'datas field wajib diisi untuk route /print/apm' });
  }

  try {
  await printApmTicket(body.datas, body.copies || 1);
    return res.status(200).json({ success: true, message: 'Cetak APM berhasil.' });
  } catch (e) {
    console.warn('[SERVER] Gagal cetak APM langsung, akan enqueu jika perlu:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal mencetak APM.', error: e.message });
  }
});

// Legacy / generic payload handling (kept for backward compatibility)
app.post('/print', async (req, res) => {
  console.log('[SERVER] Menerima request cetak:', req.body?.msg ? req.body.msg : '(body)');

  const body = req.body || {};
  const { queueNumber, poliName, printLabel, copies } = body;

  if (!queueNumber || !poliName) {
    return res.status(400).json({ success: false, message: 'queueNumber dan poliName wajib diisi.' });
  }

  try {
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