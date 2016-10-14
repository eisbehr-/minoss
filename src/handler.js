"use strict";

var fs = require("fs");
var debug = require("./debug");
var autoloader = require("./autoloader");
var response = require("./response");
var _ = require("./formatter");

/**
 * contains functions for responding data
 * out of the express server
 * @type {object}
 */
var handler = {
    /**
     * handler for script requests
     * @param {object} req
     * @param {object} res
     * @returns {*}
     */
    request: function(req, res) {
        var requestObj = req.method === "GET" ? req.query : req.body;

        // store output format into params
        if( !requestObj.output ) {
            requestObj.output = req.params.output || "json";
        }

        var module = requestObj.module = req.params.module;
        var script = requestObj.script = req.params.script;

        // clean console on debug and track execution time
        if( debug.enabled ) {
            console.time("execution");
            debug("\x1Bc--- REQUEST --- " + Date.now() + " ----------");
            debug("handle request for '/" + module + "/" + script + "'");
        }

        try {
            var moduleScript = autoloader.script(module, script);
            var moduleConfig = autoloader.config(module);

            // execute script and receive result
            require(moduleScript)(
                moduleConfig,
                requestObj,
                handler.respond.bind({req: req, res: res}),
                handler.error.bind({req: req, res: res})
            );
        }
        catch( err ) {
            // predefined messages
            if( err.message === "moduleReserved" || err.message === "moduleMissing" || err.message === "scriptMissing" ) {
                return response.error(req, res, _(err.message, {module: module, script: script}));
            }

            return response.error(req, res, err.message);
        }
    },

    /**
     * response callback function for executed scripts
     * @access private
     * @param {object} result
     * @return void
     */
    respond: function(result) {
        // handle shorthand call
        if( result === true || result === false ) {
            result = {success: result};
        }

        // check if success property is set
        if( !result.hasOwnProperty("success") ) {
            result.success = false;
        }

        if( !result.success && result.error ) {
            response.output(this.req, this.res, result.error, result, 404);
        }
        else {
            response.output(this.req, this.res, result.success ? "1" : "0", result);
        }

        // on debug flush the require cache after handling
        if( debug.enabled ) {
            debug.flushRequireCache();
            console.timeEnd("execution");
        }
    },

    /**
     * error callback function for failed script
     * @access private
     * @param {object|string} result
     * @return void
     */
    error: function(result) {
        if( typeof result === "string" ) {
            result = {success: false, error: result};
        }

        // check if success property is set
        if( !result.hasOwnProperty("success") ) {
            // noinspection JSUndefinedPropertyAssignment
            result.success = false;
        }

        // noinspection JSUnresolvedVariable
        response.output(this.req, this.res, result.error || "0", result, 404);

        // on debug flush the require cache after handling
        if( debug.enabled ) {
            debug.flushRequireCache();
            console.timeEnd("execution");
        }
    }
};

handler.response = response;
module.exports = handler;