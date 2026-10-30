/* 8B Wheater - Standalone Universal Bundle (file:// and http:// compatible) */
(function() {
/**
 * 8B Wheater — Gerenciador de Armazenamento Local (localStorage)
 * ------------------------------------------------------------
 * Armazena:
 *   - Localização definida do usuário (obrigatória na 1ª visita)
 *   - Cidades favoritas
 *   - Histórico de buscas recentes
 *   - Preferências do usuário (Sons 8-bit)
 */

const STORAGE_KEYS = {
  CIDADE_USUARIO: '8b_wheater_user_city',
  FAVORITOS: '8b_wheater_favorites',
  HISTORICO: '8b_wheater_history',
  CONFIGURACOES: '8b_wheater_settings'
};

const Storage = {
  /**
   * Verifica se o usuário já definiu sua localização anteriormente
   */
  temLocalizacaoDefinida() {
    try {
      const salva = localStorage.getItem(STORAGE_KEYS.CIDADE_USUARIO);
      if (!salva) return false;
      const parsed = JSON.parse(salva);
      return Boolean(parsed && (parsed.nome || parsed.lat !== undefined || parsed.id || parsed.ibge));
    } catch {
      return false;
    }
  },

  /**
   * Salva a localização principal do usuário
   */
  salvarLocalizacaoUsuario(cidade) {
    if (!cidade) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CIDADE_USUARIO, JSON.stringify(cidade));
      this.adicionarHistorico(cidade);
    } catch (e) {
      console.warn('Erro ao salvar localização do usuário:', e);
    }
  },

  /**
   * Obtém a localização salva do usuário (ou null se for primeira visita)
   */
  obterLocalizacaoUsuario() {
    try {
      const salva = localStorage.getItem(STORAGE_KEYS.CIDADE_USUARIO);
      if (salva) return JSON.parse(salva);
    } catch (e) {
      console.warn('Erro ao ler localização salva:', e);
    }
    return null;
  },

  /**
   * Favoritos
   */
  obterFavoritos() {
    try {
      const favs = localStorage.getItem(STORAGE_KEYS.FAVORITOS);
      if (favs) return JSON.parse(favs);
    } catch (e) {
      console.warn('Erro ao ler favoritos:', e);
    }
    return [];
  },

  alternarFavorito(cidade) {
    if (!cidade) return { favoritado: false, lista: [] };
    const favs = this.obterFavoritos();
    const indice = favs.findIndex(c => 
      c.nome.toLowerCase() === cidade.nome.toLowerCase() && 
      (c.pais || '').toLowerCase() === (cidade.pais || '').toLowerCase()
    );

    let favoritado = false;
    if (indice >= 0) {
      favs.splice(indice, 1);
      favoritado = false;
    } else {
      favs.unshift(cidade);
      favoritado = true;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(favs));
    } catch (e) {
      console.warn('Erro ao salvar favoritos:', e);
    }

    return { favoritado, lista: favs };
  },

  isFavorito(cidade) {
    if (!cidade) return false;
    const favs = this.obterFavoritos();
    return favs.some(c => 
      c.nome.toLowerCase() === cidade.nome.toLowerCase() && 
      (c.pais || '').toLowerCase() === (cidade.pais || '').toLowerCase()
    );
  },

  removerFavorito(nome, pais) {
    let favs = this.obterFavoritos();
    favs = favs.filter(c => !(c.nome === nome && c.pais === pais));
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(favs));
    } catch (e) {
      console.warn('Erro ao salvar favoritos:', e);
    }
    return favs;
  },

  /**
   * Histórico de cidades acessadas
   */
  adicionarHistorico(cidade) {
    if (!cidade || !cidade.nome) return;
    try {
      let hist = this.obterHistorico();
      hist = hist.filter(c => !(c.nome.toLowerCase() === cidade.nome.toLowerCase() && (c.pais || '').toLowerCase() === (cidade.pais || '').toLowerCase()));
      hist.unshift(cidade);
      if (hist.length > 8) hist = hist.slice(0, 8);
      localStorage.setItem(STORAGE_KEYS.HISTORICO, JSON.stringify(hist));
    } catch (e) {
      console.warn('Erro ao salvar histórico:', e);
    }
  },

  obterHistorico() {
    try {
      const hist = localStorage.getItem(STORAGE_KEYS.HISTORICO);
      if (hist) return JSON.parse(hist);
    } catch (e) {
      console.warn('Erro ao ler histórico:', e);
    }
    return [];
  },

  limparHistorico() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORICO);
    } catch (e) {
      console.warn('Erro ao limpar histórico:', e);
    }
  },

  /**
   * Configurações
   */
  obterConfiguracoes() {
    const padrao = {
      somAtivo: true
    };

    try {
      const conf = localStorage.getItem(STORAGE_KEYS.CONFIGURACOES);
      if (conf) return { ...padrao, ...JSON.parse(conf) };
    } catch (e) {
      console.warn('Erro ao ler configurações:', e);
    }
    return padrao;
  },

  salvarConfiguracoes(novasConfigs) {
    try {
      const atuais = this.obterConfiguracoes();
      const mescladas = { ...atuais, ...novasConfigs };
      localStorage.setItem(STORAGE_KEYS.CONFIGURACOES, JSON.stringify(mescladas));
      return mescladas;
    } catch (e) {
      console.warn('Erro ao salvar configurações:', e);
      return novasConfigs;
    }
  }
};


