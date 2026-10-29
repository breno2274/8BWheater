#!/usr/bin/env node
/**
 * 8B Wheater — Gerador de arte em pixel (SVG)
 * ------------------------------------------------------------
 * Gera TODAS as imagens do projeto de forma procedural:
 *   • img/cenas/*.svg   → cenários (dia/noite × clima) 320×180 px
 *   • img/icones/*.svg  → ícones de clima 16×16 px com contorno automático
 *   • img/ui/*.svg      → ícones de interface (usados como máscara CSS)
 *   • img/fx/*.svg      → texturas de efeitos (chuva, neve, névoa, raios...)
 *   • img/logo.svg e img/favicon.svg
 *
 * Uso:  node scripts/gerar-arte.mjs
 * Sem dependências. Sementes fixas → resultado sempre igual.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(RAIZ, 'img');

function salvar(rel, conteudo) {
  const caminho = join(IMG, rel);
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, conteudo);
  console.log('  ✓', rel.padEnd(30), (conteudo.length / 1024).toFixed(1).padStart(6) + ' KB');
}

/* ============================================================
 * Utilidades: aleatório com semente, cores, dithering
 * ============================================================ */
function criarRng(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexParaRgb = (h) => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbParaHex = (rgb) =>
  '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const misturar = (a, b, t) => {
  const A = hexParaRgb(a), B = hexParaRgb(b);
  return rgbParaHex(A.map((v, i) => v + (B[i] - v) * t));
};
const clarear = (c, t) => misturar(c, '#ffffff', t);
const escurecer = (c, t) => misturar(c, '#000000', t);

// Matriz de Bayer 4×4 (dithering ordenado clássico dos 8/16 bits)
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((l) => l.map((v) => (v + 0.5) / 16));
const bayer = (x, y) => BAYER[y & 3][x & 3];

/* ============================================================
 * Tela de pixels com material, profundidade e emissão de luz
 * ============================================================ */
class Tela {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cor = new Array(w * h).fill(null);
    this.mat = new Array(w * h).fill('');
    this.prof = new Int8Array(w * h).fill(-1);
    this.luz = new Uint8Array(w * h);
    this.camadas = new Map();
    this.estado('ceu', -1, false);
  }
  estado(material, profundidade, emissivo) {
    this.material = material;
    this.profundidade = profundidade;
    this.emissivo = emissivo;
  }
  px(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.cor[i] = c;
    this.mat[i] = this.material;
    this.prof[i] = this.profundidade;
    this.luz[i] = this.emissivo ? 1 : 0;
  }
  ret(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  camada(classe, x, y, c) {
    if (!this.camadas.has(classe)) this.camadas.set(classe, []);
    this.camadas.get(classe).push([Math.floor(x), Math.floor(y), c]);
  }
}

/* ============================================================
 * Exportação SVG: run-length por linha + fusão vertical,
 * agrupado em um <path> por cor (arquivos bem menores)
 * ============================================================ */
function retangulos(cores, w, h) {
  let ativos = new Map();
  const fim = [];
  for (let y = 0; y < h; y++) {
    const novos = new Map();
    let x = 0;
    while (x < w) {
      const c = cores[y * w + x];
      if (!c) { x++; continue; }
      let x2 = x + 1;
      while (x2 < w && cores[y * w + x2] === c) x2++;
      const k = x + ',' + (x2 - x) + ',' + c;
      const r = ativos.get(k);
      if (r) { r.h++; ativos.delete(k); novos.set(k, r); }
      else novos.set(k, { x, y, w: x2 - x, h: 1, c });
      x = x2;
    }
    for (const r of ativos.values()) fim.push(r);
    ativos = novos;
  }
  for (const r of ativos.values()) fim.push(r);
  return fim;
}

function pathsSvg(cores, w, h) {
  const porCor = new Map();
  for (const r of retangulos(cores, w, h)) {
    if (!porCor.has(r.c)) porCor.set(r.c, []);
    porCor.get(r.c).push(`M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`);
  }
  return [...porCor]
    .map(([c, d]) => {
      const [cor, op] = c.split('|');
      return `<path fill="${cor}"${op ? ` fill-opacity="${op}"` : ''} d="${d.join('')}"/>`;
    })
    .join('');
}

function montarSvg({ w, h, titulo, corpo, estilo = '', largura, altura, preserve }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${largura ?? w}" height="${altura ?? h}" shape-rendering="crispEdges"` +
    (preserve ? ` preserveAspectRatio="${preserve}"` : '') +
    `><title>${titulo}</title>` +
    (estilo ? `<style>${estilo}</style>` : '') +
    corpo +
    `</svg>\n`
  );
}

/* ============================================================
 * CENAS
 * ============================================================ */
const W = 320, H = 180, HZ = 100;

const NUV = {
  clara: { luz: '#ffffff', base: '#eaf2fc', sombra: '#b9cce6' },
  parcial: { luz: '#ffffff', base: '#d8e1ee', sombra: '#adc0d7' },
  cinza: { luz: '#f1f3f7', base: '#c9cfd9', sombra: '#98a1b3' },
  chuva: { luz: '#a6aebe', base: '#7e879d', sombra: '#5b6480' },
  chuvaDia: { luz: '#e0e5ee', base: '#b4bece', sombra: '#8893a7' },
  tempestade: { luz: '#6b7190', base: '#484e6e', sombra: '#2f3450' },
  neve: { luz: '#ffffff', base: '#e0e7f1', sombra: '#b3bfd2' },
  nevoa: { luz: '#eef0f3', base: '#dbdfe5', sombra: '#c3c8d0' },
  poente: { luz: '#ffd9a2', base: '#ea8f88', sombra: '#984d86' },
  noite: { luz: '#8f90d0', base: '#4d4e8a', sombra: '#33346c' },
  noiteCinza: { luz: '#5c6188', base: '#3d4167', sombra: '#2a2d4d' },
  noiteChuva: { luz: '#474e6e', base: '#303653', sombra: '#20243d' },
  noiteTempestade: { luz: '#3b405e', base: '#252942', sombra: '#171a2d' },
  noiteNeve: { luz: '#9ca8d2', base: '#5f6b9e', sombra: '#424c7c' },
};

const COBERTO = { cobertura: true, tam: [40, 72], alt: [10, 17] };

