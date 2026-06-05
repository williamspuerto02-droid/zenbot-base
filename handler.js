import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import chalk from 'chalk'
import config from './config.js'
import GroupDb from './lib/database/GroupDb.js'
import { spamCache, warnCache, groupCache, groupDbCache, msgRetryCache } from './lib/caches.js'
import { serializarM } from './lib/serializer.js'

const BOT_START_TIME = Math.floor(Date.now() / 1000)

export const plugins = {}
const cmdMap = new Map()
const regexCmds = []
const watchDebounce = new Map()
const PLUGINS_DIR = path.resolve('./plugins')

function rebuildIndex() {
  cmdMap.clear()
  regexCmds.length = 0
  for (const plugin of Object.values(plugins)) {
    if (!plugin?.command) continue
    if (plugin.command instanceof RegExp) {
      regexCmds.push({ regex: plugin.command, plugin })
    } else if (Array.isArray(plugin.command)) {
      plugin.command.forEach(c => cmdMap.set(c, plugin))
    } else {
      cmdMap.set(plugin.command, plugin)
    }
  }
}

function getFilesRecursively(dir) {
  let results = []
  const list = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of list) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) results = results.concat(getFilesRecursively(fullPath))
    else if (item.isFile() && item.name.endsWith('.js')) results.push(fullPath)
  }
  return results
}

export async function loadPlugin(relPath, silent = false) {
  try {
    const full = path.join(PLUGINS_DIR, relPath)
    if (!fs.existsSync(full)) { delete plugins[relPath]; rebuildIndex(); return }
    const url = process.env.NODE_ENV === 'production'
      ? pathToFileURL(full).href
      : pathToFileURL(full).href + `?v=${Date.now()}`

    const mod = await import(url)
    const plugin = mod.default ?? mod

    if (plugin && (plugin.command || plugin.all || plugin.before || typeof plugin === 'function')) {
      if (mod.manejarParticipantes) plugin.manejarParticipantes = mod.manejarParticipantes
      plugins[relPath] = plugin
      rebuildIndex()
      if (!silent) console.log(chalk.bold.cyanBright(`[PLUGIN] Cargado: ${relPath}`))
    } else {
      delete plugins[relPath]; rebuildIndex()
    }
  } catch (e) {
    console.error(chalk.bold.bgRed.white(` [PLUGIN ERROR] ${relPath} `), chalk.bold.redBright(e.stack || e.message))
  }
}

export async function loadPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true })
  const files = getFilesRecursively(PLUGINS_DIR)
  console.log(chalk.bold.blueBright(`\n📦 Cargando ${files.length} plugins...`))
  for (const fullPath of files) {
    const relPath = path.relative(PLUGINS_DIR, fullPath).replace(/\\/g, '/')
    await loadPlugin(relPath, true)
  }
  console.log(chalk.bold.greenBright('✅ Plugins listos.\n'))
}

export function setupWatchers(conn) {
  const watcher = fs.watch(PLUGINS_DIR, { recursive: true }, async (event, filename) => {
    if (!filename || !filename.endsWith('.js')) return
    const relPath = filename.replace(/\\/g, '/')
    if (watchDebounce.has(relPath)) { clearTimeout(watchDebounce.get(relPath)) }
    watchDebounce.set(relPath, setTimeout(async () => {
      watchDebounce.delete(relPath)
      await loadPlugin(relPath)
    }, 300))
  })
  process.on('SIGINT', () => { watcher.close(); process.exit(0) })
}

const normalizarNum = n => {
  n = String(n || '').replace(/\D/g, '')
  if (n.startsWith('549')) n = '54' + n.slice(3)
  if (n.startsWith('521')) n = '52' + n.slice(3)
  return n
}
const extraerNum = jid => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')

const spamMap = new Map()
function isSpamming(jid) {
  if (!config.antiSpam?.enabled) return false
  const { maxCmds, ventanaMs, muteMs } = config.antiSpam
  const now = Date.now()
  let entry = spamMap.get(jid) || { count: 0, first: now, muted: false, muteUntil: 0 }
  if (entry.muted) {
    if (now < entry.muteUntil) return true
    entry = { count: 0, first: now, muted: false, muteUntil: 0 }
  }
  if (now - entry.first > ventanaMs) entry = { count: 1, first: now, muted: false, muteUntil: 0 }
  else entry.count++
  if (entry.count > maxCmds) { entry.muted = true; entry.muteUntil = now + muteMs }
  spamMap.set(jid, entry)
  return entry.muted
}

