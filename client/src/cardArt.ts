/**
 * 卡面插画配置（开发者配置，玩家不可自助更换）。
 *
 * 想换某张卡的卡面图案：替换 `client/public/cards/<文件名>.jpg` 即可，
 * 或在下方对应 map 中指向新的图片路径。
 */

/** 特殊卡卡面插画：defId -> 图片路径 */
export const CARD_ART: Record<string, string> = {
  silver_moon: '/cards/silver_moon.jpg',
  steam_core: '/cards/steam_core.jpg',
  stand_in: '/cards/stand_in.jpg',
  fate_coin: '/cards/fate_coin.jpg',
  silence: '/cards/silence.jpg',
  twin: '/cards/twin.jpg',
  rewind: '/cards/rewind.jpg',
  gambler: '/cards/gambler.jpg',
  night_watch: '/cards/night_watch.jpg',
  imperial_decree: '/cards/imperial_decree.jpg',
};

/** 基础花色底图：suit -> 图片路径（每张花色共用一张朴素底图） */
export const SUIT_ART: Record<string, string> = {
  sun: '/cards/sun.jpg',
  moon: '/cards/moon.jpg',
  star: '/cards/star.jpg',
  flower: '/cards/flower.jpg',
};
