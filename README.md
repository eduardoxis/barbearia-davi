<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Barbearia do Davi</title>

<style>
body {
  margin: 0;
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(120deg, #000000, #0f0f0f);
  color: #fff;
}

/* HERO */
.hero {
  padding: 80px 40px;
  background: radial-gradient(circle at left, #1a0000, #000);
}

.hero h1 {
  font-size: 60px;
  margin: 0;
  font-weight: 900;
}

.hero span {
  color: #ef4444;
}

.hero p {
  color: #9ca3af;
  margin-top: 10px;
}

/* BOTÕES */
.buttons {
  margin-top: 20px;
}

.btn {
  padding: 12px 20px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  margin-right: 10px;
  transition: 0.3s;
}

.btn-red {
  background: #ef4444;
  color: white;
}

.btn-red:hover {
  background: #dc2626;
  transform: scale(1.05);
}

.btn-outline {
  background: transparent;
  border: 1px solid #444;
  color: white;
}

.btn-outline:hover {
  border-color: #ef4444;
}

/* SEÇÃO */
.section {
  padding: 40px;
}

.section h2 {
  font-size: 32px;
}

.section span {
  color: #ef4444;
}

/* GRID */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

/* CARD */
.card {
  background: linear-gradient(145deg, #111, #1a1a1a);
  border: 1px solid #222;
  border-radius: 12px;
  padding: 20px;

  opacity: 0;
  transform: translateY(40px);
  transition: all 0.5s ease;
}

/* ANIMAÇÃO */
.card.show {
  opacity: 1;
  transform: translateY(0);
}

/* HOVER */
.card:hover {
  border-color: #ef4444;
  transform: translateY(-8px);
  box-shadow: 0 0 25px rgba(239,68,68,0.3);
}

/* ÍCONE */
.icon {
  font-size: 30px;
  margin-bottom: 15px;
}

/* TITULO */
.card h3 {
  margin: 0;
  font-size: 18px;
}

/* PREÇO */
.price {
  color: #ef4444;
  font-weight: bold;
  margin: 10px 0;
}

/* BOTÃO CARD */
.card button {
  width: 100%;
  background: #ef4444;
  border: none;
  padding: 10px;
  color: white;
  cursor: pointer;
  transition: 0.3s;
}

.card button:hover {
  background: #dc2626;
}

/* STATUS */
.status {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
}
</style>
</head>

<body>

<!-- HERO -->
<div class="hero">
  <h1>BARBEARIA <span>DO DAVI</span></h1>
  <p>Vila Guará · Luziânia - GO</p>

  <div class="buttons">
    <button class="btn btn-red">Ver Serviços</button>
    <button class="btn btn-outline">Agendar Horário</button>
  </div>
</div>

<!-- SERVIÇOS -->
<div class="section">
  <h2>MONTE SEU <span>PEDIDO</span></h2>
  <p style="color:#9ca3af;">Escolha um ou mais serviços</p>

  <div class="grid">

    <div class="card">
      <div class="icon">✂️</div>
      <h3>Degradê Navalhado</h3>
      <div class="price">R$ 28</div>
      <button>Adicionar</button>
      <div class="status">⏱ 30 min</div>
    </div>

    <div class="card">
      <div class="icon">⚡</div>
      <h3>Degradê</h3>
      <div class="price">R$ 25</div>
      <button>Adicionar</button>
      <div class="status">⏱ 25 min</div>
    </div>

    <div class="card">
      <div class="icon">✂️</div>
      <h3>Corte Clássico</h3>
      <div class="price">R$ 20</div>
      <button>Adicionar</button>
      <div class="status">⏱ 20 min</div>
    </div>

    <div class="card">
      <div class="icon">💈</div>
      <h3>Corte + Barba</h3>
      <div class="price">R$ 35</div>
      <button>Adicionar</button>
      <div class="status">⏱ 40 min</div>
    </div>

  </div>
</div>

<script>
const cards = document.querySelectorAll('.card');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
    }
  });
}, { threshold: 0.2 });

cards.forEach(card => observer.observe(card));
</script>

</body>
</html>
