# 💈 Barbearia do Davi

<p align="center">
  <img src="https://img.shields.io/badge/status-online-brightgreen?style=for-the-badge">
  <img src="https://img.shields.io/badge/version-1.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/node.js-serverless-green?style=for-the-badge">
  <img src="https://img.shields.io/badge/deploy-vercel-black?style=for-the-badge">
</p>

<p align="center">
  <b>Sistema completo de barbearia com agendamento, pagamentos e interface animada</b>
</p>

---

## ✨ Sobre o Projeto

O **Barbearia do Davi** é uma aplicação web moderna desenvolvida para gerenciar agendamentos, clientes e pagamentos de forma simples, rápida e eficiente.

O sistema utiliza uma arquitetura **serverless com Node.js**, oferecendo alta performance e escalabilidade, além de uma interface com **animações suaves** para melhorar a experiência do usuário.

---

## 🎬 Interface e Animações

<p align="center">
  <img src="https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif" width="500">
</p>

A interface foi projetada com foco em usabilidade e inclui:

- ✨ Animações de entrada (fade + slide)
- 🖱️ Efeitos hover interativos
- 📦 Cards com transições suaves
- 📱 Experiência fluida em dispositivos móveis

---

## 🚀 Funcionalidades

### 👤 Área do Cliente
- 📅 Agendamento online de serviços
- 💈 Visualização de serviços disponíveis
- 🛒 Carrinho de compras
- 🎟️ Aplicação de cupons
- 🔐 Sistema de login e cadastro
- 🔄 Remarcação de horários

---

### 🧑‍💼 Área Administrativa
- 📊 Dashboard administrativo
- 📋 Gerenciamento de agendamentos
- 👥 Controle de clientes
- 📌 Acompanhamento de pedidos em tempo real

---

### 💳 Pagamentos
- Integração com gateway **Cakto**
- 🧾 Criação de checkout automático
- 🔎 Verificação de status de pagamento
- 🔔 Webhook para atualização em tempo real

---

### 🔔 Automação
- Sistema de lembretes (estrutura pronta)
- Integração futura com **WhatsApp (Twilio)**

---

## 🎨 Sistema de Animações

| Tipo        | Descrição                                |
|------------|------------------------------------------|
| Fade In     | Elementos aparecem suavemente            |
| Slide Up    | Componentes sobem ao entrar na tela      |
| Hover       | Interações visuais ao passar o mouse     |
| Scale       | Efeito de zoom leve                      |

---

## ⚙️ Implementação das Animações

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