const CENAS = {
  'dia-limpo': {
    periodo: 'dia', ceu: ['#2f6fdc', '#4688ea', '#62a2f2', '#86bdf7', '#b4dafb'], astro: 'sol',
    nuvens: { n: 4, pal: NUV.clara, faixa: [14, 72], tam: [22, 40], alt: [7, 11] },
    tint: null, janelas: 0, pessoas: 5, brilhoMar: '#ffffff',
  },
  'dia-parcial': {
    periodo: 'dia', ceu: ['#486790', '#5c7ba5', '#7594bc', '#95afcf', '#bdd0e5'], astro: 'sol',
    nuvens: { n: 12, pal: NUV.parcial, faixa: [8, 72], tam: [32, 60], alt: [9, 15], extras: [[196, 40, 50, 14], [220, 44, 40, 12], [148, 28, 42, 11]] },
    tint: ['#889bb2', 0.14], janelas: 0, pessoas: 4, brilhoMar: '#ffffff',
  },
  'dia-nublado': {
    periodo: 'dia', ceu: ['#7e8ba3', '#909cb3', '#a3aec2', '#b6bfcf', '#cbd2dd'],
    nuvens: { n: 16, pal: NUV.cinza, ...COBERTO }, tint: ['#8a95a8', 0.24], janelas: 0.06, pessoas: 3,
  },
  'dia-chuva': {
    periodo: 'dia', ceu: ['#687692', '#7b89a2', '#8e9bb4', '#a4b1c7', '#bcc7d9'],
    nuvens: { n: 18, pal: NUV.chuvaDia, ...COBERTO }, tint: ['#647590', 0.16], janelas: 0.08, molhado: true, pessoas: 2,
  },
  'dia-tempestade': {
    periodo: 'dia', ceu: ['#232740', '#2c3149', '#373d57', '#434a66', '#515877'],
    nuvens: { n: 20, pal: NUV.tempestade, ...COBERTO, alt: [12, 19] }, tint: ['#252b46', 0.52], janelas: 0.5, molhado: true, pessoas: 0,
  },
  'dia-neve': {
    periodo: 'dia', ceu: ['#94a9c4', '#a6b8cf', '#b8c7da', '#cad6e5', '#dde5ef'],
    nuvens: { n: 12, pal: NUV.neve, ...COBERTO, tam: [36, 60], alt: [9, 15] }, tint: ['#c2cee0', 0.16], janelas: 0.12, neve: true, pessoas: 3,
  },
  'dia-nevoa': {
    periodo: 'dia', ceu: ['#aab3bf', '#b6bec9', '#c2c9d2', '#cdd3db', '#d8dde3'],
    nuvens: { n: 6, pal: NUV.nevoa, faixa: [8, 60], tam: [40, 70], alt: [8, 12] }, tint: ['#b4bcc6', 0.2], nevoa: '#d3d8de', janelas: 0.12, pessoas: 2,
  },
  entardecer: {
    periodo: 'tarde', ceu: ['#0d1e4c', '#1b3272', '#3d2d68', '#7e2b60', '#c83f36', '#ea6526', '#f69622', '#fed058'], astro: 'sol-poente',
    nuvens: { n: 7, pal: NUV.poente, faixa: [14, 65], tam: [38, 75], alt: [4, 7] }, tint: ['#7a2e46', 0.22], janelas: 0.38, pessoas: 3, brilhoMar: '#ffb246',
  },
  'noite-limpa': {
    periodo: 'noite', ceu: ['#090720', '#131033', '#201948', '#31235c', '#4a2e6e'], astro: 'lua', estrelas: 140,
    nuvens: { n: 3, pal: NUV.noite, faixa: [20, 70], tam: [24, 40], alt: [6, 10] }, tint: ['#16133c', 0.62], janelas: 0.62, pessoas: 1, brilhoMar: '#b8b4f0',
  },
  'noite-parcial': {
    periodo: 'noite', ceu: ['#0b0a24', '#151337', '#221c4b', '#32285e', '#463270'], astro: 'lua', estrelas: 80,
    nuvens: { n: 9, pal: NUV.noite, faixa: [8, 72], tam: [28, 54], alt: [8, 13], extras: [[222, 48, 30, 10]] }, tint: ['#16133c', 0.62], janelas: 0.62, pessoas: 1, brilhoMar: '#a8a4e0',
  },
  'noite-nublada': {
    periodo: 'noite', ceu: ['#12142a', '#1a1d35', '#232741', '#2d324e', '#383e5c'], estrelas: 8,
    nuvens: { n: 16, pal: NUV.noiteCinza, ...COBERTO }, tint: ['#14162f', 0.64], janelas: 0.6, pessoas: 1,
  },
  'noite-chuva': {
    periodo: 'noite', ceu: ['#0d1121', '#141a2d', '#1c233a', '#252d47', '#2f3855'],
    nuvens: { n: 18, pal: NUV.noiteChuva, ...COBERTO }, tint: ['#0f1730', 0.66], janelas: 0.7, molhado: true, pessoas: 1,
  },
  'noite-tempestade': {
    periodo: 'noite', ceu: ['#07081a', '#0d0f23', '#14172e', '#1c203a', '#252a47'],
    nuvens: { n: 20, pal: NUV.noiteTempestade, ...COBERTO, alt: [12, 19] }, tint: ['#0c1028', 0.7], janelas: 0.65, molhado: true, pessoas: 0,
  },
  'noite-neve': {
    periodo: 'noite', ceu: ['#141a38', '#1d264d', '#28335f', '#344171', '#435184'], estrelas: 25,
    nuvens: { n: 10, pal: NUV.noiteNeve, faixa: [6, 60], tam: [30, 56], alt: [8, 13] }, tint: ['#1b2350', 0.55], janelas: 0.72, neve: true, pessoas: 1,
  },
  'noite-nevoa': {
    periodo: 'noite', ceu: ['#232740', '#2b3048', '#343952', '#3e445e', '#494f6a'],
    nuvens: { n: 5, pal: NUV.noiteCinza, faixa: [8, 60], tam: [40, 70], alt: [8, 12] }, tint: ['#1f233b', 0.6], nevoa: '#565c76', janelas: 0.62, pessoas: 0,
  },
};

const BASE = {
  montLonge: { luz: '#bccbee', base: '#96aad9', sombra: '#7d90c6' },
  cabo: { luz: '#86b48e', base: '#62947a', sombra: '#4c7a68' },
  mar: ['#5a9be0', '#3f80cc', '#2f68b4'],
  marClaro: '#a8d4f8',
  grama: { luz: '#93d46c', base: '#5ca84b', escuro: '#428c3e' },
  gramaFundo: { luz: '#7fc262', base: '#519b49', escuro: '#3b8041' },
  areia: '#ead59c',
  arvore: { luz: '#72c25c', base: '#409046', sombra: '#2a6a3b', tronco: '#6b4a38' },
  pinheiro: { luz: '#52a35a', base: '#317c4a', sombra: '#205b3b', tronco: '#5a3e30' },
  paredes: ['#f0dcb4', '#e2c08e', '#d6a97e', '#eed4b2', '#cbb5a2', '#eac6c0', '#d9caa9', '#c8d4dc'],
  telhados: [
    ['#d4634c', '#b2493b', '#8a3530'],
    ['#a34a4a', '#853b3f', '#632c35'],
    ['#5d6dab', '#485893', '#364070'],
    ['#7d5ca3', '#654a8a', '#4b356a'],
    ['#c47d42', '#a26230', '#7a4828'],
    ['#4f8a8a', '#3d7070', '#2c5454'],
  ],
  janela: '#3c4f7a',
  janelaReflexo: '#a6c8ee',
  moldura: '#f8f0e0',
  porta: '#7a4a32',
  chamine: '#8c5c4a',
  enxaimel: '#6b4636',
  pedra: ['#8c8798', '#9a95a6', '#7f7b8d', '#a39fb1', '#86818f'],
  rejunte: '#4e4a5e',
  pedraTopo: '#c1bccb',
  musgo: '#5b8b4b',
  estrada: '#a99d8f',
  estradaPedra: '#8c8176',
  estradaLuz: '#c6baa9',
  poste: '#352f45',
  flores: ['#ff6b8b', '#ffd23f', '#ff9ff3', '#ffffff'],
};

function paleta(cfg) {
  const P = structuredClone(BASE);
  if (cfg.neve) {
    P.grama = { luz: '#ffffff', base: '#e9eff8', escuro: '#cbd6e8' };
    P.gramaFundo = { luz: '#ffffff', base: '#e2e9f4', escuro: '#c6d2e6' };
    P.estrada = '#d6d9e0';
    P.estradaPedra = '#b9bdc8';
    P.estradaLuz = '#f1f4f9';
    P.areia = '#eef2f8';
    P.flores = ['#ffffff'];
  }
  return P;
}

function corCeu(cfg, x, y) {
  const cores = cfg.ceu, n = cores.length - 1;
  const t = Math.min(1, Math.max(0, y / HZ)) * n;
  const i = Math.min(n - 1, Math.floor(t));
  let f = t - i;
  f = Math.min(1, Math.max(0, (f - 0.5) * 3.2 + 0.5));
  return f > bayer(x, y) ? cores[i + 1] : cores[i];
}

function nuvem(t, rnd, cx, cy, larg, alt, pal) {
  const k = Math.max(3, Math.round(larg / 9));
  const blobs = [];
  for (let i = 0; i < k; i++) {
    const u = i / (k - 1);
    const meio = 1 - Math.abs(u - 0.5) * 2;
    const r = alt * (0.42 + 0.58 * meio) * (0.8 + rnd() * 0.35);
    blobs.push([cx - larg / 2 + u * larg, cy - r * 0.25, r]);
  }
  const base = cy + alt * 0.32;
  const dentro = (x, y) => y <= base && blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 <= r * r);
  const x0 = Math.floor(cx - larg / 2 - alt), x1 = Math.ceil(cx + larg / 2 + alt);
  const y0 = Math.floor(cy - alt * 1.4), y1 = Math.ceil(base);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!dentro(px, py)) continue;
      let c = pal.base;
      if (!dentro(px, py - 2)) c = pal.luz;
      else if (!dentro(px - 1, py - 3.5) && ((x + y) & 1) === 0) c = pal.luz;
      if (!dentro(px, py + 2)) c = pal.sombra;
      else if (!dentro(px + 2, py + 1)) c = pal.sombra;
      else if (c === pal.base && !dentro(px, py + 4) && ((x + y) & 1) === 0) c = pal.sombra;
      t.px(x, y, c);
    }
  }
}

const ESTILO_CENA =
  '.tw1{animation:b 2.8s steps(1) infinite}.tw2{animation:b 3.7s steps(1) infinite 1.1s}' +
  '.tw3{animation:b 4.6s steps(1) infinite 2.3s}.brilho{animation:b 1.9s steps(1) infinite .5s}' +
  '.pisca{animation:p 9s steps(1) infinite}' +
  '@keyframes b{0%,100%{opacity:1}50%{opacity:.15}}@keyframes p{0%,62%{opacity:0}63%,100%{opacity:1}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

const POSTES = [86, 122, 158, 236, 300];

