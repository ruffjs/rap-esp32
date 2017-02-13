'use strict';

const fs = require('fs');
const { spawn } = require('child_process');

const { Promise } = require('thenfail');

const { flash } = require('./flash');

let commandMap = Object.create({});

commandMap.system = function (program, trace) {
    program
        .command('upgrade <firmware-binary-file>')
        .option('-E, --erase', 'erase entire flash')
        .description('upgrade ruff firmware')
        .action((binPath, options) => {
            trace.push('upgrade');

            if (!fs.existsSync(binPath)) {
                console.error('The binary file specified does not exist.');
                process.exit(1);
            }

            let cp = flash({
                binary: binPath,
                address: 0,
                erase: options.erase
            });

            return Promise.for(cp);
        });
};

function setupCommands(program, commandName, trace) {
    commandMap[commandName](program, trace);
}

exports.setupCommands = setupCommands;
