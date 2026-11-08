import type { YeelightDevice } from './device-controller';
import {
  YeelightAdjustAction,
  YeelightAdjustProp,
  YeelightColorFlowAction,
  YeelightEffect,
  YeelightFlowExpression,
  YeelightPower,
  YeelightPowerMode,
  YeelightResponseSuccess,
  YeelightSceneClass,
} from './types';

export class YeelightBackgroundController {
  constructor(private readonly device: YeelightDevice) {}

  public setCtAbx(value: number, effect: YeelightEffect, duration: number): Promise<YeelightResponseSuccess> {
    return this.device.setCtAbx(value, effect, duration, true);
  }

  public setRgb(value: number, effect: YeelightEffect, duration: number): Promise<YeelightResponseSuccess> {
    return this.device.setRgb(value, effect, duration, true);
  }

  public setHsv(
    hue: number,
    saturation: number,
    effect: YeelightEffect,
    duration: number,
  ): Promise<YeelightResponseSuccess> {
    return this.device.setHsv(hue, saturation, effect, duration, true);
  }

  public setBright(value: number, effect: YeelightEffect, duration: number): Promise<YeelightResponseSuccess> {
    return this.device.setBright(value, effect, duration, true);
  }

  public setPower(
    value: YeelightPower,
    effect: YeelightEffect,
    duration: number,
    mode: YeelightPowerMode = YeelightPowerMode.NORMAL,
  ): Promise<YeelightResponseSuccess> {
    return this.device.setPower(value, effect, duration, mode, true);
  }

  public setDefault(): Promise<YeelightResponseSuccess> {
    return this.device.setDefault(true);
  }

  public startCf(
    count: number,
    action: YeelightColorFlowAction,
    flowExpression: YeelightFlowExpression[],
  ): Promise<YeelightResponseSuccess> {
    return this.device.startCf(count, action, flowExpression, true);
  }

  public stopCf(): Promise<YeelightResponseSuccess> {
    return this.device.stopCf(true);
  }

  public setScene(
    sceneClass: YeelightSceneClass,
    val1: number,
    val2: number,
    val3: number | string,
  ): Promise<YeelightResponseSuccess> {
    return this.device.setScene(sceneClass, val1, val2, val3, true);
  }

  public setSceneColor(rgbColor: number, brightness: number): Promise<YeelightResponseSuccess> {
    return this.device.setSceneColor(rgbColor, brightness, true);
  }

  public setSceneHsv(hue: number, saturation: number, brightness: number): Promise<YeelightResponseSuccess> {
    return this.device.setSceneHsv(hue, saturation, brightness, true);
  }

  public setSceneCt(value: number, brightness: number): Promise<YeelightResponseSuccess> {
    return this.device.setSceneCt(value, brightness, true);
  }

  public setSceneCf(flowExpression: YeelightFlowExpression[]): Promise<YeelightResponseSuccess> {
    return this.device.setSceneCf(flowExpression, true);
  }

  public setSceneAutoDelayOff(brightness: number, minutes: number): Promise<YeelightResponseSuccess> {
    return this.device.setSceneAutoDelayOff(brightness, minutes, true);
  }

  public setAdjust(action: YeelightAdjustAction, prop: YeelightAdjustProp): Promise<YeelightResponseSuccess> {
    return this.device.setAdjust(action, prop, true);
  }

  public toggle(): Promise<YeelightResponseSuccess> {
    return this.device.bgToggle();
  }

  public adjustBright(percentage: number, duration: number): Promise<YeelightResponseSuccess> {
    return this.device.adjustBright(percentage, duration, true);
  }

  public adjustCt(percentage: number, duration: number): Promise<YeelightResponseSuccess> {
    return this.device.adjustCt(percentage, duration, true);
  }

  public adjustColor(percentage: number, duration: number): Promise<YeelightResponseSuccess> {
    return this.device.adjustColor(percentage, duration, true);
  }
}