function gerarCena(nome, cfg, semente) {
  const rnd = criarRng(semente);
  const R = (a, b) => a + rnd() * (b - a);
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const escolher = (arr) => arr[Math.floor(rnd() * arr.length)];
  const t = new Tela(W, H);
  const P = paleta(cfg);
  const luzes = [];
  const piscas = [];
  const horizonte = cfg.ceu[cfg.ceu.length - 1];
  const acender = cfg.janelas >= 0.3;

  /* ---------- Céu ---------- */
  t.estado('ceu', -1, false);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) t.px(x, y, corCeu(cfg, x, y));

  /* ---------- Estrelas ---------- */
  if (cfg.estrelas) {
    for (let i = 0; i < cfg.estrelas; i++) {
      const x = RI(0, W - 1), y = RI(0, 86);
      const c = escolher(['#ffffff', '#fff3c4', '#cfe0ff', '#ffd9f2']);
      const tipo = rnd();
      if (tipo < 0.5) t.px(x, y, misturar(corCeu(cfg, x, y), c, 0.5));
      else if (tipo < 0.9) t.camada('tw' + RI(1, 3), x, y, c);
      else {
        const cls = 'tw' + RI(1, 3);
        t.camada(cls, x, y, '#ffffff');
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) t.camada(cls, x + dx, y + dy, misturar(corCeu(cfg, x, y), c, 0.6));
      }
    }
  }

  /* ---------- Sol / Lua ---------- */
  t.estado('astro', -1, false);
  if (cfg.astro === 'sol' || cfg.astro === 'sol-poente') {
    const poente = cfg.astro === 'sol-poente';
    const [cx, cy, r] = poente ? [96, 92, 15] : [205, 42, 10];
    const halo = poente ? '#ff9436' : '#fff6c8';
    for (let y = cy - r - 14; y <= cy + r + 14; y++) {
      for (let x = cx - r - 14; x <= cx + r + 14; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const ceu = corCeu(cfg, x, y);
        if (d <= r) {
          const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r;
          let c = poente ? '#ffa034' : '#fff1a8';
          if (d < r * 0.45) c = poente ? '#fffce8' : '#fffbe8';
          else if (d < r * 0.75) c = poente ? '#ffd050' : '#fff1a8';
          if (dx + dy > 0.65) c = poente ? '#f04c1a' : '#ffd84a';
          t.px(x, y, c);
        } else if (d <= r + 3) t.px(x, y, misturar(ceu, halo, 0.65));
        else if (d <= r + 8) t.px(x, y, misturar(ceu, halo, 0.4));
        else if (d <= r + 14 && ((x + y) & 1) === 0) t.px(x, y, misturar(ceu, halo, 0.22));
      }
    }
    if (!poente) {
      // raios curtos em pixel
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        for (let s = r + 11; s <= r + 13; s++) t.px(cx + Math.cos(a) * s, cy + Math.sin(a) * s, '#fff6c8');
      }
    }
  }
  if (cfg.astro === 'lua') {
    const [cx, cy, r] = [210, 40, 9];
    const ox = cx + r * 0.55, oy = cy - r * 0.4, rc = r * 0.88;
    for (let y = cy - r - 7; y <= cy + r + 7; y++) {
      for (let x = cx - r - 7; x <= cx + r + 7; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const dc = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
        const ceu = corCeu(cfg, x, y);
        if (d <= r) {
          if (dc <= rc) { t.px(x, y, misturar(ceu, '#7a78b8', 0.16)); continue; }
          let c = '#f6f0cc';
          if (d > r - 1.2) c = '#fffbe6';
          if (dc < rc + 1.3) c = '#d9cf9f';
          t.px(x, y, c);
        } else if (d <= r + 2) t.px(x, y, misturar(ceu, '#c8c0ff', 0.25));
        else if (d <= r + 6 && ((x + y) & 1) === 0) t.px(x, y, misturar(ceu, '#c8c0ff', 0.13));
      }
    }
    for (const [dx, dy] of [[-5, 1], [-4, -3], [-6, 3], [-2, 5]]) t.px(cx + dx, cy + dy, '#e0d6a8');
  }

  /* ---------- Nuvens ---------- */
  if (cfg.nuvens) {
    const { n, pal, cobertura, faixa = [6, 70], tam, alt, extras = [] } = cfg.nuvens;
    t.estado('nuvem', -1, false);
    const lista = [];
    for (let i = 0; i < n; i++) {
      lista.push({ x: R(-20, W + 20), y: cobertura ? R(-2, 62) : R(faixa[0], faixa[1]), w: R(tam[0], tam[1]), h: R(alt[0], alt[1]) });
    }
    if (cobertura) for (let gx = -10; gx < W + 20; gx += 32) lista.push({ x: gx + R(-6, 6), y: R(-6, 6), w: R(42, 60), h: R(12, 18) });
    for (const [x, y, w, h] of extras) lista.push({ x, y, w, h });
    lista.sort((a, b) => a.y - b.y);
    for (const c of lista) nuvem(t, rnd, c.x, c.y, c.w, c.h, pal);
  }

  /* ---------- Montanhas distantes ---------- */
  const fLonge = (x) =>
    HZ - (12 + 9 * Math.sin(x * 0.021 + 1.3) + 5 * Math.sin(x * 0.057 + 0.4) + 2.2 * Math.sin(x * 0.15 + 2)) * (0.45 + (x / W) * 0.75);
  serra(t, fLonge, P.montLonge, 0, cfg.neve ? 92 : 84);
  const fCabo = (x) => {
    const u = Math.min(1, Math.max(0, (x - 6) / 132));
    return HZ + 1 - (6 + 4 * Math.sin(x * 0.07 + 0.8) + 2 * Math.sin(x * 0.17)) * Math.sin(Math.PI * u);
  };
  serra(t, fCabo, P.cabo, 1, cfg.neve ? 97 : 0);

  /* ---------- Mar ---------- */
  t.estado('agua', 2, false);
  for (let y = HZ; y < 162; y++) {
    for (let x = 0; x < W; x++) {
      const u = Math.min(1, (y - HZ) / 45) * 2;
      const i = Math.min(1, Math.floor(u));
      let f = u - i;
      f = Math.min(1, Math.max(0, (f - 0.5) * 3 + 0.5));
      let c = f > bayer(x, y) ? P.mar[i + 1] : P.mar[i];
      if (y === HZ) c = misturar(P.mar[0], '#ffffff', 0.3);
      t.px(x, y, c);
    }
  }
  for (let i = 0; i < 90; i++) {
    const y = RI(HZ + 2, 148), x = RI(0, W), len = Math.round(R(2, 5) * (1 + (y - HZ) / 30));
    const brilha = cfg.brilhoMar && rnd() < 0.3;
    for (let j = 0; j < len; j++) {
      if (brilha) t.camada('brilho', x + j, y, cfg.brilhoMar);
      else t.px(x + j, y, P.marClaro);
    }
  }
  if (cfg.astro === 'sol-poente') {
    t.estado('reflexo', 2, true);
    const solX = 96;
    for (let y = HZ + 1; y < 150; y += 2) {
      const hw = 15 * (1 - (y - HZ) / 60) + R(0, 3);
      if (hw < 1) continue;
      const off = R(-2, 2);
      for (let x = Math.round(solX - hw + off); x <= solX + hw + off; x++) if (rnd() < 0.85) t.px(x, y, y < 114 ? '#fed266' : '#ff7a36');
    }
  }

  /* ---------- Barco ---------- */
  (function barco(x, y) {
    t.estado('barco', 2, false);
    for (let i = 0; i < 14; i++) t.px(x + i, y, '#d0503e');
    for (let i = 1; i < 13; i++) t.px(x + i, y + 1, '#6a3e2c');
    for (let i = 2; i < 12; i++) t.px(x + i, y + 2, '#55301f');
    t.estado('mastro', 2, false);
    for (let j = 1; j <= 13; j++) t.px(x + 6, y - j, '#4a3428');
    for (let j = 0; j < 10; j++) {
      const w = Math.floor(j * 0.6) + 1;
      for (let i = 0; i < w; i++) t.px(x + 7 + i, y - 12 + j, i === w - 1 ? '#d8ccb8' : '#f8f0e0');
    }
    for (let j = 0; j < 6; j++) {
      const w = Math.floor(j * 0.5) + 1;
      for (let i = 0; i < w; i++) t.px(x + 5 - i, y - 7 + j, '#e8dcc8');
    }
    t.px(x + 7, y - 14, '#ff5a6a');
    t.px(x + 8, y - 14, '#ff5a6a');
    t.px(x + 6, y - 14, '#4a3428');
    if (acender) {
      t.estado('janela', 2, true);
      t.px(x + 12, y - 2, '#ffd56b');
      luzes.push({ x: x + 12.5, y: y - 1.5, r: 5, f: 0.8 });
    }
    t.estado('agua', 2, false);
    for (let i = 2; i < 13; i += 2) t.px(x + i, y + 3, escurecer(P.mar[1], 0.25));
  })(34, 122);

  /* ---------- Terrenos ---------- */
  function terreno(f, fundoF, pal, prof) {
    t.estado('chao', prof, false);
    for (let x = 0; x < W; x++) {
      const topo = f(x);
      if (topo >= H) continue;
      const fim = Math.min(H - 1, Math.round(fundoF(x, topo)));
      for (let y = topo; y <= fim; y++) {
        let c = y - topo < 1 ? pal.luz : pal.base;
        if (y - topo === 1 && (x & 1)) c = pal.luz;
        if (rnd() < 0.05) c = pal.escuro;
        t.px(x, y, c);
      }
    }
  }
  const fundoY = (x) => (x < 138 ? 999 : Math.round(103 - Math.max(0, x - 152) * 0.11 - Math.sin(x * 0.06) * 2 + Math.max(0, 152 - x) * 0.3));
  const meioY = (x) => (x < 66 ? 999 : Math.round(x < 104 ? 131 - (x - 66) * 0.22 : 122.6 - (x - 104) * 0.06 - Math.sin(x * 0.045 + 1) * 1.6));
  const frenteY = (x) => Math.round(150 - Math.sin(x * 0.035) * 1.5);

  /* ---------- Árvores, casas, igreja ---------- */
  function arvore(x, chao, r, prof) {
    const pal = P.arvore;
    t.estado('tronco', prof, false);
    for (let y = chao - r - 1; y < chao; y++) {
      t.px(x, y, pal.tronco);
      t.px(x + 1, y, escurecer(pal.tronco, 0.25));
    }
    t.estado('arvore', prof, false);
    const cy = chao - r - 2, cx = x + 1;
    const blobs = [[cx, cy, r], [cx - r * 0.55, cy + r * 0.35, r * 0.7], [cx + r * 0.55, cy + r * 0.3, r * 0.7]];
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let xx = Math.floor(cx - r * 1.4); xx <= cx + r * 1.4; xx++) {
        const px = xx + 0.5, py = y + 0.5;
        if (!blobs.some(([bx, by, br]) => (px - bx) ** 2 + (py - by) ** 2 <= br * br)) continue;
        const lx = (px - cx) / r, ly = (py - cy) / r;
        const v = -lx * 0.55 - ly * 0.75 + (bayer(xx, y) - 0.5) * 0.5;
        t.px(xx, y, v > 0.45 ? pal.luz : v < -0.35 ? pal.sombra : pal.base);
      }
    }
  }

  function pinheiro(x, chao, h, prof) {
    const pal = P.pinheiro;
    t.estado('tronco', prof, false);
    t.px(x, chao - 1, pal.tronco);
    t.px(x, chao - 2, pal.tronco);
    t.estado('arvore', prof, false);
    const tier = Math.ceil(h / 3);
    for (let i = 0; i < h; i++) {
      const y = chao - 2 - h + i;
      const j = i % tier, k = Math.floor(i / tier);
      const hw = Math.floor(j * 0.7 + k * 0.9);
      for (let dx = -hw; dx <= hw; dx++) t.px(x + dx, y, dx < 0 ? pal.luz : dx > 0 ? pal.sombra : pal.base);
    }
  }

  function janela(wx, wy, jw, jh, prof, sill) {
    t.estado('janela', prof, false);
    if (rnd() < cfg.janelas) {
      t.emissivo = true;
      const c = escolher(['#ffd56b', '#ffc65a', '#ffe28a']);
      for (let j = 0; j < jh; j++) for (let i = 0; i < jw; i++) t.px(wx + i, wy + j, j === 0 ? clarear(c, 0.3) : c);
      t.emissivo = false;
      luzes.push({ x: wx + jw / 2, y: wy + jh / 2, r: 3, f: 0.55 });
      if (acender && rnd() < 0.12) piscas.push({ x: wx, y: wy, w: jw, h: jh, prof });
    } else {
      for (let j = 0; j < jh; j++) for (let i = 0; i < jw; i++) t.px(wx + i, wy + j, i === 0 && j === 0 ? P.janelaReflexo : P.janela);
    }
    if (sill) {
      t.estado('parede', prof, false);
      for (let i = -1; i <= jw; i++) t.px(wx + i, wy + jh, P.moldura);
      if (rnd() < 0.45) {
        t.estado('flor', prof, false);
        for (let i = 0; i < jw; i++) t.px(wx + i, wy + jh - 0, rnd() < 0.5 ? escolher(P.flores) : '#4e9a40');
      }
    }
  }

  function casa(x, chao, w, h, prof, opts = {}) {
    const parede = opts.parede ?? escolher(P.paredes);
    const tel = opts.telhado ?? escolher(P.telhados);
    const topo = chao - h;
    const passo = opts.passo ?? (rnd() < 0.55 ? 1 : 2);
    t.estado('parede', prof, false);
    const sombraW = Math.max(1, Math.round(w * 0.14));
    for (let y = topo; y < chao; y++) {
      for (let xx = x; xx < x + w; xx++) {
        let c = parede;
        if (xx >= x + w - sombraW) c = escurecer(parede, 0.16);
        if (xx === x) c = clarear(parede, 0.12);
        if (y === topo) c = escurecer(parede, 0.3);
        t.px(xx, y, c);
      }
    }
    if (opts.enxaimel) {
      const mid = topo + Math.floor(h / 2);
      for (let xx = x; xx < x + w; xx++) t.px(xx, mid, P.enxaimel);
      for (let y = topo; y < chao; y++) {
        t.px(x, y, P.enxaimel);
        t.px(x + w - 1, y, P.enxaimel);
      }
      for (let k = 0; k < Math.min(mid - topo, 6); k++) {
        t.px(x + 1 + k, mid - 1 - k, P.enxaimel);
        t.px(x + w - 2 - k, mid - 1 - k, P.enxaimel);
      }
    }
    // telhado em degraus
    t.estado('telhado', prof, false);
    let esq = x - 1, dir = x + w, r = 0;
    while (dir >= esq) {
      const y = topo - 1 - r;
      const meio = (esq + dir) / 2;
      for (let xx = esq; xx <= dir; xx++) {
        let c = xx <= meio ? tel[0] : tel[1];
        if (r % 2 === 1) c = misturar(c, tel[2], 0.3);
        if (xx === esq || xx === dir || r === 0) c = tel[2];
        t.px(xx, y, c);
      }
      esq += passo;
      dir -= passo;
      r++;
    }
    // chaminé
    if (opts.chamine ?? rnd() < 0.45) {
      const cx = x + w - 3 - RI(0, Math.max(0, Math.floor(w / 4)));
      const linhas = Math.floor((x + w - (cx + 2)) / passo);
      if (linhas > 1 && linhas < r) {
        const yTel = topo - 1 - linhas;
        t.estado('chamine', prof, false);
        for (let y = yTel - 3; y <= yTel; y++) {
          t.px(cx, y, P.chamine);
          t.px(cx + 1, y, escurecer(P.chamine, 0.2));
        }
        t.px(cx - 1, yTel - 4, escurecer(P.chamine, 0.35));
        t.px(cx, yTel - 4, escurecer(P.chamine, 0.35));
        t.px(cx + 1, yTel - 4, escurecer(P.chamine, 0.35));
        t.px(cx + 2, yTel - 4, escurecer(P.chamine, 0.35));
      }
    }
    // janelas
    const jw = opts.jw ?? (w >= 12 ? 2 : 1);
    const jh = opts.jh ?? (h >= 12 ? 3 : 2);
    const cols = Math.max(1, Math.floor((w - 2) / (jw + 2)));
    const gap = (w - cols * jw) / (cols + 1);
    const limite = chao - (opts.porta ? 7 : 2);
    for (let y = topo + 2; y + jh <= limite; y += jh + 2) {
      for (let k = 0; k < cols; k++) janela(Math.round(x + gap + k * (jw + gap)), y, jw, jh, prof, opts.porta);
    }
    // porta, vitrines e toldo
    if (opts.porta) {
      const dw = w >= 18 ? 3 : 2;
      const dx = x + Math.floor((w - dw) / 2);
      if (w >= 16) {
        janela(x + 2, chao - 5, 3, 3, prof, false);
        janela(x + w - 5, chao - 5, 3, 3, prof, false);
      }
      t.estado('porta', prof, false);
      for (let j = 0; j < 5; j++) for (let i = 0; i < dw; i++) t.px(dx + i, chao - 5 + j, j === 0 ? escurecer(P.porta, 0.3) : P.porta);
      t.px(dx + dw - 1, chao - 3, '#e8c060');
      if (opts.toldo) {
        const cores = escolher([['#e04a5a', '#f8f0e0'], ['#3f8fd8', '#f8f0e0'], ['#4fae6a', '#f8f0e0'], ['#f0a030', '#fff4dc']]);
        t.estado('toldo', prof, false);
        const y0 = chao - 8;
        for (let xx = x + 1; xx < x + w - 1; xx++) {
          const c = Math.floor((xx - x) / 2) % 2 ? cores[1] : cores[0];
          t.px(xx, y0, c);
          t.px(xx, y0 + 1, c);
          if ((xx - x) % 2 === 0) t.px(xx, y0 + 2, cores[0]);
        }
      }
    }
  }

  function igreja(x, chao, prof) {
    casa(x, chao, 15, 11, prof, { parede: '#e8e0d0', telhado: P.telhados[2], passo: 1, chamine: false, jw: 1, jh: 3 });
    const tx = x + 15, tw = 8, th = 30, topo = chao - th;
    t.estado('parede', prof, false);
    for (let y = topo; y < chao; y++) {
      for (let xx = tx; xx < tx + tw; xx++) {
        let c = '#d9d1c5';
        if (xx === tx) c = '#ece6dc';
        if (xx >= tx + tw - 2) c = '#b8afa4';
        if ((y - topo) % 5 === 4 && xx > tx) c = escurecer(c, 0.08);
        t.px(xx, y, c);
      }
    }
    t.estado('janela', prof, false);
    for (let j = 0; j < 5; j++) for (let i = 2; i < 6; i++) if (!(j === 0 && (i === 2 || i === 5))) t.px(tx + i, topo + 3 + j, '#2a2440');
    t.estado('sino', prof, false);
    t.px(tx + 3, topo + 5, '#e6b84a');
    t.px(tx + 4, topo + 5, '#e6b84a');
    t.px(tx + 3, topo + 6, '#c8962e');
    t.px(tx + 4, topo + 6, '#c8962e');
    t.estado('relogio', prof, false);
    for (let y = -3; y <= 3; y++) for (let xx = -3; xx <= 3; xx++) {
      const d = Math.hypot(xx, y);
      if (d <= 2.6) t.px(tx + 4 + xx, topo + 14 + y, '#f8f4e8');
      else if (d <= 3.4) t.px(tx + 4 + xx, topo + 14 + y, '#5a5060');
    }
    t.px(tx + 4, topo + 13, '#2a2440');
    t.px(tx + 4, topo + 12, '#2a2440');
    t.px(tx + 5, topo + 14, '#2a2440');
    janela(tx + 3, topo + 20, 2, 4, prof, false);
    t.estado('telhado', prof, false);
    const tel = P.telhados[2];
    let esq = tx - 1, dir = tx + tw, r = 0;
    while (dir >= esq) {
      const y = topo - 1 - r;
      const meio = (esq + dir) / 2;
      for (let xx = esq; xx <= dir; xx++) {
        let c = xx <= meio ? tel[0] : tel[1];
        if (xx === esq || xx === dir || r === 0) c = tel[2];
        t.px(xx, y, c);
      }
      if (r % 2 === 1) { esq++; dir--; }
      r++;
    }
    t.estado('cruz', prof, false);
    const cx = tx + Math.floor(tw / 2) - (tw % 2 ? 0 : 0);
    const cyTop = topo - 1 - r;
    for (let j = 0; j < 4; j++) t.px(cx, cyTop - j, '#ffd23f');
    t.px(cx - 1, cyTop - 2, '#ffd23f');
    t.px(cx + 1, cyTop - 2, '#ffd23f');
  }

  function poste(x, base) {
    t.estado('poste', 4, false);
    for (let y = base - 13; y < base; y++) t.px(x, y, P.poste);
    t.px(x - 1, base - 1, P.poste);
    t.px(x + 1, base - 1, P.poste);
    for (let i = -1; i <= 1; i++) t.px(x + i, base - 15, P.poste);
    t.estado(acender ? 'janela' : 'poste', 4, acender);
    for (let i = -1; i <= 1; i++) t.px(x + i, base - 14, acender ? '#fff2b0' : '#c8c8d4');
    t.emissivo = false;
    if (acender) luzes.push({ x: x + 0.5, y: base - 13, r: 10, f: 0.85 });
  }

  function sprite(linhas, x, y, cores, prof, mat = 'gente') {
    t.estado(mat, prof, false);
    linhas.forEach((l, j) => [...l].forEach((ch, i) => { if (cores[ch]) t.px(x + i, y + j, cores[ch]); }));
  }

  function pessoa(x, pe) {
    const cores = {
      H: escolher(['#3a2a20', '#e8c060', '#8a4a2a', '#1a1a1a', '#c0503a']),
      S: escolher(['#f0c8a0', '#c89070', '#8a5a3a', '#e0b090']),
      C: escolher(['#e04a5a', '#4a8ae0', '#f0c040', '#5ac08a', '#a060d0', '#ff8a3a']),
      P: escolher(['#3a3a5a', '#2a4a7a', '#5a3a2a']),
    };
    sprite(['.H.', '.S.', 'CCC', 'SCS', '.P.', 'P.P'], x, pe - 6, cores, 4);
    if (cfg.molhado) {
      const u = escolher(['#e04a5a', '#ffd23f', '#3f8fd8', '#7d5ca3']);
      sprite(['..u..', '.uuu.', 'uuuuu', '..k..'], x - 1, pe - 10, { u, k: '#2a2440' }, 4);
    }
  }

  /* ---------- Morro do fundo ---------- */
  terreno(fundoY, (x, topo) => (x < 180 ? topo + (x - 138) * 1.1 + 2 : 150), P.gramaFundo, 2);
  for (let i = 0; i < 14; i++) {
    const x = RI(150, 316);
    if (rnd() < 0.4) pinheiro(x, fundoY(x) + 2, RI(6, 9), 2);
    else arvore(x, fundoY(x) + 2, RI(2, 3), 2);
  }
  for (let x = 156; x < 318;) {
    const w = RI(6, 10), h = RI(5, 8);
    casa(x, fundoY(x + w / 2) + 3, w, h, 2, { jw: 1, jh: 2 });
    x += w + RI(1, 4);
  }

  /* ---------- Terra do meio ---------- */
  terreno(meioY, (x, topo) => (x < 100 ? topo + (x - 66) * 0.9 + 2 : 155), P.grama, 3);
  t.estado('chao', 3, false);
  for (let x = 66; x < 102; x++) {
    t.px(x, meioY(x), P.areia);
    if (x < 92) t.px(x, meioY(x) + 1, P.areia);
  }
  for (let i = 0; i < 6; i++) {
    const x = RI(72, 100);
    pinheiro(x, meioY(x) + 1, RI(7, 11), 3);
  }
  const IGREJA = 196;
  for (let x = 102; x < 318;) {
    if (x > IGREJA - 14 && x < IGREJA + 25) {
      igreja(IGREJA, meioY(IGREJA + 12) + 2, 3);
      x = IGREJA + 26;
      continue;
    }
    const w = RI(10, 16), h = RI(8, 13);
    casa(x, meioY(x + w / 2) + 2, w, h, 3, {});
    x += w + RI(0, 3);
    if (rnd() < 0.3) {
      arvore(x + 2, meioY(x) + 3, RI(3, 5), 3);
      x += 7;
    }
  }

  /* ---------- Frente: passeio, casas grandes, postes, gente ---------- */
  terreno(frenteY, () => 152, P.grama, 4);
  arvore(72, frenteY(72) + 1, 7, 4);
  arvore(176, frenteY(176) + 1, 6, 4);
  pinheiro(100, frenteY(100) + 1, 12, 4);
  for (let i = 0; i < 10; i++) {
    const x = RI(80, 190);
    arvore(x, frenteY(x) + 2, 2, 4);
  }
  for (const [a, b] of [[-6, 66], [192, 326]]) {
    for (let x = a; x < b;) {
      const w = RI(16, 24), h = RI(13, 18);
      casa(x, frenteY(x + w / 2) + 1, w, h, 4, { porta: true, toldo: rnd() < 0.45, enxaimel: rnd() < 0.3, jw: 2, jh: 3 });
      x += w + RI(1, 3);
    }
  }
  // flores no gramado
  t.estado('flor', 4, false);
  for (let i = 0; i < 40; i++) {
    const x = RI(0, W);
    t.px(x, 151, escolher(P.flores));
  }
  // calçada de pedra
  t.estado('estrada', 4, false);
  for (let y = 152; y < 160; y++) {
    for (let x = 0; x < W; x++) {
      let c = P.estrada;
      if (y === 152) c = P.estradaLuz;
      else if ((y - 153) % 3 === 2 || (x + (Math.floor((y - 153) / 3) % 2) * 3) % 6 === 0) c = P.estradaPedra;
      t.px(x, y, c);
    }
  }
  for (const x of POSTES) poste(x, 154);
  // pessoas e bichinhos
  const nPessoas = cfg.pessoas ?? 0;
  for (let i = 0; i < nPessoas; i++) pessoa(RI(70, 300), RI(157, 159));
  if (cfg.periodo !== 'noite' && !cfg.molhado) {
    sprite(['....kk', 'k...kk', 'kkkkk.', 'k.k.k.'], RI(110, 170), 155, { k: '#8a5a3a' }, 4);
  }

  /* ---------- Muro de pedra ---------- */
  for (let x = 0; x < W; x++) {
    t.estado('pedraTopo', 4, false);
    t.px(x, 160, P.pedraTopo);
    t.estado('pedra', 4, false);
    t.px(x, 161, x % 9 === 0 ? P.rejunte : clarear(P.pedra[0], 0.15));
    t.px(x, 162, P.rejunte);
  }
  for (let row = 0, y = 163; y < H; row++, y += 5) {
    const off = (row % 2) * 6;
    for (let bx = -off; bx < W; bx += 12) {
      const c = escolher(P.pedra);
      t.estado('pedra', 4, false);
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 11; i++) {
          let cc = c;
          if (j === 0) cc = clarear(c, 0.12);
          if (j === 3 || i === 10) cc = escurecer(c, 0.14);
          if (rnd() < 0.04) cc = escurecer(c, 0.22);
          t.px(bx + i, y + j, cc);
        }
        t.px(bx + 11, y + j, P.rejunte);
      }
      if (rnd() < 0.2) {
        t.estado('musgo', 4, false);
        const mx = bx + RI(0, 7);
        t.px(mx, y, P.musgo);
        t.px(mx + 1, y, P.musgo);
        t.px(mx + 1, y + 1, P.musgo);
      }
    }
    t.estado('pedra', 4, false);
    for (let x = 0; x < W; x++) t.px(x, y + 4, P.rejunte);
  }
  // gatinho no muro
  sprite(['k.k..', 'kkk..', 'kkkk.', '.kkkk', '....k'], 142, 155, { k: cfg.periodo === 'noite' ? '#1a1628' : '#2a2438' }, 4);
  t.px(143, 156, cfg.periodo === 'noite' ? '#ffe14d' : '#7cf29a');

  /* ============== Pós-processamento ============== */
  const N = W * H;
  if (cfg.neve) {
    const COBRE = new Set(['telhado', 'arvore', 'chao', 'pedraTopo', 'chamine', 'barco', 'toldo', 'musgo']);
    const mats = t.mat.slice();
    for (let x = 0; x < W; x++) {
      for (let y = 1; y < H; y++) {
        const i = y * W + x;
        if (COBRE.has(mats[i]) && !COBRE.has(mats[i - W])) {
          t.cor[i] = '#f7faff';
          if (y + 1 < H && COBRE.has(mats[i + W]) && ((x + y) & 1)) t.cor[i + W] = '#dbe5f3';
        }
      }
    }
  }
  const SEM_TINTA = new Set(['ceu', 'nuvem', 'astro', 'reflexo']);
  if (cfg.tint) {
    const [tc, ta] = cfg.tint;
    for (let i = 0; i < N; i++) if (!t.luz[i] && !SEM_TINTA.has(t.mat[i])) t.cor[i] = misturar(t.cor[i], tc, ta);
  }
  const ATM = [0.5, 0.32, 0.16, 0.06, 0];
  for (let i = 0; i < N; i++) {
    if (t.prof[i] < 0 || t.luz[i]) continue;
    const a = ATM[t.prof[i]];
    if (a) t.cor[i] = misturar(t.cor[i], horizonte, a);
  }
  if (cfg.nevoa) {
    const NEV = [0.82, 0.7, 0.55, 0.36, 0.14];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (t.prof[i] >= 0) t.cor[i] = misturar(t.cor[i], cfg.nevoa, NEV[t.prof[i]] * (t.luz[i] ? 0.55 : 1));
        else if (y > 55) {
          const a = Math.min(0.6, ((y - 55) / 45) * 0.6);
          if (a > bayer(x, y) * 0.6) t.cor[i] = misturar(t.cor[i], cfg.nevoa, a);
        }
        if ((y > 112 && y < 122) || (y > 138 && y < 147)) {
          if (((x >> 1) + y) & 1) t.cor[i] = misturar(t.cor[i], cfg.nevoa, 0.3);
        }
      }
    }
  }
  if (acender) {
    for (const l of luzes) {
      for (let y = Math.floor(l.y - l.r); y <= l.y + l.r; y++) {
        for (let x = Math.floor(l.x - l.r); x <= l.x + l.r; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x;
          if (t.luz[i]) continue;
          const d = Math.hypot(x + 0.5 - l.x, y + 0.5 - l.y);
          if (d > l.r) continue;
          let a = l.f * (1 - d / l.r);
          a = Math.round(a * 4) / 4;
          if (a <= 0 || (a <= 0.25 && ((x + y) & 1))) continue;
          t.cor[i] = misturar(t.cor[i], '#ffb347', a * 0.55);
        }
      }
    }
  }
  if (cfg.molhado) {
    t.estado('reflexo', 4, true);
    for (let k = 0; k < 9; k++) {
      const cx = R(6, 314), cy = RI(154, 157), rx = R(3, 8);
      for (let x = Math.round(cx - rx); x <= cx + rx; x++) {
        t.px(x, cy, misturar(horizonte, '#ffffff', 0.12));
        if (Math.abs(x - cx) < rx - 2) t.px(x, cy + 1, misturar(horizonte, '#000000', 0.1));
      }
    }
    if (acender) for (const lx of POSTES) for (let y = 155; y < 160; y += 2) t.px(lx, y, '#ffd56b');
  }

  /* ---------- Camadas animadas ---------- */
  let extra = '';
  for (const [cls, pts] of t.camadas) {
    const buf = new Array(N).fill(null);
    for (const [x, y, c] of pts) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (cls.startsWith('tw') && t.mat[i] !== 'ceu') continue;
      if (cls === 'brilho' && t.mat[i] !== 'agua') continue;
      buf[i] = c;
    }
    extra += `<g class="${cls}">${pathsSvg(buf, W, H)}</g>`;
  }
  if (piscas.length) {
    const buf = new Array(N).fill(null);
    for (const p of piscas) {
      let c = P.janela;
      if (cfg.tint) c = misturar(c, cfg.tint[0], cfg.tint[1]);
      c = misturar(c, horizonte, ATM[p.prof]);
      for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) buf[(p.y + j) * W + p.x + i] = c;
    }
    extra += `<g class="pisca">${pathsSvg(buf, W, H)}</g>`;
  }

  return montarSvg({
    w: W, h: H, titulo: `8B Wheater — cena ${nome}`, corpo: pathsSvg(t.cor, W, H) + extra,
    estilo: ESTILO_CENA, largura: 1920, altura: 1080, preserve: 'xMidYMid slice',
  });
}

