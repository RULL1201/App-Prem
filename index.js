const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const express = require('express'); // Modul untuk web server

// Konfigurasi API Alight Motion
const API = 'https://restapidhan.vercel.app';
const APIKEY = 'freeapikeydhan26';

// Konfigurasi API JereXD (Downloader)
const apiKeyJere = 'jere_XXxlEihAWirf';

// ---------------------------------------------------------
// KONFIGURASI NOMOR & ID
const ownerNumber = '267173356433492'; // ID unik WhatsApp Anda
const botPhoneNumber = '6285286080147'; // Nomor WhatsApp bot Anda (Awali dengan 62)
// ---------------------------------------------------------

// --- DUMMY SERVER AGAR RAILWAY TIDAK ME-RESTART BOT ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot WhatsApp sedang berjalan di Cloud (Railway)!'));
app.listen(PORT, () => console.log(`[WEB SERVER] Berjalan di port ${PORT} (Sistem Aman dari Auto-Restart)`));
// ---------------------------------------------------------

// Load Data Premium dengan aman
let premiumUsers = [];
const premFile = './premium.json';
if (fs.existsSync(premFile)) {
    try {
        const fileContent = fs.readFileSync(premFile, 'utf-8');
        if (fileContent.trim() !== '') {
            premiumUsers = JSON.parse(fileContent);
        }
    } catch (error) {
        premiumUsers = []; 
        fs.writeFileSync(premFile, JSON.stringify(premiumUsers));
    }
}

