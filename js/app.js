/**
 * 8B Wheater — Controlador Principal da Aplicação (Tela Única Responsiva)
 * ------------------------------------------------------------------------
 * Coordena o fluxo de localização obrigatória na primeira visita,
 * persistência em LocalStorage, dados da Open-Meteo API, efeitos de áudio
 * chiptune, simulador de clima e transições visuais em pixel art.
 */

import { Storage } from './storage.js';
import { AudioFX } from './audio.js';
import { WeatherAPI } from './api.js';
import { WeatherInterpreter } from './weather.js';

// Estado global da aplicação
const Estado = {
  cidadeAtual: null,
  dadosClima: null,
  config: Storage.obterConfiguracoes(),
  temporizadorRaio: null,
  modoSimulacao: null
};

// Cache de elementos do DOM
const DOM = {
  // Controles do Topo
  btnTrocarLocal: document.getElementById('btnTrocarLocal'),
  selectSimulador: document.getElementById('selectSimulador'),
  btnToggleSom: document.getElementById('btnToggleSom'),

  // Navegação da Janela
  navBtns: document.querySelectorAll('.nav-btn'),
  btnMobileMenu: document.getElementById('btnMobileMenu'),
  mobileDropdownMenu: document.getElementById('mobileDropdownMenu'),
  mobileNavLinks: document.querySelectorAll('.mobile-nav-link'),
  btnAtualizarTempo: document.getElementById('btnAtualizarTempo'),
  btnCompartilhar: document.getElementById('btnCompartilhar'),

  // Busca Principal
  inputBuscaCidade: document.getElementById('inputBuscaCidade'),
  btnGpsBusca: document.getElementById('btnGpsBusca'),
  dropdownResultadosBusca: document.getElementById('dropdownResultadosBusca'),

  // Cenário de Clima & HUD
  mainStageContainer: document.getElementById('mainStageContainer'),
  viewportClima: document.getElementById('viewportClima'),
  shelfPrevisao: document.getElementById('shelfPrevisao'),
  imgCenaCanvas: document.getElementById('imgCenaCanvas'),
  hudNomeCidade: document.getElementById('hudNomeCidade'),
  btnFavoritar: document.getElementById('btnFavoritar'),
  hudValorTemp: document.getElementById('hudValorTemp'),
  hudUnidadeTemp: document.getElementById('hudUnidadeTemp'),
  hudNomeCondicao: document.getElementById('hudNomeCondicao'),
  hudSensacaoTermica: document.getElementById('hudSensacaoTermica'),
  hudUmidade: document.getElementById('hudUmidade'),
  hudVento: document.getElementById('hudVento'),
  hudPrecipitacao: document.getElementById('hudPrecipitacao'),
  btnPressStart: document.getElementById('btnPressStart'),

  // Estação Lateral de Telemetria
  sideUv: document.getElementById('sideUv'),
  sideUvBar: document.getElementById('sideUvBar'),
  sidePressao: document.getElementById('sidePressao'),
  sideNascer: document.getElementById('sideNascer'),
  sidePor: document.getElementById('sidePor'),
  btnSideDetalhes: document.getElementById('btnSideDetalhes'),

  // Efeitos Visuais
  fxChuvaFraca: document.getElementById('fxChuvaFraca'),
  fxChuva: document.getElementById('fxChuva'),
  fxChuvaForte: document.getElementById('fxChuvaForte'),
  fxNeve: document.getElementById('fxNeve'),
  fxNevoa: document.getElementById('fxNevoa'),
  fxRaio: document.getElementById('fxRaio'),

  // Grade de 5 Dias
  gridPrevisao5Dias: document.getElementById('gridPrevisao5Dias'),

  // Painéis de Abas
  abaPainelSalvos: document.getElementById('abaPainelSalvos'),
  abaPainelHistorico: document.getElementById('abaPainelHistorico'),
  containerLocaisSalvos: document.getElementById('containerLocaisSalvos'),
  containerHistorico: document.getElementById('containerHistorico'),
  btnLimparHistorico: document.getElementById('btnLimparHistorico'),

  // Modal Obrigatório de Onboarding (Primeira Visita)
  onboardingModal: document.getElementById('onboardingModal'),
  btnOnboardingGps: document.getElementById('btnOnboardingGps'),
  inputOnboardingBusca: document.getElementById('inputOnboardingBusca'),
  dropdownOnboardingResultados: document.getElementById('dropdownOnboardingResultados'),
  chipsCidades: document.querySelectorAll('.chip-btn'),

  // Modal de Detalhes
  modalDetalhes: document.getElementById('modalDetalhes'),
  modalDetalhesTitulo: document.getElementById('modalDetalhesTitulo'),
  btnFecharDetalhes: document.getElementById('btnFecharDetalhes'),
  detSensacao: document.getElementById('detSensacao'),
  detUmidade: document.getElementById('detUmidade'),
  detVento: document.getElementById('detVento'),
  detPrecip: document.getElementById('detPrecip'),
  detPressao: document.getElementById('detPressao'),
  detUv: document.getElementById('detUv'),
  detNascer: document.getElementById('detNascer'),
  detPor: document.getElementById('detPor'),
  containerBarrasHorarias: document.getElementById('containerBarrasHorarias'),

  // Toast
  toastNotificacao: document.getElementById('toastNotificacao'),
  toastTexto: document.getElementById('toastTexto')
};

