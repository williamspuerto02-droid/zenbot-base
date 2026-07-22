<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=42&pause=2000&color=00FFE0&center=true&vCenter=true&width=600&height=80&lines=Z%CE%9EN-BOT+%F0%9F%A4%96;WhatsApp+Bot+Base;by+AXELDEV09" alt="ZΞN-BOT"/>
</div>

<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&size=14&pause=2000&color=ffffff&center=true&vCenter=true&width=600&lines=Base+profesional+para+bots+de+WhatsApp+%E2%80%A2+Baileys+Multi-Device" alt="subtitle"/>
</div>

<br/>

<div align="center">
  <img src="https://img.shields.io/badge/-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white"/>
  <img src="https://img.shields.io/badge/-FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white"/>
  <img src="https://img.shields.io/badge/-Git-F05032?style=for-the-badge&logo=git&logoColor=white"/>
</div>

<br/>

<div align="center">
  <img src="https://img.shields.io/badge/estado-activo-00ff88?style=flat-square"/>
  <img src="https://img.shields.io/badge/plataforma-Multiplataforma-black?style=flat-square&logoColor=00ffe0"/>
  <img src="https://img.shields.io/badge/hecho%20por-AXELDEV09-00ffe0?style=flat-square"/>
</div>

---

## 📦 Requisitos previos

| Herramienta | Descripción |
|-------------|-------------|
| <img src="https://img.shields.io/badge/Termux-000000?style=flat-square&logo=gnometerminal&logoColor=00ffe0"/> | Emulador de terminal para Android (Se recomienda instalar desde F-Droid). |
| <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white"/> | Entorno de ejecución JS. Se recomienda una versión moderna (≥18). |
| <img src="https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white"/> | Sistema de control de versiones para clonar el repo. |
| <img src="https://img.shields.io/badge/FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white"/> | Necesario para stickers, conversiones y todo lo multimedia. |

---

## 🚀 Instalación (Ejemplo para Termux)

### 1 — Actualizar el entorno e instalar dependencias (Ejemplo con Termux)

```bash
pkg update && pkg upgrade
pkg install git nodejs yarn ffmpeg -y
```

---

### 2 — Configurar acceso al almacenamiento (Específico de Termux)

> ⚠️ Paso obligatorio para poder trabajar en `/sdcard` desde Termux.

```bash
termux-setup-storage
```

Cuando aparezca el popup de permisos → tocá **Permitir**. Esto habilita el acceso a `/sdcard` y todo tu almacenamiento interno.

---

### 3 — Clonar el repositorio

```bash
git clone https://github.com/williamspuerto02-droid/zenbot-base.git /sdcard/zenbot-base
cd /sdcard/zenbot-base
```

> 💡 El proyecto queda en tu almacenamiento interno, accesible desde cualquier explorador de archivos de Android.

---

### 4 — Instalar dependencias de Node.js

```bash
npm install
# o bien
yarn install
```

---

### 5 — Iniciar el bot

```bash
npm start
```

> En el primer inicio, si `usePairingCode` está activado, el bot pedirá tu número (sin `+`). Se generará un código de 8 dígitos para ingresar en **WhatsApp → Dispositivos vinculados**.

---

## ⚙️ Configuración inicial

Abrí `config.js` con nano:

```bash
nano config.js
```

Buscá y editá `ownerNumber`:

```js
const config = {
  ownerNumber: ['5491112345678'], // tu número completo sin el +
}
```

Guardá con `Ctrl+O`, salí con `Ctrl+X`, y reiniciá:

```bash
npm start
```

---

## ⭐ Apoyo al proyecto

Si el proyecto te sirve, dejá una estrella — ayuda un montón al desarrollo continuo.

<div align="center">
  <a href="https://github.com/Axelixx09/zenbot-base">
    <img src="https://img.shields.io/github/stars/Axelix09/zenbot-base?style=for-the-badge&color=00ffe0&labelColor=0d0d0d&logo=github&logoColor=white" alt="stars"/>
  </a>
</div>

---

## 💬 Comunidad

<div align="center">

<a href="https://whatsapp.com/channel/0029Vb6OR9O2v1IvoXO5oT2c">
  <img src="https://img.shields.io/badge/Canal%20Oficial-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Canal WhatsApp"/>
</a>
&nbsp;
<a href="https://chat.whatsapp.com/L2i8cX4uDbxFht6oD2c2sf">
  <img src="https://img.shields.io/badge/Grupo%20Oficial-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Grupo WhatsApp"/>
</a>

</div>

---

## 👤 Créditos

<div align="center">

Base desarrollada por **AXELDEV09**

<br/>

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&size=13&pause=2000&color=00FFE0&center=true&vCenter=true&width=400&lines=Z%CE%9EN-BOT+%E2%80%A2+AXELDEV09+%C2%A9+2026" alt="footer"/>

</div>

---

[1]: https://f-droid.org/en/packages/com.termux/ "Termux en F-Droid"
