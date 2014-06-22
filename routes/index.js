/*jslint node: true, nomen: true, es5: true */
"use strict";

var _ = require("underscore-node");

/**
 * RegExps
 */

var alpha = /^[a-zA-Z]+$/,
    alphanumeric = /^[a-zA-Z0-9]+$/,
    numeric = /^-?[0-9]+$/,
    int = /^(?:-?(?:0|[1-9][0-9]*))$/,
    float = /^(?:-?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/,
    hexadecimal = /^[0-9a-fA-F]+$/,
    hexcolor = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    base64 = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{4})$/;

/**
 * Middlewares
 */

exports.middlewares = {};

exports.middlewares.init = function (req, res, next) {
    req.attached = {};
    req.errors = [];
    req.search_metadata = {};
    next();
};


/**
 * Error Handler
 */

exports.errorHandler = function (options) {
    if (options === undefined || (options.dumpExceptions === false && options.showStack === false)) {
        return function (err, req, res, next) {
            res.format({
                html: function () {
                    res.send(500, "Internal Server Error");
                },
                json: function () {
                    res.send(500, { status: "KO", errors: [{ location: "internal", message: "Internal Server Error" } ] });
                }
            });
        };
    } else {
        return function (err, req, res, next) {
            res.format({
                html: function () {
                    res.send(500, "Internal Server Error");
                },
                json: function () {
                    var error = { location: "internal" };
                    if (options.dumpExceptions) {
                        error.message = err.message;
                    } else {
                        error.message = "Internal Server Error";
                    }
                    if (options.showStack) {
                        error.stack = err.stack;
                    }
                    res.send(500, { status: "KO", errors: [error] });
                }
            });
        };
    }
};

/**
 * Routes
 */

exports.routes = {};

exports.routes.index = function (req, res) {
    res.format({
        html: function () {
            res.send("Server Up and Running");
        },
        json: function () {
            res.send({ status: "OK", message: "Server Up and Running" });
        }
    });
};

exports.routes.invalidRoute = function (req, res) {
    res.format({
        html: function () {
            res.send(404, "invalid route");
        },
        json: function () {
            res.send(404, { status: "KO", errors: { location: "url", message: "Invalid route"} });
        }
    });
};

/**
 * Algorithms
 */

exports.algorithms = {json: {}, html: {}};

exports.algorithms.json.get = function (req, res, next, Model, populate) {
    if (req.errors.length) {
        exports.algorithms.json.error(req, res);
    } else {
        var json = { status: "OK"},
            iMax,
            obj = req.attached[Model.pname];
        if (populate === undefined) {
            json[Model.pname] = obj;
            res.send(json);
        } else {
            if (_.isArray(populate)) {
                iMax = populate.length - 2;
                populate.forEach(function (p, i) {
                    if (i === populate.length) {
                        populate = p;
                        return;
                    }
                    obj = obj.populate(p);
                });
            }
            obj.populate(populate, function (err, obj) {
                if (err) {
                    next(err);
                } else {
                    json[Model.pname] = obj;
                    res.send(json);
                }
            });
        }
    }
};

exports.algorithms.html.get = function (req, res, next, Model) {
    res.send(501, "not implemented");
};

exports.algorithms.aggregate = function (req, res, next, Model, pipeline, grouping) {
    var match = {};
    if (req.attached.since_id !== undefined || req.attached.max_id !== undefined) {
        match._id = {};
        if (req.attached.since_id !== undefined) {
            match._id.$gt = req.attached.since_id;
        }
        if (req.attached.max_id !== undefined) {
            match._id.$lte = req.attached.max_id;
        }
    }
    pipeline.push({$match : match});
    pipeline.push({$sort : {_id: -1}});
    pipeline.push({$limit : req.attached.count });
    if (grouping !== undefined) {
        pipeline.push(grouping);
    }
    Model.aggregate(pipeline,
        function (err, objects) {
            if (err) {
                next(err);
            } else {
                next(undefined, objects);
            }
        });
};

exports.algorithms.filter = function (req, res, next, Model, query, fields, options) {
    if (query === undefined) {
        query = {};
    }
    if (fields === undefined) {
        fields = {};
    }
    if (options === undefined) {
        options = {};
    }
    if (req.attached.since_id !== undefined || req.attached.max_id !== undefined) {
        if (query._id === undefined) { query._id = { }; }
        if (req.attached.since_id !== undefined) {
            query._id.$gt = req.attached.since_id;
        }
        if (req.attached.max_id !== undefined) {
            query._id.$lte = req.attached.max_id;
        }
    }

    options.sort = {_id: -1};
    options.limit = req.attached.count;
    
    Model.find(query,
        fields,
        options,
        function (err, objects) {
            if (err) {
                next(err);
            } else {
                next(undefined, objects);
            }
        });
};