/* ==========================================================================
   INICIALIZAÇÃO & VERIFICAÇÃO DE LOCALIZAÇÃO OBRIGATÓRIA
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 8B Wheater inicializado em tela única...');

  aplicarConfiguracoesIniciais();
  vincularEventos();

  // Inicia o ciclo de atualização meteorológica automática a cada 1 minuto (60s)
  iniciarAutoAtualizacao();

  // Verifica se o usuário já tem uma localização definida no localStorage
  if (Storage.temLocalizacaoDefinida()) {
    const cidadeSalva = Storage.obterLocalizacaoUsuario();
    await carregarClima(cidadeSalva);
  } else {
    // PRIMEIRA VEZ: Carrega cidade padrão no fundo para preencher o console e abre o modal
    await carregarClima({ nome: 'Brasília', estado: 'DF', lat: -15.7801, lon: -47.9292, pais: 'Brasil' });
    abrirModalOnboarding();
  }

  // Toca o boot sound no primeiro clique de interação na página
  document.body.addEventListener('click', () => {
    AudioFX.boot();
  }, { once: true });
});

/* ==========================================================================
   ATUALIZAÇÃO AUTOMÁTICA CONTÍNUA (1 MINUTO)
   ========================================================================== */
let timerAutoAtualizacao = null;
function iniciarAutoAtualizacao() {
  if (timerAutoAtualizacao) clearInterval(timerAutoAtualizacao);

  // Executa checagem e atualização do clima a cada 1 minuto (60.000 ms)
  timerAutoAtualizacao = setInterval(async () => {
    // Se o usuário estiver simulando manualmente pelo dropdown, não sobrescreve com a API real
    if (Estado.modoSimulacao) {
      renderizarDadosClima();
      return;
    }

    if (Estado.cidadeAtual) {
      console.log('⏰ [8B Wheater] Atualizando clima automaticamente (ciclo de 1 minuto)...');
      await carregarClima(Estado.cidadeAtual, true);
    }
  }, 60000);
}

/* ==========================================================================
   CONFIGURAÇÕES GERAIS
   ========================================================================== */
function aplicarConfiguracoesIniciais() {
  AudioFX.definirAtivo(Estado.config.somAtivo);
  atualizarBotaoSom();
}

function alternarSom() {
  Estado.config.somAtivo = !Estado.config.somAtivo;
  AudioFX.definirAtivo(Estado.config.somAtivo);
  Storage.salvarConfiguracoes({ somAtivo: Estado.config.somAtivo });
  atualizarBotaoSom();
  if (Estado.config.somAtivo) {
    AudioFX.bip();
    exibirToast('Sons 8-Bit ativados');
  } else {
    exibirToast('Sons desativados');
  }
}

function atualizarBotaoSom() {
  if (DOM.btnToggleSom) {
    const icone = Estado.config.somAtivo ? 'img/ui/som.svg' : 'img/ui/som-off.svg';
    const texto = Estado.config.somAtivo ? 'Som: ON' : 'Som: OFF';
    DOM.btnToggleSom.innerHTML = `<img src="${icone}" class="header-btn-icon" alt="" /> <span id="txtSom">${texto}</span>`;
    DOM.btnToggleSom.classList.toggle('som-desativado', !Estado.config.somAtivo);
  }
}

/* ==========================================================================
   MODAL OBRIGATÓRIO DE PRIMEIRA VISITA (ONBOARDING)
   ========================================================================== */
function abrirModalOnboarding() {
  DOM.onboardingModal.classList.add('aberto');
  setTimeout(() => {
    DOM.inputOnboardingBusca?.focus();
  }, 200);
}

function fecharModalOnboarding() {
  DOM.onboardingModal.classList.remove('aberto');
}

async function definirLocalizacaoInicialViaGps() {
  AudioFX.clique();
  exibirToast('Conectando ao sinal GPS...');

  try {
    const coords = await WeatherAPI.obterGeolocalizacaoAtual();
    const infoCidade = await WeatherAPI.obterNomePorCoordenadas(coords.lat, coords.lon);

    Storage.salvarLocalizacaoUsuario(infoCidade);
    fecharModalOnboarding();
    await carregarClima(infoCidade);
    exibirToast(`Localização definida: ${infoCidade.nome}!`);
  } catch (erro) {
    console.warn('Erro GPS:', erro);
    exibirToast('Não foi possível obter GPS. Por favor, escolha na busca.');
  }
}

