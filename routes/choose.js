/*jslint node: true, nomen: true, es5: true */
/**
 * Developed By Carlo Bernaschina (GitHub - B3rn475)
 * www.bernaschina.com
 *
 * Copyright (c) 2014 Politecnico di Milano  
 * www.polimi.it
 *
 * Distributed under the MIT Licence
 */
"use strict";

var index = require("./index.js"),
    ImageTags = require("../models/imagetags.js").model,
    ImageSegmentations = require("../models/imagesegmentations.js").model,
    Action = require("../models/action.js").model,
    Image = require("../models/image.js").model,
    async = require("async"),
    _ = require("underscore-node");

/**
 * Routes
 */

exports.routes = { image: {}, imageandtag: {}};

exports.routes.list = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            res.send({ status: "OK", objects: ["image", "imageandtag"] });
        }
    });
};

exports.routes.image.list = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            res.send({ status: "OK", algorithms: ["random", "leastused"] });
        }
    });
};

exports.routes.image.random = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var aggregate = [
                    {$group: {_id: null, count: {$sum: 1}}}
                ];
                if (req.attached.collection) {
                    if (req.attached.collection.images.length !== 0) {
                        aggregate = _.union([{$match: {_id: {$in: req.attached.collection.images}}}], aggregate);
                    } else {
                        res.send({ status: "OK", results: []});
                        return;
                    }
                }
                Image.aggregate(aggregate,
                    function (err, result) {
                        if (err) {
                            next(err);
                        } else {
                            var inputs = [],
                                i,
                                map = function (item, next) {
                                    var aggregate = [
                                        {$skip: Math.floor(result[0].count * Math.random())},
                                        {$limit: 1},
                                        {$project: {_id: true}}
                                    ];
                                    Image.aggregate(aggregate, function (err, results) {
                                        if (err) {
                                            next(err);
                                        } else {
                                            next(undefined, {image: results[0]._id});
                                        }
                                    });
                                };
                            for (i = 0; i < req.attached.limit; i = i + 1) {
                                inputs.push(i);
                            }
                            async.map(inputs,
                                map,
                                function (err, results) {
                                    if (err) {
                                        next(err);
                                    } else {
                                        res.send({ status: "OK", results: results});
                                    }
                                });
                        }
                    });
            }
        }
    });
};

var computeCollectionMatch = function (collection) {
    var images = _.sortBy(collection.images, function (item) { return item; }),
        item,
        or = [];
    if (images.length === 0) { return {}; }
    if (images.length === 1) { return {image: images[0]}; }
    item = {$gte: images[0], $lt: images[0]};
    images.forEach(function (image) {
        if (image === item.$lt) {
            item.$lt = image + 1;
        } else {
            if (item.$lt === item.$gte + 1) {
                or.push({image: item.$gte});
            } else {
                or.push({image: item});
            }
            item = {$gte: image, $lt: image + 1};
        }
    });
    if (item.$lt === item.$gte + 1) {
        or.push({image: item.$gte});
    } else {
        or.push({image: item});
    }
    return {$or: or};
};

exports.routes.image.leastused = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var query = {},
                    options = {
                        sort: {count: 1},
                        limit: req.attached.limit
                    };
                if (req.attached.collection) {
                    if (req.attached.collection.images && req.attached.collection.images.length !== 0) {
                        query = computeCollectionMatch(req.attached.collection);
                    } else {
                        res.send({ status: "OK", results: []});
                        return;
                    }
                }
                ImageTags.find(query, "image count", options, function (err, results) {
                    if (err) {
                        next(err);
                    } else {
                        res.send({ status: "OK", completed_in: Date.now() - req.started_at, results: results});
                    }
                });
            }
        }
    });
};

exports.routes.imageandtag.list = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            res.send({ status: "OK", algorithms: ["random", "leastused", "mostused"] });
        }
    });
};

