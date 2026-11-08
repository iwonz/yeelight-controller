import { YeelightBackgroundController } from './background-controller';
import { type YeelightDeviceOptions, YeelightDeviceTransport } from './device-transport';
import { YeelightValidationError } from './errors';
import {
  YeelightAdjustAction,
  YeelightAdjustProp,
  type YeelightColorFlowAction,
  type YeelightCron,
  type YeelightCronType,
  type YeelightDeviceInfo,
  type YeelightDeviceProps,
  type YeelightEffect,
  type YeelightFlowExpression,
  YeelightMethod,
  YeelightMusicAction,
  type YeelightPower,
  YeelightPowerMode,
  type YeelightProps,
  type YeelightResponseSuccess,
  YeelightSceneClass,
} from './types';
import {
  clampProtocolInteger,
  requireByteLength,
  requireNonEmptyString,
  requireProtocolInteger,
  validateFlowExpression,
} from './validation';

export class YeelightDevice extends YeelightDeviceTransport {
  public readonly background: YeelightBackgroundController;

  constructor(state: YeelightDeviceInfo, options: YeelightDeviceOptions = {}) {
    super(state, options);
    this.background = new YeelightBackgroundController(this);
  }

  public get main(): this {
    return this;
  }

  public async getProps(props: YeelightProps[]): Promise<YeelightDeviceProps> {
    const values = await this.getPropValues(props);
    return props.reduce<YeelightDeviceProps>((result, prop, index) => {
      result[prop] = values[index];
      return result;
    }, {});
  }

  public getPropValues(props: YeelightProps[]): Promise<string[]> {
    return super.command({
      method: YeelightMethod.GET_PROP,
      params: props,
    });
  }

