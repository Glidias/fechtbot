const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FechtSchema = new Schema(
    {
        channel_id: {
            type: String,
            required: true
        },
        pin_header_id: {
            type: String,
            required: true,
            //default: 0
        },
        latest_footer_id: {
            type: String,
            required: true,
            //default: 0
        },
        latest_body_id: {
            type: String,
            required: true,
            //default: 0
        },
        json: {
            type: String,
            required: true,
            trim: true
        },
        phaseCount: {
            type: Number,
            default: 0
        },
        roundCount: {
            type: Number,
            default: 0
        },
        /*
        lastResolved: {
            type: String
        },
        */
        sides: [{
            type: String,
            required: true,
            trim: true
        }],
        phases: [{
            _id: false,
            name: {
                type: String,
                required: true,
                trim: true,
                default: ""
            },
            reactOnly: {
                type: Number
            },
            reacts: [{
                type: String,
                required: true,
                trim: true
            }],
            dmReacts: [{
                type: String,
                required: true,
                trim: true
            }],
            reactsM: [{
                type: String,
                trim: true,
                default: ""
            }],
            dmReactsM: [{
                type: String,
                trim: true,
                default: ""
            }]
        }],
        /*
        initArray: [{
                type: Schema.Types.ObjectId,
                required: true,
                ref: 'CharacterState'
        }],
        */
        initStep: {
            type: Number,
            get: v => Math.round(v),
            set: v => Math.round(v),
            alias: 'i',
            default: 0
        },
        totalUsers: {
            type: Number,
            default: 0
        },
        users: {
            type: Map,
            of: {
                type: Number
            }
        }
    },
    {
        timestamps: {
            createdAt: 'created_at'
        }
    }
);


const Fecht = mongoose.model('Fecht', FechtSchema);

module.exports = { Fecht };
