function getParameters (rap, program) {
    if (program.parameters === undefined && program.sessionParameters === undefined) {
        console.log('No target designated. ' +
                    'You should add --parameters option or use rap session mechanism');
        return undefined;
    }

    var parameters;
    if (program.parameters !== undefined) {
        parameters = rap.parseParameters(program.parameters);
    } else if (program.sessionParameters !== undefined) {
        parameters = rap.parseParameters(program.sessionParameters);
    }

    return parameters;
}

exports.getParameters = getParameters;