function serra(t, f, cores, prof, capa) {
  t.estado('montanha', prof, false);
  for (let x = 0; x < W; x++) {
    const topo = Math.round(f(x));
    if (topo >= HZ + 1) continue;
    const incl = f(x + 1) - f(x - 1);
    for (let y = topo; y <= HZ + 3; y++) {
      const k = y - topo;
      let c = cores.base;
      if (incl > 0.3 && k < 14 && (k < 9 || ((x + y) & 1))) c = cores.sombra;
      if (incl < -0.3 && k < 3) c = cores.luz;
      if (k === 0) c = incl > 0.3 ? cores.base : cores.luz;
      if (capa && y < capa + Math.sin(x * 0.9) * 1.5) c = incl > 0.3 ? '#cfd8ee' : '#f4f7ff';
      t.px(x, y, c);
    }
  }
}

/* ============================================================
 * ÍCONES DE CLIMA (16×16, contorno automático)
 * ============================================================ */
const CONTORNO = '#1b1530';

function icone(nome, desenhar, tam = 16) {
  const t = new Tela(tam, tam);
  const comps = [];
  desenhar((fn, contorno = true) => {
    const m = new Map();
    fn((x, y, c) => {
      x = Math.floor(x); y = Math.floor(y);
      if (x >= 0 && y >= 0 && x < tam && y < tam && c) m.set(x + ',' + y, c);
    });
    comps.push({ m, contorno });
  });
  for (const { m, contorno } of comps) {
    if (contorno) {
      for (const k of m.keys()) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!m.has(x + dx + ',' + (y + dy))) t.px(x + dx, y + dy, CONTORNO);
      }
    }
    for (const [k, c] of m) {
      const [x, y] = k.split(',').map(Number);
      t.px(x, y, c);
    }
  }
  return montarSvg({ w: tam, h: tam, titulo: nome, corpo: pathsSvg(t.cor, tam, tam), largura: tam * 4, altura: tam * 4 });
}