async function selecionarCidade(cidade, salvarComoPadrao = true) {
  AudioFX.clique();
  if (salvarComoPadrao) {
    Storage.salvarLocalizacaoUsuario(cidade);
  } else {
    Storage.adicionarHistorico(cidade);
  }

  fecharModalOnboarding();
  await carregarClima(cidade);
  exibirToast(`Localização definida: ${cidade.nome}!`);
}

/* ==========================================================================
   CARREGAMENTO & RENDERIZAÇÃO DO CLIMA
   ========================================================================== */
async function carregarClima(cidade, silencioso = false) {
  if (!cidade || (!cidade.nome && cidade.lat === undefined)) return;

  Estado.cidadeAtual = cidade;
  if (!silencioso) {
    DOM.hudNomeCidade.textContent = 'Carregando INMET...';
  }

  try {
    const dados = await WeatherAPI.obterPrevisao(cidade);
    const condicaoAnterior = Estado.dadosClima?.atual?.codigoClima;
    const tempAnterior = Estado.dadosClima?.atual?.temperatura;

    Estado.dadosClima = dados;
    Estado.modoSimulacao = null;
    if (DOM.selectSimulador) DOM.selectSimulador.value = '';

    renderizarDadosClima();

    if (!silencioso) {
      AudioFX.bip();
    } else {
      // Notifica o usuário caso a condição do tempo ou temperatura mude durante o ciclo
      if (condicaoAnterior !== undefined && (condicaoAnterior !== dados.atual.codigoClima || tempAnterior !== dados.atual.temperatura)) {
        exibirToast(`Tempo atualizado: ${dados.atual.condicaoDesc || 'Nova condição'}`);
      }
    }
  } catch (e) {
    console.error('Falha ao obter previsão:', e);
    if (!silencioso) {
      exibirToast('Erro de conexão. Ativando modo offline.');
    }
  }
}

function renderizarDadosClima() {
  if (!Estado.cidadeAtual || !Estado.dadosClima) return;

  const atual = Estado.dadosClima.atual;

  // Contexto para avaliação dinâmica de Pôr do Sol e Intensidade de Chuva
  const contexto = {
    porDoSol: Estado.dadosClima.porDoSol,
    nascerDoSol: Estado.dadosClima.nascerDoSol,
    precipitacaoMm: atual.precipitacaoMm,
    horaAtual: new Date(),
    forcarEntardecer: (typeof Estado.modoSimulacao === 'string' && Estado.modoSimulacao.startsWith('entardecer')) || atual.codigoClima === 800,
    forcarDiaNoite: Boolean(Estado.modoSimulacao)
  };

  const interp = WeatherInterpreter.interpretar(atual.codigoClima, atual.isDay, contexto);

  // 1. Título e Local (Prioriza formato Cidade (UF))
  const textoCidade = Estado.cidadeAtual.estado
    ? `${Estado.cidadeAtual.nome} (${Estado.cidadeAtual.estado})`
    : (Estado.cidadeAtual.pais ? `${Estado.cidadeAtual.nome}, ${Estado.cidadeAtual.pais}` : Estado.cidadeAtual.nome);

  DOM.hudNomeCidade.textContent = textoCidade;

  // 2. Temperaturas (Sempre em Celsius)
  const tempFmt = WeatherInterpreter.formatarTemp(atual.temperatura);
  const sensacaoFmt = WeatherInterpreter.formatarTemp(atual.sensacao);

  DOM.hudValorTemp.textContent = tempFmt.replace('°C', '°');
  DOM.hudUnidadeTemp.textContent = '°C';
  DOM.hudNomeCondicao.textContent = interp.nome;
  DOM.hudSensacaoTermica.textContent = `Sensação térmica ${sensacaoFmt}`;

  // 3. Mini Métricas
  DOM.hudUmidade.textContent = `${atual.umidade}%`;
  DOM.hudVento.textContent = `${atual.ventoKmH} km/h`;
  DOM.hudPrecipitacao.textContent = `${atual.precipitacaoMm} mm`;

  // 4. Ícone de Favorito
  const isFav = Storage.isFavorito(Estado.cidadeAtual);
  DOM.btnFavoritar.innerHTML = isFav ? '★' : '☆';
  DOM.btnFavoritar.style.color = isFav ? '#ffd23f' : '#b0a4d4';
  DOM.btnFavoritar.title = isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos';

  // 5. Atualiza a cena e os efeitos
  atualizarCenaVisual(interp);

  // 6. Previsão de 5 Dias
  renderizarPrevisao5Dias();

  // 7. Telemetria da Estação Lateral (UV, Pressão, Sol)
  atualizarTelemetriaLateral();
}

