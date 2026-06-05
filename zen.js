import 'dotenv/config'
import * as baileysMod from '@whiskeysockets/baileys'
import pino from 'pino'
import fs from 'fs'
import { readdir, stat, unlink } from 'fs/promises'
import readline from 'readline'
import chalk from 'chalk'
import config from './config.js'
import { handler, loadPlugins, setupWatchers } from './handler.js'
import { groupCache, msgRetryCache } from './lib/caches.js'

const pkg = baileysMod.default && Object.keys(baileysMod).length === 1 ? baileysMod.default : baileysMod
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = pkg

const SESSION_PATH = './sessions/main'
const TMP_PATH = './tmp'

if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH, { recursive: true })
if (!fs.existsSync(TMP_PATH)) fs.mkdirSync(TMP_PATH, { recursive: true })

setInterval(async () => {
  if (!fs.existsSync(TMP_PATH)) return
  try {
    const files = await readdir(TMP_PATH)
    for (const f of files) {
      const fp = `${TMP_PATH}/${f}`
      try {
        const s = await stat(fp)
        if (Date.now() - s.mtimeMs > 3_600_000) await unlink(fp)
      } catch {}
    }
  } catch {}
}, 3_600_000)

let retryCount = 0
function calcDelay() {
  return Math.min(5000 * 2 ** retryCount + Math.random() * 2000, 120_000)
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH)
  const { version } = await fetchLatestBaileysVersion()
  const logger = pino({ level: 'silent' })

  const conn = makeWASocket({
    version,
    logger,
    printQRInTerminal: !config.usePairingCode,
    browser: Browsers.ubuntu('Chrome'),
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    forceSyncHistoryMessage: false,
    shouldSyncHistoryMessage: () => false,
    getMessage: async (key) => {
      const msg = msgRetryCache.get(key.id)
      return msg || undefined
    }
  })

  if (config.usePairingCode && !conn.authState.creds.registered) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const numero = await new Promise(res =>
      rl.question(chalk.bold.yellowBright('\nINGRESA TU NÚMERO DE TELÉFONO (sin +): '), ans => { rl.close(); res(ans.replace(/\D/g, '')) })
    )
    setTimeout(async () => {
      try {
        const raw = await conn.requestPairingCode(numero)
        const code = raw?.match(/.{1,4}/g)?.join('-') ?? raw
        console.log(`\n${chalk.bold.yellowBright('CÓDIGO:')} ${chalk.bold.bgGreen.white(` ${code} `)}\n`)
      } catch (e) {
        console.error(chalk.bold.red('Error al solicitar código:'), e.message)
      }
    }, 3000)
  }

  conn.ev.on('creds.update', saveCreds)

  conn.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut

      console.log(chalk.bold.red(`\n[CONEXIÓN] Cerrada. Código: ${code}. Reconectar: ${shouldReconnect}`))

      if (shouldReconnect) {
        const delay = calcDelay()
        retryCount++
        console.log(chalk.bold.yellow(`[CONEXIÓN] Reintentando en ${Math.round(delay / 1000)}s...`))
        setTimeout(startBot, delay)
      } else {
        console.log(chalk.bold.red('[CONEXIÓN] Sesión cerrada. Borrá la carpeta sessions/ y volvé a vincular.'))
        process.exit(1)
      }
    } else if (connection === 'open') {
      retryCount = 0
      const botNum = conn.user?.id?.split('@')[0]?.split(':')[0]
      console.log(chalk.bold.greenBright(`\n╔══════════════════════════════╗`))
      console.log(chalk.bold.greenBright(`║  ✅  BOT CONECTADO           ║`))
      console.log(chalk.bold.greenBright(`╚══════════════════════════════╝`))
      console.log(chalk.bold.cyanBright(`  🤖 Nombre   : ${config.botName}`))
      console.log(chalk.bold.cyanBright(`  📱 Número   : +${botNum}`))
      console.log(chalk.bold.cyanBright(`  🔖 Versión  : ${config.version}\n`))
      conn.botname = config.botName

      await loadPlugins()
      setupWatchers(conn)
    }
  })

  conn.ev.on('group-participants.update', async (data) => {
    try {
      const GroupDb = (await import('./lib/database/GroupDb.js')).default
      const groupDb = await GroupDb.findOrCreate(data.id)
      const meta = await conn.groupMetadata(data.id).catch(() => null)
      if (!meta) return

      groupCache.set(data.id, meta)
      const { welcomeModule } = await import('./plugins/welcome.js').catch(() => ({}))
      if (welcomeModule) await welcomeModule(conn, data, meta, groupDb)
    } catch {}
  })

  conn.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        await handler(conn, msg)
      } catch (e) {
        console.error(chalk.bold.bgRed.white(' [HANDLER ERROR] '), chalk.bold.redBright(e.stack || e.message))
      }
    }
  })
}

startBot()