/**
 * 8B Wheater — Mapeador de Clima, Cenas e Efeitos (Pixel Art)
 * ------------------------------------------------------------
 * Traduz os códigos meteorológicos WMO da Open-Meteo para:
 *   - Nomes em Português
 *   - Cenas SVG específicas de Dia e Noite
 *   - Ícones SVG 16x16 pixel-art
 *   - Camadas de efeitos CSS (Chuva, Neve, Névoa, Raios)
 */

const WeatherInterpreter = {
  /**
   * Converte código WMO e contexto temporal/atmosférico em informações completas de clima
   * @param {number} codigoWmo Código WMO ou condição equivalente
   * @param {number|boolean} isDay 1 para dia, 0 para noite
   * @param {object} contexto { porDoSol: 'HH:MM', nascerDoSol: 'HH:MM', precipitacaoMm: number, horaAtual: Date, forcarEntardecer: boolean, forcarDiaNoite: boolean }
   */
  interpretar(codigoWmo, isDay = 1, contexto = {}) {
    // 1. Tratamento de Horários e Detecção de Crepúsculo / Pôr do Sol
    const agora = contexto.horaAtual || new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    const horaParaMinutos = (horaStr) => {
      if (!horaStr || typeof horaStr !== 'string') return null;
      const partes = horaStr.split(':');
      if (partes.length < 2) return null;
      const h = parseInt(partes[0], 10);
      const m = parseInt(partes[1], 10);
      return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
    };

    const minutosPorDoSol = horaParaMinutos(contexto.porDoSol);
    const minutosNascerDoSol = horaParaMinutos(contexto.nascerDoSol);

    // Janela do Pôr do Sol: começa 25 minutos antes do ocaso e se estende por até 20 minutos após (crepúsculo vespertino)
    const ehJanelaPorDoSol = Boolean(
      contexto.forcarEntardecer ||
      codigoWmo === 800 ||
      (minutosPorDoSol !== null &&
       minutosAgora >= (minutosPorDoSol - 25) &&
       minutosAgora <= (minutosPorDoSol + 20))
    );

    // Determina se é dia ou noite com base no relógio local e nascer/pôr do sol
    let dia = Boolean(isDay);
    if (minutosNascerDoSol !== null && minutosPorDoSol !== null && !contexto.forcarDiaNoite) {
      dia = (minutosAgora >= minutosNascerDoSol && minutosAgora <= (minutosPorDoSol + 20));
    }

    // 2. Avaliação de Chuva (Leve vs Normal/Forte)
    // Valores de 0.0 a 0.2 mm representam traços imperceptíveis no solo (onde o céu fica apenas Nublado).
    // Chuva ativa exige precipitação mensurável (> 0.2 mm) ou códigos fortes (63, 65, 80+)
    const precipitacaoMm = typeof contexto.precipitacaoMm === 'number' ? contexto.precipitacaoMm : 0;
    const temChuvaAtiva = (precipitacaoMm > 0.2) || ([63, 65, 80, 81, 82].includes(codigoWmo) && precipitacaoMm > 0.1);
    const ehChuvaLeve = temChuvaAtiva && (precipitacaoMm <= 2.0 || [51, 53, 55, 61].includes(codigoWmo));
    const ehChuvaNormalOuForte = temChuvaAtiva && (precipitacaoMm > 2.0 || [63, 65, 80, 81, 82].includes(codigoWmo));
    const temChuva = ehChuvaLeve || ehChuvaNormalOuForte;
    const temTempestade = [95, 96, 99].includes(codigoWmo);
    const temNeve = [71, 73, 75, 77, 85, 86].includes(codigoWmo);

    // 3. Caso especial prioritário: Pôr do Sol / Entardecer com Adaptação Dinâmica de Efeitos
    if (ehJanelaPorDoSol) {
      if (temTempestade) {
        return {
          nome: 'Tempestade no Pôr do Sol',
          descricao: 'Crepúsculo dramático cortado por relâmpagos e trovões',
          cena: 'entardecer',
          icone: 'tempestade',
          efeitos: { chuva: true, chuvaFraca: false, chuvaForte: true, neve: false, nevoa: false, tempestade: true }
        };
      }

      if (temChuva) {
        if (ehChuvaLeve) {
          return {
            nome: 'Pôr do Sol com Chuva Fraca',
            descricao: 'Chuvisco e gotas suaves refletindo o crepúsculo dourado',
            cena: 'entardecer',
            icone: 'sol-chuva',
            efeitos: { chuva: false, chuvaFraca: true, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
          };
        } else {
          return {
            nome: 'Pôr do Sol com Chuva',
            descricao: 'Pancadas de chuva contínua durante o horizonte poente',
            cena: 'entardecer',
            icone: 'chuva',
            efeitos: { chuva: true, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
          };
        }
      }

      if (temNeve) {
        return {
          nome: 'Neve no Pôr do Sol',
          descricao: 'Flocos brancos sob as cores quentes do entardecer',
          cena: 'entardecer',
          icone: 'neve',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: true, nevoa: false, tempestade: false }
        };
      }

      if (codigoWmo === 3) {
        return {
          nome: 'Entardecer Encoberto',
          descricao: 'Manto de nuvens densas coloridas pelo sol poente',
          cena: 'entardecer',
          icone: 'nublado',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };
      }

      return {
        nome: 'Pôr do Sol',
        descricao: 'Entardecer dourado e crepúsculo no horizonte',
        cena: 'entardecer',
        icone: 'sol',
        efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
      };
    }

    // 4. Mapeamento padrão WMO (fora da janela de pôr do sol)
    switch (codigoWmo) {
      // Pôr do Sol forçado via código 800
      case 800:
        return {
          nome: 'Pôr do Sol',
          descricao: 'Entardecer dourado e crepúsculo no horizonte',
          cena: 'entardecer',
          icone: 'sol',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };

      // Céu Limpo
      case 0:
        return {
          nome: dia ? 'Ensolarado' : 'Céu Limpo',
          descricao: dia ? 'Dia de sol brilhante' : 'Noite estrelada e límpida',
          cena: dia ? 'dia-limpo' : 'noite-limpa',
          icone: dia ? 'sol' : 'lua',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };

      // Principalmente claro / Parcialmente nublado
      case 1:
      case 2:
        return {
          nome: 'Parcialmente Nublado',
          descricao: dia ? 'Sol entre nuvens pixeladas' : 'Lua entre nuvens na noite',
          cena: dia ? 'dia-parcial' : 'noite-parcial',
          icone: dia ? 'sol-nuvem' : 'lua-nuvem',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };

      // Encoberto / Nublado
      case 3:
        return {
          nome: 'Nublado',
          descricao: 'Manto de nuvens densas',
          cena: dia ? 'dia-nublado' : 'noite-nublada',
          icone: 'nublado',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };

      // Nevoeiro e Névoa
      case 45:
      case 48:
        return {
          nome: 'Nevoeiro',
          descricao: 'Visibilidade baixa com névoa densa',
          cena: dia ? 'dia-nevoa' : 'noite-nevoa',
          icone: 'nevoa',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };

      // Chuvisco e Chuva Leve / Chuva Fraca
      case 51:
      case 53:
      case 55:
      case 61:
        if (!temChuvaAtiva) {
          return {
            nome: 'Nublado',
            descricao: 'Manto de nuvens densas com possibilidade de chuvisco leve',
            cena: dia ? 'dia-nublado' : 'noite-nublada',
            icone: 'nublado',
            efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
          };
        }
        return {
          nome: 'Chuva Fraca',
          descricao: 'Gotas suaves e chuvisco refrescante',
          cena: dia ? 'dia-chuva' : 'noite-chuva',
          icone: dia ? 'sol-chuva' : 'lua-chuva',
          efeitos: { chuva: false, chuvaFraca: true, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };

      // Chuva Moderada a Forte
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        if (!temChuvaAtiva) {
          return {
            nome: 'Nublado',
            descricao: 'Céu encoberto com probabilidade de chuva',
            cena: dia ? 'dia-nublado' : 'noite-nublada',
            icone: 'nublado',
            efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
          };
        }
        return {
          nome: 'Chuvoso',
          descricao: 'Pancadas de chuva contínua',
          cena: dia ? 'dia-chuva' : 'noite-chuva',
          icone: 'chuva',
          efeitos: { chuva: true, chuvaFraca: false, chuvaForte: true, neve: false, nevoa: false, tempestade: false }
        };

      // Neve
      case 71:
      case 73:
      case 75:
      case 77:
      case 85:
      case 86:
        return {
          nome: 'Neve',
          descricao: 'Flocos brancos caindo sobre os telhados',
          cena: dia ? 'dia-neve' : 'noite-neve',
          icone: 'neve',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: true, nevoa: false, tempestade: false }
        };

      // Tempestade e Trovoadas
      case 95:
      case 96:
      case 99:
        return {
          nome: 'Tempestade',
          descricao: 'Relâmpagos e trovões estrondosos',
          cena: dia ? 'dia-tempestade' : 'noite-tempestade',
          icone: 'tempestade',
          efeitos: { chuva: true, chuvaFraca: false, chuvaForte: true, neve: false, nevoa: false, tempestade: true }
        };

      default:
        if (temChuva) {
          return {
            nome: ehChuvaLeve ? 'Chuva Fraca' : 'Chuvoso',
            descricao: ehChuvaLeve ? 'Gotas suaves de chuva' : 'Pancadas de chuva',
            cena: dia ? 'dia-chuva' : 'noite-chuva',
            icone: 'chuva',
            efeitos: { chuva: !ehChuvaLeve, chuvaFraca: ehChuvaLeve, chuvaForte: !ehChuvaLeve, neve: false, nevoa: false, tempestade: false }
          };
        }
        return {
          nome: dia ? 'Ensolarado' : 'Noite Limpa',
          descricao: 'Tempo estável',
          cena: dia ? 'dia-limpo' : 'noite-limpa',
          icone: dia ? 'sol' : 'lua',
          efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
        };
    }
  },

  /**
   * Formata temperatura em graus Celsius
   */
  formatarTemp(celsius) {
    if (celsius === null || celsius === undefined) return '--';
    return `${Math.round(celsius)}°C`;
  },

  /**
   * Converte data ISO (YYYY-MM-DD) para dia da semana abreviado em PT-BR
   */
  obterDiaSemana(dataIso) {
    if (!dataIso) return '';
    const partes = dataIso.split('-');
    const data = new Date(partes[0], partes[1] - 1, partes[2]);
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    return dias[data.getDay()] || '';
  },

  /**
   * Calcula probabilidade de chuva estimada em porcentagem (0% a 100%)
   */
  obterProbabilidadeChuva(codigoWmo, precipitacaoMm) {
    if (precipitacaoMm && precipitacaoMm >= 10) return 95;
    if (precipitacaoMm && precipitacaoMm >= 5) return 85;
    if (precipitacaoMm && precipitacaoMm >= 2) return 70;
    if (precipitacaoMm && precipitacaoMm > 0) return 60;

    switch (codigoWmo) {
      case 95:
      case 96:
      case 99:
        return 90; // Tempestade
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        return 80; // Chuvoso / Pancadas
      case 51:
      case 53:
      case 55:
      case 61:
        return 50; // Chuva Fraca / Chuvisco
      case 3:
      case 45:
      case 48:
        return 25; // Nublado / Nevoeiro
      case 1:
      case 2:
        return 10; // Parcialmente Nublado
      case 71:
      case 73:
      case 75:
      case 77:
      case 85:
      case 86:
        return 65; // Neve
      case 0:
      default:
        return 0; // Céu Limpo / Ensolarado
    }
  }
};


/**
 * 8B Wheater — Sintetizador de Áudio Chiptune 8-Bit (Web Audio API)
 * -----------------------------------------------------------------
 * Efeitos sonoros autênticos estilo Game Boy / NES sintetizados
 * inteiramente via osciladores, sem necessidade de arquivos externos.
 */

let audioCtx = null;
let somHabilitado = true;

function obterContexto() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

const AudioFX = {
  definirAtivo(ativo) {
    somHabilitado = Boolean(ativo);
  },

  isAtivo() {
    return somHabilitado;
  },

  /**
   * Beep de navegação / hover de botão
   */
  bip() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Ignora restrições de autoplay antes da interação
    }
  },

  /**
   * Som de clique em botão
   */
  clique() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.03); // A5

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  },

  /**
   * Jingle "Press Start" / Detalhes (Acorde clássico de videogame)
   */
  start() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const notas = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.18);
      });
    } catch (e) {}
  },

  /**
   * Som de Favoritado / Sucesso (Moeda tipo Mario)
   */
  moeda() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  },

  /**
   * Trovão sintetizado para clima de tempestade
   */
  trovao() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      // Buffer de ruído branco com filtro passa-baixa
      const bufferSize = ctx.sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.2);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {}
  },

  /**
   * Fanfarra de inicialização estilo Game Boy boot
   */
  boot() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
      osc.frequency.setValueAtTime(2093.00, ctx.currentTime + 0.12); // C7

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }
};


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

