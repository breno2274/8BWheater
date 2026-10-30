# 8B Wheater — Previsão do Tempo em Pixel Art

Aplicação web de previsão do tempo desenvolvida em JavaScript puro, CSS e HTML, com estética retrô inspirada em consoles clássicos portáteis (como Game Boy e Super Famicom). O projeto consome dados meteorológicos em tempo real por meio de APIs públicas abertas, mapeia as condições para cenários vetoriais em pixel art (SVG) e processa efeitos visuais e sonoros diretamente no navegador.

## Acesso Online (GitHub Pages)

A aplicação está hospedada e disponível para acesso direto pelo GitHub Pages no seguinte endereço:

**https://breno2274.github.io/8BWheater/**

O site é totalmente estático e responsivo, funcionando tanto em navegadores de computadores desktop quanto em smartphones e tablets.

---

## Funcionalidades

- **Acesso direto via navegador**: Hospedagem estática pelo GitHub Pages, sem necessidade de instalação ou login.
- **Geolocalização via GPS**: Identificação automática do município e estado do usuário utilizando a API de geolocalização do navegador e geocodificação reversa.
- **Busca de cidades**: Campo de pesquisa com autocompletar para qualquer localidade brasileira ou mundial, com atalhos para capitais.
- **Cenários dinâmicos em SVG**: Ilustrações em pixel art que mudam de acordo com as condições do tempo (dia ensolarado, noite estrelada, nublado, chuva fraca, chuva forte, tempestade, neve, neblina e pôr do sol).
- **Cálculo de ciclo solar**: Transição automática para o cenário de pôr do sol baseada nos horários calculados de nascer e pôr do sol para as coordenadas locais.
- **Filtro de precipitação real**: Valores de precipitação abaixo de 0.2 mm são tratados como umidade residual/nublado, disparando efeitos de chuva apenas quando há volume real de chuva.
- **Áudio chiptune procedural**: Sons sintetizados em tempo real com a Web Audio API (usando osciladores e filtros), sem uso de arquivos de áudio externos (MP3 ou WAV).
- **Telemetria meteorológica**:
  - Temperatura atual e sensação térmica.
  - Umidade relativa do ar, velocidade do vento e pressão atmosférica.
  - Índice UV com barra de classificação.
  - Horários de nascer e pôr do sol.
  - Gráfico de previsão horária para as próximas 16 horas.
  - Previsão estendida para os próximos 5 dias com temperaturas máxima e mínima.
- **Favoritos e histórico local**: Persistência de preferências e buscas anteriores no localStorage do navegador.
- **Simulador de clima**: Menu suspenso para alternar manualmente entre qualquer condição de clima e testar os cenários e sons.

---

## Design e Responsividade

A interface foi projetada para funcionar em duas disposições principais:

- **Desktop**: Layout inspirado em um console de mesa widescreen, com moldura de proteção, barra de controles com botões de ação e painel lateral com sensores e previsão estendida de 5 dias.
- **Mobile**: Layout vertical empilhado, com controles adaptados para toque (área mínima de toque de 36px), barra de ferramentas compacta em duas linhas e métricas essenciais em linha única para não cobrir a arte do cenário.

---

## APIs Utilizadas

O projeto utiliza apenas endpoints públicos gratuitos e que não exigem chaves privadas no código client-side:

| Serviço | Endpoint | Finalidade |
| :--- | :--- | :--- |
| Open-Meteo Forecast | api.open-meteo.com/v1/forecast | Temperatura, sensação térmica, umidade, vento, pressão, código WMO, índice UV e previsões horária e diária. |
| Open-Meteo Geocoding | geocoding-api.open-meteo.com/v1/search | Busca e autocompletar de cidades por nome com coordenadas geográficas. |
| OpenStreetMap Nominatim | nominatim.openstreetmap.org/reverse | Geocodificação reversa para obter nome do município a partir das coordenadas do GPS. |
| BrasilAPI / CPTEC | brasilapi.com.br/api/cptec/v1 | Serviço alternativo de consulta meteorológica para municípios brasileiros. |

---

## Tecnologias

- **HTML5**: Estrutura semântica e acessibilidade.
- **CSS3**: Estilos customizados, layout flexbox/grid, animações via keyframes para efeitos climáticos e responsividade por media queries.
- **JavaScript (ES6+)**: Consumo de APIs via Fetch, manipulação de DOM e versionamento modular/unificado (`bundle.js`).
- **Web Audio API**: Síntese de áudio procedural para os efeitos sonoros da interface.
- **SVG**: Gráficos vetoriais renderizados em formato pixel art para garantir nitidez em qualquer resolução.

---

## Estrutura do Projeto

```
8BWheater/
├── .github/
│   └── workflows/
│       └── deploy.yml    # Workflow de publicação automática no GitHub Pages
├── index.html            # Estrutura HTML da página
├── README.md             # Documentação do projeto
├── css/
│   └── style.css         # Folha de estilos e regras responsivas
├── js/
│   ├── api.js            # Integração com as APIs externas
│   ├── weather.js        # Interpretação dos códigos de clima e ciclo solar
│   ├── audio.js          # Síntese sonora com Web Audio API
│   ├── storage.js        # Persistência de dados no localStorage
│   ├── app.js            # Lógica geral da aplicação e eventos de interface
│   └── bundle.js         # Código unificado para execução direta
├── img/
│   ├── cenas/            # Cenários de clima em SVG
│   ├── icones/           # Ícones das condições climáticas
│   ├── ui/               # Ícones da interface
│   ├── fx/               # Efeitos gráficos sobrepostos
│   ├── logo.svg          # Logotipo
│   └── favicon.svg       # Favicon
└── scripts/
    └── gerar-arte.mjs    # Script auxiliar em Node.js para geração dos vetores
```

---

## Como Executar Localmente

Como a aplicação é puramente estática e não possui dependências de compilação, é possível executá-la diretamente:

### 1. Abertura direta
Basta abrir o arquivo `index.html` em qualquer navegador. O arquivo `js/bundle.js` permite a execução pelo protocolo `file:///` sem restrições de CORS de módulos ES.

### 2. Com servidor local
Se preferir rodar por um servidor HTTP:

```bash
# Com Node.js
npx serve .

# Ou com Python 3
python -m http.server 8080
```

Em seguida, acesse no navegador pelo endereço `http://localhost:8080`.

---

## Publicação no GitHub Pages

O deploy é configurado de duas formas no repositório:

1. **GitHub Actions**: O arquivo `.github/workflows/deploy.yml` compila e publica os arquivos estáticos a cada push nas branches configuradas.
2. **Branch gh-pages**: Uma branch dedicada (`gh-pages`) está publicada no repositório para deploy direto pelas configurações de Pages do GitHub (Settings > Pages > Deploy from a branch > gh-pages / root).

---

## Autor

Desenvolvido por **Breno Santana**:
- GitHub: https://github.com/breno2274
- LinkedIn: https://www.linkedin.com/in/breno-dos-santos-santana-2723a4213/
