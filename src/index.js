'use strict';

exports.version = 1;

exports.commands = Object.create(null);

Object.assign(
    exports.commands,
    require('./commands/system'),
    require('./commands/deploy')
);
