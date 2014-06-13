/*jslint node: true, nomen: true, es5: true */
"use strict";

var fs = require("fs"),
    Image = require("../models/image.js").model;

exports.routes = {};
exports.params = {};

exports.routes.index = function (req, res) {
    var min_id, //used later
        query = {};
    
    if (req.since_id !== undefined || req.max_id !== undefined) {
        query._id = {};
        if (req.since_id !== undefined) {
            query._id.$gt = req.since_id;
        }
        if (req.max_id !== undefined) {
            query._id.$lte = req.max_id;
        }
    }
    
    Image.find(query,
               {},
               {sort: {_id: -1}, limit: req.count},
               function (err, images) {
            res.format({
                html: function () {
                    res.send(501, "not implemented");
                },
                json: function () {
                    var search_metadata = {
                        count: req.count,
                    };
                    if (req.max_id !== undefined) {
                        search_metadata.max_id = req.max_id;
                    }
                    if (req.since_id !== undefined) {
                        search_metadata.since_id = req.since_id;
                    }
                    if (images.length > 0) {
                        search_metadata.refresh_url = "?since_id=" + images[0].id + "&count=" + req.count;
                        if (images.length === req.count) {
                            min_id = images[images.length - 1].id;
                            if (min_id > 0) {
                                search_metadata.next_results = "?max_id=" + min_id - 1;
                                if (req.since_id !== undefined) {
                                    search_metadata.next_results += "&since_id=" + req.since_id;
                                }
                                search_metadata.next_results += "&count=" + req.count;
                            }
                        }
                    }
                    res.send({
                        status: "OK",
                        images: images,
                        search_metadata: search_metadata
                    });
                }
            });
        });
};

exports.routes.add = function (req, res, next) {
    var obj = {},
        image,
        error;
    
    if (req.body.width === undefined) {
        error = "Missing 'width' field";
    } else {
        obj.width = parseInt(req.body.width, 10);
        if (obj.width.toString() !== req.body.width) {
            error = "Invalid 'width', it is not a number";
        } else {
            if (obj.width < 1) {
                error = "invalid 'width' field, out of bound";
            }
        }
    }
    
    if (!error && req.body.height === undefined) {
        error = "Missing 'height' field";
    } else {
        obj.height = parseInt(req.body.height, 10);
        if (obj.height.toString() !== req.body.height) {
            error = "Invalid 'height' field, it is not a number";
        } else {
            if (obj.height < 1) {
                error = "invalid 'height' field, out of bound";
            }
        }
    }
    
    if (!error && req.body.payload === undefined) {
        error = "Missing 'payload' parameter";
    } else {
        if (new RegExp("!^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$").test(req.body.payload)) {
            error = "Invalid 'payload' field, it is not a valid base64 string";
        }
    }
    
    if (error) {
        res.format({
            html: function () {
                res.send(501, "not implemented");
            },
            json: function () {
                res.send(400, { status: "KO", error: error});
            }
        });
    } else {
        image = new Image(obj);
        image.save(function (err, image) {
            if (err) {
                next(err);
                return;
            }
            image.mediaLocator = '/storage/image/' + image.id.toString() + ".jpg";
            image.save(function (err, image) {
                if (err) {
                    next(err);
                    return;
                }
                fs.writeFile("./storage/image/" + image.id.toString() + ".jpg", new Buffer(req.body.payload, "base64"),
                             function (err) {
                        if (err) {
                            next(err);
                            image.delete();
                            return;
                        }
                        res.format({
                            html: function () {
                                res.send(501, "not implemented");
                            },
                            json: function () {
                                res.send({ status: "OK", id: image.id});
                            }
                        });
                    });
            });
        });
    }
};

exports.routes.get = function (req, res) {
    res.format({
        html: function () {
            res.send(501, "not implemented");
        },
        json: function () {
            res.send({ status: "OK", image: req.image});
        }
    });
};

exports.params.id = function (req, res, next, inId) {
    var error,
        idStr = inId.toString(),
        id = parseInt(idStr.toString(), 10);
    if (idStr !== id.toString()) {
        error = "Invalid Image 'id', it is not a number";
    } else {
        if (id < 0) {
            error = "Invalid Image 'id', must be greater than 0";
        }
    }
    if (error) {
        res.format({
            html: function () {
                res.send(501, "not implemented");
            },
            json: function () {
                res.send(400, { status: "KO", error: error});
            }
        });
    } else {
        Image.find({_id : id}, function (err, image) {
            console.log(image);
            if (err) {
                next(err);
            } else if (image) {
                req.image = image;
                next();
            } else {
                err = "Unable to find Image " + id;
                res.format({
                    html: function () {
                        res.send(501, "not implemented");
                    },
                    json: function () {
                        res.send(404, { status: "KO", error: err });
                    }
                });
            }
        });
    }
};