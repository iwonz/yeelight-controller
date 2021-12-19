export enum YeelightDiscoveryEvents {
  DISCONNECT = 'DISCONNECT',
  DISCOVER_DEVICE = 'DISCOVER_DEVICE',
  CONNECT_DEVICE = 'CONNECT_DEVICE',
  DISCONNECT_DEVICE = 'DISCONNECT_DEVICE',
  DEVICE_CHANGE_PROPS = 'DEVICE_CHANGE_PROPS',
  DEVICE_DATA = 'DEVICE_DATA',
  DEVICE_ERROR = 'DEVICE_ERROR',
}

export enum YeelightDeviceEvents {
  CONNECT = 'CONNECT',
  DISCONNECT = 'DISCONNECT',
  PROPS_CHANGE = 'PROPS_CHANGE',
  DATA = 'DATA',
  ERROR = 'ERROR',
}

export enum YeelightPower {
  ON = 'on',
  OFF = 'off',
}

export enum YeelightPowerMode {
  NORMAL,
  CT,
  RGB,
  HSV,
  COLOR_FLOW,
  NIGHT_LIGHT_MODE,
}

export enum YeelightColorFlowAction {
  RECOVER,
  STAY,
  TURN_OFF,
}

export enum YeelightFlowExpressionMode {
  COLOR = 1,
  COLOR_TEMPERATURE = 2,
  SLEEP = 7,
}

export enum YeelightCronType {
  POWER_OFF,
}

export interface YeelightCron {
  type: YeelightCronType;
  delay: number;
  mix: number;
}

export enum YeelightAdjustAction {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  CIRCLE = 'circle',
}

export enum YeelightAdjustProp {
  BRIGHT = 'bright',
  CT = 'ct',
  COLOR = 'color',
}

export enum YeelightMusicAction {
  TURN_OFF,
  TURN_ON,
}

export type YeelightFlowExpression = [number, YeelightFlowExpressionMode, number, number];

export enum YeelightSceneClass {
  COLOR = 'color',
  HSV = 'hsv',
  CT = 'ct',
  CF = 'cf',
  AUTO_DELAY_OFF = 'auto_dealy_off',
}

export enum YeelightMethod {
  GET_PROP = 'get_prop',
  SET_CT_ABX = 'set_ct_abx',
  SET_RGB = 'set_rgb',
  SET_HSV = 'set_hsv',
  SET_BRIGHT = 'set_bright',
  SET_POWER = 'set_power',
  TOGGLE = 'toggle',
  SET_DEFAULT = 'set_default',
  START_CF = 'start_cf',
  STOP_CF = 'stop_cf',
  SET_SCENE = 'set_scene',
  CRON_ADD = 'cron_add',
  CRON_GET = 'cron_get',
  CRON_DEL = 'cron_del',
  SET_ADJUST = 'set_adjust',
  SET_MUSIC = 'set_music',
  SET_NAME = 'set_name',
  BG_SET_RGB = 'bg_set_rgb',
  BG_SET_HSV = 'bg_set_hsv',
  BG_SET_CT_ABX = 'bg_set_ct_abx',
  BG_START_CF = 'bg_start_cf',
  BG_STOP_CF = 'bg_stop_cf',
  BG_SET_SCENE = 'bg_set_scene',
  BG_SET_DEFAULT = 'bg_set_default',
  BG_SET_POWER = 'bg_set_power',
  BG_SET_BRIGHT = 'bg_set_bright',
  BG_SET_ADJUST = 'bg_set_adjust',
  BG_TOGGLE = 'bg_toggle',
  DEV_TOGGLE = 'dev_toggle',
  ADJUST_BRIGHT = 'adjust_bright',
  ADJUST_CT = 'adjust_ct',
  ADJUST_COLOR = 'adjust_color',
  BG_ADJUST_BRIGHT = 'bg_adjust_bright',
  BG_ADJUST_CT = 'bg_adjust_ct',
  BG_ADJUST_COLOR = 'bg_adjust_color',
}

export interface YeelightCommand {
  id?: number;
  method: YeelightMethod;
  params: any[];
}

export interface YeelightDeviceInfo {
  id?: string;

  model?: string;
  version?: number;
  support?: YeelightMethod[];

  location?: string;
  host: string;
  port: number;
}

export enum YeelightProps {
  POWER = 'power',
  BRIGHT = 'bright',
  CT = 'ct',
  RGB = 'rgb',
  HUE = 'hue',
  SAT = 'sat',
  COLOR_MODE = 'color_mode',
  FLOWING = 'flowing',
  DELAYOFF = 'delayoff',
  FLOW_PARAMS = 'flow_params',
  MUSIC_ON = 'music_on',
  NAME = 'name',
  BG_POWER = 'bg_power',
  BG_FLOWING = 'bg_flowing',
  BG_FLOW_PARAMS = 'bg_flow_params',
  BG_CT = 'bg_ct',
  BG_LMODE = 'bg_lmode',
  BG_BRIGHT = 'bg_bright',
  BG_RGB = 'bg_rgb',
  BG_HUE = 'bg_hue',
  BG_SAT = 'bg_sat',
  NL_BR = 'nl_br',
  ACTIVE_MODE = 'active_mode',
}

export const YEELIGHT_PROPS = Object.values(YeelightProps);

export type YeelightDeviceProps = {
  [key in YeelightProps]?: string;
};

export enum YeelightEffect {
  SUDDEN = 'sudden',
  SMOOTH = 'smooth',
}

export type YeelightResponseSuccess = ['ok'];
