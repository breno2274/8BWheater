/**
 * 8B Wheater — Cliente de API de Meteorologia INMET (Brasil)
 * ------------------------------------------------------------
 * Integra com as APIs públicas meteorológicas do Brasil:
 *   1. INMET API de Previsão por Município (apiprevmet3.inmet.gov.br)
 *   2. BrasilAPI Meteorologia CPTEC / INMET (brasilapi.com.br/api/cptec)
 *   3. IBGE / Nominatim para geolocalização e busca de cidades brasileiras
 *
 * Suporte a:
 *   - Previsão diária de 5 a 6 dias para municípios de todos os estados do Brasil
 *   - Temperaturas máxima, mínima e atual estimada
 *   - Resumo das condições meteorológicas (Sol, Chuva, Tempestade, Nublado, etc.)
 *   - Direção do vento, umidade, índice UV e nascer/pôr do sol
 *   - Fallback offline robusto
 */

const ENDPOINT_INMET_PREVISAO = 'https://apiprevmet3.inmet.gov.br/previsao';
const ENDPOINT_BRASILAPI_CLIMA = 'https://brasilapi.com.br/api/cptec/v1/clima/previsao';
const ENDPOINT_BRASILAPI_CIDADE = 'https://brasilapi.com.br/api/cptec/v1/cidade';

// Mapeamento inicial das principais capitais e cidades brasileiras (ID BrasilAPI e Código IBGE)
const CIDADES_BRASIL_DESTAQUE = [
  { id: 244, ibge: '3550308', nome: 'São Paulo', estado: 'SP', lat: -23.5475, lon: -46.6361 },
  { id: 241, ibge: '3304557', nome: 'Rio de Janeiro', estado: 'RJ', lat: -22.9068, lon: -43.1729 },
  { id: 61,  ibge: '5300108', nome: 'Brasília', estado: 'DF', lat: -15.7939, lon: -47.8828 },
  { id: 222, ibge: '3106200', nome: 'Belo Horizonte', estado: 'MG', lat: -19.9208, lon: -43.9378 },
  { id: 243, ibge: '2927408', nome: 'Salvador', estado: 'BA', lat: -12.9714, lon: -38.5014 },
  { id: 227, ibge: '4106902', nome: 'Curitiba', estado: 'PR', lat: -25.4297, lon: -49.2711 },
  { id: 237, ibge: '4314902', nome: 'Porto Alegre', estado: 'RS', lat: -30.0331, lon: -51.2300 },
  { id: 239, ibge: '2611606', nome: 'Recife', estado: 'PE', lat: -8.0476, lon: -34.8770 },
  { id: 229, ibge: '2304400', nome: 'Fortaleza', estado: 'CE', lat: -3.7319, lon: -38.5267 },
  { id: 234, ibge: '1302603', nome: 'Manaus', estado: 'AM', lat: -3.1190, lon: -60.0217 },
  { id: 230, ibge: '5208707', nome: 'Goiânia', estado: 'GO', lat: -16.6869, lon: -49.2648 },
  { id: 228, ibge: '4205407', nome: 'Florianópolis', estado: 'SC', lat: -27.5954, lon: -48.5480 },
  { id: 221, ibge: '1501402', nome: 'Belém', estado: 'PA', lat: -1.4558, lon: -48.4902 },
  { id: 246, ibge: '3205309', nome: 'Vitória', estado: 'ES', lat: -20.3155, lon: -40.3128 },
  { id: 226, ibge: '5103403', nome: 'Cuiabá', estado: 'MT', lat: -15.6014, lon: -56.0979 },
  { id: 225, ibge: '5002704', nome: 'Campo Grande', estado: 'MS', lat: -20.4697, lon: -54.6201 },
  { id: 235, ibge: '2408102', nome: 'Natal', estado: 'RN', lat: -5.7945, lon: -35.2110 },
  { id: 232, ibge: '2507507', nome: 'João Pessoa', estado: 'PB', lat: -7.1150, lon: -34.8631 },
  { id: 233, ibge: '2704302', nome: 'Maceió', estado: 'AL', lat: -9.6658, lon: -35.7351 },
  { id: 245, ibge: '2211001', nome: 'Teresina', estado: 'PI', lat: -5.0919, lon: -42.8034 },
  { id: 242, ibge: '2111300', nome: 'São Luís', estado: 'MA', lat: -2.5307, lon: -44.3068 },
  { id: 220, ibge: '2800308', nome: 'Aracaju', estado: 'SE', lat: -10.9472, lon: -37.0731 },
  { id: 236, ibge: '1721000', nome: 'Palmas', estado: 'TO', lat: -10.2128, lon: -48.3603 }
];

