let Service, Characteristic;
const packageJson = require('./package.json');
const request = require('request');

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory(
    'homebridge-switchbot-thermostat',
    'Thermostat',
    Thermostat
  );
};

function Thermostat(log, config) {
  console.log(
    'Device Restarted. Please set thermostat lowest temperature and Off.'
  );
  this.name = config.name;
  this.log = log;

  this.bearerToken = config.thermostat_configuration['bearerToken'];
  this.power_switch_accessory_uuid =
    config.thermostat_configuration['power_switch_accessory_uuid'];
  this.temp_up_accessory_uuid =
    config.thermostat_configuration['temp_up_accessory_uuid'];
  this.temp_down_accessory_uuid =
    config.thermostat_configuration['temp_down_accessory_uuid'];

  // let configuration = config.thermostat_configuration;
  // let power_switch_accessory_uuid =
  //   config.thermostat_configuration.power_switch_accessory_uuid;
  // let temp_up_accessory_uuid = configuration.temp_up_accessory_uuid;
  // let temp_down_accessory_uuid = configuration.temp_down_accessory_uuid;

  this.validStates = config.validStates || [0, 1, 2, 3];

  this.requestArray = [
    'targetHeatingCoolingState',
    'targetTemperature',
    // 'coolingThresholdTemperature',
    // 'heatingThresholdTemperature',
  ];

  this.manufacturer = config.manufacturer || packageJson.author;
  this.serial = 'n/a';
  this.model = config.model || packageJson.name;

  this.temperatureDisplayUnits = config.temperatureDisplayUnits || 0;
  this.maxTemp = config.thermostat_details.maxTemp || 30;
  this.minTemp = config.thermostat_details.minTemp || 15;
  this.minStep = config.thermostat_details.minStep || 0.5;

  this.currentTemperature = 20;

  this.service = new Service.Thermostat(this.name);

  // this.service = new this.api.hap.Service.Switch(this.name);

  // // link methods used when getting or setting the state of the service
  // this.service
  //   .getCharacteristic(this.api.hap.Characteristic.On)
  //   .onGet(this.getOnHandler.bind(this)) // bind to getOnHandler method below
  //   .onSet(this.setOnHandler.bind(this)); // bind to setOnHandler method below
  return;
}

Thermostat.prototype = {
  identify: function (callback) {
    this.log('Identify requested!');
    callback();
  },

  _httpHandler: function (characteristic, value) {
    console.log('characteristic', characteristic);

    switch (characteristic) {
      case 'targetHeatingCoolingState': {
        this.service
          .getCharacteristic(Characteristic.TargetHeatingCoolingState)
          .updateValue(value);
        this.log('Updated %s to: %s', characteristic, value);
        break;
      }
      case 'targetTemperature': {
        this.service
          .getCharacteristic(Characteristic.TargetTemperature)
          .updateValue(value);
        this.log('Updated %s to: %s', characteristic, value);
        break;
      }
      // case 'coolingThresholdTemperature': {
      //   this.service
      //     .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      //     .updateValue(value);
      //   this.log('Updated %s to: %s', characteristic, value);
      //   break;
      // }
      // case 'heatingThresholdTemperature': {
      //   this.service
      //     .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      //     .updateValue(value);
      //   this.log('Updated %s to: %s', characteristic, value);
      //   break;
      // }
      default: {
        this.log.warn(
          'Unknown characteristic "%s" with value "%s"',
          characteristic,
          value
        );
      }
    }
  },

  setTargetHeatingCoolingState: function (value, callback) {
    console.log(
      'setting power state to %s from setTargetHeatingCoolingState function',
      value
    );

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(value);

    this.sendCurl(this.power_switch_accessory_uuid);
  },

  setTargetTemperature: async function (value) {
    this.log(`Changing Temp from ${this.currentTemperature} to ${value}`);
    this.log(`setTargetTemperature: ${value}`);
    this.log(`Current Temperature: ${this.currentTemperature}`);
    this.log(`temp_up_accessory_uuid : ${this.temp_up_accessory_uuid}`);
    this.log('temp_down_accessory_uuid: ' + this.temp_down_accessory_uuid);
    this.log(
      `power_switch_accessory_uuid: ${this.power_switch_accessory_uuid}`
    );
    this.log(`bearerToken: ${this.bearerToken}`);

    this.sendCurl(this.power_switch_accessory_uuid);

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(3);

    this.log(
      'Temp Change Requested. Power State toggled to AUTO from setTargetTemperature function'
    );

    if (this.currentTemperature < value) {
      for (
        let index = 0;
        index < value - this.currentTemperature;
        index = index + 0.5
      ) {
        this.log(
          `increasing temp ${index} / ${value - this.currentTemperature}`
        );

        this.sendCurl(this.temp_up_accessory_uuid);

        this.log('curl executed to increase temp');
      }
      this.log(
        `Bot sent ${
          (value - this.currentTemperature) * 2
        } requests to increase temp`
      );
      this.service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(value);
    } else {
      this.log('Toggled power state to %s', this.poweredOn);
      for (
        let index = 0;
        index < this.currentTemperature - value;
        index = index + 0.5
      ) {
        this.log(
          `decreasing temp ${index} / ${this.currentTemperature - value}`
        );
        this.sendCurl(this.temp_down_accessory_uuid);
        this.log('curl executed to decrease temp');
      }
      this.service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(value);
    }
  },

  sendCurl: async function (device) {
    new Promise((resolve, reject) => {
      request(
        {
          url: `http://localhost:8581/api/accessories/${device}`,
          method: 'PUT',
          headers: {
            accept: '*/*',
            Authorization: `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
          },
          json: {
            characteristicType: 'On',
            value: true,
          },
        },
        (error, response, body) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  },

  getServices: function () {
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware);

    // Needed
    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .updateValue(1);

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: this.validStates,
      });

    // Needed
    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('set', this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: this.minStep,
      });

    // Needed
    this.service.getCharacteristic(Characteristic.CurrentTemperature).setProps({
      minValue: -600,
      maxValue: 600,
    });

    return [this.informationService, this.service];
  },
};