function atualizarTelemetriaLateral() {
  if (!Estado.dadosClima) return;
  const dados = Estado.dadosClima;
  const atual = dados.atual;

  if (DOM.sideUv) DOM.sideUv.textContent = `${dados.uvIndice !== undefined ? dados.uvIndice : '--'} / 11`;
  if (DOM.sideUvBar) {
    const uvVal = Number(dados.uvIndice) || 0;
    const pct = Math.min(100, Math.max(8, Math.round((uvVal / 11) * 100)));
    DOM.sideUvBar.style.width = `${pct}%`;
  }
  if (DOM.sidePressao) DOM.sidePressao.textContent = `${atual.pressaoHpa || 1013} hPa`;
  if (DOM.sideNascer) DOM.sideNascer.textContent = dados.nascerDoSol || '--:--';
  if (DOM.sidePor) DOM.sidePor.textContent = dados.porDoSol || '--:--';
}

function atualizarCenaVisual(interp) {
  const caminhoCena = `img/cenas/${interp.cena}.svg`;
  const caminhoAtual = DOM.imgCenaCanvas.getAttribute('src');

  if (caminhoAtual !== caminhoCena) {
    DOM.imgCenaCanvas.style.opacity = '0.2';
    const novaImg = new Image();
    novaImg.src = caminhoCena;
    novaImg.onload = () => {
      DOM.imgCenaCanvas.src = caminhoCena;
      DOM.imgCenaCanvas.style.opacity = '1';
    };
  } else {
    DOM.imgCenaCanvas.style.opacity = '1';
  }

  // Efeitos CSS Atmosféricos
  DOM.fxChuvaFraca?.classList.toggle('ativo', Boolean(interp.efeitos.chuvaFraca));
  DOM.fxChuva.classList.toggle('ativo', Boolean(interp.efeitos.chuva));
  DOM.fxChuvaForte.classList.toggle('ativo', Boolean(interp.efeitos.chuvaForte));
  DOM.fxNeve.classList.toggle('ativo', Boolean(interp.efeitos.neve));
  DOM.fxNevoa.classList.toggle('ativo', Boolean(interp.efeitos.nevoa));
  DOM.fxNevoa.classList.toggle('ativo', Boolean(interp.efeitos.nevoa));

  // Raios e Trovões
  gerenciarRaios(Boolean(interp.efeitos.tempestade));
}

function gerenciarRaios(ativo) {
  if (Estado.temporizadorRaio) {
    clearInterval(Estado.temporizadorRaio);
    Estado.temporizadorRaio = null;
  }

  if (!ativo) return;

  const disparar = () => {
    DOM.fxRaio.classList.remove('flash');
    void DOM.fxRaio.offsetWidth; // trigger reflow
    DOM.fxRaio.classList.add('flash');

    setTimeout(() => {
      AudioFX.trovao();
    }, 180);
  };

  disparar();
  Estado.temporizadorRaio = setInterval(disparar, 7000 + Math.random() * 6000);
}