  public setCtAbx(
    value: number,
    effect: YeelightEffect,
    duration: number,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_CT_ABX : YeelightMethod.SET_CT_ABX,
      params: [clampProtocolInteger(value, 'ct', 1700, 6500), effect, clampProtocolInteger(duration, 'duration', 30)],
    });
  }

  public setRgb(
    value: number,
    effect: YeelightEffect,
    duration: number,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_RGB : YeelightMethod.SET_RGB,
      params: [clampProtocolInteger(value, 'rgb', 0, 16777215), effect, clampProtocolInteger(duration, 'duration', 30)],
    });
  }

  public setHsv(
    hue: number,
    saturation: number,
    effect: YeelightEffect,
    duration: number,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_HSV : YeelightMethod.SET_HSV,
      params: [
        clampProtocolInteger(hue, 'hue', 0, 359),
        clampProtocolInteger(saturation, 'saturation', 0, 100),
        effect,
        clampProtocolInteger(duration, 'duration', 30),
      ],
    });
  }

  public setBright(
    value: number,
    effect: YeelightEffect,
    duration: number,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_BRIGHT : YeelightMethod.SET_BRIGHT,
      params: [
        clampProtocolInteger(value, 'brightness', 1, 100),
        effect,
        clampProtocolInteger(duration, 'duration', 30),
      ],
    });
  }

  public setPower(
    value: YeelightPower,
    effect: YeelightEffect,
    duration: number,
    mode: YeelightPowerMode = YeelightPowerMode.NORMAL,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_POWER : YeelightMethod.SET_POWER,
      params: [
        value,
        effect,
        clampProtocolInteger(duration, 'duration', 30),
        requireProtocolInteger(mode, 'mode', 0, 5),
      ],
    });
  }

  public toggle(): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.TOGGLE,
      params: [],
    });
  }

  public setDefault(isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_DEFAULT : YeelightMethod.SET_DEFAULT,
      params: [],
    });
  }

  public startCf(
    count: number,
    action: YeelightColorFlowAction,
    flowExpression: YeelightFlowExpression[],
    isBg: boolean,
  ): Promise<YeelightResponseSuccess> {
    requireProtocolInteger(count, 'count', 0);
    requireProtocolInteger(action, 'action', 0, 2);
    validateFlowExpression(flowExpression);
    const expressions = flowExpression
      .reduce((result, flowExpression) => {
        result.push(...flowExpression);

        return result;
      })
      .join(',');

    return super.command({
      method: isBg ? YeelightMethod.BG_START_CF : YeelightMethod.START_CF,
      params: [count, action, expressions],
    });
  }

  public stopCf(isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_STOP_CF : YeelightMethod.STOP_CF,
      params: [],
    });
  }

  public setScene(
    sceneClass: YeelightSceneClass,
    val1: number,
    val2: number,
    val3: number | string,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    const params: [YeelightSceneClass, number?, number?, (number | string)?] = [sceneClass];

    switch (sceneClass) {
      case YeelightSceneClass.COLOR:
        params.push(clampProtocolInteger(val1, 'rgb', 0, 16777215), clampProtocolInteger(val2, 'brightness', 1, 100));
        break;
      case YeelightSceneClass.HSV:
        params.push(
          clampProtocolInteger(val1, 'hue', 0, 359),
          clampProtocolInteger(val2, 'saturation', 0, 100),
          clampProtocolInteger(Number(val3), 'brightness', 1, 100),
        );
        break;
      case YeelightSceneClass.CT:
        params.push(clampProtocolInteger(val1, 'ct', 1700, 6500), clampProtocolInteger(val2, 'brightness', 1, 100));
        break;
      case YeelightSceneClass.CF:
        requireNonEmptyString(String(val3), 'flowExpression');
        params.push(0, 0, val3);
        break;
      case YeelightSceneClass.AUTO_DELAY_OFF:
        params.push(clampProtocolInteger(val1, 'brightness', 1, 100), requireProtocolInteger(val2, 'minutes', 1, 60));
        break;
    }

    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params,
    });
  }

  public setSceneColor(rgbColor: number, brightness: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params: [
        YeelightSceneClass.COLOR,
        clampProtocolInteger(rgbColor, 'rgb', 0, 16777215),
        clampProtocolInteger(brightness, 'brightness', 1, 100),
      ],
    });
  }

  public setSceneHsv(
    hue: number,
    saturation: number,
    brightness: number,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params: [
        YeelightSceneClass.HSV,
        clampProtocolInteger(hue, 'hue', 0, 359),
        clampProtocolInteger(saturation, 'saturation', 0, 100),
        clampProtocolInteger(brightness, 'brightness', 1, 100),
      ],
    });
  }

  public setSceneCt(value: number, brightness: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params: [
        YeelightSceneClass.CT,
        clampProtocolInteger(value, 'ct', 1700, 6500),
        clampProtocolInteger(brightness, 'brightness', 1, 100),
      ],
    });
  }

  public setSceneCf(flowExpression: YeelightFlowExpression[], isBg = false): Promise<YeelightResponseSuccess> {
    validateFlowExpression(flowExpression);
    const expressions = flowExpression
      .reduce((result, flowExpression) => {
        result.push(...flowExpression);

        return result;
      })
      .join(',');

    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params: [YeelightSceneClass.CF, 0, 0, expressions],
    });
  }

  public setSceneAutoDelayOff(brightness: number, minutes: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params: [
        YeelightSceneClass.AUTO_DELAY_OFF,
        clampProtocolInteger(brightness, 'brightness', 1, 100),
        requireProtocolInteger(minutes, 'minutes', 1, 60),
      ],
    });
  }

  public cronAdd(type: YeelightCronType, value: number): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.CRON_ADD,
      params: [requireProtocolInteger(type, 'type', 0, 0), clampProtocolInteger(value, 'value', 1)],
    });
  }

  public cronGet(type: YeelightCronType): Promise<YeelightCron[]> {
    return super.command({
      method: YeelightMethod.CRON_GET,
      params: [type],
    });
  }

  public cronDel(type: YeelightCronType): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.CRON_DEL,
      params: [type],
    });
  }

  public setAdjust(
    action: YeelightAdjustAction,
    prop: YeelightAdjustProp,
    isBg = false,
  ): Promise<YeelightResponseSuccess> {
    if (prop === YeelightAdjustProp.COLOR && action !== YeelightAdjustAction.CIRCLE) {
      throw new YeelightValidationError('action', 'must be circle when adjusting color');
    }
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_ADJUST : YeelightMethod.SET_ADJUST,
      params: [action, prop],
    });
  }

  public enableMusic(host: string, port: number): Promise<YeelightResponseSuccess> {
    return this.setMusic(YeelightMusicAction.TURN_ON, host, port);
  }

  public disableMusic(): Promise<YeelightResponseSuccess> {
    return this.setMusic(YeelightMusicAction.TURN_OFF);
  }

  public async setMusic(action: YeelightMusicAction, host?: string, port?: number): Promise<YeelightResponseSuccess> {
    requireProtocolInteger(action, 'action', 0, 1);
    if (action === YeelightMusicAction.TURN_ON) {
      host = requireNonEmptyString(host, 'host');
      port = requireProtocolInteger(Number(port), 'port', 1, 65535);
    }
    const result = await super.command({
      method: YeelightMethod.SET_MUSIC,
      params: action === YeelightMusicAction.TURN_OFF ? [action] : [action, host, port],
    });
    this.setCommandRateLimitBypassed(action === YeelightMusicAction.TURN_ON);
    return result;
  }

  public setName(name: string): Promise<YeelightResponseSuccess> {
    requireByteLength(name, 'name', 64);
    return super.command({
      method: YeelightMethod.SET_NAME,
      params: [name],
    });
  }

  public bgToggle(): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.BG_TOGGLE,
      params: [],
    });
  }

  public devToggle(): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.DEV_TOGGLE,
      params: [],
    });
  }

  public adjustBright(percentage: number, duration: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_ADJUST_BRIGHT : YeelightMethod.ADJUST_BRIGHT,
      params: [
        clampProtocolInteger(percentage, 'percentage', -100, 100),
        clampProtocolInteger(duration, 'duration', 30),
      ],
    });
  }

  public adjustCt(percentage: number, duration: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_ADJUST_CT : YeelightMethod.ADJUST_CT,
      params: [
        clampProtocolInteger(percentage, 'percentage', -100, 100),
        clampProtocolInteger(duration, 'duration', 30),
      ],
    });
  }

  public adjustColor(percentage: number, duration: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_ADJUST_COLOR : YeelightMethod.ADJUST_COLOR,
      params: [
        clampProtocolInteger(percentage, 'percentage', -100, 100),
        clampProtocolInteger(duration, 'duration', 30),
      ],
    });
  }
}

export { YeelightDevice as YeelightDeviceController };