const emailCache = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesi_bot');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // Proses Pairing Code Otomatis untuk Cloud (Railway/Koyeb)
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let cleanedPhone = botPhoneNumber.replace(/[^0-9]/g, '');
                if (!cleanedPhone || cleanedPhone.length < 10) {
                    console.log('❌ PERINGATAN: Harap masukkan nomor bot yang valid di variabel botPhoneNumber!');
                    return;
                }
                console.log(`--- MEMINTA PAIRING CODE UNTUK NOMOR: ${cleanedPhone} ---`);
                const code = await sock.requestPairingCode(cleanedPhone);
                console.log(`\n========================================`);
                console.log(`=> KODE PAIRING ANDA: ${code} <=`);
                console.log(`========================================\n`);
                console.log(`⚠️ Segera masukkan kode ini ke WhatsApp sebelum kedaluwarsa!`);
            } catch (err) {
                console.log('Gagal meminta pairing code:', err);
            }
        }, 4000); 
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot WhatsApp Berhasil Terhubung di Cloud!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        
        const prefix = '.';
        if (!text.startsWith(prefix)) return;

        // --- SISTEM PEMBERSIHAN PENGIRIM ---
        let rawSender = msg.key.participant || msg.key.remoteJid || "";
        if (msg.key.fromMe && sock.user && sock.user.id) {
            rawSender = sock.user.id;
        }
        
        const senderNumber = rawSender.replace(/[^0-9]/g, '');
        const senderJid = senderNumber + '@s.whatsapp.net';

        const args = text.slice(prefix.length).trim().split(/\s+/);
        const command = args[0]?.toLowerCase();

        // --- PAKSA ID ANDA MENJADI OWNER ---
        const isOwner = senderNumber === ownerNumber;
        const isPremium = isOwner || premiumUsers.includes(senderJid);

        const reply = (textReply) => sock.sendMessage(msg.key.remoteJid, { text: textReply }, { quoted: msg });

        // TAMPILAN MENU UTAMA
        if (command === 'menu') {
            const menuText = `╭─「 🤖 *BOT RULZZ CYNTAXX* 」
│
├ 👤 *Status:* ${isOwner ? 'Owner 👑' : (isPremium ? 'Premium 🌟' : 'Free User 👤')}
├ ⚡ *Prefix:* [ ${prefix} ]
│
├─「 🛠️ *MENU AM (PREMIUM)* 」
│ ⬡ *.am send <email>*
│ ⬡ *.am verif <url>*
│ ⬡ *.am cancel*
│
├─「 📥 *MENU DOWNLOADER* 」
│ ⬡ *.tt <link tiktok>*
│ ⬡ *.ig <link instagram>*
│
${isOwner ? `├─「 👑 *MENU OWNER* 」
│ ⬡ *.addprem <nomor>*
│ ⬡ *.delprem <nomor>*
│\n` : ''}╰───────────────────`;
            return reply(menuText);
        }

        // FITUR TAMBAH PREMIUM (KHUSUS OWNER)
        if (command === 'addprem') {
            if (!isOwner) return reply(`❌ Akses ditolak! Nomor Anda terbaca: ${senderNumber}`);
            const target = args[1];
            if (!target) return reply('❌ Masukkan nomor target!\nContoh: `.addprem 6281234567890`');
            
            const targetNumber = target.replace(/[^0-9]/g, '');
            const targetJid = targetNumber + '@s.whatsapp.net';
            
            if (premiumUsers.includes(targetJid)) return reply('⚠️ Nomor tersebut sudah terdaftar sebagai Premium.');
            
            premiumUsers.push(targetJid);
            fs.writeFileSync(premFile, JSON.stringify(premiumUsers, null, 2));
            return reply(`✅ Sukses menambahkan *${target}* ke daftar Premium.`);
        }

        // FITUR HAPUS PREMIUM (KHUSUS OWNER)
        if (command === 'delprem') {
            if (!isOwner) return reply(`❌ Akses ditolak! Nomor Anda terbaca: ${senderNumber}`);
            const target = args[1];
            if (!target) return reply('❌ Masukkan nomor target!\nContoh: `.delprem 6281234567890`');
            
            const targetNumber = target.replace(/[^0-9]/g, '');
            const targetJid = targetNumber + '@s.whatsapp.net';
            
            if (!premiumUsers.includes(targetJid)) return reply('⚠️ Nomor tersebut tidak ada di daftar Premium.');
            
            premiumUsers = premiumUsers.filter(user => user !== targetJid);
            fs.writeFileSync(premFile, JSON.stringify(premiumUsers, null, 2));
            return reply(`✅ Sukses menghapus *${target}* dari daftar Premium.`);
        }

        // -----------------------------------------------------
        // FITUR TIKTOK DOWNLOADER
        // -----------------------------------------------------
        if (command === 'tt' || command === 'tiktok') {
            const url = args[1];
            if (!url || !url.includes('tiktok.com')) {
                return reply('❌ *Format salah!*\nContoh: `.tt https://vt.tiktok.com/ZS4PsYnUu/`');
            }

            reply('⏳ *Sedang memproses video TikTok, tunggu sebentar...*');

            try {
                const apiUrl = `https://api.jerexd.my.id/api/downloader/tiktok?apikey=${apiKeyJere}&url=${encodeURIComponent(url)}`;
                const res = await fetch(apiUrl);
                const data = await res.json();

                if (data.status && data.result) {
                    let videoUrl = data.result.nowm || data.result.url || data.result.video || (data.result.media && data.result.media[0]);
                    let title = data.result.title || data.result.desc || 'TikTok Video';

                    if (videoUrl) {
                        await sock.sendMessage(msg.key.remoteJid, { 
                            video: { url: videoUrl }, 
                            caption: `📦 *TIKTOK DOWNLOADER*\n\n📝 *Deskripsi:* ${title}` 
                        }, { quoted: msg });
                    } else {
                        reply(`❌ *Gagal!* API tidak mengembalikan link video yang valid.`);
                    }
                } else {
                    reply(`❌ *Gagal!* ${data.message || 'API sedang gangguan.'}`);
                }
            } catch (err) {
                console.log('Error TikTok:', err);
                reply('❌ Terjadi kesalahan saat memproses permintaan TikTok.');
            }
        }

        // -----------------------------------------------------
        // FITUR INSTAGRAM DOWNLOADER
        // -----------------------------------------------------
        if (command === 'ig' || command === 'instagram') {
            const url = args[1];
            if (!url || !url.includes('instagram.com')) {
                return reply('❌ *Format salah!*\nContoh: `.ig https://www.instagram.com/reel/Da8UfeQh2xg/`');
            }

            reply('⏳ *Sedang memproses link Instagram, tunggu sebentar...*');

            try {
                const apiUrl = `https://api.jerexd.my.id/api/downloader/instagram?apikey=${apiKeyJere}`;
                
                // Gunakan POST sesuai standar API
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url }) 
                });
                
                const data = await res.json();

                if (data.status && data.result) {
                    let mediaArray = Array.isArray(data.result) ? data.result : [data.result];
                    
                    for (let media of mediaArray) {
                        let mediaUrl = media.url || media.video || media;
                        
                        if (typeof mediaUrl === 'string') {
                            if (mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('.webp')) {
                                await sock.sendMessage(msg.key.remoteJid, { image: { url: mediaUrl } }, { quoted: msg });
                            } else {
                                await sock.sendMessage(msg.key.remoteJid, { video: { url: mediaUrl } }, { quoted: msg }).catch(async () => {
                                    await sock.sendMessage(msg.key.remoteJid, { image: { url: mediaUrl } }, { quoted: msg });
                                });
                            }
                        }
                    }
                } else {
                    reply(`❌ *Gagal!* ${data.message || 'API sedang gangguan atau link private.'}`);
                }
            } catch (err) {
                console.log('Error Instagram:', err);
                reply('❌ Terjadi kesalahan saat memproses permintaan Instagram.');
            }
        }

        // -----------------------------------------------------
        // LOGIK PERINTAH ALIGHT MOTION (KHUSUS PREMIUM)
        // -----------------------------------------------------
        if (command === 'am') {
            if (!isPremium) return reply('❌ *Akses Ditolak!*\nFitur ini khusus pengguna Premium. Silakan hubungi Owner untuk mendaftar.');
            
            const sub = args[1]?.toLowerCase();

            if (sub === 'send') {
                const email = args[2];
                if (!email || !email.includes('@')) {
                    return reply('❌ *Format salah!*\nContoh: `.am send tes@gmail.com`');
                }

                try {
                    const res = await fetch(`${API}/api/am?action=send&apikey=${APIKEY}&email=${encodeURIComponent(email)}`);
                    const data = await res.json();

                    if (data.status) {
                        emailCache[senderJid] = email;
                        reply(`✅ Magic link dikirim ke *${email}*\n\nCek email Anda, lalu salin URL-nya dan kirim:\n*.am verif <url dari email>*`);
                    } else {
                        reply(`❌ *Gagal:* ${data.error || data.message}`);
                    }
                } catch (err) {
                    reply('❌ Terjadi kesalahan saat menghubungi API.');
                }

            } else if (sub === 'verif') {
                const url = args.slice(2).join(' ');
                if (!url || !url.startsWith('http')) {
                    return reply('❌ *Format salah!*\nContoh: `.am verif https://...`');
                }

                const email = emailCache[senderJid];
                if (!email) {
                    return reply('❌ *Email tidak ditemukan.*\nKirim dulu: `.am send <email>`');
                }

                try {
                    const res = await fetch(`${API}/api/am?action=verif&apikey=${APIKEY}&email=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}`);
                    const data = await res.json();

                    if (data.status) {
                        delete emailCache[senderJid];
                        reply(`🎉 *BERHASIL DIAKTIFKAN!*\n\n📦 Code Order: \`${data.codeorder || '-'}\``);
                    } else {
                        reply(`❌ *Gagal:* ${data.error || data.message}`);
                    }
                } catch (err) {
                    reply('❌ Terjadi kesalahan saat menghubungi API.');
                }

            } else if (sub === 'cancel') {
                if (emailCache[senderJid]) {
                    const email = emailCache[senderJid];
                    delete emailCache[senderJid];
                    reply(`✅ Proses order untuk email *${email}* berhasil dibatalkan.`);
                } else {
                    reply('⚠️ Tidak ada proses order yang sedang berjalan untuk akun Anda.');
                }
            }
        }
    });
}

startBot();
