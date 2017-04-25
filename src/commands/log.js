'use strict';

const chalk = require('chalk');

exports.log = function (rap, program, trace) {
    program
        .description('stream system and application logs to output');

    trace.push(action);
};

function action(rap, program) {
    var serial = rap.getSerialPort();

    var path;
    switch (process.platform) {
        case 'darwin':
            path = '/dev/cu.SLAB_USBtoUART';
            break;
        case 'linux':
            path = '/dev/ttyUSB0';
            break;
        case 'win32':
            path = 'COM1';
            break;
        default:
            console.log(chalk.red(`Unsupported platform "${process.platform}".`));
            return;
    }

    var port = new serial.SerialPort(path, {
        baudrate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        parser: serial.parsers.readline('\n')
    });

    port.on('data', function (data) {
        console.log(data.toString());
    });

    port.on('error', function (error) {
        console.log('serialport error', error.message);
    });
}
