# 🎮 8B Wheater — Previsão do Tempo 8-Bit Pixel Art

<div align="center">

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deploy-brightgreen?style=for-the-badge&logo=github)
![Status](https://img.shields.io/badge/Status-Online%20%26%20Ativo-22c55e?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-Pixel%20Art-1572B6?style=for-the-badge&logo=css3)
![HTML5](https://img.shields.io/badge/HTML5-Semântico-E34F26?style=for-the-badge&logo=html5)

<br />

### 🌐 [CLIQUE AQUI PARA ACESSAR A APLICAÇÃO ONLINE NO GITHUB PAGES](https://breno2274.github.io/8BWheater/)

**Link de Acesso Direto:** [https://breno2274.github.io/8BWheater/](https://breno2274.github.io/8BWheater/)

*(Disponível instantaneamente para navegadores Desktop e Celulares/Mobile, sem necessidade de instalação)*

</div>

---

## 🕹️ Sobre o Projeto

O **8B Wheater** é uma aplicação meteorológica front-end interativa desenvolvida com estética retrô inspirada em consoles clássicos portáteis dos anos 90 e no design contemporâneo de dispositivos como o *AYN Thor* (com botões de ação nas cores do *Super Famicom*).

A aplicação consome dados meteorológicos ao vivo de estações e satélites públicos globais, convertendo telemetria real em belos cenários procedurais em **Pixel Art SVG**, animações em camadas de CSS puro (chuva, neve, névoa, raios e tempestades) e síntese sonora chiptune em tempo real via **Web Audio API**.

---

## ✨ Principais Funcionalidades

- **🌐 Acesso Imediato via Web (GitHub Pages)**: Hospedado de forma 100% estática e otimizada, permitindo acesso universal via link direto em qualquer plataforma.
- **📍 Geolocalização Automática Inteligente**:
  - Detecção via GPS nativo do dispositivo com geocodificação reversa para identificar município e estado brasileiro.
  - Modal de integração inicial (Onboarding) com salvamento de preferências no `localStorage`.
- **🔍 Busca de Municípios com Autocomplete**:
  - Pesquisa rápida de qualquer cidade do Brasil e do mundo com sugestões instantâneas de capitais.
- **☀️ Cenários Climáticos Dinâmicos (16:9 em Pixel Art)**:
  - Arte vetorial SVG procedural renderizada em tempo real para: *Dia Ensolarado, Noite Estrelada, Dia Parcial, Noite Parcial, Nublado, Chuva Fraca, Chuva Moderada/Forte, Tempestade com Trovões, Neve, Nevoeiro e Pôr do Sol/Entardecer*.
- **🌅 Ciclo Solar e Pôr do Sol Astronômico**:
  - O sistema calcula os horários exatos de nascer e pôr do sol baseados na latitude/longitude da cidade. Durante a janela do crepúsculo (25 min antes até 20 min após o pôr do sol), o cenário transiciona suavemente para a paleta alaranjada do ocaso.
- **🌧️ Filtro e Limiar de Precipitação Real**:
  - Evita falsos positivos de chuva: precipitações de até 0.2 mm são interpretadas como umidade residual/nublado; efeitos de pingos só disparam quando há chuva real perceptível.
- **🔊 Sintetizador de Áudio Chiptune 8-Bit (Sem MP3)**:
  - Sons sintetizados matematicamente pelo navegador usando a **Web Audio API** nativa (osciladores `square`, `sawtooth` e filtros passa-baixa). Sem downloads de arquivos externos de áudio pesados.
- **📊 Telemetria Meteorológica Completa**:
  - Temperatura atual, sensação térmica, umidade relativa, velocidade do vento, pressão atmosférica (hPa) e índice de radiação UV com barra de risco.
  - Relatório horário das próximas 16 horas com gráfico em barras retrô.
  - Previsão estendida para os próximos 5 dias com temperaturas máximas e mínimas.
- **⭐ Favoritos & Histórico Local**:
  - Salve suas cidades prediletas e consulte seu histórico recente salvo no `localStorage`.
- **🎮 Simulador de Climas Integrado**:
  - Seletor rápido no topo para testar e demonstrar qualquer clima e efeito sonoro na hora, ideal para portfólio e testes.

---

## 📱 Design Responsivo Especializado (Mobile & Desktop)

O projeto conta com arquitetura visual independente para cada tipo de dispositivo:

| Aspecto | Versão Desktop | Versão Mobile (Smartphones & Tablets) |
| :--- | :--- | :--- |
| **Layout Geral** | Módulos lado a lado em tela panorâmica inspirada em estação console de mesa | Empilhamento vertical fluido com visual estilo videogame portátil retrô |
| **Controles de Topo** | Barra de ferramentas horizontal espaçosa | Grid ergonômico de 2 linhas (*Linha 1: Localização + Som lado a lado; Linha 2: Simulador*) |
| **Navegação** | Abas Super Famicom com atalhos físicos `(X, Y, B, A)` | Barra de status retrô `● 8-BIT RADAR` com botões táteis (36×36px) e menu gaveta |
| **Métricas Rápidas** | Badges com ícones e dados complementares | Grade de 3 colunas em **linha única**, liberando toda a visibilidade da arte pixel |
| **Cards de 5 Dias** | Visualização em grade expansiva com destaque | Lista vertical alinhada (`Dia \| Ícone \| Condição \| Mín/Máx`) |
| **Experiência ao Toque** | Efeitos de hover tridimensionais (relevo 3D) | Sem atraso de clique (`tap-highlight: transparent`), modais com rolagem suave |

---

## 📡 APIs e Fontes de Dados

O projeto consome exclusivamente serviços públicos e abertos, garantindo total transparência e funcionamento sem chaves de API pagas ou privadas:

| API / Serviço | Endpoint | Finalidade |
| :--- | :--- | :--- |
| **Open-Meteo Forecast** | `api.open-meteo.com/v1/forecast` | Telemetria meteorológica: temperaturas, umidade, vento, pressão, código WMO, radiação UV, ciclo solar e previsão para 5 dias. |
| **Open-Meteo Geocoding** | `geocoding-api.open-meteo.com/v1/search` | Mecanismo de busca geográfica mundial por nome de município e estado. |
| **OpenStreetMap Nominatim** | `nominatim.openstreetmap.org/reverse` | Geocodificação reversa precisa para detecção do nome do município via coordenadas GPS. |
| **BrasilAPI / CPTEC** | `brasilapi.com.br/api/cptec/v1` | Camada de contingência para dados climáticos de cidades brasileiras. |

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 Semântico**: Estruturação limpa, acessibilidade (WAI-ARIA) e metadados Open Graph.
- **CSS3 Puro (Vanilla CSS)**:
  - Efeitos em pixel art com relevos 3D mecânicos e bordas chanfradas.
  - Animações `@keyframes` (chuva, neve, neblina, flashes de relâmpagos e scanlines CRT).
  - Media queries sob medida para Desktop, Tablets, Smartphones e telas ultra-compactas.
- **JavaScript Moderno (ES6+)**:
  - Módulos ES6 e versão compilada `bundle.js` para suporte tanto a servidores web quanto ao protocolo local `file:///`.
  - Manipulação assíncrona com `async/await` e `fetch`.
- **Web Audio API**: Processamento e síntese sonora de chiptunes 8-bit em tempo real.
- **SVG Vetorial Procedural**: Todos os cenários e ícones desenhados em vetor para nitidez máxima em telas Retina e 4K.

---

## 📂 Estrutura de Arquivos

```text
8BWheater/
├── .github/
│   └── workflows/
│       └── deploy.yml    # Workflow de deploy automático para o GitHub Pages
├── index.html            # Ponto de entrada e estrutura HTML5
├── README.md             # Documentação técnica completa
├── css/
│   └── style.css         # Estilização completa, design system retrô e responsividade
├── js/
│   ├── api.js            # Módulo de consumo das APIs (Open-Meteo, Nominatim, BrasilAPI)
│   ├── weather.js        # Interpretador de códigos meteorológicos WMO e ciclo solar
│   ├── audio.js          # Síntese de áudio chiptune via Web Audio API
│   ├── storage.js        # Gerenciamento de favoritos e histórico no LocalStorage
│   ├── app.js            # Lógica central da aplicação, eventos e temporizadores
│   └── bundle.js         # Pacote unificado pronto para GitHub Pages e execução local
├── img/
│   ├── cenas/            # Cenários de clima em SVG (dia, noite, chuva, neve, tempestade, etc.)
│   ├── icones/           # Ícones das condições do tempo em pixel art
│   ├── ui/               # Ícones de interface (lupa, pin, som, atualizar, etc.)
│   ├── fx/               # Efeitos visuais e sobreposições
│   ├── logo.svg          # Logotipo 8-bit
│   └── favicon.svg       # Ícone de aba do navegador
└── scripts/
    └── gerar-arte.mjs    # Script procedural em Node.js para geração de assets vetoriais
```

---

## 🚀 Como Executar o Projeto

### Opção 1: Acessar Online (Recomendado)
Acesse diretamente pelo GitHub Pages sem precisar baixar nem configurar nada:
👉 **[https://breno2274.github.io/8BWheater/](https://breno2274.github.io/8BWheater/)**

### Opção 2: Executar Localmente
Como a aplicação é 100% estática, basta clonar o repositório e abrir:

```bash
# 1. Clone o repositório
git clone https://github.com/breno2274/8BWheater.git

# 2. Acesse a pasta do projeto
cd 8BWheater

# 3. Abra diretamente o index.html no navegador:
# No Windows:
start index.html

# Ou execute com um servidor local simples:
# Com Node.js
npx serve .

# Ou com Python 3
python -m http.server 8080
```

---

## 🌐 Publicação no GitHub Pages

O projeto está configurado para publicação no **GitHub Pages**:

1. **Deploy Automático por GitHub Actions**:
   - Cada atualização enviada aos branches `main` ou `feat/atualizacao/doc` dispara a action `.github/workflows/deploy.yml`.
   - O GitHub publica automaticamente os artefatos estáticos no ambiente de produção.
2. **Branch Alternativa `gh-pages`**:
   - Também é mantida a branch `gh-pages` para suporte nativo imediato caso a opção clássica de deploy por branch esteja selecionada nas configurações do repositório (*Settings > Pages*).

---

## 👨‍💻 Autor

Desenvolvido por **Breno Santana**:

- **GitHub**: [@breno2274](https://github.com/breno2274)
- **LinkedIn**: [Breno Santana](https://www.linkedin.com/in/breno-dos-santos-santana-2723a4213/)

---

<div align="center">
  <sub>Construído com café, código limpo e amor aos jogos clássicos de 8-Bit. 🕹️☁️</sub>
</div>