function renderizarPrevisao5Dias() {
  if (!Estado.dadosClima || !Estado.dadosClima.diario) return;

  const dias = Estado.dadosClima.diario;

  DOM.gridPrevisao5Dias.innerHTML = '';

  dias.forEach((dia, idx) => {
    const diaSemana = idx === 0 ? 'HOJE' : WeatherInterpreter.obterDiaSemana(dia.data);
    const interpDia = WeatherInterpreter.interpretar(dia.codigoClima, 1);

    const maxFmt = WeatherInterpreter.formatarTemp(dia.tempMax);
    const minFmt = WeatherInterpreter.formatarTemp(dia.tempMin);
    const probChuva = dia.probabilidadeChuva !== undefined 
      ? dia.probabilidadeChuva 
      : WeatherInterpreter.obterProbabilidadeChuva(dia.codigoClima, dia.precipitacaoMm);
    const temChuva = probChuva >= 30 || (dia.precipitacaoMm && dia.precipitacaoMm > 0);

    const card = document.createElement('div');
    card.className = `forecast-card-item ${idx === 0 ? 'ativo' : ''}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = `${diaSemana}: ${interpDia.nome} • Prob. Chuva: ${probChuva}% • Máx ${maxFmt} / Mín ${minFmt} (Clique para detalhes)`;
    card.innerHTML = `
      <div class="card-day-badge">
        <span class="day-name">${diaSemana}</span>
        ${idx === 0 ? '<span class="today-pill">ATUAL</span>' : ''}
      </div>
      <div class="card-icon-frame">
        <img class="card-weather-icon" src="img/icones/${interpDia.icone}.svg" alt="${interpDia.nome}" />
      </div>
      <div class="card-info-col">
        <div class="card-weather-name">${interpDia.nome}</div>
        <div class="card-rain-badge ${temChuva ? 'tem-chuva' : ''}">
          <img src="img/ui/gota.svg" class="card-rain-icon" alt="" />
          <span>${probChuva}%</span>
        </div>
      </div>
      <div class="card-temp-range">
        <div class="temp-unit-box max-box">
          <span class="temp-tag">MÁX</span>
          <span class="temp-max-val">${maxFmt.replace('°C', '°')}</span>
        </div>
        <span class="temp-sep">/</span>
        <div class="temp-unit-box min-box">
          <span class="temp-tag">MÍN</span>
          <span class="temp-min-val">${minFmt.replace('°C', '°')}</span>
        </div>
      </div>
    `;

    card.addEventListener('mouseenter', () => AudioFX.bip());
    card.addEventListener('click', () => {
      AudioFX.clique();
      abrirModalDetalhes();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        AudioFX.clique();
        abrirModalDetalhes();
      }
    });

    DOM.gridPrevisao5Dias.appendChild(card);
  });
}

/* ==========================================================================
   SIMULADOR DE CLIMA (Para o Portfólio)
   ========================================================================== */
function simularClima(tipo) {
  if (!tipo || tipo === 'tempo-real') {
    Estado.modoSimulacao = null;
    if (DOM.selectSimulador) DOM.selectSimulador.value = '';
    if (Estado.cidadeAtual) {
      carregarClima(Estado.cidadeAtual);
      exibirToast('Modo Tempo Real ativado!');
    }
    return;
  }

  AudioFX.clique();
  Estado.modoSimulacao = tipo;

  let codigo = 0;
  let isDay = 1;
  let temp = 24;
  let precip = 0;

  switch (tipo) {
    case 'dia-limpo':
      codigo = 0; isDay = 1; temp = 28; precip = 0; break;
    case 'noite-limpa':
      codigo = 0; isDay = 0; temp = 18; precip = 0; break;
    case 'dia-parcial':
      codigo = 2; isDay = 1; temp = 23; precip = 0; break;
    case 'noite-parcial':
      codigo = 2; isDay = 0; temp = 17; precip = 0; break;
    case 'dia-nublado':
      codigo = 3; isDay = 1; temp = 19; precip = 0; break;
    case 'noite-nublada':
      codigo = 3; isDay = 0; temp = 15; precip = 0; break;
    case 'chuva-fraca':
      codigo = 51; isDay = 1; temp = 20; precip = 1.2; break;
    case 'chuva-dia':
      codigo = 63; isDay = 1; temp = 18; precip = 5.2; break;
    case 'chuva-noite':
      codigo = 63; isDay = 0; temp = 16; precip = 4.8; break;
    case 'tempestade':
      codigo = 95; isDay = 0; temp = 17; precip = 12.0; break;
    case 'neve':
      codigo = 71; isDay = 1; temp = -2; precip = 0; break;
    case 'nevoa':
      codigo = 45; isDay = 1; temp = 13; precip = 0; break;
    case 'entardecer':
      codigo = 800; isDay = 1; temp = 22; precip = 0; break;
    case 'entardecer-chuva-leve':
      codigo = 51; isDay = 1; temp = 21; precip = 1.2; break;
    case 'entardecer-chuva':
      codigo = 63; isDay = 1; temp = 20; precip = 5.8; break;
    default:
      return;
  }

  if (!Estado.dadosClima) {
    const hoje = new Date();
    const formatarDataIso = (d) => d.toISOString().split('T')[0];
    Estado.cidadeAtual = Estado.cidadeAtual || { nome: 'São Paulo', estado: 'SP', pais: 'Brasil' };
    Estado.dadosClima = {
      atual: {
        temperatura: temp,
        sensacao: temp + 1,
        umidade: 62,
        ventoKmH: 14,
        precipitacaoMm: precip,
        pressaoHpa: 1014,
        codigoClima: codigo,
        isDay: isDay
      },
      diario: [0, 1, 2, 3, 4].map(offset => {
        const d = new Date(hoje);
        d.setDate(d.getDate() + offset);
        return {
          data: formatarDataIso(d),
          codigoClima: offset === 0 ? codigo : (offset % 2 === 0 ? 0 : 2),
          tempMax: temp + (offset === 0 ? 2 : 1),
          tempMin: temp - 5,
          precipitacaoMm: precip,
          probabilidadeChuva: offset === 0 
            ? (tipo.includes('tempestade') ? 95 : (precip > 0 ? 85 : (tipo.includes('nublado') ? 30 : (tipo.includes('parcial') ? 15 : 0))))
            : (offset % 2 === 0 ? 0 : 20)
        };
      }),
      horario: [],
      nascerDoSol: '05:45',
      porDoSol: '18:22',
      uvIndice: 7
    };
  } else {
    Estado.dadosClima.atual.codigoClima = codigo;
    Estado.dadosClima.atual.isDay = isDay;
    Estado.dadosClima.atual.temperatura = temp;
    Estado.dadosClima.atual.sensacao = temp + 1;
    Estado.dadosClima.atual.precipitacaoMm = precip;
    if (Estado.dadosClima.diario && Estado.dadosClima.diario[0]) {
      Estado.dadosClima.diario[0].codigoClima = codigo;
      Estado.dadosClima.diario[0].precipitacaoMm = precip;
      Estado.dadosClima.diario[0].probabilidadeChuva = tipo.includes('tempestade') 
        ? 95 
        : (precip > 0 ? 85 : (tipo.includes('nublado') ? 30 : (tipo.includes('parcial') ? 15 : 0)));
    }
  }
  renderizarDadosClima();
  exibirToast(`Simulação ativada: ${tipo.replace(/-/g, ' ').toUpperCase()}`);
}

/* ==========================================================================
   MODAL DE DETALHES RETRO ("Press Start")
   ========================================================================== */
function abrirModalDetalhes() {
  AudioFX.start();

  const dados = Estado.dadosClima;
  if (!dados) return;

  const atual = dados.atual;

  const nomeCompleto = Estado.cidadeAtual.estado
    ? `${Estado.cidadeAtual.nome} (${Estado.cidadeAtual.estado})`
    : Estado.cidadeAtual.nome;
  DOM.modalDetalhesTitulo.textContent = `${nomeCompleto} — Detalhes Meteorológicos (INMET)`;
  DOM.detSensacao.textContent = WeatherInterpreter.formatarTemp(atual.sensacao);
  DOM.detUmidade.textContent = `${atual.umidade}%`;
  DOM.detVento.textContent = `${atual.ventoKmH} km/h`;
  DOM.detPrecip.textContent = `${atual.precipitacaoMm} mm`;
  DOM.detPressao.textContent = `${atual.pressaoHpa} hPa`;
  DOM.detUv.textContent = `${dados.uvIndice} / 11`;
  DOM.detNascer.textContent = dados.nascerDoSol;
  DOM.detPor.textContent = dados.porDoSol;

  renderizarBarrasHorarias(dados.horario);
  DOM.modalDetalhes.classList.add('aberto');
}

function fecharModalDetalhes() {
  AudioFX.clique();
  DOM.modalDetalhes.classList.remove('aberto');
}

function renderizarBarrasHorarias(horas) {
  if (!DOM.containerBarrasHorarias || !horas || !horas.length) return;
  DOM.containerBarrasHorarias.innerHTML = '';

  const temps = horas.slice(0, 16).map(h => h.temperatura);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const diff = Math.max(1, maxT - minT);

  horas.slice(0, 16).forEach(h => {
    const alturaPx = Math.round(15 + ((h.temperatura - minT) / diff) * 60);
    const horaFmt = typeof h.hora === 'string' && h.hora.includes('T')
      ? h.hora.split('T')[1].slice(0, 5)
      : h.hora;

    const col = document.createElement('div');
    col.className = 'bar-column';
    col.innerHTML = `
      <div class="bar-temp">${WeatherInterpreter.formatarTemp(h.temperatura).replace('°C', '°')}</div>
      <div class="bar-fill" style="height: ${alturaPx}px;"></div>
      <div class="bar-hour">${horaFmt}</div>
    `;
    DOM.containerBarrasHorarias.appendChild(col);
  });
}

/* ==========================================================================
   CONFIGURAÇÃO DE BUSCA COM AUTOCOMPLETAR
   ========================================================================== */
function configurarBusca(input, dropdown, onSelect) {
  let timerDebounce = null;

  input.addEventListener('input', (e) => {
    const termo = e.target.value.trim();
    clearTimeout(timerDebounce);

    if (termo.length < 2) {
      dropdown.classList.remove('aberto');
      dropdown.innerHTML = '';
      return;
    }

    timerDebounce = setTimeout(async () => {
      const cidades = await WeatherAPI.buscarCidades(termo);
      dropdown.innerHTML = '';

      if (!cidades.length) {
        dropdown.innerHTML = '<div class="search-popup-item" style="color:#b0a4d4;">Nenhuma cidade encontrada</div>';
        dropdown.classList.add('aberto');
        return;
      }

      cidades.forEach(c => {
        const item = document.createElement('div');
        item.className = 'search-popup-item';
        item.innerHTML = `
          <div><strong>${c.nome}</strong> ${c.estado ? `(${c.estado})` : ''}</div>
          <span class="country-badge">${c.pais}</span>
        `;
        item.addEventListener('mouseenter', () => AudioFX.bip());
        item.addEventListener('click', () => {
          dropdown.classList.remove('aberto');
          input.value = '';
          onSelect(c);
        });
        dropdown.appendChild(item);
      });

      dropdown.classList.add('aberto');
    }, 280);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.classList.remove('aberto');
  });
}

/* ==========================================================================
   PAINÉIS DE ABAS (Início, Buscar, Locais, Histórico)
   ========================================================================== */
function trocarAba(nomeAba) {
  AudioFX.clique();

  // Fecha menu mobile se estiver aberto
  DOM.mobileDropdownMenu.classList.remove('aberto');

  DOM.navBtns.forEach(btn => btn.classList.toggle('ativo', btn.dataset.tab === nomeAba));

  const mostrarPrincipal = nomeAba === 'home' || nomeAba === 'search';
  if (DOM.mainStageContainer) DOM.mainStageContainer.style.display = mostrarPrincipal ? '' : 'none';
  DOM.viewportClima.style.display = mostrarPrincipal ? '' : 'none';
  DOM.shelfPrevisao.style.display = mostrarPrincipal ? '' : 'none';

  DOM.abaPainelSalvos.classList.remove('visivel');
  DOM.abaPainelHistorico.classList.remove('visivel');

  if (nomeAba === 'search') {
    DOM.inputBuscaCidade.focus();
  } else if (nomeAba === 'locations') {
    renderizarPainelSalvos();
    DOM.abaPainelSalvos.classList.add('visivel');
  } else if (nomeAba === 'history') {
    renderizarPainelHistorico();
    DOM.abaPainelHistorico.classList.add('visivel');
  }
}

function renderizarPainelSalvos() {
  const favoritos = Storage.obterFavoritos();
  DOM.containerLocaisSalvos.innerHTML = '';

  if (!favoritos.length) {
    DOM.containerLocaisSalvos.innerHTML = '<p style="color:#b0a4d4; font-size:9px;">Nenhum local salvo ainda. Clique na estrela ★ na tela principal para favoritar.</p>';
    return;
  }

  favoritos.forEach(fav => {
    const card = document.createElement('div');
    card.className = 'saved-city-tile';
    card.innerHTML = `
      <div>
        <h4>${fav.nome}</h4>
        <p>${fav.pais || ''}</p>
      </div>
      <button class="btn-delete-tile" title="Remover">✕</button>
    `;

    card.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-delete-tile')) return;
      AudioFX.clique();
      trocarAba('home');
      await carregarClima(fav);
    });

    card.querySelector('.btn-delete-tile').addEventListener('click', (e) => {
      e.stopPropagation();
      AudioFX.clique();
      Storage.removerFavorito(fav.nome, fav.pais);
      renderizarPainelSalvos();
      renderizarDadosClima();
      exibirToast(`Removido: ${fav.nome}`);
    });

    DOM.containerLocaisSalvos.appendChild(card);
  });
}

function renderizarPainelHistorico() {
  const historico = Storage.obterHistorico();
  DOM.containerHistorico.innerHTML = '';

  if (!historico.length) {
    DOM.containerHistorico.innerHTML = '<p style="color:#b0a4d4; font-size:9px;">Nenhuma busca recente.</p>';
    return;
  }

  historico.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-entry';
    div.innerHTML = `
      <span>${item.nome} (${item.pais || 'GPS'})</span>
      <span style="color:var(--accent-gold); font-size:8px;">Carregar ➔</span>
    `;

    div.addEventListener('click', async () => {
      AudioFX.clique();
      trocarAba('home');
      await carregarClima(item);
    });

    DOM.containerHistorico.appendChild(div);
  });
}

/* ==========================================================================
   VINCULAÇÃO DE EVENTOS
   ========================================================================== */
function vincularEventos() {
  // Trocar Localização (Abre modal de onboarding / seleção)
  DOM.btnTrocarLocal?.addEventListener('click', () => {
    AudioFX.clique();
    abrirModalOnboarding();
  });

  // Simulador
  DOM.selectSimulador?.addEventListener('change', (e) => simularClima(e.target.value));

  // Alternador de Som
  DOM.btnToggleSom?.addEventListener('click', alternarSom);

  // Navegação por Abas Desktop
  DOM.navBtns.forEach(btn => {
    btn.addEventListener('click', () => trocarAba(btn.dataset.tab));
  });

  // Navegação Mobile
  DOM.btnMobileMenu?.addEventListener('click', () => {
    AudioFX.clique();
    DOM.mobileDropdownMenu.classList.toggle('aberto');
  });

  DOM.mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (link.id === 'btnMobileGps') {
        definirLocalizacaoInicialViaGps();
        DOM.mobileDropdownMenu.classList.remove('aberto');
      } else {
        trocarAba(link.dataset.tab);
      }
    });
  });

  // Atualizar Tempo
  DOM.btnAtualizarTempo?.addEventListener('click', () => {
    AudioFX.clique();
    const icon = DOM.btnAtualizarTempo.querySelector('.action-btn-icon');
    if (icon) {
      icon.classList.add('girando');
      setTimeout(() => icon.classList.remove('girando'), 800);
    }
    if (Estado.cidadeAtual) {
      carregarClima(Estado.cidadeAtual);
      exibirToast('Clima atualizado!');
    }
  });

  // Compartilhar
  DOM.btnCompartilhar?.addEventListener('click', async () => {
    AudioFX.clique();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      exibirToast('Link copiado para a área de transferência!');
    } else {
      exibirToast('Compartilhe o 8B Wheater!');
    }
  });

  // Busca Principal
  configurarBusca(DOM.inputBuscaCidade, DOM.dropdownResultadosBusca, (cidade) => {
    selecionarCidade(cidade, false);
  });

  DOM.btnGpsBusca?.addEventListener('click', definirLocalizacaoInicialViaGps);

  // Busca no Modal de Onboarding
  configurarBusca(DOM.inputOnboardingBusca, DOM.dropdownOnboardingResultados, (cidade) => {
    selecionarCidade(cidade, true);
  });

  DOM.btnOnboardingGps?.addEventListener('click', definirLocalizacaoInicialViaGps);

  // Chips Rápidos de Cidades no Onboarding (Capitais do Brasil)
  DOM.chipsCidades.forEach(chip => {
    chip.addEventListener('click', () => {
      const cidade = {
        nome: chip.dataset.cidade,
        estado: chip.dataset.estado,
        id: chip.dataset.id ? parseInt(chip.dataset.id, 10) : undefined,
        ibge: chip.dataset.ibge,
        pais: 'Brasil'
      };
      selecionarCidade(cidade, true);
    });
  });

  // Favoritar
  DOM.btnFavoritar?.addEventListener('click', () => {
    if (!Estado.cidadeAtual) return;
    const res = Storage.alternarFavorito(Estado.cidadeAtual);
    if (res.favoritado) {
      AudioFX.moeda();
      exibirToast(`★ ${Estado.cidadeAtual.nome} salvo nos favoritos!`);
    } else {
      AudioFX.clique();
      exibirToast(`${Estado.cidadeAtual.nome} removido dos favoritos.`);
    }
    renderizarDadosClima();
  });

  // Press Start / Detalhes
  DOM.btnPressStart?.addEventListener('click', abrirModalDetalhes);
  DOM.btnSideDetalhes?.addEventListener('click', abrirModalDetalhes);
  DOM.btnFecharDetalhes?.addEventListener('click', fecharModalDetalhes);
  DOM.modalDetalhes?.addEventListener('click', (e) => {
    if (e.target === DOM.modalDetalhes) fecharModalDetalhes();
  });

  // Limpar Histórico
  DOM.btnLimparHistorico?.addEventListener('click', () => {
    AudioFX.clique();
    Storage.limparHistorico();
    renderizarPainelHistorico();
    exibirToast('Histórico limpo');
  });

  // Sons para botões sociais retrô
  document.querySelectorAll('.retro-social-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => AudioFX.bip());
    btn.addEventListener('click', () => AudioFX.clique());
  });

  // Teclado Gamer (Espaço ou Enter abre Start)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (DOM.modalDetalhes.classList.contains('aberto')) {
        fecharModalDetalhes();
      } else if (!DOM.onboardingModal.classList.contains('aberto')) {
        abrirModalDetalhes();
      }
    } else if (e.key === 'Escape') {
      fecharModalDetalhes();
      DOM.dropdownResultadosBusca.classList.remove('aberto');
      DOM.dropdownOnboardingResultados.classList.remove('aberto');
    }
  });

  // Fecha dropdowns ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar-box')) {
      DOM.dropdownResultadosBusca.classList.remove('aberto');
    }
    if (!e.target.closest('.onboarding-search-box')) {
      DOM.dropdownOnboardingResultados.classList.remove('aberto');
    }
  });
}

/* ==========================================================================
   TOAST NOTIFICATION
   ========================================================================== */
let timerToast = null;
function exibirToast(mensagem) {
  if (!DOM.toastNotificacao || !DOM.toastTexto) return;
  DOM.toastTexto.textContent = mensagem;
  DOM.toastNotificacao.classList.add('visivel');

  clearTimeout(timerToast);
  timerToast = setTimeout(() => {
    DOM.toastNotificacao.classList.remove('visivel');
  }, 2600);
}