exports.algorithms.json.list = function (req, res, next, Model, query, fields, options, cbPrepare) {
    if (req.errors.length) {
        exports.algorithms.json.error(req, res);
    } else {
        var cbNext = function (err, objects) {
            if (err) {
                next(err);
            } else {
                var min_id,
                    json = { status: "OK"},
                    key,
                    url_tail,
                    search_metadata = req.search_metadata;
                if (req.attached.max_id !== undefined) {
                    search_metadata.max_id = req.attached.max_id;
                }
                if (req.attached.since_id !== undefined) {
                    search_metadata.since_id = req.attached.since_id;
                }
                if (objects.length > 0) {
                    url_tail = _.reduce(_.pairs(req.search_metadata), function (memo, n) {
                        return memo + "&" + encodeURIComponent(n[0]) + "=" + encodeURIComponent(n[1]);
                    }, "");
                    search_metadata.refresh_url = "?since_id=" + objects[0].id + url_tail;
                    if (objects.length === req.attached.count) {
                        min_id = objects[objects.length - 1].id;
                        if (min_id > 0) {
                            search_metadata.next_results = "?max_id=" + (min_id - 1);
                            if (req.attached.since_id !== undefined) {
                                search_metadata.next_results += "&since_id=" + req.attached.since_id;
                            }
                            search_metadata.next_results += url_tail;
                        }
                    }
                }
                json.search_metadata = search_metadata;
                if (cbPrepare === undefined) {
                    json[Model.json_list_property] = objects;
                    res.send(json);
                } else {
                    cbPrepare(objects, function (err, objects) {
                        if (err) {
                            next(err);
                        } else {
                            json[Model.json_list_property] = objects;
                            res.send(json);
                        }
                    });
                }
            }
        };
        exports.algorithms.filter(req, res, cbNext, Model, query, fields, options);
    }
};

exports.algorithms.json.add = function (req, res, next, Model, obj, savecb) {
    if (req.errors.length) {
        exports.algorithms.json.error(req, res);
    } else {
        if (obj === undefined) { obj = {}; }
        obj = new Model(obj);
        obj.save(function (err, obj) {
            if (err) {
                next(err);
                return;
            }
            var cbNext = function (err) {
                if (err) {
                    obj.delete();
                    next(err);
                } else {
                    res.send({ status: "OK", id: obj.id});
                }
            };
            if (savecb !== undefined) {
                savecb(obj, cbNext);
            } else {
                cbNext();
            }
        });
    }
};

exports.algorithms.json.update = function (req, res, next, Model, query, update, options, updatecb) {
    if (req.errors.length) {
        exports.algorithms.json.error(req, res);
    } else {
        if (query === undefined) { query = {}; }
        if (update === undefined) { update = {}; }
        if (options === undefined) { options = {}; }
        Model.update(query, update, options, function (err, numAffected) {
            if (err) {
                next(err);
                return;
            }
            var cbNext = function (err) {
                if (err) {
                    next(err);
                } else {
                    res.send({ status: "OK", updated: numAffected});
                }
            };
            if (updatecb !== undefined) {
                updatecb(numAffected, cbNext);
            } else {
                cbNext();
            }
        });
    }
};

exports.algorithms.json.count = function (req, res, next, Model, query) {
    if (req.errors.length) {
        exports.algorithms.json.error(req, res);
    } else {
        if (query === undefined) { query = {}; }
        Model.count(query, function (err, count) {
            if (err) {
                next(err);
            } else {
                res.send({ status: "OK", count: count});
            }
        });
    }
};

exports.algorithms.json.error = function (req, res) {
    res.send({
        status: "KO",
        errors: req.errors
    });
};

exports.algorithms.html.list = function (req, res, next, Model, conditions, fields, options) {
    res.send(501, "not implemented");
};

exports.algorithms.html.add = function (req, res, next, Model, obj, savecb) {
    res.send(501, "not implemented");
};

exports.algorithms.html.update = function (req, res, next, Model, query, update, options, updatecb) {
    res.send(501, "not implemented");
};

exports.algorithms.html.count = function (req, res, next, Model, query) {
    res.send(501, "not implemented");
};

/**
 * Url Params
 */

exports.params = {};

