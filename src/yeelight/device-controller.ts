import { YeelightDevice } from './device';
import {
  YeelightAdjustAction,
  YeelightAdjustProp,
  YeelightColorFlowAction,
  YeelightCron,
  YeelightCronType,
  YeelightDeviceInfo,
  YeelightDeviceProps,
  YeelightEffect,
  YeelightFlowExpression,
  YeelightMethod,
  YeelightMusicAction,
  YeelightPower,
  YeelightPowerMode,
  YeelightProps,
  YeelightResponseSuccess,
  YeelightSceneClass,
} from './types';
import { clamp } from '../utils';

export class YeelightDeviceController extends YeelightDevice {
  constructor(state: YeelightDeviceInfo) {
    super(state);
  }

  public getProps(props: YeelightProps[]): Promise<YeelightDeviceProps> {
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
      params: [clamp(value, 1700, 6500), effect, clamp(duration, 30)],
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
      params: [clamp(value, 0, 16777215), effect, clamp(duration, 30)],
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
      params: [clamp(hue, 0, 359), clamp(saturation, 0, 100), effect, clamp(duration, 30)],
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
      params: [clamp(value, 1, 100), effect, clamp(duration, 30)],
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
      params: [value, effect, clamp(duration, 30), mode],
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
    const params: [YeelightSceneClass, number?, number?, any?] = [sceneClass];

    switch (sceneClass) {
      case YeelightSceneClass.COLOR:
        params.push(val1, val2);
        break;
      case YeelightSceneClass.HSV:
        params.push(val1, val2, val3);
        break;
      case YeelightSceneClass.CT:
        params.push(val1, val2);
        break;
      case YeelightSceneClass.CF:
        params.push(0, 0, val3);
        break;
      case YeelightSceneClass.AUTO_DELAY_OFF:
        params.push(val1, val2);
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
      params: [YeelightSceneClass.COLOR, clamp(rgbColor, 0, 16777215), clamp(brightness, 1, 100)],
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
      params: [YeelightSceneClass.HSV, clamp(hue, 0, 359), clamp(saturation, 0, 100), clamp(brightness, 1, 100)],
    });
  }

  public setSceneCt(value: number, brightness: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_SCENE : YeelightMethod.SET_SCENE,
      params: [YeelightSceneClass.CT, clamp(value, 1700, 6500), clamp(brightness, 1, 100)],
    });
  }

  public setSceneCf(flowExpression: YeelightFlowExpression[], isBg = false): Promise<YeelightResponseSuccess> {
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
      params: [YeelightSceneClass.AUTO_DELAY_OFF, clamp(brightness, 1, 100), minutes],
    });
  }

  public cronAdd(type: YeelightCronType, value: number): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.CRON_ADD,
      params: [type, clamp(value, 1)],
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
    return super.command({
      method: isBg ? YeelightMethod.BG_SET_ADJUST : YeelightMethod.SET_ADJUST,
      params: [action, prop],
    });
  }

  public setMusic(action: YeelightMusicAction, host: string, port: number): Promise<YeelightResponseSuccess> {
    return super.command({
      method: YeelightMethod.SET_MUSIC,
      params: [action, host, port],
    });
  }

  public setName(name: string): Promise<YeelightResponseSuccess> {
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
      params: [clamp(percentage, -100, 100), clamp(duration, 30)],
    });
  }

  public adjustCt(percentage: number, duration: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_ADJUST_CT : YeelightMethod.ADJUST_CT,
      params: [clamp(percentage, -100, 100), clamp(duration, 30)],
    });
  }

  public adjustColor(percentage: number, duration: number, isBg = false): Promise<YeelightResponseSuccess> {
    return super.command({
      method: isBg ? YeelightMethod.BG_ADJUST_COLOR : YeelightMethod.ADJUST_COLOR,
      params: [clamp(percentage, -100, 100), clamp(duration, 30)],
    });
  }
}
