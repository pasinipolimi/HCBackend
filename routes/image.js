/*jslint node: true, nomen: true, es5: true */
"use strict";

var fs = require("fs"),
    Image = require("../models/image.js").model,
    Action = require("../models/action.js").model,
    Tag = require("../models/tag.js").model,
    index = require("./index.js");

/**
 * Routes
 */

exports.routes = {};

exports.routes.index = function (req, res, next) {
    res.format({
        html: function () {
            index.algorithms.html.list(req, res, next, Image);
        },
        json: function () {
            index.algorithms.json.list(req, res, next, Image);
        }
    });
};

exports.routes.add = function (req, res, next) {
    var obj = {width: req.attached.width, height: req.attached.height},
        cb = function (image, next) {
            fs.writeFile("./storage/image/" + image.id.toString() + ".jpg", new Buffer(req.attached.payload, "base64"), next);
        };
    res.format({
        html: function () {
            index.algorithms.html.add(req, res, next, Image, obj, cb);
        },
        json: function () {
            index.algorithms.json.add(req, res, next, Image, obj, cb);
        }
    });
};

exports.routes.get = function (req, res, next) {
    res.format({
        html: function () {
            index.algorithms.html.get(req, res, next, Image);
        },
        json: function () {
            index.algorithms.json.get(req, res, next, Image);
        }
    });
};

exports.routes.tag = function (req, res, next) {
    var match = { type: "tagging" },
        group = {$group: {_id: "$tag"}},
        grouping = {$group: {_id: null, result: {$addToSet: "$_id"}}},
        cbNext = function (err, objects) {
            console.log(objects);
            var query = {};
            if (objects.length > 0) {
                query._id = { $in: objects[0].result};
            } else {
                query._id = { $in: []};
            }
            res.format({
                html: function () {
                    index.algorithms.html.list(req, res, next, Tag, query);
                },
                json: function () {
                    index.algorithms.json.list(req, res, next, Tag, query);
                }
            });
        };
    if (req.attached.image) { match.image = req.attached.image.id; }
    index.algorithms.aggregate(req, res, cbNext, Action, [{$match: match}, group], grouping);
};

/**
 * Url Params
 */

exports.params = {};

exports.params.id = function (req, res, next, inId) {
    index.params.id(req, res, next, Image, inId);
};

/**
 * Query Params
 */

exports.query = {
    mandatory: {},
    optional: {},
    route: {}
};

exports.query.mandatory.id = function (req, res, next) {
    index.query.mandatory.id(req, res, index.query.register(req, res, next, Image.pname, "id"), Image);
};

exports.query.optional.id = function (req, res, next) {
    index.query.optional.id(req, res, index.query.register(req, res, next, Image.pname, "id"), Image);
};

/**
 * Body Params
 */

exports.body = {
    mandatory: {},
    optional: {},
    route: {}
};

exports.body.mandatory.id = function (req, res, next) {
    index.body.mandatory.id(req, res, next, Image);
};

exports.body.optional.id = function (req, res, next) {
    index.body.optional.id(req, res, next, Image);
};

exports.body.mandatory.width = function (req, res, next) {
    index.body.mandatory.integer(req, res, next, "width", 1);
};

exports.body.optional.width = function (req, res, next) {
    index.body.optional.integer(req, res, next, "width", 1);
};

exports.body.mandatory.height = function (req, res, next) {
    index.body.mandatory.integer(req, res, next, "height", 1);
};

exports.body.optional.height = function (req, res, next) {
    index.body.optional.integer(req, res, next, "height", 1);
};

exports.body.mandatory.payload = function (req, res, next) {
    index.body.mandatory.base64(req, res, next, "payload");
};

exports.body.optional.payload = function (req, res, next) {
    index.body.optional.base64(req, res, next, "payload");
};