exports.params.id = function (Model) {
    return function (req, res, next, id) {
        var error;
        if (typeof id !== 'number') {
            id = id.toString();
            if (int.test(id)) {
                id = parseInt(id, 10);
            } else {
                id = undefined;
            }
        }
        if (id !== undefined && Math.floor(id) === id) {
            if (id < 0) {
                error = true;
                req.errors.push({location: "url", name: "id", message: "Invalid " + Model.modelName + " 'id', must be greater than 0"});
            }
        } else {
            error = true;
            req.errors.push({location: "url", name: "id", message: "Invalid " + Model.modelName + " 'id', it is not a number"});
        }
        if (error) {
            next();
        } else {
            Model.findOne({_id : id}, function (err, obj) {
                if (err) {
                    next(err);
                } else if (obj) {
                    req.attached[Model.pname] = obj;
                    next();
                } else {
                    req.errors.push({location: "url", name: "id", message: "Unable to find " + Model.pname + " " + id});
                    next();
                }
            });
        }
    };
};

exports.params.regexp = function (req, res, next, property, exp, value) {
    var error = false;
    if (!exp.test(value)) {
        error = true;
        req.errors.add({location: "url", name: property, message: "Invalid '" + property + "'"});
    }
    if (!error) {
        req.attached[property] = value;
    }
    next();
};

/**
 * Query Parameters
 */

exports.query = {
    mandatory: {},
    optional: {},
    unchecked: {},
};

exports.query.register = function (req, res, next, property, path) {
    return function (err) {
        var value = req.attached[property];
        if (value !== undefined) {
            if (path === undefined) {
                req.search_metadata[property] = value;
            } else {
                req.search_metadata[property] = value[path];
            }
        }
        next(err);
    };
};

exports.query.mandatory.populate = function (req, res, next) {
    exports.query.mandatory.boolean(req, res, exports.query.register(req, res, next, "populate"), "populate");
};

exports.query.optional.populate = function (req, res, next) {
    exports.query.optional.boolean(req, res, exports.query.register(req, res, next, "populate"), "populate", false);
};

exports.query.mandatory.count = function (req, res, next) {
    exports.query.mandatory.integer(req, res, exports.query.register(req, res, next, "count"), "count", 0, 100);
};

exports.query.optional.count = function (req, res, next) {
    exports.query.optional.integer(req, res, exports.query.register(req, res, next, "count"), "count", 0, 100, 100);
};

exports.query.mandatory.max_id = function (req, res, next) {
    exports.query.mandatory.integer(req, req, next, "max_id", 0);
};

exports.query.optional.max_id = function (req, res, next) {
    exports.query.optional.integer(req, res, next, "max_id", 0);
};

exports.query.mandatory.since_id = function (req, res, next) {
    exports.query.mandatory.integer(req, res, next, "since_id", 0);
};

exports.query.optional.since_id = function (req, res, next) {
    exports.query.optional.integer(req, res, next, "since_id", 0);
};

exports.query.mandatory.boolean = function (req, res, next, property) {
    if (req.query[property] === undefined) {
        req.errors.push({location: "query", name: property, message: "Missing Query Parameter '" + property + "'" });
        next();
    } else {
        exports.query.unchecked.boolean(req, res, next, property);
    }
};

