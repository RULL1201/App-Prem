const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');

// Konfigurasi API
const API = 'https://restapidhan.vercel.app';
const APIKEY = 'freeapikeydhan26';

// ---------------------------------------------------------
const ownerNumber = '6289676153775@s.whatsapp.net'; 
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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesi_bot');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'] 
    });

    if (!sock.authState.creds.registered) {
        console.log('--- SETUP PAIRING CODE ---');
        const phoneNumber = await question('Masukkan nomor WhatsApp bot (contoh: 6281234567890): ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\nSilakan masukkan kode ini di notifikasi WhatsApp Anda: \n=> ${code} <=\n`);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot WhatsApp Berhasil Terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        
        const prefix = '.';
        if (!text.startsWith(prefix)) return;

        // --- SISTEM PEMBACAAN NOMOR YANG LEBIH AKURAT ---
        // Jika bot chat ke dirinya sendiri (fromMe), gunakan JID bot. Jika tidak, gunakan JID pengirim.
        let rawSender = msg.key.fromMe ? sock.user.id : (msg.key.participant || msg.key.remoteJid);
        
        // Bersihkan ID Perangkat (:1, :2, dsb)
        const sender = rawSender.includes(':') ? rawSender.split(':')[0] + '@s.whatsapp.net' : rawSender;
        // ------------------------------------------------

        const args = text.slice(prefix.length).trim().split(/\s+/);
        const command = args[0]?.toLowerCase();

        const isOwner = sender === ownerNumber;
        const isPremium = isOwner || premiumUsers.includes(sender);

        const reply = (textReply) => sock.sendMessage(msg.key.remoteJid, { text: textReply }, { quoted: msg });

        if (command === 'menu') {
            const menuText = `╭─「 🤖 *BOT ALIGHT MOTION* 」
│
├ 👤 *Status:* ${isOwner ? 'Owner 👑' : (isPremium ? 'Premium 🌟' : 'Free User 👤')}
├ ⚡ *Prefix:* [ ${prefix} ]
│
├─「 🛠️ *MENU AM (PREMIUM)* 」
│ ⬡ *.am send <email>*
│ ⬡ *.am verif <url>*
│ ⬡ *.am cancel*
│
${isOwner ? `├─「 👑 *MENU OWNER* 」
│ ⬡ *.addprem <nomor>*
│ ⬡ *.delprem <nomor>*
│\n` : ''}╰───────────────────`;
            return reply(menuText);
        }

        if (command === 'addprem') {
            // JIKA GAGAL, BOT AKAN MEMBERITAHU NOMOR APA YANG DIA BACA
            if (!isOwner) {
                return reply(`❌ *Gagal! Anda bukan Owner.*\n\n🔍 *Cek Sistem:*\nNomor Anda terdeteksi sebagai:\n👉 *${sender}*\n\nSedangkan Owner disetting ke:\n👉 *${ownerNumber}*\n\n_(Samakan tulisan ownerNumber di kode dengan nomor yang terdeteksi di atas)_`);
            }
            
            const target = args[1];
            if (!target) return reply('❌ Masukkan nomor target!\nContoh: `.addprem 6281234567890`');
            
            const targetJid = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (premiumUsers.includes(targetJid)) return reply('⚠️ Nomor tersebut sudah terdaftar sebagai Premium.');
            
            premiumUsers.push(targetJid);
            fs.writeFileSync(premFile, JSON.stringify(premiumUsers, null, 2));
            return reply(`✅ Sukses menambahkan *${target}* ke daftar Premium.`);
        }

        if (command === 'delprem') {
            if (!isOwner) return reply('❌ Perintah ini khusus Owner bot!');
            const target = args[1];
            if (!target) return reply('❌ Masukkan nomor target!\nContoh: `.delprem 6281234567890`');
            
            const targetJid = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!premiumUsers.includes(targetJid)) return reply('⚠️ Nomor tersebut tidak ada di daftar Premium.');
            
            premiumUsers = premiumUsers.filter(user => user !== targetJid);
            fs.writeFileSync(premFile, JSON.stringify(premiumUsers, null, 2));
            return reply(`✅ Sukses menghapus *${target}* dari daftar Premium.`);
        }

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
                        emailCache[sender] = email;
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

                const email = emailCache[sender];
                if (!email) {
                    return reply('❌ *Email tidak ditemukan.*\nKirim dulu: `.am send <email>`');
                }

                try {
                    const res = await fetch(`${API}/api/am?action=verif&apikey=${APIKEY}&email=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}`);
                    const data = await res.json();

                    if (data.status) {
                        delete emailCache[sender];
                        reply(`🎉 *BERHASIL DIAKTIFKAN!*\n\n📦 Code Order: \`${data.codeorder || '-'}\``);
                    } else {
                        reply(`❌ *Gagal:* ${data.error || data.message}`);
                    }
                } catch (err) {
                    reply('❌ Terjadi kesalahan saat menghubungi API.');
                }

            } else if (sub === 'cancel') {
                if (emailCache[sender]) {
                    const email = emailCache[sender];
                    delete emailCache[sender];
                    reply(`✅ Proses order untuk email *${email}* berhasil dibatalkan.`);
                } else {
                    reply('⚠️ Tidak ada proses order yang sedang berjalan untuk akun Anda.');
                }
            }
        }
    });
}

startBot();
