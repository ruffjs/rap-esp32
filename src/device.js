'use strict';

const fs = require('fs');
const path = require('path');

const Promise = require('thenfail').Promise;

/**
 * @param {Object} options
 * @param {number} options.timeout - Scan timeout in milliseconds.
 * @param {Function} ondevice
 * @returns {Promise}
 */
function scan(options, ondevice) {
    return new Promise((resolve, reject) => {
        let dir = '/dev/';
        let devices = [];

        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            resolve(devices);
        }

        fs.readdir(dir, (err, files) => {
            if (err) {
                reject(err);
                return;
            }

            files.forEach(file => {
                let matched = file.match(/cu.SLAB(.*)/);
                if (matched && matched[1]) {
                    let deviceName = matched[1];
                    let device = new Device({
                        id: `mcu/icdi/${deviceName}`,
                        name: deviceName,
                        devPath: path.join(dir, file)
                    });

                    devices.push(device);

                    ondevice(device);
                }
            });

            resolve(devices);
        });
    });
}

exports.scan = scan;

const CHECKSUM_FILENAME = 'checksum.txt';
const FIRMWARE_BIN_FILENAME_PATTERN = 'ruffos-*.bin';
const FIRMWARE_MAGIC_NUMBER = 0x27051956;

function upgrade(sessionInfo, options) {
}

exports.upgrade = upgrade;

function reset(sessionInfo) {
    // TODO
}

exports.reset = reset;

function reboot(sessionInfo) {
    // TODO
}

exports.reboot = reboot;

function getSystemInfo(sessionInfo) {
    // TODO
}

exports.getSystemInfo = getSystemInfo;

class Device {
    constructor(data) {
        Object.assign(this, data);
    }

    get text() {
        return `${this.name || '[unnamed]'} - ${this.devPath}`;
    }
}
