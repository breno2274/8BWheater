# 8B Wheater — Previsão do Tempo 8-Bit Pixel Art

Aplicação web de previsão do tempo desenvolvida com estética retrô de jogos 8-bit. O sistema consome dados meteorológicos em tempo real, mapeia condições atmosféricas para cenários dinâmicos em SVG e renderiza efeitos climáticos com animações em CSS puro e áudio sintetizado via Web Audio API.

---

## Como Funciona o Sistema

O 8B Wheater opera como uma aplicação de tela única que conecta dados meteorológicos reais à interface visual:

1. **Definição de Localização**:
   - Na primeira abertura, o usuário pode buscar qualquer cidade do Brasil e do mundo ou autorizar o GPS do navegador.
   - A cidade escolhida fica salva no `localStorage`, carregando direto nas próximas visitas.
   - O histórico de buscas recentes e favoritos (★) também são armazenados localmente.

2. **Interpretação Meteorológica (`WeatherInterpreter`)**:
   - Converte os códigos numéricos padrão da OMM (WMO Weather Interpretation Codes) em descrições em português, ícones e cenários correspondentes.
   - **Filtro de Precipitação Real**: Valores de precipitação até 0.2 mm são tratados como traços de umidade (tempo nublado, sem disparar pingos de chuva na tela). Apenas precipitações acima desse limiar ativam os efeitos de chuva (fraca ou moderada/forte).
   - **Ciclo Solar e Pôr do Sol**: O sistema compara o relógio local com os horários de nascer e pôr do sol calculados para as coordenadas da cidade. Durante a janela do ocaso (25 minutos antes a 20 minutos após o pôr do sol), o cenário transiciona automaticamente para o pôr do sol, adaptando os efeitos visuais caso esteja chovendo.

3. **Atualização Automática Contínua**:
   - O aplicativo roda um temporizador em segundo plano que consulta os dados da estação meteorológica a cada **1 minuto (60 segundos)**.
   - Se a temperatura ou a condição climática mudar, os cenários, gráficos e efeitos são atualizados na tela e um aviso retrô (toast) notifica a alteração.
   - Um botão manual de atualização permite forçar a checagem imediata a qualquer momento.

4. **Sintetizador Chiptune Retrô (Web Audio API)**:
   - Os efeitos sonoros (bips de navegação, cliques, jingle de inicialização e trovões) são sintetizados em tempo real pelo navegador usando osciladores (`square`, `sawtooth` e filtros passa-baixa), sem necessidade de carregar arquivos externos de áudio (MP3/WAV).
   - Controle de áudio (ON/OFF) integrado no cabeçalho com persistência no navegador.

---

## 📡 APIs e Fontes de Dados

O projeto consome APIs públicas abertas e gratuitas, sem necessidade de chaves privadas expostas no front-end:

| Serviço | Endpoint Principal | Finalidade |
| :--- | :--- | :--- |
| **Open-Meteo Forecast** | `api.open-meteo.com/v1/forecast` | Telemetria em tempo real: temperatura do ar, sensação térmica, umidade relativa, velocidade do vento, pressão atmosférica, código WMO, índice UV, horários de nascer/pôr do sol e previsão horária e diária (5 dias). |
| **Open-Meteo Geocoding** | `geocoding-api.open-meteo.com/v1/search` | Busca de municípios por nome com coordenadas geográficas (latitude/longitude), estado e país. |
| **OpenStreetMap / Nominatim** | `nominatim.openstreetmap.org/reverse` | Geocodificação reversa para identificar o nome da cidade e estado a partir do GPS nativo do dispositivo. |
| **BrasilAPI / CPTEC** | `brasilapi.com.br/api/cptec/v1` | Camada de redundância/fallback para cidades brasileiras caso os serviços principais fiquem indisponíveis. |

---

## Tecnologias e Linguagens

Construído 100% com tecnologias nativas da web, sem frameworks pesados ou dependências de build:

- **HTML5**: Estrutura semântica, metadados Open Graph e tags de acessibilidade (ARIA).
- **CSS3 Puro (Vanilla CSS)**:
  - Design system em pixel art (bordas com box-shadows pixeladas, tipografia retrô, paleta de cores temática).
  - Animações CSS com `@keyframes` para chuva, tempestade com flashes de raios, nuvens em movimento e efeito de scanlines (filtro CRT).
  - Layout flexbox e CSS grid responsivo para telas desktop e dispositivos móveis.
- **JavaScript Moderno (ES6+)**:
  - Manipulação de DOM e requisições assíncronas com `fetch` e `async/await`.
  - Estrutura modular (`api.js`, `weather.js`, `audio.js`, `storage.js`, `app.js`) e versão unificada (`bundle.js`) para funcionar tanto em servidores HTTP quanto via protocolo local (`file:///`).
- **Web Audio API**: Geração procedural de áudio 8-bit diretamente pelo processador de som do navegador.
- **SVG (Scalable Vector Graphics)**: Cenários e ícones pixelados desenhados em vetor, permitindo escala nítida em qualquer resolução de tela sem perda de qualidade.

---

## Estrutura do Projeto

```
8Bwheater/
├── index.html            # Estrutura principal da interface
├── README.md             # Documentação técnica do sistema
├── css/
│   └── style.css         # Folha de estilos, design system e animações
├── js/
│   ├── api.js            # Integração com Open-Meteo, Nominatim e BrasilAPI
│   ├── weather.js        # Interpretador WMO, limiares de chuva e ciclo solar
│   ├── audio.js          # Síntese sonora chiptune via Web Audio API
│   ├── storage.js        # Gerenciamento de preferências no LocalStorage
│   ├── app.js            # Inicialização, eventos de UI e temporizador de atualização
│   └── bundle.js         # Código unificado para compatibilidade local e servidores
├── img/
│   ├── cenas/            # Cenários de dia, noite, chuva, neve, tempestade e entardecer
│   ├── icones/           # Ícones pixel art de condições do tempo (16x16)
│   ├── ui/               # Ícones de interface (lupa, pin, som, atualizar, etc.)
│   ├── fx/               # Camadas e máscaras para efeitos visuais
│   ├── logo.svg          # Logotipo vetorial
│   └── favicon.svg       # Favicon em pixel art
└── scripts/
    └── gerar-arte.mjs    # Script auxiliar Node.js para geração de assets SVG
```

---

## Como Executar Localmente

Como o projeto é totalmente estático, você pode executá-lo de duas formas:

### 1. Abertura Direta
Basta dar um duplo clique no arquivo `index.html` ou abri-lo no seu navegador. O arquivo `js/bundle.js` garante compatibilidade direta sem bloqueios de CORS por módulos.

### 2. Com Servidor Local
Se preferir rodar em um servidor de desenvolvimento:

```bash
# Com Node.js
npx serve .

# Ou com Python 3
python -m http.server 8080
```

Acesse no navegador pelo endereço `http://localhost:8080`.