exports.query.optional.boolean = function (req, res, next, property, dvalue) {
    if (req.query[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.query.unchecked.boolean(req, res, next, property);
    }
};

exports.query.unchecked.boolean = function (req, res, next, property) {
    var value = req.query[property];
    req.attached[property] = (value === false || value === "false" || value === "0") ? false : true;
    next();
};

exports.query.mandatory.integer = function (req, res, next, property, min, max) {
    if (req.query[property] === undefined) {
        req.errors.push({location: "query", name: property, message: "Missing Query Parameter '" + property + "'" });
        next();
    } else {
        exports.query.unchecked.integer(req, res, next, property, min, max);
    }
};

exports.query.optional.integer = function (req, res, next, property, min, max, dvalue) {
    if (req.query[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.query.unchecked.integer(req, res, next, property, min, max);
    }
};

exports.query.unchecked.integer = function (req, res, next, property, min, max) {
    var error,
        value = req.query[property];
    if (typeof value !== 'number') {
        value = value.toString();
        if (int.test(value)) {
            value = parseInt(value, 10);
        } else {
            value = undefined;
        }
    }
    if (value !== undefined && Math.floor(value) === value) {
        if ((min && value < min) || (max && value > max)) {
            error = true;
            req.errors.push({location: "query", name: property, message: "Invalid '" + property + "' parameter, out of bound"});
        }
    } else {
        error = true;
        req.errors.push({location: "query", name: property, message: "Invalid '" + property + "' parameter, it is not a number"});
    }
    if (!error) {
        req.attached[property] = value;
    }
    next();
};

exports.query.mandatory.id = function (req, res, next, Model) {
    if (req.query[Model.pname] === undefined) {
        req.errors.push({location: "query", name: Model.pname, message: "Missing Query Parameter '" + Model.pname + "'" });
        next();
    } else {
        exports.body.unchecked.id(req, res, next, Model);
    }
};

exports.query.optional.id = function (req, res, next, Model) {
    if (req.query[Model.pname] === undefined) {
        next();
    } else {
        exports.query.unchecked.id(req, res, next, Model);
    }
};

exports.query.unchecked.id = function (req, res, next, Model) {
    exports.query.unchecked.integer(req, res, function () {
        if (req.attached[Model.pname] === undefined) {
            next();
        } else {
            Model.findOne({_id : req.attached[Model.pname]}, function (err, obj) {
                if (err) {
                    next(err);
                } else if (obj) {
                    req.attached[Model.pname] = obj;
                    next();
                } else {
                    req.errors.push({location: "query", name: Model.pname, message: "Unable to find " + Model.modelName
                                     + " " + req.attached[Model.pname]
                                     + " in Query Parameter '"
                                     + Model.pname + "'"});
                    next();
                }
            });
        }
    }, Model.pname, 0);
};

exports.query.mandatory.regexp = function (req, res, next, property, exp, type) {
    if (req.query[property] === undefined) {
        req.errors.push({location: "query", name: property, message: "Missing Query Parameter '" + property + "'" });
        next();
    } else {
        exports.query.unchecked.regexp(req, res, next, property, exp, type);
    }
};

exports.query.optional.regexp = function (req, res, next, property, exp, type, dvalue) {
    if (req.query[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.query.unchecked.regexp(req, res, next, property, exp, type);
    }
};

exports.query.unchecked.regexp = function (req, res, next, property, exp, type) {
    var value = req.query[property];
    if (exp.test(value)) {
        req.attached[property] = value;
    } else {
        req.errors.push({location: "query", name: property, message: "Invalid Query Parameter '" + property + "'" + (type ? ", it is not a valid " + type : "")});
    }
    next();
};

/**
 * Body Params
 */

exports.body = {
    mandatory: {},
    optional: {},
    unchecked: {},
};

exports.body.mandatory.id = function (req, res, next, Model) {
    if (req.body[Model.pname] === undefined) {
        req.errors.push({location: "body", name: Model.pname, message: "Missing Body Parameter '" + Model.pname + "'" });
        next();
    } else {
        exports.body.unchecked.id(req, res, next, Model);
    }
};

exports.body.optional.id = function (req, res, next, Model) {
    if (req.body[Model.pname] === undefined) {
        next();
    } else {
        exports.body.unchecked.id(req, res, next, Model);
    }
};

exports.body.unchecked.id = function (req, res, next, Model) {
    exports.body.unchecked.integer(req, res, function () {
        if (req.attached[Model.pname] === undefined) {
            next();
        } else {
            Model.findOne({_id : req.attached[Model.pname]}, function (err, obj) {
                if (err) {
                    next(err);
                } else if (obj) {
                    req.attached[Model.pname] = obj;
                    next();
                } else {
                    req.errors.push({location: "body", name: Model.pname, message: "Unable to find " + Model.modelName
                                     + " " + req.attached[Model.pname]
                                     + " in Body Parameter '"
                                     + Model.pname + "'"});
                    next();
                }
            });
        }
    }, Model.pname, 0);
};

exports.body.mandatory.boolean = function (req, res, next, property) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.boolean(req, res, next, property);
    }
};

exports.body.optional.boolean = function (req, res, next, property, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.boolean(req, res, next, property);
    }
};

exports.body.unchecked.boolean = function (req, res, next, property) {
    var value = req.body[property];
    req.attached[property] = (value === false || value === "false" || value === "0") ? false : true;
    next();
};

exports.body.mandatory.integer = function (req, res, next, property, min, max) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.integer(req, res, next, property, min, max);
    }
};

exports.body.optional.integer = function (req, res, next, property, min, max, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.integer(req, res, next, property, min, max);
    }
};