function getAdminStatus(participants, jid) {
  if (!jid || !participants?.length) return false
  const clean = jidNorm(jid)
  return participants.some(p => {
    const matched = jidNorm(p.id) === clean || (p.lid && jidNorm(p.lid) === clean)
    return matched && (p.admin === 'admin' || p.admin === 'superadmin' || p.isCommunityAdmin)
  })
}

function jidNorm(jid) {
  return (jid || '').replace(/:[0-9]+@/, '@').trim()
}

export async function handler(conn, m) {
  m = serializarM(conn, m, m)
  if (!m?.mtype) return

  const numSender = normalizarNum(extraerNum(m.sender))
  const senderUser = m.sender

  const owners = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber]
  const esOwner = owners.some(o => normalizarNum(extraerNum(o)) === numSender)

  const prefixMatch = m.body.match(config.prefix)
  const esCmd = !!prefixMatch && m.body.indexOf(prefixMatch[0]) === 0

  const interactiveNative =
    m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    m.message?.viewOnceMessageV2?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    m.message?.viewOnceMessage?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson

  const esBotonRespuesta = !!(
    m.message?.buttonsResponseMessage?.selectedButtonId ||
    m.message?.templateButtonReplyMessage?.selectedId ||
    m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    interactiveNative ||
    m.responseId
  )

  if (m.fromMe && !esCmd && !esBotonRespuesta) return

  let esAdmin = false
  let esBotAdmin = false
  let participants = []
  let grupoMeta = null
  let groupDb = null

  if (m.isGroup) {
    grupoMeta = groupCache.get(m.chat)
    if (!grupoMeta?.participants) {
      grupoMeta = await conn.groupMetadata(m.chat).catch(() => null) || {}
      if (grupoMeta.id) groupCache.set(m.chat, grupoMeta)
    }
    participants = grupoMeta.participants || []

    esAdmin = getAdminStatus(participants, m.sender) || (m.author ? getAdminStatus(participants, m.author) : false)

    const botIds = [conn.user?.id, conn.user?.lid].filter(Boolean)
    esBotAdmin = botIds.some(id => getAdminStatus(participants, id))

    groupDb = groupDbCache.get(m.chat)
    if (!groupDb) {
      groupDb = await GroupDb.findOrCreate(m.chat)
      groupDbCache.set(m.chat, groupDb)
    }
  }

  m.isOwner = esOwner
  m.isAdmin = esAdmin
  m.isBotAdmin = esBotAdmin

  const prefixUsado = esCmd ? prefixMatch[0] : ''

  if (m.isGroup && groupDb) {
    const cmdUsado = esCmd ? m.body.slice(prefixUsado.length).trim().split(/\s+/)[0].toLowerCase() : ''
    const isBypass = ['bot', 'boton', 'botoff', 'onlyadmin', 'soloadmin', 'adminonly'].includes(cmdUsado)

    if (!isBypass) {
      if (groupDb.onlyadmin && !esAdmin && !esOwner) return
    }
  }

  const ctx = {
    conn, args: [], text: '', command: '', usedPrefix: prefixUsado,
    participants, groupMetadata: grupoMeta, groupDb,
    isOwner: esOwner, isAdmin: esAdmin, isBotAdmin: esBotAdmin,
    config
  }

  if (!esCmd && !esBotonRespuesta) return

  conn.readMessages([m.key]).catch(() => {})
  const sinPrefix = esCmd ? m.body.slice(prefixUsado.length).trim() : m.body.trim()
  let [cmd, ...args] = sinPrefix.split(/\s+/)
  cmd = (cmd || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (esCmd || m.responseId) {
    for (const [nombre, plug] of Object.entries(plugins)) {
      if (typeof plug.all === 'function') {
        try { await plug.all.call(conn, m, ctx) }
        catch (e) { console.error(chalk.bold.bgRed.white(` [ALL:${nombre}] `), chalk.bold.redBright(e.stack || e.message)) }
      }
      if (typeof plug.before === 'function' && plug.alwaysBefore) {
        try { await plug.before(m, ctx) }
        catch (e) { console.error(chalk.bold.bgRed.white(` [BEFORE:${nombre}] `), chalk.bold.redBright(e.stack || e.message)) }
      }
    }
  }

  let plugin = cmdMap.get(cmd)
  if (!plugin) {
    const rx = regexCmds.find(c => c.regex.test(cmd))
    if (rx) plugin = rx.plugin
  }
  if (!plugin) return

  const userTag = numSender

  if (!esOwner && isSpamming(senderUser)) {
    if (!warnCache.has(senderUser)) {
      warnCache.set(senderUser, true)
      await m.reply(`*『 ⏳ 』ANTI SPAM.*\n> @${userTag}, estás enviando comandos muy rápido. Esperá unos segundos.`)
    }
    return
  }

  if (config.MODE === 'private' && !esOwner) {
    if (!warnCache.has(senderUser)) {
      warnCache.set(senderUser, true)
      await m.reply(`*『 ⚠️ 』MODO PRIVADO.*\n> @${userTag}, el bot está en modo privado.`)
    }
    return
  }

  if (m.isGroup) {
    if (groupDb && !esOwner && !esAdmin) {
      const pTag = (Array.isArray(plugin.tags) ? plugin.tags[0] : (plugin.tags || 'otros')).toLowerCase()
      if (groupDb.disabledCategories?.includes(pTag) || groupDb.disabledCmds?.includes(cmd)) {
        return m.reply(`*『 🚫 』BLOQUEADO.*\n> Este comando o categoría fue desactivado por los administradores del grupo.`)
      }
    }

    let necesitaRecarga = false
    if (plugin.adminOnly && !esAdmin && !esOwner) necesitaRecarga = true
    if (plugin.botAdminOnly && !esBotAdmin) necesitaRecarga = true

    if (necesitaRecarga) {
      const freshMeta = await conn.groupMetadata(m.chat).catch(() => null)
      if (freshMeta?.participants) {
        groupCache.set(m.chat, freshMeta)
        participants = freshMeta.participants
        if (plugin.adminOnly && !esOwner) esAdmin = getAdminStatus(participants, m.sender) || (m.author ? getAdminStatus(participants, m.author) : false)
        if (plugin.botAdminOnly) {
          const botIds = [conn.user?.id, conn.user?.lid].filter(Boolean)
          esBotAdmin = botIds.some(id => getAdminStatus(participants, id))
        }
      }
    }
  }

  if (plugin.ownerOnly && !esOwner) return m.reply(`*『 👑 』SOLO OWNER.*\n> @${userTag}, este comando es exclusivo del dueño del bot.`)
  if (plugin.groupOnly && !m.isGroup) return m.reply(`*『 👥 』SOLO GRUPOS.*\n> @${userTag}, este comando solo funciona en grupos.`)
  if (plugin.adminOnly && !esAdmin && !esOwner) return m.reply(`*『 👤 』SOLO ADMINS.*\n> @${userTag}, necesitás ser admin para usar este comando.`)
  if (plugin.botAdminOnly && !esBotAdmin) return m.reply(`*『 🤖 』BOT SIN PERMISOS.*\n> @${userTag}, hacé al bot administrador para usar esto.`)

  const text = args.join(' ')
  if (plugin.expectedArgs && !text) {
    return m.reply(plugin.expectedArgs.replace(/\{p\}/g, prefixUsado).replace(/\{cmd\}/g, cmd))
  }

  const nombreChat = (m.isGroup && grupoMeta?.subject) ? grupoMeta.subject : m.chat.split('@')[0]
  const hora = new Date().toLocaleTimeString('es', { hour12: false })

  console.log(`\n${chalk.bold.magentaBright('╭━━━ ❬')} ${chalk.bold.cyanBright(hora)} ${chalk.bold.magentaBright('❭ ━━━ ✧')}`)
  console.log(`${chalk.bold.magentaBright('┃')} ${chalk.bold.white('💬 Chat :')} ${m.isGroup ? chalk.bold.cyanBright('👥 Grupo') : chalk.bold.blueBright('👤 Privado')} ${chalk.dim(`(${nombreChat})`)}`)
  console.log(`${chalk.bold.magentaBright('┃')} ${chalk.bold.white('👤 User :')} ${chalk.bold.yellowBright(m.pushName)} ${chalk.bold.greenBright(`(+${numSender})`)}${esOwner ? chalk.bold.redBright(' [👑 OWNER]') : ''}`)
  console.log(`${chalk.bold.magentaBright('┃')} ${chalk.bold.white('🚀 Cmd  :')} ${chalk.bold.whiteBright(m.body.substring(0, 60))}`)
  console.log(`${chalk.bold.magentaBright('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ✧')}\n`)

  ctx.args = args
  ctx.text = text
  ctx.command = cmd

  try {
    if (typeof plugin.before === 'function') {
      if (await plugin.before(m, ctx)) return
    }
    if (typeof plugin.execute === 'function') {
      await plugin.execute(m, ctx)
    } else if (typeof plugin === 'function') {
      await plugin(m, ctx)
    }
    if (typeof plugin.after === 'function') await plugin.after(m, ctx)
  } catch (e) {
    console.error(chalk.bold.bgRed.white(` [ERROR: ${cmd}] `), chalk.bold.redBright(e.stack || e.message))
    await m.reply(`*❌ Ocurrió un error inesperado.*`).catch(() => {})
  }
}
