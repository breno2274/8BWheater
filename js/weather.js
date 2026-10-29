/**
 * 8B Wheater — Mapeador de Clima, Cenas e Efeitos (Pixel Art)
 * ------------------------------------------------------------
 * Traduz os códigos meteorológicos WMO da Open-Meteo para:
 *   - Nomes em Português
 *   - Cenas SVG específicas de Dia e Noite
 *   - Ícones SVG 16x16 pixel-art
 *   - Camadas de efeitos CSS (Chuva, Neve, Névoa, Raios)
 */

export const WeatherInterpreter = {
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

      if (codigoWmo === 3 || (!temChuvaAtiva && [51, 53, 55, 61].includes(codigoWmo))) {
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
            descricao: 'Céu encoberto com alta umidade',
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
            descricao: 'Céu encoberto e denso',
            cena: dia ? 'dia-nublado' : 'noite-nublada',
            icone: 'nublado',
            efeitos: { chuva: false, chuvaFraca: false, chuvaForte: false, neve: false, nevoa: false, tempestade: false }
          };
        }
        return {
          nome: ehChuvaNormalOuForte ? 'Chuvoso' : 'Chuva Fraca',
          descricao: 'Pancadas de chuva contínua',
          cena: dia ? 'dia-chuva' : 'noite-chuva',
          icone: 'chuva',
          efeitos: { chuva: ehChuvaNormalOuForte, chuvaFraca: !ehChuvaNormalOuForte, chuvaForte: ehChuvaNormalOuForte, neve: false, nevoa: false, tempestade: false }
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
