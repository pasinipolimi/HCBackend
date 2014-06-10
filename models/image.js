/*jslint node: true, nomen: true, es5: true */
"use strict";

var mongoose = require("mongoose");
var mongooseAI = require("mongoose-auto-increment");

var minId = 0;

var schema = mongoose.Schema({ _id: { type: Number, min: minId, index: { unique: true }, select: false},
                                    mediaLocator: { type: String, trim: true},
                                    width: { type: Number, min: 1},
                                    height: { type: Number, min: 1}
                                }, { id: false});

schema.virtual('id').get(function () { return this._id; });

schema.options.toJSON = {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
};

exports.schema = schema;

schema.plugin(mongooseAI.plugin, { model: 'Image', field: '_id' });

var model = mongoose.model('Image',
                           schema,
                           'Image');

exports.model = model;