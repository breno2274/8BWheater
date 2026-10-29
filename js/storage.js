/**
 * 8B Wheater — Gerenciador de Armazenamento Local (localStorage)
 * 
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

export const Storage = {
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
