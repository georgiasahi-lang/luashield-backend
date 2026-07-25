const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');
const PROMETHEUS_DIR = path.join(__dirname, 'prometheus');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['POST', 'GET']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Lua Obfuscator API - Gyx Studio' });
});

app.post('/obfuscate', limiter, async (req, res) => {
  const { code } = req.body;

  if (!code || code.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Kode tidak boleh kosong.' });
  }

  if (Buffer.byteLength(code, 'utf8') > 1024 * 1024) {
    return res.status(400).json({ success: false, error: 'Ukuran kode melebihi batas 1MB.' });
  }

  const id = uuidv4();
  const inputFile = path.join(TEMP_DIR, `${id}_input.lua`);
  const outputFile = path.join(TEMP_DIR, `${id}_output.lua`);

  const cleanup = () => {
    if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  };

  try {
    fs.writeFileSync(inputFile, code, 'utf8');

    const cmd = `lua ${PROMETHEUS_DIR}/cli/main.lua --preset Medium --out ${outputFile} ${inputFile}`;

    await new Promise((resolve, reject) => {
      const proc = exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve();
      });
    });

    if (!fs.existsSync(outputFile)) {
      throw new Error('Prometheus tidak menghasilkan output.');
    }

    const result = fs.readFileSync(outputFile, 'utf8');
    cleanup();

    res.json({ success: true, result });

  } catch (err) {
    cleanup();
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Gagal memproses kode. Pastikan kode Lua valid.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