const disco = (cx, cy, r) => (x, y) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
function preencher(set, teste, cor, tam = 16) {
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (teste(x, y)) set(x, y, typeof cor === 'function' ? cor(x, y) : cor);
}
function formaNuvem(ox, oy, s = 1) {
  const discos = [[4.5, 9.5, 2.8], [8, 7, 3.8], [11.8, 9.5, 2.8]].map(([x, y, r]) => [ox + x * s, oy + y * s, r * s]);
  const base = oy + 12.5 * s, esq = ox + 2 * s, dir = ox + 14.5 * s;
  return (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (py > base) return false;
    if (py >= oy + 9.5 * s && px >= esq && px <= dir) return true;
    return discos.some(([cx, cy, r]) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r);
  };
}
const corNuvem = (teste, pal) => (x, y) => (!teste(x, y - 1) ? pal[0] : !teste(x, y + 1) || !teste(x + 1, y) ? pal[2] : pal[1]);
const PN = {
  clara: ['#ffffff', '#e3ecf7', '#a9bcd6'],
  cinza: ['#dfe4ec', '#b4bdcc', '#7f8aa0'],
  chuva: ['#c8d6ea', '#93a6c4', '#65789a'],
  escura: ['#9aa2b8', '#6b7390', '#4a5170'],
  neve: ['#ffffff', '#eaf2fb', '#b8c8e0'],
};
const corSol = (cx, cy) => (x, y) => {
  const s = x + 0.5 - cx + (y + 0.5 - cy);
  return s < -2.2 ? '#fff6b8' : s > 2 ? '#ff9f1c' : '#ffd23f';
};
const corLua = (cx, cy) => (x, y) => (x + 0.5 - cx + (y + 0.5 - cy) > 1.5 ? '#d9cf98' : '#f6efc4');

