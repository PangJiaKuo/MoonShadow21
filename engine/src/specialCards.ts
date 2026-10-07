/**
 * 首批特殊卡牌池（10 张，原创名称）。
 * 特殊卡与基础牌一起构成玩家个人卡组：对局中可被抽到，也可通过商城购买后装备进卡组。
 * 系列名《创始系列》为原创，不涉及任何第三方作品专有名词。
 */
import type { SpecialCardDef } from '@moon21/shared';

export const SPECIAL_CARDS: SpecialCardDef[] = [
  {
    id: 'silver_moon',
    name: '银月',
    series: '创始系列',
    rarity: 'legendary',
    suit: 'special',
    baseValue: 2,
    effect: { trigger: 'OnDraw', type: 'adjustValue', params: { min: 1, max: 5 } },
    description: '抽到时，可将此牌点数在 1-5 之间调整。',
  },
  {
    id: 'steam_core',
    name: '蒸汽核心',
    series: '创始系列',
    rarity: 'epic',
    suit: 'special',
    baseValue: 5,
    effect: {
      trigger: 'OnDraw',
      type: 'adjustValue',
      params: { values: [9, 10], condition: 'allSun' },
    },
    description: '若手牌全部为太阳花色，此牌点数可设为 9 或 10。',
  },
  {
    id: 'stand_in',
    name: '替身',
    series: '创始系列',
    rarity: 'rare',
    suit: 'special',
    baseValue: 9,
    effect: { trigger: 'OnDraw', type: 'swapCard', params: { target: 'opponentHidden' } },
    description: '抽到时，可与上一家一张暗牌互换；上一家无暗牌则无效。',
  },
  {
    id: 'fate_coin',
    name: '命运硬币',
    series: '创始系列',
    rarity: 'rare',
    suit: 'special',
    baseValue: 6,
    effect: { trigger: 'OnDraw', type: 'redraw', params: { count: 1 } },
    description: '抽到时，可弃置一张手牌并重新抽一张。',
  },
  {
    id: 'silence',
    name: '沉默',
    series: '创始系列',
    rarity: 'epic',
    suit: 'special',
    baseValue: 3,
    effect: { trigger: 'Passive', type: 'negate', params: { target: 'opponentSpecial' } },
    description: '此牌在手牌中时，上一家的特殊卡效果无效。',
  },
  {
    id: 'twin',
    name: '双生',
    series: '创始系列',
    rarity: 'legendary',
    suit: 'special',
    baseValue: 8,
    effect: { trigger: 'OnDraw', type: 'split', params: { divisor: 2 } },
    description: '抽到时，可将此牌拆分为两张点数减半（向下取整）的牌。',
  },
  {
    id: 'rewind',
    name: '回溯',
    series: '创始系列',
    rarity: 'rare',
    suit: 'special',
    baseValue: 11,
    effect: { trigger: 'OnStand', type: 'discardRedraw', params: { mustStandAfter: true } },
    description: '停牌时，可弃置一张手牌并重新抽一张，然后必须停牌。',
  },
  {
    id: 'gambler',
    name: '赌徒',
    series: '创始系列',
    rarity: 'epic',
    suit: 'special',
    baseValue: 7,
    effect: { trigger: 'OnDraw', type: 'doubleOrNothing', params: { multiplier: 2 } },
    description: '抽到此牌后，可声明“加倍”：再抽一张，未爆则本局总点数×2，爆则直接出局。',
  },
  {
    id: 'night_watch',
    name: '守夜人',
    series: '创始系列',
    rarity: 'legendary',
    suit: 'special',
    baseValue: 4,
    effect: { trigger: 'OnCompare', type: 'forceRedraw', params: { triggerOnOpponent21: true } },
    description: '上一家达到 21 点时，可弃置此牌，强制其弃一张并重抽一张。',
  },
  {
    id: 'imperial_decree',
    name: '皇帝密令',
    series: '创始系列',
    rarity: 'epic',
    suit: 'special',
    baseValue: 13,
    effect: {
      trigger: 'OnDraw',
      type: 'fixedValue',
      params: { value: 13, cannotStandThisTurn: true },
    },
    description: '此牌点数固定为 13，抽到后本回合必须再抽一张，不可停牌。',
  },
];

export const SPECIAL_BY_ID = new Map<string, SpecialCardDef>(SPECIAL_CARDS.map((c) => [c.id, c]));