exports.routes.imageandtag.random = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var aggregate = [
                    {$match: {type: "tagging", tag: {$exists: true}, validity: true}},
                    {$group: {_id: {image: "$image", tag: "$tag"}}},
                    {$group: {_id: null, count: {$sum: 1}}}
                ];
                if (req.attached.collection) {
                    if (req.attached.collection.images.length !== 0) {
                        aggregate = _.union([{$match: {image: {$in: req.attached.collection.images}}}], aggregate);
                    } else {
                        res.send({ status: "OK", results: []});
                        return;
                    }
                }
                Action.aggregate(aggregate,
                    function (err, result) {
                        if (err) {
                            next(err);
                        } else {
                            var inputs = [],
                                i,
                                map = function (item, next) {
                                    var aggregate = [
                                        {$match: {type: "tagging", tag: {$exists: true}, validity: true}},
                                        {$group: {_id: {image: "$image", tag: "$tag"}}},
                                        {$skip: Math.floor(result[0].count * Math.random())},
                                        {$limit: 1},
                                        {$project: {_id: false, image: "$_id.image", tag: "$_id.tag"}}
                                    ];
                                    Action.aggregate(aggregate, function (err, results) {
                                        if (err) {
                                            next(err);
                                        } else {
                                            next(undefined, results[0]);
                                        }
                                    });
                                };
                            for (i = 0; i < req.attached.limit; i = i + 1) {
                                inputs.push(i);
                            }
                            async.map(inputs, map,
                                function (err, results) {
                                    if (err) {
                                        next(err);
                                    } else {
                                        res.send({ status: "OK", completed_in: Date.now() - req.started_at, results: results});
                                    }
                                });
                        }
                    });
            }
        }
    });
};

exports.routes.imageandtag.leastused = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var match = [{tagging: {$ne: 0}}],
                    aggregate = [
                        {$sort: {segmentations: 1, image: 1, tag: 1}},
                        {$match: {$and: match}},
                        {$group: {_id: "$image", tag: {$first: "$tag"}, count: {$first: "$segmentations"}}},
                        {$sort: {count: 1}},
                        {$limit: req.attached.limit},
                        {$project: {_id: false, image: "$_id", tag: true, count: true}}
                    ];
                if (req.attached.collection) {
                    if (req.attached.collection.images.length !== 0) {
                        match.push(computeCollectionMatch(req.attached.collection));
                    } else {
                        res.send({ status: "OK", completed_in: Date.now() - req.started_at, results: []});
                        return;
                    }
                }
                ImageSegmentations.aggregate(aggregate,
                    function (err, results) {
                        if (err) {
                            next(err);
                        } else {
                            res.send({ status: "OK", completed_in: Date.now() - req.started_at, results: results});
                        }
                    });
            }
        }
    });
};



exports.routes.imageandtag.mostused = function (req, res, next) {
    res.format({
        html: function () {
            res.send(501, "not Implemented");
        },
        json: function () {
            if (req.errors.length) {
                index.algorithms.json.error(req, res);
            } else {
                var match = [{tagging: {$ne: 0}}],
                    aggregate = [
                        {$sort: {segmentations: -1, image: 1, tag: 1}},
                        {$match: {$and: match}},
                        {$group: {_id: "$image", tag: {$first: "$tag"}, count: {$first: "$segmentations"}}},
                        {$sort: {count: -1}},
                        {$limit: req.attached.limit},
                        {$project: {_id: false, image: "$_id", tag: true, count: true}}
                    ];
                if (req.attached.collection) {
                    if (req.attached.collection.images.length !== 0) {
                        match.push(computeCollectionMatch(req.attached.collection));
                    } else {
                        res.send({ status: "OK", completed_in: Date.now() - req.started_at, results: []});
                        return;
                    }
                }
                ImageSegmentations.aggregate(aggregate,
                    function (err, results) {
                        if (err) {
                            next(err);
                        } else {
                            res.send({ status: "OK", completed_in: Date.now() - req.started_at, results: results});
                        }
                    });
            }
        }
    });
};

/**
 * Query Parameters
 */

exports.query = {
    mandatory: {},
    optional: {},
};
                
exports.query.mandatory.limit = index.query.mandatory.integer("limit", 1, 100);

exports.query.optional.limit = index.query.optional.integer("limit", 1, 100, 1);