function solPequeno(comp, cx, cy, r, raios) {
  comp((set) => raios.forEach(([x, y]) => set(x, y, '#ffb627')));
  comp((set) => preencher(set, disco(cx, cy, r), corSol(cx, cy)));
}
function luaCrescente(comp, cx, cy, r) {
  const cheio = disco(cx, cy, r), corte = disco(cx + r * 0.53, cy - r * 0.4, r * 0.83);
  comp((set) => preencher(set, (x, y) => cheio(x, y) && !corte(x, y), corLua(cx, cy)));
}
function nuvemComp(comp, ox, oy, s, pal) {
  const f = formaNuvem(ox, oy, s);
  comp((set) => preencher(set, f, corNuvem(f, pal)));
}
function gotas(comp, lista) {
  lista.forEach(([x, y]) => comp((set) => { set(x, y, '#a8dcff'); set(x, y + 1, '#4fa3ff'); }));
}

const ICONES = {
  sol: (c) => solPequeno(c, 8, 8, 4.6, [[7, 1], [8, 1], [7, 14], [8, 14], [1, 7], [1, 8], [14, 7], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]),
  lua: (c) => {
    luaCrescente(c, 7.5, 8.5, 5.8);
    c((set) => { set(13, 3, '#ffffff'); set(12, 3, '#c8dcff'); set(14, 3, '#c8dcff'); set(13, 2, '#c8dcff'); set(13, 4, '#c8dcff'); set(13, 12, '#fff6b8'); }, false);
  },
  'sol-nuvem': (c) => {
    solPequeno(c, 6, 6, 3.6, [[5, 0], [6, 0], [0, 5], [0, 6], [1, 1], [10, 1], [1, 10], [11, 5], [11, 6]]);
    nuvemComp(c, 1.5, 2.8, 0.9, PN.clara);
  },
  'lua-nuvem': (c) => {
    luaCrescente(c, 6, 6.5, 4.8);
    c((set) => { set(13, 2, '#ffffff'); set(12, 2, '#c8dcff'); set(14, 2, '#c8dcff'); set(13, 1, '#c8dcff'); set(13, 3, '#c8dcff'); }, false);
    nuvemComp(c, 1.5, 2.8, 0.9, PN.clara);
  },
  nublado: (c) => {
    nuvemComp(c, -1.5, -3, 0.85, PN.cinza);
    nuvemComp(c, 1, 1.5, 0.92, PN.clara);
  },
  chuva: (c) => {
    nuvemComp(c, 0, -2.2, 1, PN.chuva);
    gotas(c, [[4, 12], [8, 13], [12, 12]]);
  },
  'sol-chuva': (c) => {
    solPequeno(c, 5.5, 5, 3.2, [[5, 0], [0, 4], [0, 5], [1, 1], [9, 0]]);
    nuvemComp(c, 1.5, -1.2, 0.9, PN.chuva);
    gotas(c, [[5, 13], [9, 14], [13, 13]]);
  },
  'lua-chuva': (c) => {
    luaCrescente(c, 5.5, 5.5, 4.4);
    nuvemComp(c, 1.5, -1.2, 0.9, PN.chuva);
    gotas(c, [[5, 13], [9, 14], [13, 13]]);
  },
  tempestade: (c) => {
    nuvemComp(c, 0, -2.2, 1, PN.escura);
    gotas(c, [[3, 12], [12, 12]]);
    c((set) => [[8, 10], [9, 10], [7, 11], [8, 11], [6, 12], [7, 12], [8, 12], [9, 12], [8, 13], [7, 14]].forEach(([x, y]) => set(x, y, '#ffe14d')));
  },
  neve: (c) => {
    nuvemComp(c, 0, -2.2, 1, PN.neve);
    for (const [x, y] of [[4, 13], [11, 13]]) c((set) => { set(x, y, '#cfe6ff'); set(x - 1, y, '#ffffff'); set(x + 1, y, '#ffffff'); set(x, y - 1, '#ffffff'); set(x, y + 1, '#ffffff'); });
    c((set) => set(8, 14, '#ffffff'));
  },
  nevoa: (c) => {
    nuvemComp(c, 0, -3.5, 1, PN.cinza);
    c((set) => { for (let x = 1; x <= 9; x++) set(x, 10, '#e6ebf1'); });
    c((set) => { for (let x = 5; x <= 14; x++) set(x, 12, '#d3dae3'); });
    c((set) => { for (let x = 2; x <= 11; x++) set(x, 14, '#e6ebf1'); });
  },
};

