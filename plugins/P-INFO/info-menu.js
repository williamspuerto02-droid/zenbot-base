import * as baileysMod from '@whiskeysockets/baileys'
import config from '../../config.js'
import { plugins } from '../../handler.js'

const pkg = baileysMod.default && Object.keys(baileysMod).length === 1 ? baileysMod.default : baileysMod
const { prepareWAMessageMedia, generateWAMessageFromContent } = pkg

const START_TIME = Date.now()

// Cambiá estas imágenes por las tuyas
const IMAGENES = [
  'https://ibb.co/dwxWKFMV',
  'https://ibb.co/WpkwzLRd',
  'https://ibb.co/JWPTsCk4',
  'https://ibb.co/S2YKKvH',
  'https://ibb.co/Kjrd9zF1',
]

const ETIQUETAS = {
  info:          'ℹ️  Información',
  group:         '👥 Gestión de Grupos',
  tools:         '🔧 Herramientas',
  descargas:     '📥 Descargas',
  convertidores: '🔄 Convertidores',
  juegos:        '🎮 Minijuegos',
  otros:         '📦 Otros',
}

const getTime = () => {
  const t = Math.floor((Date.now() - START_TIME) / 1000)
  const d = Math.floor(t / 86400), h = Math.floor((t / 3600) % 24), min = Math.floor((t / 60) % 60), s = t % 60
  return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${min > 0 ? min + 'm ' : ''}${s}s`
}

function getCategorias(isOwner, groupDb) {
  const categorias = {}
  let total = 0
  for (const p of Object.values(plugins)) {
    if (!p || !p.help) continue
    if ((p.owner || p.ownerOnly) && !isOwner) continue
    const tagRaw = Array.isArray(p.tags) ? p.tags[0] : (p.tags || 'otros')
    const tag = tagRaw.toLowerCase()
    if (groupDb?.disabledCategories?.includes(tag)) continue
    const cmdsReales = Array.isArray(p.command) ? p.command : [p.command]
    if (groupDb && cmdsReales.every(c => groupDb.disabledCmds?.includes(c))) continue
    if (!categorias[tag]) categorias[tag] = []
    const cmds = Array.isArray(p.help) ? p.help : [p.help]
    for (const cmd of cmds) { categorias[tag].push(cmd); total++ }
  }
  return { categorias, total }
}

function getOrdenActivo(isOwner, groupDb) {
  const { categorias, total } = getCategorias(isOwner, groupDb)
  const orden = ['info', 'group', 'descargas', 'convertidores', 'juegos', 'tools', 'otros']
  const ordenFinal = orden.filter(k => categorias[k]?.length).concat(
    Object.keys(categorias).filter(k => !orden.includes(k))
  )
  return { categorias, total, ordenFinal }
}

const getContextInfo = (conn, m) => ({
  mentionedJid: [m.sender],
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: global.newsletterJid || '120363403631501323@newsletter',
    newsletterName: `${conn.botname || config.botName} - ${config.ownerName}`,
    serverMessageId: Math.floor(Math.random() * 999) + 1,
  }
})

async function enviarSubmenu(conn, m, tag, isOwner, usedPrefix, groupDb) {
  const { categorias } = getOrdenActivo(isOwner, groupDb)
  const comandos = categorias[tag]
  if (!comandos?.length) return m.reply(`*『 ❌ 』Sin comandos activos en esta categoría.*`)

  const nombreCat = ETIQUETAS[tag] || ETIQUETAS.otros
  const prefix = usedPrefix || '.'
  const linkCanal = config.groupLink || 'https://whatsapp.com'
  const currentBotName = conn.botname || config.botName

  let caption = `┌─────────────────\n`
  caption += `└┐  *${nombreCat.toUpperCase()}*\n`
  caption += `┌┤\n`
  for (const cmd of comandos) caption += `││  ${prefix}${cmd}\n`
  caption += `│└──⊷\n`
  caption += `└─────────────────`

  const imageUrl = IMAGENES[Math.floor(Math.random() * IMAGENES.length)]
  const media = await prepareWAMessageMedia({ image: { url: imageUrl } }, { upload: conn.waUploadToServer })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: {
          body: { text: caption },
          footer: { text: `© ${new Date().getFullYear()} ${currentBotName}` },
          header: { hasMediaAttachment: true, imageMessage: media.imageMessage },
          nativeFlowMessage: {
            buttons: [
              { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔙 Volver al Menú', id: `${prefix}menu` }) },
              { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📢 Canal', url: linkCanal, merchant_url: linkCanal }) }
            ]
          },
          contextInfo: getContextInfo(conn, m)
        }
      }
    }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

const handler = async (m, { conn, usedPrefix, isOwner, command, groupDb }) => {
  const { categorias, total, ordenFinal } = getOrdenActivo(isOwner, groupDb)

  const numMatch = command.match(/^menu(\d+)$/)
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1
    const tag = ordenFinal[idx]
    if (tag) return enviarSubmenu(conn, m, tag, isOwner, usedPrefix, groupDb)
    return m.reply(`*『 ❌ 』Categoría no encontrada.*`)
  }

  const nombreUsuario = m.pushName || 'Usuario'
  const prefix = usedPrefix || '.'
  const currentBotName = conn.botname || config.botName

  const rows = ordenFinal.map((tag, i) => {
    const nombreCat = ETIQUETAS[tag] || ETIQUETAS.otros
    const n = categorias[tag]?.length || 0
    return {
      header: nombreCat.toUpperCase(),
      title: 'Ver comandos',
      description: `${n} comandos · Escribe ${prefix}menu${i + 1}`,
      id: `menu_cat_${tag}`
    }
  })

  const textoMenu =
`*┏━━•❈ 🤖 ${currentBotName} ❈•━━┓*

> 👋 *Hola, ${nombreUsuario}*

*『 📊 ESTADÍSTICAS 』*
▢ 👑 *Creador:* ${config.ownerName}
▢ ⚙️ *Prefijo:* [ *${prefix}* ]
▢ ⏱️ *Activo:* ${getTime()}
▢ 📦 *Comandos:* ${total}

> Tocá el botón para ver los comandos.
*┗━━━━•❅•°•❈•°•❅•━━━━┛*`

  const imageUrl = IMAGENES[Math.floor(Math.random() * IMAGENES.length)]
  const media = await prepareWAMessageMedia({ image: { url: imageUrl } }, { upload: conn.waUploadToServer })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: {
          body: { text: textoMenu },
          footer: { text: `© ${new Date().getFullYear()} ${currentBotName}` },
          header: { hasMediaAttachment: true, imageMessage: media.imageMessage },
          nativeFlowMessage: {
            buttons: [
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: '📁 SELECCIONAR MENÚ',
                  sections: [{ title: '🌟 CATEGORÍAS', rows }]
                })
              },
              {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                  display_text: '📢 Canal',
                  url: config.groupLink || 'https://whatsapp.com',
                  merchant_url: config.groupLink || 'https://whatsapp.com'
                })
              }
            ]
          },
          contextInfo: getContextInfo(conn, m)
        }
      }
    }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

handler.all = async (m, { conn, isOwner, usedPrefix, groupDb }) => {
  if (m.responseId?.startsWith('menu_cat_')) {
    const tag = m.responseId.replace('menu_cat_', '')
    await enviarSubmenu(conn, m, tag, isOwner, usedPrefix, groupDb)
  }
}

handler.help = ['menu']
handler.tags = ['info']
handler.command = [
  'menu', 'help', 'ayuda', 'menú',
  ...Array.from({ length: 20 }, (_, i) => `menu${i + 1}`)
]

export default handler
