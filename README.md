# 💈 Barbearia do Davi

<p align="center">
  <img src="https://img.shields.io/badge/status-online-brightgreen?style=for-the-badge">
  <img src="https://img.shields.io/badge/version-1.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/node.js-enabled-green?style=for-the-badge">
</p>

<p align="center">
  <b>🚀 Sistema moderno de barbearia com animações e automações</b>
</p>

---

## ✨ Preview das Animações

<p align="center">
  <img src="https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif" width="500">
</p>

✔ Entrada suave de elementos  
✔ Hover moderno  
✔ Cards animados  
✔ Interface profissional  

---

## 🚀 Funcionalidades

### 👤 Cliente
- 📅 Agendamento online
- 💈 Visualização de serviços
- 🛒 Carrinho
- 🎟️ Cupons
- 🔐 Login / Cadastro
- 🔄 Remarcação

---

### 🧑‍💼 Admin
- 📊 Painel administrativo
- 📋 Controle de agendamentos
- 👥 Gestão de clientes
- 📌 Monitoramento de pedidos

---

### 💳 Pagamentos
- Integração com **Cakto**
- Checkout automático
- Verificação de status
- Webhook em tempo real

---

### 🔔 Automação
- Lembretes automáticos
- Preparado para WhatsApp (Twilio)

---

## 🎬 Sistema de Animações

### 🔥 Tipos implementados

| Tipo | Descrição |
|------|--------|
| Fade In | Elementos aparecem suavemente |
| Slide Up | Cards sobem ao entrar na tela |
| Hover | Botões e cards com efeito |
| Scale | Zoom leve ao interagir |

---

## ⚙️ Código de Animação

### 🎨 CSS
```css
.card {
  opacity: 0;
  transform: translateY(40px);
  transition: all 0.6s ease;
}

.card.show {
  opacity: 1;
  transform: translateY(0);
}

.card:hover {
  transform: translateY(-10px) scale(1.03);
}