/* ============================================================
 * ÍCONES DE INTERFACE (máscaras monocromáticas em ASCII)
 * ============================================================ */
const UI = {
  lupa: ['..XXX......', '.X...X.....', 'X.....X....', 'X.....X....', 'X.....X....', '.X...X.....', '..XXXXX....', '......XX...', '.......XX..', '........XX.', '.........XX'],
  pin: ['...XXXX...', '..XXXXXX..', '.XXX..XXX.', '.XX....XX.', '.XXX..XXX.', '..XXXXXX..', '...XXXX...', '....XX....', '....XX....', '....XX....'],
  alvo: ['.....X.....', '...XXXXX...', '..X..X..X..', '.X.......X.', '.X..XXX..X.', 'XXX.XXX.XXX', '.X..XXX..X.', '.X.......X.', '..X..X..X..', '...XXXXX...', '.....X.....'],
  atualizar: ['...XXXXX...', '..X.....XX.', '.X.....XXX.', 'X.......XX.', 'X..........', 'X.........X', '..........X', '.XX.......X', '.XXX.....X.', '.XX.....X..', '...XXXXX...'],
  compartilhar: ['......XXXXX', '........XXX', '.......XX.X', '......XX..X', 'XXXX.XX....', 'X...XX.....', 'X..XX......', 'X..........', 'X.........X', 'X.........X', 'XXXXXXXXXXX'],
  menu: ['..........', 'XXXXXXXXXX', 'XXXXXXXXXX', '..........', 'XXXXXXXXXX', 'XXXXXXXXXX', '..........', 'XXXXXXXXXX', 'XXXXXXXXXX', '..........'],
  fechar: ['XX......XX', 'XXX....XXX', '.XXX..XXX.', '..XXXXXX..', '...XXXX...', '...XXXX...', '..XXXXXX..', '.XXX..XXX.', 'XXX....XXX', 'XX......XX'],
  gota: ['....XX....', '....XX....', '...XXXX...', '...XXXX...', '..XXXXXX..', '.XXXXXXXX.', '.XX.XXXXX.', '.XX.XXXXX.', '..XX.XXX..', '...XXXX...'],
  vento: ['.......XX..', '.........X.', 'XXXXXXXXX..', '...........', 'XXXXXXXXXXX', '...........', 'XXXXXXX....', '.......X...', '......X....'],
  guarda: ['.....X.....', '...XXXXX...', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'X.XX.X.XX.X', '.....X.....', '.....X.....', '.....X.....', '.....X.....', '.....X.X...', '......X....'],
  termometro: ['....XXX....', '....X.X....', '....X.X....', '....XXX....', '....XXX....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '..XXXXXXX..', '..XXXXXXX..', '...XXXXX...'],
  nascer: ['.....X.....', '....XXX....', '...X.X.X...', '.....X.....', '...........', 'X..XXXXX..X', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '...........', 'XXXXXXXXXXX'],
  por: ['.....X.....', '...X.X.X...', '....XXX....', '.....X.....', '...........', 'X..XXXXX..X', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '...........', 'XXXXXXXXXXX'],
  olho: ['...XXXXX...', '.XX.....XX.', 'X...XXX...X', 'X..XXXXX..X', 'X...XXX...X', '.XX.....XX.', '...XXXXX...'],
  pressao: ['...XXXXX...', '.XX.....XX.', '.X..X....X.', 'X....X....X', 'X.....X...X', 'X....XXX..X', 'X.........X', '.X.......X.', '.XX.....XX.', '...XXXXX...'],
  estrela: ['.....X.....', '.....X.....', '....XXX....', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '..XXXXXXX..', '..XXX.XXX..', '.XX.....XX.', '.X.......X.'],
  'estrela-vazia': ['.....X.....', '.....X.....', '....X.X....', 'XXXXX.XXXXX', '.X.......X.', '..X.....X..', '...X...X...', '..X.....X..', '..X..X..X..', '.X.X...X.X.', '.XX.....XX.'],
  lixeira: ['...XXXX...', 'XXXXXXXXXX', '..........', '.XXXXXXXX.', '.X.X..X.X.', '.X.X..X.X.', '.X.X..X.X.', '.X.X..X.X.', '.X.X..X.X.', '.XXXXXXXX.'],
  'seta-esq': ['......X', '....XXX', '..XXXXX', 'XXXXXXX', '..XXXXX', '....XXX', '......X'],
  'seta-dir': ['X......', 'XXX....', 'XXXXX..', 'XXXXXXX', 'XXXXX..', 'XXX....', 'X......'],
  casa: ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '.XXXXXXXXX.', '.XXX...XXX.', '.XXX...XXX.', '.XXX...XXX.', '.XXX...XXX.'],
  relogio: ['...XXXXX...', '.XX.....XX.', '.X...X...X.', 'X....X....X', 'X....X....X', 'X....XXX..X', 'X.........X', 'X.........X', '.X.......X.', '.XX.....XX.', '...XXXXX...'],
  som: ['....X......', '...XX....X.', 'XXXXX..X..X', 'XXXXX...X.X', 'XXXXX...X.X', 'XXXXX...X.X', 'XXXXX..X..X', '...XX....X.', '....X......'],
  'som-off': ['....X......', '...XX......', 'XXXXX.X...X', 'XXXXX..X.X.', 'XXXXX...X..', 'XXXXX..X.X.', 'XXXXX.X...X', '...XX......', '....X......'],
  tv: ['..X.....X..', '...X...X...', '....X.X....', 'XXXXXXXXXXX', 'X.........X', 'X.XXXXXX..X', 'X.XXXXXX.XX', 'X.XXXXXX..X', 'X.........X', 'XXXXXXXXXXX'],
  uv: ['.....X.....', '..X..X..X..', '...X...X...', '....XXX....', 'XX.XXXXX.XX', '....XXX....', '...X...X...', '..X..X..X..', '.....X.....'],
  nuvem: ['...........', '....XXX....', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.'],
  ornamento: [
    '..XXX...................',
    '.X...X..................',
    'X..X..X.................',
    'X.X.X.XXXXXXXXXXXXXXXXXX',
    'X.X...X.................',
    '.X...X..XXXXXXXXXXXXXXXX',
    '..XXX...................',
  ],
};

function iconeUi(nome, linhas) {
  const w = Math.max(...linhas.map((l) => l.length)), h = linhas.length;
  const t = new Tela(w, h);
  linhas.forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'X') t.px(x, y, '#ffffff'); }));
  return montarSvg({ w, h, titulo: nome, corpo: pathsSvg(t.cor, w, h), largura: w * 3, altura: h * 3 });
}