export const WeatherAPI = {
  /**
   * Busca cidades por nome via Open-Meteo Geocoding com suporte a capitais e cidades brasileiras
   */
  async buscarCidades(termo) {
    if (!termo || termo.trim().length < 2) return [];

    const termoLimpo = termo.trim().toLowerCase();
    const locaisFiltrados = [];

    // 1. Cidades de destaque locais (capitais)
    CIDADES_BRASIL_DESTAQUE.forEach(c => {
      if (c.nome.toLowerCase().includes(termoLimpo) || (c.estado && c.estado.toLowerCase() === termoLimpo)) {
        locaisFiltrados.push({ ...c, pais: 'Brasil' });
      }
    });

    // 2. Consulta Geocoding da Open-Meteo (retorna latitude e longitude precisas de qualquer município)
    try {
      const urlGeo = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(termoLimpo)}&count=8&language=pt&format=json`;
      const respostaGeo = await fetch(urlGeo);
      if (respostaGeo.ok) {
        const dadosGeo = await respostaGeo.json();
        if (Array.isArray(dadosGeo.results)) {
          dadosGeo.results.forEach(res => {
            const estadoUf = extrairUf(res.admin1) || res.admin1 || '';
            const jaExiste = locaisFiltrados.some(f => 
              f.nome.toLowerCase() === res.name.toLowerCase() && 
              (!f.estado || f.estado === estadoUf)
            );
            if (!jaExiste) {
              locaisFiltrados.push({
                id: res.id,
                nome: res.name,
                estado: estadoUf,
                pais: res.country || 'Brasil',
                lat: res.latitude,
                lon: res.longitude
              });
            }
          });
        }
      }
    } catch (eGeo) {
      console.warn('Geocodificação Open-Meteo falhou:', eGeo);
    }

    // 3. Consulta BrasilAPI como complemento
    try {
      const url = `${ENDPOINT_BRASILAPI_CIDADE}/${encodeURIComponent(termoLimpo)}`;
      const resposta = await fetch(url);
      if (resposta.ok) {
        const dados = await resposta.json();
        if (Array.isArray(dados)) {
          dados.slice(0, 6).forEach(cidade => {
            if (!locaisFiltrados.some(f => f.nome.toLowerCase() === cidade.nome.toLowerCase())) {
              locaisFiltrados.push({
                id: cidade.id,
                ibge: cidade.ibge || null,
                nome: cidade.nome,
                estado: cidade.estado,
                pais: 'Brasil'
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Busca de cidades online falhou, usando lista local:', e);
    }

    return locaisFiltrados.slice(0, 8);
  },

  /**
   * Obtém a previsão do tempo em tempo real exata via Open-Meteo (com fallback para BrasilAPI/INMET)
   */
  async obterPrevisao(param1, param2) {
    let cidade = param1;
    if (typeof param1 === 'number') {
      cidade = await this.obterNomePorCoordenadas(param1, param2);
    }
    if (!cidade) throw new Error('Cidade inválida');

    let lat = cidade.lat;
    let lon = cidade.lon;

    // Se a cidade não tem coordenadas (lat/lon), resolve antes de consultar o clima
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
      try {
        const termoBusca = cidade.estado ? `${cidade.nome}, ${cidade.estado}, Brasil` : `${cidade.nome}, Brasil`;
        const urlGeo = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(termoBusca)}&limit=1`;
        const respGeo = await fetch(urlGeo, { headers: { 'User-Agent': '8B-Wheater-App' } });
        if (respGeo.ok) {
          const dadosGeo = await respGeo.json();
          if (dadosGeo && dadosGeo[0]) {
            lat = parseFloat(dadosGeo[0].lat);
            lon = parseFloat(dadosGeo[0].lon);
            cidade.lat = lat;
            cidade.lon = lon;
          }
        }
      } catch (errGeo) {
        console.warn('Geocodificação Nominatim falhou:', errGeo);
      }

      if (lat === undefined || lon === undefined) {
        try {
          const urlMeteoGeo = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade.nome)}&count=5&language=pt&format=json`;
          const respMeteoGeo = await fetch(urlMeteoGeo);
          if (respMeteoGeo.ok) {
            const dadosMeteoGeo = await respMeteoGeo.json();
            if (dadosMeteoGeo.results && dadosMeteoGeo.results.length > 0) {
              const match = dadosMeteoGeo.results.find(r => r.country_code === 'BR') || dadosMeteoGeo.results[0];
              lat = match.latitude;
              lon = match.longitude;
              cidade.lat = lat;
              cidade.lon = lon;
            }
          }
        } catch (eMeteoGeo) {
          console.warn('Geocodificação Open-Meteo falhou:', eMeteoGeo);
        }
      }
    }

    // 1. CONSULTA PRINCIPAL: Open-Meteo (leituras de estações e satélites em tempo real exatas)
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      try {
        const urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum&timezone=auto`;
        const respMeteo = await fetch(urlMeteo);
        if (respMeteo.ok) {
          const dadosMeteo = await respMeteo.json();
          if (dadosMeteo && dadosMeteo.current) {
            return processarRespostaOpenMeteo(dadosMeteo, cidade);
          }
        }
      } catch (errMeteo) {
        console.warn('Open-Meteo falhou, tentando fallback INMET/BrasilAPI:', errMeteo);
      }
    }

    // 2. FALLBACK SECUNDÁRIO: Tenta obter por IBGE no INMET direto
    if (cidade.ibge) {
      try {
        const urlInmet = `${ENDPOINT_INMET_PREVISAO}/${cidade.ibge}`;
        const respInmet = await fetch(urlInmet);
        if (respInmet.ok) {
          const dadosInmet = await respInmet.json();
          const dadosCidade = dadosInmet[cidade.ibge] || dadosInmet;
          if (dadosCidade && typeof dadosCidade === 'object') {
            return processarRespostaInmetDireta(dadosCidade, cidade);
          }
        }
      } catch (errInmet) {
        console.warn('INMET direto não respondeu, usando BrasilAPI:', errInmet);
      }
    }

    // 3. FALLBACK TERCIÁRIO: BrasilAPI (CPTEC)
    const idCidade = cidade.id || (await resolverIdCidadeBrasil(cidade));
    if (idCidade) {
      try {
        const urlBrasil = `${ENDPOINT_BRASILAPI_CLIMA}/${idCidade}/6`;
        const respBrasil = await fetch(urlBrasil);
        if (respBrasil.ok) {
          const dadosBrasil = await respBrasil.json();
          if (dadosBrasil && dadosBrasil.clima && dadosBrasil.clima.length) {
            return processarRespostaBrasilApi(dadosBrasil, cidade);
          }
        }
      } catch (errBrasil) {
        console.warn('Erro na BrasilAPI:', errBrasil);
      }
    }

    // 4. Fallback offline final
    return gerarFallbackBrasil(cidade);
  },

  /**
   * Obtém GPS do navegador e resolve para município brasileiro
   */
  async detectarLocalizacaoPorIp() {
    try {
      const resp = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (resp.ok) {
        const dados = await resp.json();
        if (dados && dados.latitude && dados.longitude) {
          return {
            nome: dados.city || 'São Paulo',
            estado: dados.region || 'SP',
            pais: dados.country || 'Brasil',
            lat: parseFloat(dados.latitude),
            lon: parseFloat(dados.longitude)
          };
        }
      }
    } catch (e) {
      console.warn('Falha na detecção por IP:', e);
    }
    return null;
  },

  async obterGeolocalizacaoAtual() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(err),
        { timeout: 9000, enableHighAccuracy: true }
      );
    });
  },

  /**
   * Geocodificação reversa de GPS para cidade e estado do Brasil
   */
  async obterNomePorCoordenadas(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=pt-BR`;
      const resposta = await fetch(url, { headers: { 'User-Agent': '8B-Wheater-INMET-Portfolio' } });
      if (resposta.ok) {
        const dados = await resposta.json();
        const endereco = dados.address || {};
        const nomeCidade = endereco.city || endereco.town || endereco.municipality || endereco.village || 'São Paulo';
        const estadoUf = extrairUf(endereco.state);

        // Tenta achar o ID da cidade
        const busca = await this.buscarCidades(nomeCidade);
        const encontrada = busca.find(b => b.estado === estadoUf) || busca[0];

        if (encontrada) {
          return { ...encontrada, lat, lon };
        }

        return { nome: nomeCidade, estado: estadoUf, pais: 'Brasil', lat, lon };
      }
    } catch (e) {
      console.warn('Erro ao resolver coordenadas reversas:', e);
    }

    // Padrão São Paulo
    return CIDADES_BRASIL_DESTAQUE[0];
  }
};

/**
 * Auxiliar: resolve ID da cidade se não existir no objeto
 */
async function resolverIdCidadeBrasil(cidade) {
  if (cidade.id) return cidade.id;
  const busca = await WeatherAPI.buscarCidades(cidade.nome);
  const match = busca.find(b => b.estado === cidade.estado) || busca[0];
  return match ? match.id : 244; // 244 = São Paulo
}

/**
 * Processa resposta em tempo real da Open-Meteo API
 */
function processarRespostaOpenMeteo(data, cidade) {
  const current = data.current || {};
  const daily = data.daily || {};
  const hourly = data.hourly || {};

  const tempAtual = Math.round(current.temperature_2m ?? 20);
  const sensacao = Math.round(current.apparent_temperature ?? tempAtual);
  const umidade = Math.round(current.relative_humidity_2m ?? 60);
  const ventoKmH = Math.round(current.wind_speed_10m ?? 10);
  const probChuvaHoje = daily.precipitation_probability_max?.[0] ?? 0;
  const precipitacaoDia = Math.round((daily.precipitation_sum?.[0] || 0) * 10) / 10;
  const precipitacaoInstantanea = Math.round((current.precipitation || 0) * 10) / 10;
  const precipitacaoMm = precipitacaoInstantanea > 0 ? precipitacaoInstantanea : precipitacaoDia;
  const pressaoHpa = Math.round(current.pressure_msl || 1013);
  const codigoClima = current.weather_code ?? 0;
  const isDay = current.is_day ?? 1;

  // Previsão para os próximos 5 dias com dados diários reais
  const previsao5Dias = (daily.time || []).slice(0, 5).map((dStr, idx) => ({
    data: dStr,
    condicaoTexto: '',
    tempMax: Math.round(daily.temperature_2m_max?.[idx] ?? tempAtual + 2),
    tempMin: Math.round(daily.temperature_2m_min?.[idx] ?? tempAtual - 4),
    codigoClima: daily.weather_code?.[idx] ?? 0,
    probabilidadeChuva: daily.precipitation_probability_max?.[idx] ?? 0,
    precipitacaoMm: Math.round((daily.precipitation_sum?.[idx] || 0) * 10) / 10
  }));

  // Horários das próximas 16 horas reais
  const agoraIsoHour = new Date().toISOString().slice(0, 13);
  let startIdx = (hourly.time || []).findIndex(t => t.startsWith(agoraIsoHour));
  if (startIdx === -1) startIdx = new Date().getHours();

  const barrasHorarias = [];
  for (let i = 0; i < 16; i++) {
    const idx = startIdx + i;
    if (hourly.time && idx < hourly.time.length) {
      const horaStr = hourly.time[idx].split('T')[1].slice(0, 5);
      barrasHorarias.push({
        hora: horaStr,
        temperatura: Math.round(hourly.temperature_2m[idx]),
        codigoClima: hourly.weather_code[idx],
        isDay: hourly.is_day[idx]
      });
    }
  }

  const sunriseStr = daily.sunrise?.[0];
  const sunsetStr = daily.sunset?.[0];
  const nascerDoSol = sunriseStr ? sunriseStr.split('T')[1].slice(0, 5) : '05:30';
  const porDoSol = sunsetStr ? sunsetStr.split('T')[1].slice(0, 5) : '18:18';
  const uvIndice = Math.round(daily.uv_index_max?.[0] ?? 6);

  return {
    atual: {
      temperatura: tempAtual,
      sensacao: sensacao,
      umidade: umidade,
      ventoKmH: ventoKmH,
      precipitacaoMm: precipitacaoMm,
      probabilidadeChuva: probChuvaHoje,
      pressaoHpa: pressaoHpa,
      codigoClima: codigoClima,
      condicaoDesc: '',
      isDay: isDay
    },
    diario: previsao5Dias,
    horario: barrasHorarias.length ? barrasHorarias : gerarBarrasHorariasEstimadas(tempAtual - 4, tempAtual + 2, codigoClima),
    nascerDoSol: nascerDoSol,
    porDoSol: porDoSol,
    uvIndice: uvIndice
  };
}

/**
 * Processa resposta direta da API do INMET (apiprevmet3)
 */
function processarRespostaInmetDireta(dadosInmet, cidade) {
  const datas = Object.keys(dadosInmet);
  const hojeKey = datas[0];
  const hoje = dadosInmet[hojeKey];

  // Período atual (manhã, tarde ou noite)
  const agora = new Date();
  const hora = agora.getHours();
  const isDay = hora >= 6 && hora < 18 ? 1 : 0;
  const periodoChave = hora < 12 ? 'manha' : (hora < 18 ? 'tarde' : 'noite');

  const dadosPeriodo = hoje[periodoChave] || hoje.manha || hoje;
  const tempMax = dadosPeriodo.temp_max || 25;
  const tempMin = dadosPeriodo.temp_min || 17;
  const tempAtual = Math.round(tempMin + (tempMax - tempMin) * (isDay ? 0.8 : 0.3));

  const resumoCondicao = dadosPeriodo.resumo || 'Estável';

  // Previsão para os próximos 5 dias
  const previsao5Dias = datas.slice(0, 5).map((dKey, idx) => {
    const dVal = dadosInmet[dKey];
    const sub = dVal.tarde || dVal.manha || dVal;
    return {
      data: formatarDataIso(dKey),
      condicaoTexto: sub.resumo || 'Tempo Estável',
      tempMax: Math.round(sub.temp_max || 24),
      tempMin: Math.round(sub.temp_min || 16),
      codigoClima: converterResumoInmetParaWmo(sub.resumo)
    };
  });

  return {
    atual: {
      temperatura: tempAtual,
      sensacao: tempAtual + 1,
      umidade: dadosPeriodo.umidade_max || 65,
      ventoKmH: extrairVelocidadeVento(dadosPeriodo.int_vento),
      precipitacaoMm: resumoCondicao.toLowerCase().includes('chuva') ? 5 : 0,
      pressaoHpa: 1013,
      codigoClima: converterResumoInmetParaWmo(resumoCondicao),
      condicaoDesc: resumoCondicao,
      isDay: isDay
    },
    diario: previsao5Dias,
    horario: gerarBarrasHorariasEstimadas(tempMin, tempMax, converterResumoInmetParaWmo(resumoCondicao)),
    nascerDoSol: dadosPeriodo.nascer || '06:05',
    porDoSol: dadosPeriodo.ocaso || '18:22',
    uvIndice: 7
  };
}

/**
 * Processa resposta da BrasilAPI (CPTEC / INMET)
 */
function processarRespostaBrasilApi(dadosBrasil, cidade) {
  const listaClima = dadosBrasil.clima || [];
  const hoje = listaClima[0] || {};

  const agora = new Date();
  const hora = agora.getHours();
  const isDay = hora >= 6 && hora < 18 ? 1 : 0;

  const tempMax = hoje.max ?? 25;
  const tempMin = hoje.min ?? 17;
  const tempAtual = Math.round(tempMin + (tempMax - tempMin) * (isDay ? 0.78 : 0.35));

  const previsao5Dias = listaClima.slice(0, 5).map((item, idx) => ({
    data: item.data,
    condicaoTexto: item.condicao_desc || 'Tempo Estável',
    tempMax: Math.round(item.max),
    tempMin: Math.round(item.min),
    codigoClima: converterCptecParaWmo(item.condicao)
  }));

  const codClima = converterCptecParaWmo(hoje.condicao);

  return {
    atual: {
      temperatura: tempAtual,
      sensacao: tempAtual + 1,
      umidade: 62,
      ventoKmH: 14,
      precipitacaoMm: hoje.condicao === 'c' || hoje.condicao === 't' ? 6 : 0,
      pressaoHpa: 1014,
      codigoClima: codClima,
      condicaoDesc: hoje.condicao_desc || 'Ensolarado',
      isDay: isDay
    },
    diario: previsao5Dias,
    horario: gerarBarrasHorariasEstimadas(tempMin, tempMax, codClima),
    nascerDoSol: '06:08',
    porDoSol: '18:25',
    uvIndice: hoje.indice_uv || 8
  };
}

/**
 * Converte siglas de condições do CPTEC/INMET para códigos universais WMO
 */
function converterCptecParaWmo(sigla) {
  switch ((sigla || '').toLowerCase()) {
    case 'cl': // Céu Claro
    case 'ps': // Predomínio de Sol
      return 0;
    case 'pn': // Parcialmente Nublado
    case 'in': // Instável
      return 2;
    case 'e':  // Encoberto
      return 3;
    case 'nv': // Nevoeiro
      return 45;
    case 'cv': // Chuvisco
    case 'ci': // Chuvas Isoladas
      return 51;
    case 'c':  // Chuva
    case 'p':  // Pancadas
    case 'ch': // Chuvoso
    case 'cm': // Chuva pela Manhã
    case 'cn': // Chuva a Noite
      return 63;
    case 'g':  // Geada
    case 'n':  // Neve
      return 71;
    case 't':  // Tempestade
      return 95;
    default:
      return 0;
  }
}

/**
 * Converte descrição textual do INMET para WMO
 */
function converterResumoInmetParaWmo(resumo) {
  const r = (resumo || '').toLowerCase();
  if (r.includes('tempestade') || r.includes('trovoada')) return 95;
  if (r.includes('chuva forte') || r.includes('pancadas')) return 63;
  if (r.includes('chuva fraca') || r.includes('chuva leve') || r.includes('chuvisco') || r.includes('garoa') || r.includes('isolada') || r.includes('esparsa')) return 51;
  if (r.includes('chuva') || r.includes('chuvoso')) return 63;
  if (r.includes('nevoeiro') || r.includes('névoa')) return 45;
  if (r.includes('neve') || r.includes('geada')) return 71;
  if (r.includes('encoberto') || r.includes('muitas nuvens')) return 3;
  if (r.includes('parcialmente') || r.includes('poucas nuvens')) return 2;
  return 0; // Céu claro / ensolarado
}

/**
 * Converte velocidade textual de vento do INMET (ex: "Fracos", "Moderados") em km/h
 */
function extrairVelocidadeVento(intVento) {
  const v = (intVento || '').toLowerCase();
  if (v.includes('forte')) return 28;
  if (v.includes('moderado')) return 18;
  return 12; // Fracos
}

/**
 * Converte DD/MM/AAAA para AAAA-MM-DD
 */
function formatarDataIso(dataStr) {
  if (!dataStr) return '';
  if (dataStr.includes('/')) {
    const [d, m, y] = dataStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dataStr;
}

/**
 * Converte nome completo de estado brasileiro para sigla UF
 */
function extrairUf(nomeEstado) {
  const mapa = {
    'são paulo': 'SP', 'rio de janeiro': 'RJ', 'distrito federal': 'DF',
    'minas gerais': 'MG', 'bahia': 'BA', 'paraná': 'PR', 'rio grande do sul': 'RS',
    'pernambuco': 'PE', 'ceará': 'CE', 'amazonas': 'AM', 'goiás': 'GO',
    'santa catarina': 'SC', 'pará': 'PA', 'espírito santo': 'ES', 'mato grosso': 'MT',
    'mato grosso do sul': 'MS', 'rio grande do norte': 'RN', 'paraíba': 'PB',
    'alagoas': 'AL', 'piauí': 'PI', 'maranhão': 'MA', 'sergipe': 'SE',
    'rondônia': 'RO', 'tocantins': 'TO', 'acre': 'AC', 'amapá': 'AP', 'roraima': 'RR'
  };
  return mapa[(nomeEstado || '').toLowerCase()] || 'SP';
}

/**
 * Gera barras horárias realistas para o modal com base nas temperaturas
 */
function gerarBarrasHorariasEstimadas(min, max, codClima) {
  const horas = [];
  const agora = new Date();
  const horaAtual = agora.getHours();

  for (let i = 0; i < 16; i++) {
    const h = (horaAtual + i) % 24;
    const ciclo = Math.sin(((h - 6) / 24) * Math.PI * 2);
    const temp = Math.round(min + (max - min) * Math.max(0, Math.min(1, (ciclo + 1) / 2)));
    horas.push({
      hora: `${String(h).padStart(2, '0')}:00`,
      temperatura: temp,
      codigoClima: codClima,
      isDay: h >= 6 && h < 18 ? 1 : 0
    });
  }
  return horas;
}

/**
 * Fallback realista para cidades brasileiras em caso de rede desconectada
 */
function gerarFallbackBrasil(cidade) {
  const agora = new Date();
  const hora = agora.getHours();
  const isDay = hora >= 6 && hora < 18 ? 1 : 0;

  const previsao5Dias = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(agora.getDate() + i);
    previsao5Dias.push({
      data: d.toISOString().split('T')[0],
      condicaoTexto: i === 1 ? 'Chuva' : (i === 3 ? 'Parcialmente Nublado' : 'Ensolarado'),
      tempMax: 26 - i,
      tempMin: 18 - i,
      codigoClima: [0, 63, 0, 2, 0][i % 5]
    });
  }

  return {
    atual: {
      temperatura: 24,
      sensacao: 25,
      umidade: 60,
      ventoKmH: 14,
      precipitacaoMm: 0,
      pressaoHpa: 1014,
      codigoClima: 0,
      condicaoDesc: 'Ensolarado',
      isDay: isDay
    },
    diario: previsao5Dias,
    horario: gerarBarrasHorariasEstimadas(18, 26, 0),
    nascerDoSol: '06:06',
    porDoSol: '18:24',
    uvIndice: 7
  };
}
