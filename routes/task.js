/*jslint node: true, nomen: true, es5: true */
"use strict";

var Task = require("../models/task.js").model,
    Microtask = require("../models/microtask.js").model,
    index = require("./index.js"),
    _ = require("underscore-node");

/**
 * Routes
 */

exports.routes = {};

exports.routes.index = function (req, res, next) {
    var conditions = {};
    if (req.attached.image) { conditions.image = req.attached.image.id; }
    if (req.attached.collection) { conditions.image = { $in: req.attached.collection.images}; }
    if (req.attached.completed !== undefined) { conditions.image.completed = {$exists: req.attached.completed}; }
    res.format({
        html: function () {
            index.algorithms.html.list(req, res, next, Task, conditions);
        },
        json: function () {
            index.algorithms.json.list(req, res, next, Task, conditions);
        }
    });
};

exports.routes.add = function (req, res, next) {
    var obj = { };
    if (req.attached.image !== undefined) { obj.image = req.attached.image.id; }
    res.format({
        html: function () {
            index.algorithms.html.add(req, res, next, Task, obj);
        },
        json: function () {
            index.algorithms.json.add(req, res, next, Task, obj);
        }
    });
};

exports.routes.complete = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var task = req.attached.task;
                task.completed_at = new Date();
                task.save(function (err, task) {
                    if (err) {
                        next(err);
                    } else {
                        var query = {completed_at: {$exists: false}, task: task.id},
                            update = {$set: {completed_at: new Date()}},
                            options = {multi: true};
                        Microtask.update(query, update, options, function (err) {
                            if (err) {
                                next(err);
                            } else {
                                res.send({status: "OK"});
                            }
                        });
                    }
                });
            }
        }
    });
};

exports.routes.get = function (req, res, next) {
    res.format({
        html: function () {
            index.algorithms.html.get(req, res, next, Task);
        },
        json: function () {
            var populate;
            if (req.attached.populate) {
                populate = ["image", "users", "microtasks"];
            }
            index.algorithms.json.get(req, res, next, Task, populate);
        }
    });
};

exports.routes.addUser = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var task = req.attached.task,
                    user = req.attached.user;
                if (_.contains(task.users, user.id)) {
                    res.send({ status: "OK" });
                } else {
                    task.users.push(user.id);
                    task.save(function (err, task) {
                        if (err) {
                            next(err);
                        } else {
                            res.send({ status: "OK" });
                        }
                    });
                }
            }
        }
    });
};

/**
 * Url Params
 */

exports.params = {};

exports.params.id = function (req, res, next, inId) {
    index.params.id(req, res, next, Task, inId);
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
    index.query.mandatory.id(req, res, index.query.register(req, res, next, Task.pname, "id"), Task);
};

exports.query.optional.id = function (req, res, next) {
    index.query.optional.id(req, res, index.query.register(req, res, next, Task.pname, "id"), Task);
};

exports.query.mandatory.completed = function (req, res, next) {
    index.query.mandatory.boolean(req, res, index.query.register(req, res, next, "completed"), "completed");
};

exports.query.optional.completed = function (req, res, next) {
    index.query.optional.boolean(req, res, index.query.register(req, res, next, "completed"), "completed");
};

/**
 * Body Params
 */

exports.body = {
    mandatory: {},
    optional: {},
    route: { }
};

exports.body.mandatory.id = function (req, res, next) {
    index.body.mandatory.id(req, res, next, Task);
};

exports.body.optional.id = function (req, res, next) {
    index.body.optional.id(req, res, next, Task);
};

/**
 * Checkers
 */

exports.checkers = {
    route: {}
};

exports.checkers.open = function (req, res, next) {
    if (req.attached.task && req.attached.task.completed_at) {
        req.errors.push({location: "status", message: "Microtask " + req.attached.action.id + " is already closed" });
    }
    next();
};

exports.checkers.route.index = function (req, res, next) {
    if (req.attached.image && req.attached.collection) {
        req.errors.push({location: "query", name: "image|collection", message: "Cannot set both Image and Collection as filter" });
    }
    next();
};