exports.body.unchecked.integer = function (req, res, next, property, min, max) {
    var error,
        value = req.body[property];
    if (typeof value !== 'number') {
        value = value.toString();
        if (int.test(value)) {
            value = parseInt(value, 10);
        } else {
            value = undefined;
        }
    }
    if (value !== undefined && Math.floor(value) === value) {
        if ((min && value < min) || (max && value > max)) {
            error = true;
            req.errors.push({location: "body", name: property, message: "invalid Body Parameter '" + property + "' field, out of bound"});
        }
    } else {
        error = true;
        req.errors.push({location: "body", name: property, message: "Invalid Body Parameter '" + property + "', it is not an integer"});
    }
    if (!error) {
        req.attached[property] = value;
    }
    next();
};

exports.body.mandatory.string = function (req, res, next, property, empty) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.integer(req, res, next, property, empty);
    }
};

exports.body.optional.string = function (req, res, next, property, empty, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.integer(req, res, next, property, empty);
    }
};

exports.body.unchecked.string = function (req, res, next, property, empty) {
    var error,
        value = req.body[property];
    if (empty === undefined) { empty = false; }
    if (value !== undefined) {
        if (!empty && value === "") {
            error = true;
            req.errors.push({location: "body", name: property, message: "invalid Body Parameter '" + property + "' field, it cannot be empty"});
        }
    } else {
        error = true;
        req.errors.push({location: "body", name: property, message: "Invalid Body Parameter '" + property + "', it is not a string"});
    }
    if (!error) {
        req.attached[property] = value;
    }
    next();
};

exports.body.mandatory.float = function (req, res, next, property, min, max) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.float(req, res, next, property, min, max);
    }
};

exports.body.optional.float = function (req, res, next, property, min, max, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.float(req, res, next, property, min, max);
    }
};

exports.body.unchecked.float = function (req, res, next, property, min, max) {
    var error,
        value = req.body[property];
    if (typeof value !== 'number') {
        value = value.toString();
        if (float.test(value)) {
            value = parseFloat(value, 10);
        } else {
            value = undefined;
        }
    }
    if (value !== undefined) {
        if ((min && value < min) || (max && value > max)) {
            error = true;
            req.errors.push({location: "body", name: property, message: "invalid Body Parameter '" + property + "' field, out of bound"});
        }
    } else {
        error = true;
        req.errors.push({location: "body", name: property, message: "Invalid Body Parameter '" + property + "', it is not an float"});
    }
    if (!error) {
        req.attached[property] = value;
    }
    next();
};

exports.body.mandatory.base64 = function (req, res, next, property) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.regexp(req, res, next, property, base64, "Base64 String");
    }
};

exports.body.optional.base64 = function (req, res, next, property, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.regexp(req, res, next, property, base64, "Base64 String");
    }
};

exports.body.mandatory.regexp = function (req, res, next, property, exp, type) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.regexp(req, res, next, property, exp, type);
    }
};

exports.body.optional.regexp = function (req, res, next, property, exp, type, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.regexp(req, res, next, property, exp, type);
    }
};

exports.body.unchecked.regexp = function (req, res, next, property, exp, type) {
    var value = req.body[property];
    if (exp.test(value)) {
        req.attached[property] = value;
    } else {
        req.errors.push({location: "body", name: property, message: "Invalid Body Parameter '" + property + "'" + (type ? ", it is not a valid " + type : "")});
    }
    next();
};

exports.body.mandatory.array = function (req, res, next, property, check, map) {
    if (req.body[property] === undefined) {
        req.errors.push({location: "body", name: property, message: "Missing Body Parameter '" + property + "'" });
        next();
    } else {
        exports.body.unchecked.array(req, res, next, property, check, map);
    }
};

exports.body.optional.array = function (req, res, next, property, check, map, dvalue) {
    if (req.body[property] === undefined) {
        if (dvalue) {
            req.attached[property] = dvalue;
        }
        next();
    } else {
        exports.body.unchecked.array(req, res, next, property, check, map);
    }
};

exports.body.unchecked.array = function (req, res, next, property, check, map) {
    var error,
        value = req.body[property];
    if (!_.isArray(value)) {
        try {
            value = JSON.parse(value.toString());
            if (!_.isArray(value)) {
                value = undefined;
            }
        } catch (ex) {
            value = undefined;
        }
    }
    if (value !== undefined) {
        if (check) {
            if (!_.every(value, check)) {
                error = true;
                req.errors.push({location: "body", name: property, message: "Invalid Body Parameter '" + property + "', some Array items are not valid"});
            }
        }
    } else {
        error = true;
        req.errors.push({location: "body", name: property, message: "Invalid Body Parameter '" + property + "', it is not an Array"});
    }
    if (!error) {
        if (map) {
            req.attached[property] = _.map(value, map);
        } else {
            req.attached[property] = value;
        }
    }
    next();
};