/* ============================================================
 * TEXTURAS DE EFEITOS
 * ============================================================ */
function fxChuva(nome, w, h, n, min, max, semente) {
  const rnd = criarRng(semente);
  const t = new Tela(w, h);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h), len = min + Math.floor(rnd() * (max - min + 1));
    for (let j = 0; j < len; j++) t.px(x, (y + j) % h, j === len - 1 ? '#ffffff|0.9' : '#bfe0ff|0.7');
  }
  return montarSvg({ w, h, titulo: nome, corpo: pathsSvg(t.cor, w, h) });
}

function fxNeve(semente) {
  const rnd = criarRng(semente);
  const w = 64, h = 64, t = new Tela(w, h);
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h), tipo = rnd();
    if (tipo < 0.5) t.px(x, y, '#ffffff|0.85');
    else if (tipo < 0.82) { t.px(x, y, '#ffffff'); t.px((x + 1) % w, y, '#ffffff'); t.px(x, (y + 1) % h, '#ffffff'); t.px((x + 1) % w, (y + 1) % h, '#e3efff'); }
    else { t.px(x, y, '#ffffff'); t.px((x + 1) % w, y, '#dcebff'); t.px((x + w - 1) % w, y, '#dcebff'); t.px(x, (y + 1) % h, '#dcebff'); t.px(x, (y + h - 1) % h, '#dcebff'); }
  }
  return montarSvg({ w, h, titulo: 'neve', corpo: pathsSvg(t.cor, w, h) });
}

function fxNevoa() {
  const w = 96, h = 24, t = new Tela(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.exp(-(((y - 12) / 6.5) ** 2)) * (0.62 + 0.38 * Math.sin((x / w) * Math.PI * 4));
      if (d * 0.95 > bayer(x, y)) t.px(x, y, '#ffffff|0.55');
    }
  }
  return montarSvg({ w, h, titulo: 'névoa', corpo: pathsSvg(t.cor, w, h), preserve: 'none' });
}

function fxNuvem(nome, w, h, semente, partes) {
  const rnd = criarRng(semente);
  const t = new Tela(w, h);
  for (const [cx, cy, lw, lh] of partes) nuvem(t, rnd, cx, cy, lw, lh, NUV.clara);
  return montarSvg({ w, h, titulo: nome, corpo: pathsSvg(t.cor, w, h) });
}

function fxRaio(nome, semente) {
  const rnd = criarRng(semente);
  const w = 40, h = 110, t = new Tela(w, h);
  const nucleo = [];
  function ramo(x, y, comp, espessura) {
    for (let i = 0; i < comp && y < h; i++) {
      nucleo.push([x, y, espessura]);
      y++;
      if (rnd() < 0.45) x += rnd() < 0.5 ? -1 : 1;
      if (rnd() < 0.08) x += rnd() < 0.5 ? -2 : 2;
      if (espessura > 1 && rnd() < 0.035) ramo(x, y, 12 + Math.floor(rnd() * 20), 1);
    }
  }
  ramo(20, 0, h, 2);
  for (const [x, y] of nucleo) for (const [dx, dy] of [[-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) t.px(x + dx, y + dy, '#8aa0ff|0.45');
  for (const [x, y, e] of nucleo) { t.px(x, y, '#ffffff'); if (e > 1) t.px(x + 1, y, '#e8eeff'); }
  return montarSvg({ w, h, titulo: nome, corpo: pathsSvg(t.cor, w, h) });
}

function fxPassaro() {
  const frames = [
    ['X.....X', '.X...X.', '..XXX..', '.......'],
    ['.......', '..XXX..', '.X...X.', 'X.....X'],
  ];
  const t = new Tela(14, 4);
  frames.forEach((f, k) => f.forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'X') t.px(x + k * 7, y, '#1d1a33'); })));
  return montarSvg({ w: 14, h: 4, titulo: 'pássaro', corpo: pathsSvg(t.cor, 14, 4) });
}

function fxMuro() {
  const rnd = criarRng(77);
  const w = 48, h = 24, t = new Tela(w, h);
  const cores = ['#5d5878', '#6a6488', '#545070', '#726c90', '#605a7e'];
  for (let row = 0; row < 4; row++) {
    const y = row * 6, off = (row % 2) * 6;
    for (let x = 0; x < w; x++) t.px(x, y + 5, '#2c2840');
    for (let b = -1; b < 5; b++) {
      const bx = b * 12 + off;
      const c = cores[Math.floor(rnd() * cores.length)];
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 11; i++) {
          let cc = c;
          if (j === 0) cc = clarear(c, 0.14);
          if (j === 4 || i === 10) cc = escurecer(c, 0.18);
          if (rnd() < 0.05) cc = escurecer(c, 0.25);
          t.px((bx + i + w) % w, y + j, cc);
        }
        t.px((bx + 11 + w) % w, y + j, '#2c2840');
      }
    }
  }
  return montarSvg({ w, h, titulo: 'muro', corpo: pathsSvg(t.cor, w, h) });
}

/* ============================================================
 * Execução
 * ============================================================ */
console.log('\n🎨 8B Wheater — gerando arte em pixel...\n');
console.log('Cenas:');
let semente = 8;
for (const [nome, cfg] of Object.entries(CENAS)) salvar(`cenas/${nome}.svg`, gerarCena(nome, cfg, semente++ * 0 + 2024));

console.log('\nÍcones de clima:');
for (const [nome, fn] of Object.entries(ICONES)) salvar(`icones/${nome}.svg`, icone(nome, fn));

console.log('\nÍcones de interface:');
for (const [nome, linhas] of Object.entries(UI)) salvar(`ui/${nome}.svg`, iconeUi(nome, linhas));

console.log('\nEfeitos:');
salvar('fx/chuva.svg', fxChuva('chuva', 48, 96, 26, 4, 7, 11));
salvar('fx/chuva-perto.svg', fxChuva('chuva perto', 64, 128, 12, 8, 13, 12));
salvar('fx/neve.svg', fxNeve(13));
salvar('fx/nevoa.svg', fxNevoa());
salvar('fx/nuvem-a.svg', fxNuvem('nuvem a', 64, 22, 21, [[32, 13, 44, 12]]));
salvar('fx/nuvem-b.svg', fxNuvem('nuvem b', 96, 26, 22, [[40, 15, 50, 13], [66, 18, 36, 9]]));
salvar('fx/nuvem-c.svg', fxNuvem('nuvem c', 48, 16, 23, [[24, 10, 30, 8]]));
salvar('fx/raio-a.svg', fxRaio('raio a', 31));
salvar('fx/raio-b.svg', fxRaio('raio b', 47));
salvar('fx/passaro.svg', fxPassaro());
salvar('fx/muro.svg', fxMuro());

console.log('\nMarca:');
salvar('logo.svg', icone('8B Wheater', ICONES['sol-nuvem']));
salvar('favicon.svg', icone('8B Wheater', ICONES['sol-nuvem']));
console.log('\n✨ Pronto!\n');