const WeatherAPI = {
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
        console.warn('INMET direto não respondeu ou bloqueado por CORS no browser, usando BrasilAPI:', errInmet);
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


/**
 * 8B Wheater — Controlador Principal da Aplicação (Tela Única Responsiva)
 * ------------------------------------------------------------------------
 * Coordena o fluxo de localização obrigatória na primeira visita,
 * persistência em LocalStorage, dados da Open-Meteo API, efeitos de áudio
 * chiptune, simulador de clima e transições visuais em pixel art.
 */


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
    const localDetectado = await WeatherAPI.detectarLocalizacaoPorIp();
    if (localDetectado) {
      Storage.salvarLocalizacaoUsuario(localDetectado);
      await carregarClima(localDetectado);
    } else {
      await carregarClima({ nome: 'São Paulo', estado: 'SP', lat: -23.5505, lon: -46.6333, pais: 'Brasil' });
      abrirModalOnboarding();
    }
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

  DOM.hudValorTemp.textContent = Math.round(atual.temperatura);
  DOM.hudUnidadeTemp.textContent = '°C';
  DOM.hudNomeCondicao.textContent = interp.nome;
  DOM.hudSensacaoTermica.textContent = `Sensação térmica ${sensacaoFmt}`;

  // 3. Mini Métricas
  DOM.hudUmidade.textContent = `${atual.umidade}%`;
  DOM.hudVento.textContent = `${atual.ventoKmH} km/h`;
  if (atual.precipitacaoMm > 0) {
    DOM.hudPrecipitacao.textContent = `${atual.precipitacaoMm} mm`;
  } else if (atual.probabilidadeChuva !== undefined && atual.probabilidadeChuva > 0) {
    DOM.hudPrecipitacao.textContent = `${atual.probabilidadeChuva}%`;
  } else {
    DOM.hudPrecipitacao.textContent = '0 mm';
  }

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

})();
